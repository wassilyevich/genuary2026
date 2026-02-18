const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');
const sanzo = require('sanzo-color');
const col = require('canvas-sketch-util/color');
const nice = require("nice-color-palettes");

const settings = {
  dimensions: [1080, 1080],
  animate: true
};

const params = {
  margin: 20,
  rows: 100,
  cols: 100,
  dotRadius: 4,
  threshVal1: 0.5,
  threshVal2: 0.5,
  threshVal3: 0.5
}

let didResetForExport = false;

const sketch = ({ context, width, height, stop, render, play }) => {

  window.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
      stop();
      resetAll();
      render();
      play();
    }
  });

  // POSITIONING
  var drawWidth = width - 2 * params.margin;
  var drawHeight = height - 2 * params.margin;
  var rows = params.rows;
  var cols = params.cols;
  var cellWidth = drawWidth / cols;
  var cellHeight = cellWidth;
  drawHeight = rows * cellHeight;
  var origin = { x: params.margin, y: (height - drawHeight) / 2 };


  const colors = random.pick(nice);


  const grid = new Grid(rows, cols, cellWidth, cellHeight, origin, 1, colors);


  const resetAll = () => {
    grid.cells.forEach(cell => {
      cell.reset();
    })
  };
  return ({ context, width, height, time, frame, exporting, recording }) => {

    const isCapturing = exporting || recording;
    if (isCapturing && frame == 0 && !didResetForExport) {
      resetAll();
      didResetForExport = true;
    }

    if (!isCapturing && didResetForExport) {
      didResetForExport = false;
    }
    // BACKGROUND
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    // Update/set values of internal functions
    grid.cells.forEach(cell => {
      // let val1 = sin(sin(frame/cell.col, cell.row, time/20, cell.col / cell.row), 1, 0.01, 0.1 * time);
      // let val2 = sin(cell.row * sin(cell.col, 1, 0.06, cell.row / cell.col), 1, 0.03, 0.2 * time);
       let val1 = sin(cell.row * cell.col, sin(time, 1, 0.01, 0.1*time), 0.02, 0.8*time);
      let val2 = sin(cell.row / cell.col*frame, 1, 0.01, 0.9*time);
      // let val3 = noise_2d(cell.row, sin(cell.row, cell.col, 0.1, 1), 1, 0.01, time);
      let val3 = sin(cell.col/cell.row*frame, 1, 0.02, 0.8*time);
      cell.setVals([val1, val2, val3]);
      cell.evalState();
      cell.draw(context);
    })

  };
};

canvasSketch(sketch, settings);


// CLASSES

// Grid class
class Grid {
  constructor(rows, cols, cellWidth, cellHeight, origin, id, colors) {
    this.rows = rows;
    this.cols = cols;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.origin = origin;
    this.id = id;
    this.cells = [];
    this.colors = colors;
    this.init();
  }

  init() {
    let count = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.cells.push(new Cell(row, col, this.cellWidth, this.cellHeight, this.origin, count, this.colors));
        count++;
      }
    }
  }



  drawCells(context) {
    this.cells.forEach(cell => {
      cell.draw(context);
    })
  }

  setVals(vals) {
    this.cells.forEach(cell => {
      cell.setVals(vals);
    })
  }

  reset() {
    this.cells.forEach(cell => {
      cell.reset();
    })
  }
}

class Cell {
  constructor(row, col, cellWidth, cellHeight, origin, id, colors) {
    this.row = row;
    this.col = col;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.origin = origin;
    this.id = id;
    this.cellCorner = { x: origin.x + col * cellWidth, y: origin.y + row * cellWidth };
    this.cellCenter = { x: origin.x + col * cellWidth + cellWidth / 2, y: origin.y + row * cellWidth + cellHeight / 2 };
    this.vals = [];
    this.state = [];
    this.colors = colors;
  }

  reset() {
    this.vals = [];
    this.state = [];
  }

  draw(context) {
    if (this.states[0] && this.states[1]) {
      context.fillStyle = this.colors[0];
      context.strokeStyle = 'white';
    }
    else if (xor(this.states[0], this.states[1])) {
      context.fillStyle = this.colors[1];
      context.strokeStyle = 'white';
    }
    else if (xor(this.states[2], this.states[1])) {
      context.fillStyle = this.colors[2];
      context.strokeStyle = 'white';
    }
    else if (xor(this.states[2], this.states[0])) {
      context.fillStyle = this.colors[3];
      context.strokeStyle = 'white';
    }
    else {
      context.fillStyle = 'white';
      context.strokeStyle = 'black';
    }
    context.save();
    context.beginPath();
    context.arc(this.cellCenter.x, this.cellCenter.y, params.dotRadius, 0, 2 * Math.PI);
    context.fill();
    context.stroke();
    context.restore();
  }

  setVals(vals) {
    this.vals = vals;
  }

  evalState() {
    let state1 = toBool(this.vals[0], params.threshVal1, true);
    let state2 = toBool(this.vals[1], params.threshVal2, true);
    let state3 = toBool(this.vals[2], params.threshVal3, true);
    this.states = [state1, state2, state3];
  }
}

// Functions

// SIN
function sin(t, a, b, phi) {
  return a * Math.sin(b * t + phi);
}

function noise(t, a, b, phi) {
  return random.noise1D(t + phi, b, a);
}

function noise_2d(t, y, a, b, phi) {
  return random.noise2D(t + phi, y, b, a);
}

function toBool(val, thresh, abs) {
  if (!abs) {
    return val > thresh ? true : false;
  }
  else {
    if (val > thresh || val < -thresh) {
      return true;
    }
    else {
      return false;
    }
  }

}


function xor(a, b) {
  return a !== b;
}
