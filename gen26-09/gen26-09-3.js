const canvasSketch = require("canvas-sketch");
const math = require("canvas-sketch-util/math");
const random = require("canvas-sketch-util/random");
const createRegl = require("regl");

const settings = {
    context: "webgl",
    animate: true,
    dimensions: [2048, 2048],
};

const sketch = ({ canvas, gl, width, height }) => {
    const regl = createRegl({ gl });

    // ---- SIM DIMENSIONS (aantal cellen) ----
    const simW = width / 2;
    const simH = height / 2;

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

    // brush (tekenen)
    uniform vec2 uBrushPos;     // uv
    uniform float uBrushDown;   // 0/1
    uniform float uBrushRadius; // uv units

    float cell(vec2 uv) {
      // state zit in R kanaal, threshold op 0.5
      return step(0.5, texture2D(uPrev, uv).r);
    }

    float circle(vec2 uv, vec2 c, float r) {
      float d = length(uv - c);
      return 1.0 - smoothstep(r, r * 1.1, d);
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

      // GoL regels (zonder float-equality issues)
      float born    = (1.0 - alive) * step(2.5, n) * (1.0 - step(3.5, n)); // n in [3]
      float survive = alive * step(1.5, n) * (1.0 - step(3.5, n));         // n in [2..3]
      float nextAlive = clamp(born + survive, 0.0, 1.0);

      // brush: voeg levende cellen toe
      float ink = circle(uv, uBrushPos, uBrushRadius) * uBrushDown;
      nextAlive = max(nextAlive, step(0.5, ink));

      gl_FragColor = vec4(nextAlive, 0.0, 0.0, 1.0);
    }
  `;

    const updatePass = regl({
        vert,
        frag: lifeFrag,
        ...fullscreen,
        uniforms: {
            uPrev: (_, props) => props.prev,
            uTexel: [1 / simW, 1 / simH],
            uBrushPos: () => brushPos,
            uBrushDown: () => (brushDown ? 1 : 0),
            uBrushRadius: () => brushRadius,
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

    let brushDown = false;
    let brushPos = [0.5, 0.5];
    let brushRadius = 0.015; // in uv (dus relatief)

    const setBrushFromEvent = (e) => {
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = 1.0 - (e.clientY - r.top) / r.height;
        brushPos = [x, y];
    };

    canvas.addEventListener("mousedown", (e) => {
        brushDown = true;
        setBrushFromEvent(e);
    });
    window.addEventListener("mouseup", () => (brushDown = false));
    canvas.addEventListener("mousemove", setBrushFromEvent);

    window.addEventListener("keydown", (e) => {
        if (e.key === " ") paused = !paused; // pause
        if (e.key === "s") stepOnce = true; // single step
        if (e.key === "r") randomize = true; // reset random
        if (e.key === "[") brushRadius *= 0.8; // smaller
        if (e.key === "]") brushRadius *= 1.25; // bigger
    });

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

            const doUpdate = !paused || stepOnce;
            if (doUpdate) {
                updatePass({ prev: ping.color[0], next: pong });
                // swap
                const tmp = ping;
                ping = pong;
                pong = tmp;
                stepOnce = false;
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
