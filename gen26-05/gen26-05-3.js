const canvasSketch = require('canvas-sketch');
const math = require('canvas-sketch-util/math');
const random = require('canvas-sketch-util/random');
const Color = require('canvas-sketch-util/color');
const sanzo = require('sanzo-color');

// Canvas-Sketch settings
const settings = {
  dimensions: [2048, 2048],
  animate: true,
  fps: 30,
};

// Generative parameters
const params = {
  margin: 100,
  rows: 3,
  cols: 21,
  dotRadius: 2,
  minAgents: 200,
  maxAgents: 600,
  lookRadius: 3,
  attractRadius: 500,
  step: 5,
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

  // COLORS
  const colors = sanzo.january();
  const combination = random.pick(colors).colors;

  // GRID CREATION
  const grid = new Grid(rows, cols, cellWidth, cellHeight, origin, 1, combination);
  // AGENT CREATION
  const nPaths = 5;
  const agentArray = [];
  for (let i = 0; i < nPaths; i++) {
    agentArray.push(Math.round(random.range(params.minAgents, params.maxAgents)));
  }
  grid.initAgents(agentArray);

  // Path creation
  const paths = [];
  const path0 = [22, 23, 44, 42, 0, 2, 3, 45, 47, 48, 6, 7, 49, 50, 8, 9, 51, 53, 11, 12, 33, 35, 56, 57, 15, 17, 38, 36, 59, 60, 62, 20];
  const path1 = [22, 23, 44, 42, 0, 2, 3, 24, 26];
  const path2 = [22, 23, 44, 42, 0, 2, 3, 5];
  const path3 = [22, 23, 44, 42, 0, 2, 3, 45, 47, 48, 6, 7, 49, 50, 8, 9, 51, 53, 11, 12, 54];
  const path4 = [22, 23, 44, 42, 0, 2, 3, 45, 47, 48, 6, 7, 49, 50, 8, 9, 51, 53, 11, 12, 14, 56, 57, 15, 17, 38, 36, 59, 60, 62, 41, 39, 18];
  paths.push(path0, path1, path2, path3, path4);
  grid.agents.forEach(agent => {
    agent.initPath(paths[agent.groupid]);
    agent.findCoords(grid.entities);
    agent.spawn();
  });






  // ACTUAL RENDERING
  return ({ context, width, height, frame, time }) => {
    context.fillStyle = 'black';
    context.fillRect(0, 0, width, height);
    // grid.drawEntities(context);

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

  };
};

// RUN THE SKETCH
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
    this.entities = [];
    this.init();
    this.agents = [];
    this.colors = colors;
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
    const shuffledColors = random.shuffle(this.colors);
    let groupcount = 0;
    agentArray.forEach(number => {
      const selectedColor = shuffledColors[groupcount];
      const color = Color.parse(sanzo.CMYK2RGB(selectedColor.CMYK)).hex;
      console.log(color);
      const groupOffset = { x: random.range(-20, 20), y: random.range((-20, 20)) };
      for (let i = 0; i < number; i++) {
        const agent = new Agent(22, i, groupcount, params.lookRadius, params.attractRadius, color, groupOffset)
        this.agents.push(agent);

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
  constructor(start, id, groupid, lookRadius, attractRadius, color, groupOffset) {
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
    this.groupOffset = groupOffset;
  }

  launch(frame) {
    if (this.id * params.delayFactor < frame) {
      this.launched = true;
    }
  }

  initPath(path) {
    this.path = path;
    this.start = path[0];
  }

  findCoords(dots) {
    for (let i = 0; i < this.path.length; i++) {
      const dot = dots.find(obj => obj.id === this.path[i]);
      const x = dot.cellCenter.x + this.groupOffset.x;
      const y = dot.cellCenter.y + this.groupOffset.y;
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