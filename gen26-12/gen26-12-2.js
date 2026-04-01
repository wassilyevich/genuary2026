const canvasSketch = require("canvas-sketch");
const math = require("canvas-sketch-util/math");
const random = require("canvas-sketch-util/random");
const vector = require("./vector");
const settings = {
    dimensions: [2048, 2048],
};

const params = {
    n: 4,
    zCube: 10,
};

const sketch = ({ width, height }) => {
    // PRECOMUTATIONS
    // Define Cube vertices
    const zC = params.zCube;
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: zC, y: 0, z: 0 };
    const p3 = { x: zC, y: zC, z: 0 };
    const p4 = { x: 0, y: zC, z: 0 };
    const p5 = { x: 0, y: 0, z: zC };
    const p6 = { x: zC, y: 0, z: zC };
    const p7 = { x: zC, y: zC, z: zC };
    const p8 = { x: 0, y: zC, z: zC };
    const plane1 = new Rectangle([p1, p2, p3, p4]);
    const plane2 = new Rectangle([p5, p6, p7, p8]);
    const plane3 = new Rectangle([p1, p2, p6, p5]);
    const plane4 = new Rectangle([p4, p3, p7, p8]);
    const plane5 = new Rectangle([p1, p5, p8, p4]);
    const plane6 = new Rectangle([p2, p6, p7, p3]);

    const cameraPosition = { x: 0, y: 0, z: -10 };
    const cameraDirection = { x: 0, y: 0, z: 1 };
    const camera = new Camera(cameraPosition, cameraDirection);

    const vP1 = { x: 10, y: 10, z: -4 };
    const vP2 = { x: 10, y: -10, z: -4 };
    const vP3 = { x: -10, y: -10, z: -4 };
    const vP4 = { x: -10, y: 10, z: -4 };
    const viewPlane = new Rectangle([vP1, vP2, vP3, vP4]);

    // Debugging

    // Actual rendering
    return ({ context, width, height }) => {
        context.fillStyle = "white";
        context.fillRect(0, 0, width, height);
    };
};

canvasSketch(sketch, settings);

// CLASSES
class Vertex {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

class Edge {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
    }
}

class Rectangle {
    constructor(vertices) {
        if (vertices.length != 4) {
            console.error(
                `Trying to create Rectangle with ${vertices.length} vertices! Should be 4.`,
            );
        }
        this.vertices = vertices;
        this.edges = [];
        this.normal = {};
        this.bounds = {};
        this.isPlanar = [];
        this.init();
    }
    init() {
        this.checkPlanar();
        this.makeEdges();
    }

    checkPlanar() {
        const error = 0.01;
        const v1 = {
            x: this.vertices[1].x - this.vertices[0].x,
            y: this.vertices[1].y - this.vertices[0].y,
            z: this.vertices[1].z - this.vertices[0].z,
        };
        const v2 = {
            x: this.vertices[2].x - this.vertices[0].x,
            y: this.vertices[2].y - this.vertices[0].y,
            z: this.vertices[2].z - this.vertices[0].z,
        };
        const v3 = {
            x: this.vertices[3].x - this.vertices[0].x,
            y: this.vertices[3].y - this.vertices[0].y,
            z: this.vertices[3].z - this.vertices[0].z,
        };
        const cross = vector.cross(v2, v3);
        const dot = vector.dot(v1, cross);
        if (dot <= error && dot >= -error) {
            this.isPlanar = true;
        } else {
            this.isPlanar = false;
        }
    }
    makeEdges() {
        if (this.isPlanar) {
            this.edges.push(new Edge(this.vertices[0], this.vertices[1]));
            this.edges.push(new Edge(this.vertices[1], this.vertices[2]));
            this.edges.push(new Edge(this.vertices[2], this.vertices[3]));
            this.edges.push(new Edge(this.vertices[3], this.vertices[0]));
        } else {
            return;
        }
    }
}

class Camera {
    constructor(position, direction) {
        this.position = position;
        this.direction = direction;
    }
    project(p, viewPlane) {}
}
