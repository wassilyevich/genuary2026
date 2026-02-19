#version 300 es
precision highp float;

in vec2 a;
out vec2 u;

void main() {
    u = a * 2. - 1.;
    gl_Position = vec4(u, 0, 1);
}
