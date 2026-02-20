const canvasSketch = require("canvas-sketch");
const math = require("canvas-sketch-util/math");
const random = require("canvas-sketch-util/random");
const createRegl = require("regl");

const settings = {
    context: "webgl",
    animate: true,
    dimensions: [2048, 2048],
    scaleToView: true,
};

const params = {
    ruleSetR: "B3/S4",
    ruleSetG: "B3/S34678",
    ruleSetB: "B3/S23",
    dimFact: 1,
    simHz: 30,
    seed: 0.123,
    margin: 20,
    rows: 250,
    cols: 250,
    dotRadius: 1,
    threshVal1: 0.5,
    threshVal2: 0.5,
    threshVal3: 0.5,
};
let didResetForExport = false;
const sketch = ({ canvas, gl, width, height, stop, render, play }) => {
    // EXPORTING AND STUFF

    window.addEventListener("keydown", (event) => {
        if (event.key === "r") {
            stop();
            resetAll();
            render();
            play();
        }
    });

    const resetAll = () => {
        acc = 0;
        lastTime = 0;
        firstFrame = true;
        grid.reset();

        // maak paintCanvas black
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.fillStyle = "black";
        pctx.fillRect(0, 0, simW, simH);

        // teken meteen je seed (grid) één keer
        grid.cells.forEach((cell) => {
            cell.evalState();
            cell.draw(pctx);
        });

        // upload input texture
        paintTex.subimage(paintCanvas);

        // seed sim-state met dezelfde canvas
        ping.color[0].subimage(paintCanvas);
        pong.color[0].subimage(paintCanvas);
    };
    const resetPaint = () => {
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.fillStyle = "rgba(0,0,0,1)";
        pctx.fillRect(0, 0, simW, simH);
        paintTex.subimage(paintCanvas);
    };

    const regl = createRegl({ gl });

    // ---- SIM DIMENSIONS (aantal cellen) ----
    const simW = Math.floor(width / params.dimFact);
    const simH = Math.floor(height / params.dimFact);
    const simHz = params.simHz;
    let acc = 0;
    let lastTime = 0;
    const makeFBO = () =>
        regl.framebuffer({
            color: regl.texture({
                width: simW,
                height: simH,
                // Game of Life: geen interpolatie
                min: "nearest",
                mag: "nearest",
                // torus wrap
                wrap: "repeat",
                // 8-bit is prima voor 0/1 state
                format: "rgba",
                type: "uint8",
                flipY: true,
            }),
            depth: false,
            stencil: false,
        });

    let ping = makeFBO();
    let pong = makeFBO();

    //  PAINT  CANVAS
    const paintCanvas = document.createElement("canvas");
    paintCanvas.width = simW;
    paintCanvas.height = simH;
    const pctx = paintCanvas.getContext("2d");
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.imageSmoothingEnabled = false;
    // POSITIONING
    var drawWidth = simW - 2 * params.margin;
    var drawHeight = simH - 2 * params.margin;
    var rows = params.rows;
    var cols = params.cols;
    var cellWidth = drawWidth / cols;
    var cellHeight = cellWidth;
    drawHeight = rows * cellHeight;
    var origin = { x: params.margin, y: (simH - drawHeight) / 2 };
    const grid = new Grid(rows, cols, cellWidth, cellHeight, origin, 1);

    // GPU texture
    const paintTex = regl.texture({
        width: simW,
        height: simH,
        format: "rgba",
        type: "uint8",
        min: "nearest",
        mag: "nearest",
        wrap: "clamp",
        flipY: true,
    });
    // Fullscreen triangle
    const vert = `
    precision highp float;
    attribute vec2 position;
    varying vec2 vUv;
    void main () {
      vUv = 0.5 * (position + 1.0);
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

    const fullscreen = {
        attributes: {
            position: [-1, -1, 3, -1, -1, 3],
        },
        count: 3,
    };

    // --- Seed shader: random init (0/1)
    const seedFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform float uSeed;

    // simpele hash noise
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    void main () {
      float r = hash(vUv * 1000.0 + uSeed);
      float alive = step(0.5, r); // 50% kans
      gl_FragColor = vec4(alive, 0.0, 0.0, 1.0);
    }
  `;

    const seedPass = regl({
        vert,
        frag: seedFrag,
        ...fullscreen,
        uniforms: {
            uSeed: (_, props) => props.seed,
        },
        framebuffer: (_, props) => props.fbo,
    });

    // --- Life update shader
    const lifeFrag = `
   precision highp float;
varying vec2 vUv;
uniform sampler2D uPrev;
uniform sampler2D uPaint;
uniform vec2 uTexel;
uniform float uBirthMaskR, uBirthMaskG, uBirthMaskB;
uniform float uSurviveMaskR, uSurviveMaskG, uSurviveMaskB;

float hasBit(float mask, float n){
  float p = pow(2.0, n);
  return step(0.5, mod(floor(mask/p), 2.0));
}

void main () {
  vec2 uv = vUv;

  vec4 p = texture2D(uPrev, uv);
  float aR = step(0.5, p.r);
  float aG = step(0.5, p.g);
  float aB = step(0.5, p.b);
  float inkR = step(0.5, texture2D(uPaint, uv).r);
  float inkG = step(0.5, texture2D(uPaint, uv).g);
  float inkB = step(0.5, texture2D(uPaint, uv).b);


  vec2 t = uTexel;

  vec4 n00 = texture2D(uPrev, uv + t * vec2(-1.0, -1.0));
  vec4 n10 = texture2D(uPrev, uv + t * vec2( 0.0, -1.0));
  vec4 n20 = texture2D(uPrev, uv + t * vec2( 1.0, -1.0));

  vec4 n01 = texture2D(uPrev, uv + t * vec2(-1.0,  0.0));
  vec4 n21 = texture2D(uPrev, uv + t * vec2( 1.0,  0.0));

  vec4 n02 = texture2D(uPrev, uv + t * vec2(-1.0,  1.0));
  vec4 n12 = texture2D(uPrev, uv + t * vec2( 0.0,  1.0));
  vec4 n22 = texture2D(uPrev, uv + t * vec2( 1.0,  1.0));

  float nR = 0.0;
  nR += step(0.5, n00.r); nR += step(0.5, n10.r); nR += step(0.5, n20.r);
  nR += step(0.5, n01.r);                         nR += step(0.5, n21.r);
  nR += step(0.5, n02.r); nR += step(0.5, n12.r); nR += step(0.5, n22.r);

  float nG = 0.0;
  nG += step(0.5, n00.g); nG += step(0.5, n10.g); nG += step(0.5, n20.g);
  nG += step(0.5, n01.g);                         nG += step(0.5, n21.g);
  nG += step(0.5, n02.g); nG += step(0.5, n12.g); nG += step(0.5, n22.g);

  float nB = 0.0;
  nB += step(0.5, n00.b); nB += step(0.5, n10.b); nB += step(0.5, n20.b);
  nB += step(0.5, n01.b);                         nB += step(0.5, n21.b);
  nB += step(0.5, n02.b); nB += step(0.5, n12.b); nB += step(0.5, n22.b);

  float bornR = (1.0 - aR) * hasBit(uBirthMaskR, nR);
  float bornG = (1.0 - aG) * hasBit(uBirthMaskG, nG);
  float bornB = (1.0 - aB) * hasBit(uBirthMaskB, nB);

  float surviveR = aR * hasBit(uSurviveMaskR, nR);
  float surviveG = aG * hasBit(uSurviveMaskG, nG);
  float surviveB = aB * hasBit(uSurviveMaskB, nB);

vec3 next = clamp(vec3(bornR + surviveR, bornG + surviveG, bornB + surviveB), 0.0, 1.0);

// middenweg: ink forceert leven, maar beïnvloedt niet de buurcount
next = max(next, vec3(inkR, inkG, inkB));

gl_FragColor = vec4(next, 1.0);
}    `;

    const ruleStateR = parseRule(params.ruleSetR);
    const ruleStateG = parseRule(params.ruleSetG);
    const ruleStateB = parseRule(params.ruleSetB);

    const updatePass = regl({
        vert,
        frag: lifeFrag,
        ...fullscreen,
        uniforms: {
            uPrev: (_, props) => props.prev,
            uPaint: () => paintTex,
            uTexel: [1 / simW, 1 / simH],
            uBirthMaskR: () => ruleStateR.birthMask,
            uBirthMaskG: () => ruleStateG.birthMask,
            uBirthMaskB: () => ruleStateB.birthMask,
            uSurviveMaskR: () => ruleStateR.surviveMask,
            uSurviveMaskG: () => ruleStateG.surviveMask,
            uSurviveMaskB: () => ruleStateB.surviveMask,
        },
        framebuffer: (_, props) => props.next,
    });

    // --- Draw shader (toon state)
    const drawFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;

    uniform vec3 uColR;
uniform vec3 uColG;
uniform vec3 uColB;
uniform vec3 uColOverlap; // highlight bij overlap
uniform float uOverlapStrength;

    void main () {
      vec3 s = texture2D(uTex, vUv).rgb; // states

  // basis palette mix
  vec3 col = s.r * uColR + s.g * uColG + s.b * uColB;

  // overlap detect: als meer dan 1 kanaal "aan" is
  float overlap = step(1.5, s.r + s.g + s.b); // 2 of 3 kanalen aan
  col += uOverlapStrength * overlap * uColOverlap;

  // clamp & lichte contrast
  col = clamp(col, 0.0, 1.0);
  col = smoothstep(vec3(0.0), vec3(1.0), col);

  gl_FragColor = vec4(col, 1.0);
    }
  `;

    const drawPass = regl({
        vert,
        frag: drawFrag,
        ...fullscreen,
        uniforms: {
            uTex: (_, props) => props.tex,
            uColR: [
                0.9647058823529412, 0.6823529411764706, 0.17647058823529413,
            ],
            uColG: [
                0.9490196078431372, 0.39215686274509803, 0.09803921568627451,
            ],
            uColB: [0.2, 0.396078431372549, 0.396078431372549],
            uColOverlap: [1.0, 1.0, 1.0],
            uOverlapStrength: 0.4,
        },
    });

    // --- input / controls
    let paused = false;
    let stepOnce = false;

    let firstFrame = true;
    // init clear
    regl.clear({ color: [0, 0, 0, 1], framebuffer: ping });
    regl.clear({ color: [0, 0, 0, 1], framebuffer: pong });

    return {
        render({ time, frame, exporting, recording }) {
            const isCapturing = exporting || recording;

            if (isCapturing && frame === 0 && !didResetForExport) {
                resetAll({ time });
                didResetForExport = true;
                acc = 0;
                lastTime = 0;
            }

            if (!isCapturing && didResetForExport) {
                didResetForExport = false;
            } // (re)seed
            if (firstFrame) {
                ping.color[0].subimage(paintCanvas);
                pong.color[0].subimage(paintCanvas);
                pctx.clearRect(0, 0, simW, simH);
                pctx.fillStyle = "black";
                pctx.fillRect(0, 0, simW, simH);
                paintTex.subimage(paintCanvas);
                firstFrame = false;
            }

            if (lastTime === 0) {
                lastTime = time;
            }
            const dt = time - lastTime;
            lastTime = time;

            acc += dt;
            const stepDt = 1 / simHz;

            // 2D canvas “per frame” tekenen
            pctx.setTransform(1, 0, 0, 1, 0, 0);

            // voorbeeld: fade trails op input

            // Update/set values of internal functions
            grid.cells.forEach((cell) => {
                let val1 = sin(
                    cell.row * cell.col,
                    sin(time, 1, 0.01, 0.1 * time),
                    0.02,
                    0.8 * time,
                );
                let val2 = sin(
                    (cell.row / cell.col) * frame,
                    1,
                    0.01,
                    0.9 * time,
                );
                let val3 = sin(
                    (cell.col / cell.row) * frame,
                    1,
                    0.02,
                    0.8 * time,
                );
                cell.setVals([val1, val2, val3]);
                cell.evalState();
                cell.draw(pctx);
            });
            paintTex.subimage(paintCanvas);
            const doUpdate = !paused || stepOnce;
            if (doUpdate) {
                while (acc >= stepDt) {
                    updatePass({ prev: ping.color[0], next: pong });
                    // swap
                    const tmp = ping;
                    ping = pong;
                    pong = tmp;
                    stepOnce = false;
                    acc -= stepDt;
                }
            }

            // draw to screen
            regl.clear({ color: [0, 0, 0, 1] });
            drawPass({ tex: ping.color[0] });
        },
        unload() {
            ping.destroy();
            pong.destroy();
            regl.destroy();
        },
    };
};

canvasSketch(sketch, settings);

// FUNCTION
function parseRule(rule = "B3/S23") {
    const r = rule.toUpperCase().replace(/\s+/g, "");
    const [bPart, sPart] = r.split("/");
    const births = (bPart.match(/\d/g) || []).map(Number);
    const survives = (sPart.match(/\d/g) || []).map(Number);

    const toMask = (arr) => arr.reduce((m, k) => m | (1 << k), 0);
    return { birthMask: toMask(births), surviveMask: toMask(survives) };
}

// Grid class
class Grid {
    constructor(rows, cols, cellWidth, cellHeight, origin, id) {
        this.rows = rows;
        this.cols = cols;
        this.cellWidth = cellWidth;
        this.cellHeight = cellHeight;
        this.origin = origin;
        this.id = id;
        this.cells = [];
        this.init();
    }

    init() {
        let count = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                this.cells.push(
                    new Cell(
                        row,
                        col,
                        this.cellWidth,
                        this.cellHeight,
                        this.origin,
                        count,
                    ),
                );
                count++;
            }
        }
    }

    drawCells(context) {
        this.cells.forEach((cell) => {
            cell.draw(context);
        });
    }

    setVals(vals) {
        this.cells.forEach((cell) => {
            cell.setVals(vals);
        });
    }

    reset() {
        this.cells.forEach((cell) => {
            cell.reset();
        });
    }
}

class Cell {
    constructor(row, col, cellWidth, cellHeight, origin, id) {
        this.row = row;
        this.col = col;
        this.cellWidth = cellWidth;
        this.cellHeight = cellHeight;
        this.origin = origin;
        this.id = id;
        this.cellCorner = {
            x: origin.x + col * cellWidth,
            y: origin.y + row * cellWidth,
        };
        this.cellCenter = {
            x: origin.x + col * cellWidth + cellWidth / 2,
            y: origin.y + row * cellWidth + cellHeight / 2,
        };
        this.vals = [];
        this.state = [];
        this.colors = ["red", "green", "blue"];
    }

    reset() {
        this.vals = [];
        this.state = [];
    }

    draw(context) {
        if (this.states[0] && this.states[1]) {
            context.fillStyle = this.colors[0];
        } else if (xor(this.states[0], this.states[1])) {
            context.fillStyle = this.colors[1];
        } else if (xor(this.states[2], this.states[1])) {
            context.fillStyle = this.colors[2];
        } else {
            context.fillStyle = "black";
        }

        context.beginPath();
        context.arc(
            this.cellCenter.x,
            this.cellCenter.y,
            params.dotRadius,
            0,
            Math.PI * 2,
        );
        context.fill();
    }

    setVals(vals) {
        this.vals = vals;
    }

    evalState() {
        let state1 = toBool(this.vals[0], params.threshVal1, true);
        let state2 = toBool(this.vals[1], params.threshVal2, true);
        let state3 = toBool(this.vals[2], params.threshVal3, true);
        this.states = [state1, state2, state3];
    }
}

// Functions

// SIN
function sin(t, a, b, phi) {
    return a * Math.sin(b * t + phi);
}

function noise(t, a, b, phi) {
    return random.noise1D(t + phi, b, a);
}

function noise_2d(t, y, a, b, phi) {
    return random.noise2D(t + phi, y, b, a);
}

function toBool(val, thresh, abs) {
    if (!abs) {
        return val > thresh ? true : false;
    } else {
        if (val > thresh || val < -thresh) {
            return true;
        } else {
            return false;
        }
    }
}

function xor(a, b) {
    return a !== b;
}
