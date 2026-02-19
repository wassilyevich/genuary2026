#version 300 es
precision highp float;

in vec2 u;
out vec4 cc;
uniform vec2 res;
uniform float time;

const float MAX_DIST = 100.;
const float SURF_DIST = .01;

float box(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float xdonut(vec3 p, float r0, float r1) {
    p.y = abs(p.y - 2.) - 2.;
    return length(vec2(length(p.xz) - r0, p.y)) - r1;
}

float cube(vec3 p) {
    return box(p - vec3(0, -5, 0), vec3(5)) - 0.3;
}

float df(vec3 p, float t) {
    const vec3 centre = vec3(0., 3., 0.);
    const float radius = 3.0;
    float xdon = abs(xdonut(p - centre, 3.0, 2.0)) - 0.2;
    float sphr = abs(xdonut(p.yxz - centre.yxz, 3.0, 2.0)) - 0.2;
    float bb = cube(p);
    return min(max(sphr, xdon), bb);
    return bb;
}

float intersect(vec3 ro, vec3 rd, float ti) {
    for (float t = 0.; t < MAX_DIST; ) {
        float h = df(ro + t * rd, ti);
        t += h;
        if (h < SURF_DIST) return t;
    }
    return MAX_DIST;
}

vec3 normal(vec3 p, float t) {
    const float h = 0.001;
    const vec2 k = vec2(1, -1);
    return normalize(k.xyy * df(p + k.xyy * h, t) +
            k.yyx * df(p + k.yyx * h, t) +
            k.yxy * df(p + k.yxy * h, t) +
            k.xxx * df(p + k.xxx * h, t));
}

vec3 pix(vec2 uv, float t) {
    const vec3 camera_pos = vec3(-15, 15, -20);
    const vec3 look_at = vec3(0, 3, 0);
    const float zoom = 2.5;

    const vec3 fwd = normalize(look_at - camera_pos);
    const vec3 right = normalize(cross(vec3(0, 1, 0), fwd));
    const vec3 up = cross(fwd, right);

    vec3 rd = normalize(uv.x * right + uv.y * up + zoom * fwd);

    float d = intersect(camera_pos, rd, t);
    vec3 p = camera_pos + rd * d;

    vec3 n = normal(p, t);
    const vec3 light_pos = vec3(-15, 30, -5);
    vec3 light_dir = normalize(light_pos - p);

    float diffuse = max(0., dot(n, light_dir));

    float cub = step(SURF_DIST, cube(p));
    vec3 col = mix(vec3(1., .4, .2), vec3(0.4, 0.2, 0.9), cub);

    return vec3(diffuse * col);
}

void main() {
    vec2 uv = u;
    vec3 col = pix(uv, time);
    cc = vec4(pow(clamp(col, 0., 1.), vec3(1. / 2.2)), 1.);
}
