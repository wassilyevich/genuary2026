const canvasSketch = require("canvas-sketch");
const math = require("canvas-sketch-util/math");
const random = require("canvas-sketch-util/random");

const settings = {
    dimensions: [2048, 2048],
    animate: true,
};

const params = {
    steps: 48,
    resolution: 100,
    depth: 10,
    angle: Math.PI / 4,
};

const sketch = ({ width, height }) => {
    // PRECOMUTATIONS

    const boxWidth = width / params.resolution;
    const position = { x: width / 2, y: height / 2 };
    const stairs = [];
    for (let i = 0; i < 10; i++) {
        let s = new Stair(params.steps - 3 * i, position, boxWidth);
        stairs.push(s);
    }

    // Actual rendering
    return ({ context, width, height }) => {
        context.fillStyle = "white";
        context.fillRect(0, 0, width, height);
        stairs.forEach((stair) => {
            stair.draw(context);
        });
    };
};

canvasSketch(sketch, settings);

// CLASSES
class Stair {
    constructor(steps, position, boxWidth) {
        this.steps = steps;
        this.position = position;
        this.boxWidth = boxWidth;
        this.boxHeight = boxWidth;
        this.planeCoords = [];
        this.depthCoords = [];
        this.init();
    }

    init() {
        this.findPlaneCoords();
        this.findDepthCoords();
    }
    findDepthCoords() {
        const projDist = {
            x: params.depth * Math.cos(params.angle),
            y: params.depth * Math.sin(params.angle),
        };
        // Start left
        const p1 = {
            x:
                this.position.x -
                (this.steps - 0.5) * this.boxWidth -
                projDist.x,
            y: this.position.y - 0.5 * this.boxHeight - projDist.y,
        };
        this.depthCoords.push(p1);
        let dirX = 0;
        let dirY = 0;
        let dimFirst = true; // true = x, false = y
        let pNext = {
            x: p1.x,
            y: p1.y,
        };
        for (let i = 0; i < 4; i++) {
            switch (i) {
                case 0:
                    dirX = 1;
                    dirY = -1;
                    dimFirst = true;
                    break;
                case 1:
                    dirX = 1;
                    dirY = 1;
                    dimFirst = false;
                    break;
                case 2:
                    dirX = -1;
                    dirY = 1;
                    dimFirst = true;
                    break;
                case 3:
                    dirX = -1;
                    dirY = -1;
                    dimFirst = false;
                    break;
                default:
                    dirX = 1;
                    dirY = 1;
                    dimFirst = true;
            }

            for (let j = 0; j < 2 * this.steps - 1; j++) {
                if (dimFirst) {
                    if (j % 2 === 0 && j === 2 * this.steps - 2) {
                        pNext = {
                            x:
                                pNext.x +
                                dirX * (this.boxWidth + 2 * projDist.x),
                            y: pNext.y,
                        };
                    } else if (j % 2 === 0 && j != 2 * this.steps - 2) {
                        pNext = {
                            x: pNext.x + dirX * this.boxWidth,
                            y: pNext.y,
                        };
                    } else {
                        pNext = {
                            x: pNext.x,
                            y: pNext.y + dirY * this.boxHeight,
                        };
                    }
                } else {
                    if (j % 2 === 0 && j != 2 * this.steps - 2) {
                        pNext = {
                            x: pNext.x,
                            y: pNext.y + dirY * this.boxHeight,
                        };
                    } else if (j % 2 === 0 && j === 2 * this.steps - 2) {
                        pNext = {
                            x: pNext.x,
                            y:
                                pNext.y +
                                dirY * (this.boxHeight + 2 * projDist.y),
                        };
                    } else {
                        pNext = {
                            x: pNext.x + dirX * this.boxWidth,
                            y: pNext.y,
                        };
                    }
                }
                this.depthCoords.push(pNext);
            }
        }
    }
    findPlaneCoords() {
        // Start left
        const p1 = {
            x: this.position.x - (this.steps - 0.5) * this.boxWidth,
            y: this.position.y - 0.5 * this.boxHeight,
        };
        this.planeCoords.push(p1);
        let dirX = 0;
        let dirY = 0;
        let dimFirst = true; // true = x, false = y
        let pNext = {
            x: p1.x,
            y: p1.y,
        };
        for (let i = 0; i < 4; i++) {
            switch (i) {
                case 0:
                    dirX = 1;
                    dirY = -1;
                    dimFirst = true;
                    break;
                case 1:
                    dirX = 1;
                    dirY = 1;
                    dimFirst = false;
                    break;
                case 2:
                    dirX = -1;
                    dirY = 1;
                    dimFirst = true;
                    break;
                case 3:
                    dirX = -1;
                    dirY = -1;
                    dimFirst = false;
                    break;
                default:
                    dirX = 1;
                    dirY = 1;
                    dimFirst = true;
            }

            for (let j = 0; j < 2 * this.steps - 1; j++) {
                if (dimFirst) {
                    if (j % 2 === 0) {
                        pNext = {
                            x: pNext.x + dirX * this.boxWidth,
                            y: pNext.y,
                        };
                    } else {
                        pNext = {
                            x: pNext.x,
                            y: pNext.y + dirY * this.boxHeight,
                        };
                    }
                } else {
                    if (j % 2 === 0) {
                        pNext = {
                            x: pNext.x,
                            y: pNext.y + dirY * this.boxHeight,
                        };
                    } else {
                        pNext = {
                            x: pNext.x + dirX * this.boxWidth,
                            y: pNext.y,
                        };
                    }
                }
                this.planeCoords.push(pNext);
            }
        }
    }
    draw(context) {
        this.drawPlaneStairs(context);
        this.drawDepthStairs(context);
        this.drawConnections(context);
    }
    drawPlaneStairs(context) {
        context.strokeStyle = "black";
        context.beginPath();
        context.moveTo(this.planeCoords[0].x, this.planeCoords[0].y);
        this.planeCoords.slice(1);
        this.planeCoords.forEach((p) => {
            context.lineTo(p.x, p.y);
        });
        context.closePath();
        context.stroke();
    }
    drawDepthStairs(context) {
        context.strokeStyle = "black";
        context.beginPath();
        context.moveTo(this.depthCoords[0].x, this.depthCoords[0].y);
        this.depthCoords.slice(1);
        this.depthCoords.forEach((p) => {
            context.lineTo(p.x, p.y);
        });
        context.closePath();
        context.stroke();
    }
    drawConnections(context) {
        context.strokeStyle = "black";
        this.planeCoords.forEach((pC, index) => {
            context.beginPath();
            context.moveTo(pC.x, pC.y);
            context.lineTo(
                this.depthCoords[index].x,
                this.depthCoords[index].y,
            );
            context.closePath();
            context.stroke();
        });
    }
}
