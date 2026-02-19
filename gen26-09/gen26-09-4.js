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
    ruleSetR: "B3/S23",
    ruleSetG: "B36/S345",
    ruleSetB: "B3678/S34678",
    dimFact: 1,
    simHz: 30,
    seed: 0.123,
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
        ping.color[0].subimage(seedCanvas);
        pong.color[0].subimage(seedCanvas);
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

    //  OFFSCREEN CANVAS
    const seedCanvas = document.createElement("canvas");
    seedCanvas.width = simW;
    seedCanvas.height = simH;
    const sctx = seedCanvas.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = "black";
    sctx.fillRect(0, 0, simW, simH);
    const fontSize = Math.floor(simH * 0.18);
    sctx.font = `${fontSize}px monospace`;
    const cx = simW * 0.15;
    const spacing = simH * 0.28;
    sctx.fillStyle = "rgb(0,0,255)";
    sctx.fillText("GENUARY", cx, simH * 0.3);
    sctx.fillStyle = "rgb(0,0,255)";
    sctx.fillText("2026", 2 * cx, simH * 0.3 + 2 * spacing);
    sctx.font = `${fontSize * 0.5}px monospace`;
    sctx.fillStyle = "rgb(0,255,0)";
    sctx.fillText("CRAZY AUTOMATA", cx, simH * 0.3 + spacing);
    let origin = { x: 0, y: 0 };
    let nr = 10;
    let nc = 10;
    let cellWidth = simW / nc;
    let cellHeight = simH / nr;
    const grid = new Grid(origin, nr, nc, cellWidth, cellHeight);
    grid.draw(sctx, "red", 1);

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

    void main () {
      vec3 v = texture2D(uTex, vUv).rgb;
      gl_FragColor = vec4(v,  1.0);
    }
  `;

    const drawPass = regl({
        vert,
        frag: drawFrag,
        ...fullscreen,
        uniforms: { uTex: (_, props) => props.tex },
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
                console.log(seedCanvas.width, seedCanvas.height, simW, simH);
                ping.color[0].subimage(seedCanvas);
                pong.color[0].subimage(seedCanvas);
                firstFrame = false;
            }

            if (lastTime === 0) {
                lastTime = time;
            }
            const dt = time - lastTime;
            lastTime = time;

            acc += dt;
            const stepDt = 1 / simHz;

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

class Grid {
    constructor(origin, nr, nc, cellWidth, cellHeight) {
        this.origin = origin;
        this.nr = nr;
        this.nc = nc;
        this.cellWidth = cellWidth;
        this.cellHeight = cellHeight;
    }

    draw(context, strokeStyle, lw) {
        for (let i = 0; i < this.nr; i++) {
            for (let j = 0; j < this.nc; j++) {
                context.strokeStyle = strokeStyle;
                context.lineWidth = lw;
                context.strokeRect(
                    this.origin.x + i * this.cellWidth,
                    this.origin.y + j * this.cellHeight,
                    this.cellWidth,
                    this.cellHeight,
                );
            }
        }
    }
}
