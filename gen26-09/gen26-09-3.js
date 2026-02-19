const canvasSketch = require("canvas-sketch");
const math = require("canvas-sketch-util/math");
const random = require("canvas-sketch-util/random");
const createRegl = require("regl");

const settings = {
    context: "webgl",
    animate: true,
    dimensions: [2048, 2048],
};

const params = {
    ruleSet: "B3678/S34678",
    dimFact: 1,
    simHz: 30,
};
const sketch = ({ canvas, gl, width, height }) => {
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
            }),
            depth: false,
            stencil: false,
        });

    let ping = makeFBO();
    let pong = makeFBO();

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
    uniform float uTime;

    // simpele hash noise
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    void main () {
      float r = hash(vUv * 1000.0 + uTime);
      float alive = step(0.5, r); // 50% kans
      gl_FragColor = vec4(alive, 0.0, 0.0, 1.0);
    }
  `;

    const seedPass = regl({
        vert,
        frag: seedFrag,
        ...fullscreen,
        uniforms: { uTime: ({ time }) => time },
        framebuffer: (_, props) => props.fbo,
    });

    // --- Life update shader
    const lifeFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uPrev;
    uniform vec2 uTexel;
    uniform float uBirthMask;
    uniform float uSurviveMask;

    float cell(vec2 uv) {
      // state zit in R kanaal, threshold op 0.5
      return step(0.5, texture2D(uPrev, uv).r);
    }
    
    float hasBit(float mask, float n){
        float p = pow(2.0, n);
        return step(0.5, mod(floor(mask/p), 2.0));
    }

    void main () {
      vec2 uv = vUv;

      // tel 8 buren
      float n = 0.0;
      n += cell(uv + uTexel * vec2(-1.0, -1.0));
      n += cell(uv + uTexel * vec2( 0.0, -1.0));
      n += cell(uv + uTexel * vec2( 1.0, -1.0));
      n += cell(uv + uTexel * vec2(-1.0,  0.0));
      n += cell(uv + uTexel * vec2( 1.0,  0.0));
      n += cell(uv + uTexel * vec2(-1.0,  1.0));
      n += cell(uv + uTexel * vec2( 0.0,  1.0));
      n += cell(uv + uTexel * vec2( 1.0,  1.0));

      float alive = cell(uv);

     float born    = (1.0 - alive) * hasBit(uBirthMask, n);
     float survive = alive * hasBit(uSurviveMask, n);
     float nextAlive = clamp(born + survive, 0.0, 1.0);
     gl_FragColor = vec4(nextAlive, 0.0, 0.0, 1.0);
    }
  `;

    const ruleState = parseRule(params.ruleSet);
    const updatePass = regl({
        vert,
        frag: lifeFrag,
        ...fullscreen,
        uniforms: {
            uPrev: (_, props) => props.prev,
            uTexel: [1 / simW, 1 / simH],
            uBirthMask: () => ruleState.birthMask,
            uSurviveMask: () => ruleState.surviveMask,
        },
        framebuffer: (_, props) => props.next,
    });

    // --- Draw shader (toon state)
    const drawFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;

    void main () {
      float v = texture2D(uTex, vUv).r;
      gl_FragColor = vec4(vec3(v), 1.0);
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

    let randomize = true;
    // init clear
    regl.clear({ color: [0, 0, 0, 1], framebuffer: ping });
    regl.clear({ color: [0, 0, 0, 1], framebuffer: pong });

    return {
        render({ time }) {
            // (re)seed
            if (randomize) {
                seedPass({ fbo: ping });
                seedPass({ fbo: pong });
                randomize = false;
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
