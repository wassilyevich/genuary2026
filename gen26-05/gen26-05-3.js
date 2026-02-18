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
  duration: 10
};

// Generative parameters
const params = {
  margin: 100,
  rows: 3,
  cols: 21,
  dotRadius: 3,
  drawRadius: 3,
  minAgents: 10,
  maxAgents: 500,
  lookRadius: 5,
  smoothfactor: 300,
  linearfactor: 0.8,
  step: 5,
  delayFactor: 0.8,
  minOffset: 1,
  maxOffset: 2
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
  const grid1 = new Grid(rows, cols, cellWidth, cellHeight, origin, 1, combination);
  const grid2 = new Grid(rows, cols, cellWidth, cellHeight, { x: origin.x, y: origin.y - drawHeight }, 2, combination);
  const nPaths = 5;
  // AGENT CREATION
  const agentArray1 = [];
  for (let i = 0; i < nPaths; i++) {
    if (i == 0) {
      agentArray1.push(Math.round(random.range(params.minAgents, params.maxAgents)));
    }
    else {
      agentArray1.push(Math.round(random.range(params.minAgents / 2, params.maxAgents / 2)));
    }
  }
  const agentArray2 = [];
  for (let i = 0; i < nPaths; i++) {
    if (i == 0) {
      agentArray2.push(Math.round(random.range(params.minAgents, params.maxAgents)));
    }
    else {
      agentArray2.push(Math.round(random.range(params.minAgents / 2, params.maxAgents / 2)));
    }
  }
  grid1.initAgents(agentArray1);
  grid2.initAgents(agentArray2);
  console.log(grid1, grid2);

  // Path creation
  const paths = [];
  const path0 = [22, 23, 44, 42, 0, 2, 3, 45, 47, 48, 6, 50, 8, 9, 51, 53, 11, 12, 33, 35, 56, 57, 15, 17, 38, 36, 59, 60, 62, 20];
  const path1 = [22, 23, 44, 42, 0, 2, 3, 24, 26];
  const path2 = [22, 23, 44, 42, 0, 2, 3, 5];
  const path3 = [22, 23, 44, 42, 0, 2, 3, 45, 47, 48, 6, 50, 8, 9, 51, 53, 11, 12, 54];
  const path4 = [22, 23, 44, 42, 0, 2, 3, 45, 47, 48, 6, 50, 8, 9, 51, 53, 11, 12, 14, 56, 57, 15, 17, 38, 36, 59, 60, 62, 41, 39, 18];
  paths.push(path0, path1, path2, path3, path4);
  grid1.agents.forEach(agent => {
    agent.initPath(paths[agent.groupid]);
    agent.findCoords(grid1.entities);
    agent.spawn();
  });
  grid2.agents.forEach(agent => {
    agent.initPath(paths[agent.groupid]);
    agent.findCoords(grid2.entities);
    agent.spawn();
  });

  const input = {
    step: true,
    stepMin: 1,
    stepMax: 10,
    smoothfactor: true,
    smoothMin: 200,
    smoothMax: 400,
    linearfactor: true,
    linearMin: 0.1,
    linearMax: 0.8,
    randomInterpol: false,
    interpolMin: 0.1,
    interpolMax: 0.8,
    drawRadius: true,
    drawMin: 3, 
    drawMax: 15
  }

  grid2.makeUnique(input);






  // ACTUAL RENDERING
  return ({ context, width, height, frame, time }) => {
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    // grid.drawEntities(context);

    grid1.agents.forEach(agent => {
      if (!agent.launched) {
        agent.launch(time);
      }
      else {
        agent.move(params.step, 50);
        agent.updateTarget();
        agent.draw(context);
      }
    });

    grid2.agents.forEach(agent => {
      if (!agent.launched) {
        agent.launch(time);
      }
      else {
        agent.move();
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
      // const selectedColor = shuffledColors[groupcount];
      // const color = Color.parse(sanzo.CMYK2RGB(selectedColor.CMYK)).hex;
      const color = 'black';
      const offsetbounds = random.range(params.minOffset, params.maxOffset);
      const groupOffset = { x: random.range(-offsetbounds, offsetbounds), y: random.range((-offsetbounds, offsetbounds)) };
      for (let i = 0; i < number; i++) {
        const agent = new Agent(22, i, groupcount, params.lookRadius, params.smoothfactor, params.linearfactor, color, groupOffset, params.step)
        this.agents.push(agent);

      }
      groupcount++;
    })

  }

  makeUnique(input) {
    this.agents.forEach(agent => {
      agent.makeUnique(input);
    });
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
  constructor(start, id, groupid, lookRadius, smoothfactor, linearfactor, color, groupOffset, step) {
    this.start = start;
    this.id = id;
    this.groupid = groupid;
    this.path = [];
    this.pathCoords = [];
    this.lookRadius = lookRadius;
    this.smoothfactor = smoothfactor;
    this.linearfactor = linearfactor;
    this.position = [];
    this.target = [];
    this.targetDot = [];
    this.dir = true; // true = order, false = reverse
    this.launched = false;
    this.color = color;
    this.groupOffset = groupOffset;
    this.step = step;
    this.interpol = 1;
    this.drawRadius = params.drawRadius;
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

  move() {
    const dist = { x: this.target.x - this.position.x, y: this.target.y - this.position.y };
    const vector = {
      x: (dist.x / this.smoothfactor)*(1-this.interpol) + normalize(dist).x*this.interpol*this.linearfactor,
      y: (dist.y / this.smoothfactor)*(1-this.interpol) + normalize(dist).y*this.interpol*this.linearfactor
    }

    // const vector = normalize({ x: this.target.x - this.position.x, y: this.target.y - this.position.y });


    // update position
    this.position.x += vector.x * this.step;
    this.position.y += vector.y * this.step;

  }

  makeUnique(input) {
    // What can we make unique
    // Stepsize, attractradius
    // Interpolation in between Linear and smooth movement
    // drawradius
    if (input.step) {
      this.step = random.range(input.stepMin, input.stepMax);
    }
    if (input.smoothfactor) {
      this.smoothfactor = random.range(input.smoothMin, input.smoothMax);
    }
    if (input.linearfactor) {
      this.linearfactor = random.range(input.linearMin, input.linearMax);
    }
    if (input.setInterpol) {
      this.interpol = input.interpol;
    }
    if (input.randomInterpol) {
      this.interpol = random.range(input.interpolMin, input.interpolMax);
    }
    if (input.drawRadius) {
      this.drawRadius = random.range(input.drawMin, input.drawMax);
    }
  }


  draw(context) {
    context.save();
    context.beginPath();
    context.fillStyle = this.color;
    context.arc(this.position.x, this.position.y, this.drawRadius, 0, 2 * Math.PI);
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