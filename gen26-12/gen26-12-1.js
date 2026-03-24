const canvasSketch = require("canvas-sketch");

const settings = {
    dimensions: [2048, 2048],
    animate: false,
};

const params = {
    steps: 20,
    resolution: 100,
};

const sketch = ({ width, height }) => {
    const boxWidth = width / params.resolution;
    const position = { x: width / 2, y: height / 2 };
    const stair = new Stair(params.steps, position, boxWidth);

    return ({ context, width, height }) => {
        context.fillStyle = "white";
        context.fillRect(0, 0, width, height);
        stair.draw(context);
    };
};

canvasSketch(sketch, settings);

class Stair {
    constructor(steps, position, boxWidth) {
        this.steps = steps;
        this.position = position;
        this.boxWidth = boxWidth;
        this.boxHeight = boxWidth;
        this.coords = [];
        this.init();
    }

    init() {
        const p1 = {
            x: this.position.x - (this.steps - 0.5) * this.boxWidth,
            y: this.position.y - (this.steps - 0.5) * this.boxHeight,
        };

        this.coords.push(p1);

        let pNext = { x: p1.x, y: p1.y };

        for (let i = 0; i < 4; i++) {
            let dirX = 0;
            let dirY = 0;

            switch (i) {
                case 0:
                    dirX = 1;
                    dirY = -1;
                    break;
                case 1:
                    dirX = 1;
                    dirY = 1;
                    break;
                case 2:
                    dirX = -1;
                    dirY = 1;
                    break;
                case 3:
                    dirX = -1;
                    dirY = -1;
                    break;
            }

            for (let j = 0; j < this.steps; j++) {
                pNext = {
                    x: pNext.x + dirX * this.boxWidth,
                    y: pNext.y + dirY * this.boxHeight,
                };
                this.coords.push(pNext);
            }
        }
    }

    draw(context) {
        context.strokeStyle = "black";
        context.beginPath();
        context.moveTo(this.coords[0].x, this.coords[0].y);

        this.coords.slice(1).forEach((p) => {
            context.lineTo(p.x, p.y);
        });

        context.closePath();
        context.stroke();
    }
}
