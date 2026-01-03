const canvasSketch = require('canvas-sketch');
const math = require('canvas-sketch-util/math');
const random = require('canvas-sketch-util/random');

// Canvas-Sketch settings
const settings = {
  dimensions: [2048, 2048],
  animate: true,
  fps: 30,
  duration: 10,
  loop: true
};

// Generative parameters
const params = {
  margin: 100,
  rows: 3,
  cols: 21,
  dotRadius: 10,
  nAgents: 10
}

const sketch = (props) => {
  const { exportFrame, stop, play, render, width, height } = props;

  // POSITIONING
  var drawWidth = width - 2 * params.margin;
  var drawHeight = height - 2 * params.margin;
  var rows = params.rows;
  var cols = params.cols;
  var cellWidth = drawWidth / cols;
  var cellHeight = cellWidth;
  drawHeight = rows * cellHeight;
  var origin = { x: params.margin, y: (height - drawHeight) / 2 };

  // GRID CREATION
  const grid = new Grid(rows, cols, cellWidth, cellHeight, origin, 1);

  // ACTUAL RENDERING
  return ({ context, width, height }) => {
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    grid.drawEntities(context);
  };
};

// RUN THE SKETCH
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
    this.entities = [];
    this.init();
    this.agents = [];
  }

  init() {
    let count = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.entities.push(new Dot(row, col, this.cellWidth, this.cellHeight, this.origin, count));
        count++;
      }
    }
  }

  drawEntities(context) {
    this.entities.forEach(dot => {
      dot.draw(context);
    })
  }

  initAgents(agentArray) {
    let count = 0;
    let groupcount = 0;
    agentArray.forEach(number => {
      for (let i = 0; i < number; i++) {
        agent = new Agent(1, count, groupcount)
        count++;
      }
      groupcount++;
    })

  }



}

class Dot {
  constructor(row, col, cellWidth, cellHeight, origin, id) {
    this.row = row;
    this.col = col;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.origin = origin;
    this.id = id;
    this.cellCorner = { x: origin.x + col * cellWidth, y: origin.y + row * cellWidth };
    this.cellCenter = { x: origin.x + col * cellWidth + cellWidth / 2, y: origin.y + row * cellWidth + cellHeight / 2 };
  }

  draw(context) {
    context.save();
    context.beginPath();
    context.fillStyle = 'black';
    context.arc(this.cellCenter.x, this.cellCenter.y, params.dotRadius, 0, 2 * Math.PI);
    context.fill();
    context.restore();
  }
}

class Agent {
  constructor(start, id, groupid) {
    this.start = start;
    this.id = id;
    this.groupid = groupid;
  }
}


// FUNCTIONS