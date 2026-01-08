const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');

const settings = {
  dimensions: [2048, 2048],
  animate: true
};

const params = {
  margin: 20,
  rows: 100,
  cols: 100,
  dotRadius: 8,
  threshVal1: 0.7,
  threshVal2: 0.4
}

const sketch = ({ context, width, height }) => {

  // POSITIONING
  var drawWidth = width - 2 * params.margin;
  var drawHeight = height - 2 * params.margin;
  var rows = params.rows;
  var cols = params.cols;
  var cellWidth = drawWidth / cols;
  var cellHeight = cellWidth;
  drawHeight = rows * cellHeight;
  var origin = { x: params.margin, y: (height - drawHeight) / 2 };

  const grid = new Grid(rows, cols, cellWidth, cellHeight, origin, 1);

  return ({ context, width, height, time, frame }) => {

    // BACKGROUND
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    // Update/set values of internal functions
    grid.cells.forEach(cell => {
      let val1 = sin(cell.row * cell.col, sin(time, 1, 0.01, 0.1*time), 0.02, 0.8*time);
      let val2 = sin(cell.row / cell.col*frame, 1, 0.01, 0.9*time);
      cell.setVals([val1, val2]);
      cell.evalState();
      cell.draw(context);
    })

  };
};

canvasSketch(sketch, settings);


// CLASSES

// Grid class
class Grid {
  constructor(rows, cols, cellWidth, cellHeight, origin, id) {
    this.rows = rows;
    this.cols = cols;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.origin = origin;
    this.id = id;
    this.cells = [];
    this.init();
  }

  init() {
    let count = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.cells.push(new Cell(row, col, this.cellWidth, this.cellHeight, this.origin, count));
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
  constructor(row, col, cellWidth, cellHeight, origin, id) {
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
  }

  draw(context) {
    if (this.states[0] && this.states[1]){
      context.fillStyle = 'black';
      context.strokeStyle = 'white';
    }
    else if (xor(this.states[0], this.states[1])){
      context.fillStyle = 'red';
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

  evalState(){
    let state1 = toBool(this.vals[0], params.threshVal1, true);
    let state2 = toBool(this.vals[1], params.threshVal2, true);
    this.states = [state1, state2];
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
  return random.noise2d(t + phi, y, b, a);
}

function toBool(val, thresh, abs) {
  if (!abs){
    return val > thresh ? true : false;
  }
  else {
    if (val > thresh || val < -thresh){
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
