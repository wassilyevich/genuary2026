const canvasSketch = require("canvas-sketch");
const createRegl = require("regl");

const settings = {
  context: "webgl",
  animate: true,
  dimensions: [2048, 2048],
};

const sketch = ({ canvas, gl, width, height }) => {
  const regl = createRegl({ gl });

  // Kies een resolutie voor je sim (mag lager dan scherm)
  const simW = width / 2;
  const simH = height / 2;

  const makeFBO = () =>
    regl.framebuffer({
      color: regl.texture({
        width: simW,
        height: simH,
        wrap: "repeat",
        min: "linear",
        mag: "linear",
      }),
      depth: false,
      stencil: false,
    });

  let ping = makeFBO();
  let pong = makeFBO();

  // Fullscreen triangle (geen vertex buffer nodig)
  const vert = `
    precision highp float;
    attribute vec2 position;
    varying vec2 vUv;
    void main () {
      vUv = 0.5 * (position + 1.0);
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  // Update pass: feedback (prev) -> next (pong), plus cirkel-injectie
  const updateFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uPrev;
    uniform vec2 uInjectPos;  // in [0..1]
    uniform float uRadius;    // in uv units
    uniform float uTime;
    uniform vec2 uTexel;      // 1.0 / simSize

    float circle(vec2 uv, vec2 c, float r) {
      float d = length(uv - c);
      // zachte rand
      return 1.0 - smoothstep(r, r * 1.1, d);
    }

    void main () {
      vec2 uv = vUv;

      // ---- FEEDBACK: sample vorige frame met kleine offset + decay ----
      vec2 drift = vec2(
        sin(uTime * 0.7),
        cos(uTime * 0.6)
      ) * (2.0 * uTexel); // paar pixels verschuiving

      vec4 prev = texture2D(uPrev, uv + drift);

      // decay: langzaam uitdoven
      prev *= 0.985;

      // optioneel: heel lichte "smear" door extra samples te mixen
      vec4 blur =
        0.25 * texture2D(uPrev, uv + vec2( 1.0, 0.0) * uTexel) +
        0.25 * texture2D(uPrev, uv + vec2(-1.0, 0.0) * uTexel) +
        0.25 * texture2D(uPrev, uv + vec2( 0.0, 1.0) * uTexel) +
        0.25 * texture2D(uPrev, uv + vec2( 0.0,-1.0) * uTexel);

      vec4 state = mix(prev, blur, 0.08);

      // ---- INJECTIE: teken cirkel in de state ----
      float ink = circle(uv, uInjectPos, uRadius);
      // schrijf in R-kanaal (grijswaarden is genoeg)
      state.r = max(state.r, ink);

      gl_FragColor = state;
    }
  `;

  // Draw pass: toon texture op scherm (met simpele tonemap/contrast)
  const drawFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;

    void main () {
      float v = texture2D(uTex, vUv).r;
      // beetje contrast
      v = smoothstep(0.0, 1.0, v);
      gl_FragColor = vec4(vec3(v), 1.0);
    }
  `;

  const fullscreen = {
    attributes: {
      position: [-1, -1, 3, -1, -1, 3],
    },
    count: 3,
  };

  // muis (injectiepositie)
  let injectPos = [0.5, 0.5];
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1.0 - (e.clientY - r.top) / r.height;
    injectPos = [x, y];
  });

  const updatePass = regl({
    vert,
    frag: updateFrag,
    ...fullscreen,
    uniforms: {
      uPrev: (_, props) => props.prev,
      uInjectPos: () => injectPos,
      uRadius: 0.04,
      uTime: ({ time }) => time,
      uTexel: [1 / simW, 1 / simH],
    },
    framebuffer: (_, props) => props.next,
  });

  const drawPass = regl({
    vert,
    frag: drawFrag,
    ...fullscreen,
    uniforms: {
      uTex: (_, props) => props.tex,
    },
  });

  // init: clear FBOs
  regl.clear({ color: [0, 0, 0, 1], framebuffer: ping });
  regl.clear({ color: [0, 0, 0, 1], framebuffer: pong });

  return {
    render({ time }) {
      // 1) update: ping -> pong
      updatePass({ prev: ping.color[0], next: pong });

      // 2) draw pong to screen
      regl.clear({ color: [0, 0, 0, 1] });
      drawPass({ tex: pong.color[0] });

      // 3) swap
      const tmp = ping;
      ping = pong;
      pong = tmp;
    },
    unload() {
      ping.destroy();
      pong.destroy();
      regl.destroy();
    },
  };
};

canvasSketch(sketch, settings);
