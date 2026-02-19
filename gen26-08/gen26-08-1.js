// PROMPT 8: A GENERATIVE METROPOLIS
const canvasSketch = require("canvas-sketch");
const random = require("canvas-sketch-util/random");
const math = require("canvas-sketch-util/math");
const settings = {
  dimensions: [2048, 2048],
};

const params = {
  margin: 20,
};

const sketch = ({ width, height }) => {
  const margin = params.margin;
  const drawWidth = width - 2 * margin;
  const drawHeight = height - 2 * margin;
  const origin = { x: margin, y: margin };

  return ({ context, width, height }) => {
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
  };
};

canvasSketch(sketch, settings);

// CLASSES
class Ground {
  constructor(origin) {
    this.origin = origin;
  }

  draw(context) {
    context.beginPath();
    context.endPath();
  }
}
// FUNCTIONS:w
//
