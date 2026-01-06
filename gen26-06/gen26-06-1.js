const canvasSketch = require('canvas-sketch');
const math = require('canvas-sketch-util/math');
const random = require('canvas-sketch-util/random');
const color = require('canvas-sketch-util/color');
const penplot = require('canvas-sketch-util/penplot')
const sanzo = require('sanzo-color');
const { viewBox, namedPaths } = require('./lamp.paths');



const settings = {
  dimensions: [2048, 2048]
};

const params = {

}

const sketch = ({ context, width, height }) => {


  const lamp = new Lamp(namedPaths, true)


  return ({ context, width, height }) => {
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);


    lamp.draw(context, 4, width, height);




  };
};

canvasSketch(sketch, settings);


// CLASSES
class Lamp {
  constructor(paths, state) {
    this.paths = paths;
    this.state = state;
  }

  draw(context, lineWidth, width, height) {
    // Als je lineWidth “in pixels” constant wil houden:
    context.strokeStyle = 'black';
    context.lineWidth = lineWidth;  // 2px op het scherm, ongeacht schaal
    // Redraw cord
    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height / 8)
    context.stroke();
    const s = applyViewBoxTransform(context, width, height, viewBox, 0);
    context.lineWidth = lineWidth / s;  // 2px op het scherm, ongeacht schaal
    context.save();
    if (this.state) {
      // Socket
      const socket = new Path2D(this.paths[1].d);
      context.fillStyle = 'red'
      context.fill(socket);
      context.stroke(socket);
      // Shade
      const shade = new Path2D(this.paths[2].d);
      context.fillStyle = 'blue';
      context.fill(shade);
      context.stroke(shade);
      // Light
      const light = new Path2D(this.paths[4].d);
      const gradient = context.createRadialGradient(width / (2 * s), height / (6 * s), height / (4 * s), width / (2 * s), height / (6 * s), height / (2 * s));
      gradient.addColorStop(0, 'rgba(251, 228, 100, 1)')
      gradient.addColorStop(1, 'rgba(255,207,28,1)')
      context.fillStyle = gradient;
      context.fill(light);
      // Bulb
      const bulb = new Path2D(this.paths[3].d);
      context.fillStyle = 'yellow';
      context.fill(bulb);
      context.stroke(bulb);
      context.restore();
    }

    else {
      // Socket
      const socket = new Path2D(this.paths[1].d);
      context.fillStyle = 'red'
      context.fill(socket);
      context.stroke(socket);
      // Shade
      const shade = new Path2D(this.paths[2].d);
      context.fillStyle = 'blue';
      context.fill(shade);
      context.stroke(shade);
      // Bulb
      const bulb = new Path2D(this.paths[3].d);
      context.fillStyle = 'gray';
      context.fill(bulb);
      context.stroke(bulb);
      context.restore();

    }
  }
}

class Mosquito {
  constructor() {

  }
}

// FUNCTIONS
function applyViewBoxTransform(context, width, height, vb, marginPx = 0) {
  // marginPx in canvas pixels
  const sx = (width - 2 * marginPx) / vb.w;
  const sy = (height - 2 * marginPx) / vb.h;
  const s = Math.min(sx, sy);

  const tx = (width - vb.w * s) / 2 - vb.x * s;
  const ty = (height - vb.h * s) / 2 - vb.y * s;

  context.setTransform(s, 0, 0, s, tx, ty);
  return s; // handig voor lineWidth-compensatie
}

