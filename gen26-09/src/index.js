import srcVert from "./shaders/vShader.vert.glsl?raw";
import srcFrag from "./shaders/fShader.frag.glsl?raw";

// ---------- Canvas + WebGL2 context ----------
const canvas = document.createElement("canvas");
document.body.appendChild(canvas);

const gl = canvas.getContext("webgl2", { antialias: true });
if (!gl) {
  throw new Error("WebGL2 not supported in this browser/device.");
}

// ---------- Helpers ----------
function compileShader(gl, type, source, label = "shader") {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`Failed to create ${label}.`);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!ok) {
    const log = gl.getShaderInfoLog(shader) || "(no log)";
    console.error(
      `❌ ${label} compile failed:\n${log}\n--- source ---\n${source}`,
    );
    gl.deleteShader(shader);
    throw new Error(`${label} compile failed`);
  }
  return shader;
}

function createProgram(gl, vertSource, fragSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSource, "vertex shader");
  const fs = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragSource,
    "fragment shader",
  );

  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program.");

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  // shaders can be deleted after linking
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const ok = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!ok) {
    const log = gl.getProgramInfoLog(program) || "(no log)";
    gl.deleteProgram(program);
    throw new Error(`❌ Program link failed:\n${log}`);
  }

  return program;
}

// ---------- Program setup ----------
const program = createProgram(gl, srcVert, srcFrag);
gl.useProgram(program);

// Uniforms
const locRes = gl.getUniformLocation(program, "res");
const locTime = gl.getUniformLocation(program, "time");
if (!locRes) console.warn("Uniform 'res' not found (or optimized out).");
if (!locTime) console.warn("Uniform 'time' not found (or optimized out).");

// Fullscreen quad attribute "a"
const locA = gl.getAttribLocation(program, "a");
if (locA < 0) throw new Error("Attribute 'a' not found in vertex shader.");

const quad = new Float32Array([0, 1, 0, 0, 1, 1, 1, 0]);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

gl.enableVertexAttribArray(locA);
gl.vertexAttribPointer(locA, 2, gl.FLOAT, false, 0, 0);

// ---------- Resize ----------
let M = 1; // resolution multiplier
let resx = 1;
let resy = 1;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  resx = Math.max(1, Math.floor(M * w * dpr));
  resy = Math.max(1, Math.floor(M * h * dpr));

  canvas.width = resx;
  canvas.height = resy;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  gl.viewport(0, 0, resx, resy);
}

// Debounced resize
let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    resize();
  }, 150);
});

// ---------- Render loop ----------
let running = true;

window.addEventListener("keyup", (e) => {
  if (e.key === " ") running = !running;
});

function frame() {
  if (running) {
    const t = performance.now() * 0.001;

    if (locTime) gl.uniform1f(locTime, t);
    if (locRes) gl.uniform2f(locRes, resx, resy);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  requestAnimationFrame(frame);
}

// Start
resize();
requestAnimationFrame(frame);
