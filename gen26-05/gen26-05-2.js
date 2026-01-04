const canvasSketch = require('canvas-sketch');
const math = require('canvas-sketch-util/math');
const random = require('canvas-sketch-util/random');

// Canvas-Sketch settings
const settings = {
  dimensions: [2048, 2048],
  animate: true,
  fps: 30,
  duration: 10
};

// Generative parameters
const params = {
  margin: 100,
  rows: 3,
  cols: 21,
  dotRadius: 10,
  minAgents: 50,
  maxAgents: 100,
  lookRadius: 5,
  attractRadius: 500,
  step: 10,
  basicSpeed: 5,
  delayFactor: 0.1
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
  // AGENT CREATION
  const nPaths = 1;
  const agentArray = [];
  for (let i = 0; i < nPaths; i++) {
    agentArray.push(Math.round(random.range(params.minAgents, params.maxAgents)));
  }
  grid.initAgents(agentArray);
  const path = [22, 23, 44, 42, 0, 2, 3, 45, 47, 48, 6, 7, 49, 50, 8, 9, 51, 53, 11, 12, 33, 35, 56, 57, 15, 17, 38, 36, 59, 60, 62, 20];
  grid.agents.forEach(agent => {
    agent.initPath(path);
    agent.findCoords(grid.entities);
    agent.spawn();
  });






  // ACTUAL RENDERING
  return ({ context, width, height, frame, time }) => {
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    grid.drawEntities(context);

    grid.agents.forEach(agent => {
      if (!agent.launched) {
        agent.launch(time);
      }
      else {
        agent.move(params.step, 50);
        agent.updateTarget();
        agent.draw(context);
      }
    });
    context.font = "50px serif";
    context.fillStyle = 'black'
    context.fillText(time.toString(), 500, params.margin);
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
      const color = random.pick(['red', 'blue', 'green', 'yellow']);
      for (let i = 0; i < number; i++) {
        const agent = new Agent(22, count, groupcount, params.lookRadius, params.attractRadius, color)
        this.agents.push(agent);
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
    context.font = "15px serif";
    context.fillText(this.id.toString(), this.cellCenter.x, this.cellCenter.y + 2 * params.dotRadius);
    context.restore();
  }
}

class Agent {
  constructor(start, id, groupid, lookRadius, attractRadius, color) {
    this.start = start;
    this.id = id;
    this.groupid = groupid;
    this.path = [];
    this.pathCoords = [];
    this.lookRadius = lookRadius;
    this.attractRadius = attractRadius;
    this.position = [];
    this.target = [];
    this.targetDot = [];
    this.dir = true; // true = order, false = reverse
    this.launched = false;
    this.color = color;
  }

  launch(frame) {
    if (this.id * params.delayFactor < frame) {
      this.launched = true;
      console.log('launched');
    }
  }

  initPath(path) {
    this.path = path;
    this.start = path[0];
  }

  findCoords(dots) {
    for (let i = 0; i < this.path.length; i++) {
      const dot = dots.find(obj => obj.id === this.path[i]);
      const x = dot.cellCenter.x;
      const y = dot.cellCenter.y;
      this.pathCoords.push({ x: x, y: y });
    }
  }

  spawn() {
    this.position = { x: this.pathCoords[0].x, y: this.pathCoords[0].y };
    this.targetDot = 1;
    this.target = { x: this.pathCoords[this.targetDot].x, y: this.pathCoords[this.targetDot].y }
  }

  updateTarget() {
    // ORDER DIRECTION
    if (this.dir) {
      if (distance(this.position, this.target) < this.lookRadius && this.targetDot < this.path.length - 1) {
        this.targetDot++;
      }
      else if (distance(this.position, this.target) < this.lookRadius && this.targetDot == this.path.length - 1) {
        this.dir = false;
        this.targetDot--;
      }
    }
    // REVERSE DIRECTION
    else {
      if (distance(this.position, this.target) < this.lookRadius && this.targetDot > 0) {
        this.targetDot--;
      }
      else if (distance(this.position, this.target) < this.lookRadius && this.targetDot == 0) {
        this.dir = true;
        this.targetDot++;
      }
    }
    this.target = { x: this.pathCoords[this.targetDot].x, y: this.pathCoords[this.targetDot].y };
  }

  move(step, p) {
    // const dist = { x: this.target.x - this.position.x, y: this.target.y - this.position.y };
    // const numerator = {
    //   x: dist.x / (Math.pow(distance(this.position, this.target), p) * this.attractRadius),
    //   y: dist.y / (Math.pow(distance(this.position, this.target), p) * this.attractRadius)
    // }

    // const denominator = 1 / (Math.pow(distance(this.position, this.target), p));
    // const vector = {
    //   x: numerator.x / denominator,
    //   y: numerator.y / denominator
    // };

    const vector = normalize({ x: this.target.x - this.position.x, y: this.target.y - this.position.y });
    

    // update position
    this.position.x += vector.x * step;
    this.position.y += vector.y * step;

  }


  draw(context) {
    context.save();
    context.beginPath();
    context.fillStyle = this.color;
    context.arc(this.position.x, this.position.y, params.dotRadius * 1.2, 0, 2 * Math.PI);
    context.fill();
    // context.font = "15px serif";
    // context.fillText(this.id.toString(), this.position.x, this.position.y + 2 * params.dotRadius);
    context.restore();
  }
}


// FUNCTIONS

function distance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function normalize(v) {
  const magnitude = Math.sqrt(v.x ** 2 + v.y ** 2);
  return { x: v.x / magnitude, y: v.y / magnitude };
}