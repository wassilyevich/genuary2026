const canvasSketch = require('canvas-sketch');
const math = require('canvas-sketch-util/math');
const random = require('canvas-sketch-util/random');
const Color = require('canvas-sketch-util/color');
const sanzo = require('sanzo-color');

// Canvas-Sketch settings
const settings = {
  dimensions: [2048, 2048],
  animate: true,
  fps: 24,
  duration: 5,
  attributes: {
    alpha: true
  }
};

// Generative parameters
const params = {
  margin: 100,
  rows: 3,
  cols: 21,
  dotRadius: 3,
  drawRadius: 8,
  minAgents: 300,
  maxAgents: 500,
  lookRadius: 5,
  smoothfactor: 100,
  linearfactor: 0.3,
  step: 20,
  delayFactor: 0.1,
  minOffset: 0,
  maxOffset: 0,
  connectRadius: 120,
  lineWidth: 0.08
}

let didResetForExport = false;

const sketch = ({ exportFrame, pause, stop, play, togglePlay, render, width, height }) => {
  // FUNCTIONALITIES
  window.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
      stop();
      resetAll();
      render();
      play();
    }
  });


  const resetAll = () => {
    [grid1, grid2, grid3, grid4, grid5].forEach(grid => {
      grid.agents.forEach(a => a.reset());
    });
  };


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
  const colors = sanzo.redish;
  const shuffledColors = random.shuffle(colors);
  // const color1 = Color.parse(sanzo.CMYK2RGB(shuffledColors[0].CMYK)).hex;
  // const color2 = Color.parse(sanzo.CMYK2RGB(shuffledColors[1].CMYK)).hex;
  // const color3 = Color.parse(sanzo.CMYK2RGB(shuffledColors[2].CMYK)).hex;
  // const color4 = Color.parse(sanzo.CMYK2RGB(shuffledColors[3].CMYK)).hex;
  // const color5 = Color.parse(sanzo.CMYK2RGB(shuffledColors[4].CMYK)).hex;
  const color = 'black';

  // GRID CREATION
  const grid1 = new Grid(rows, cols, cellWidth, cellHeight, origin, 1, color);
  const grid2 = new Grid(rows, cols, cellWidth, cellHeight, { x: origin.x, y: origin.y - drawHeight * 1.2 }, 2, color);
  const grid3 = new Grid(rows, cols, cellWidth, cellHeight, { x: origin.x, y: origin.y - drawHeight * 2.4 }, 3, color);
  const grid4 = new Grid(rows, cols, cellWidth, cellHeight, { x: origin.x, y: origin.y + drawHeight * 1.2 }, 4, color);
  const grid5 = new Grid(rows, cols, cellWidth, cellHeight, { x: origin.x, y: origin.y + drawHeight * 2.4 }, 5, color);
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
  const agentArray3 = [];
  for (let i = 0; i < nPaths; i++) {
    if (i == 0) {
      agentArray3.push(Math.round(random.range(params.minAgents, params.maxAgents)));
    }
    else {
      agentArray3.push(Math.round(random.range(params.minAgents / 2, params.maxAgents / 2)));
    }
  }
  const agentArray4 = [];
  for (let i = 0; i < nPaths; i++) {
    if (i == 0) {
      agentArray4.push(Math.round(random.range(params.minAgents, params.maxAgents)));
    }
    else {
      agentArray4.push(Math.round(random.range(params.minAgents / 2, params.maxAgents / 2)));
    }
  }
  const agentArray5 = [];
  for (let i = 0; i < nPaths; i++) {
    if (i == 0) {
      agentArray5.push(Math.round(random.range(params.minAgents, params.maxAgents)));
    }
    else if (i == 1) {
      agentArray5.push(Math.round(random.range(params.minAgents / 7, params.maxAgents / 7)));
    }
    else {
      agentArray5.push(Math.round(random.range(params.minAgents / 4, params.maxAgents / 4)));
    }
  }
  grid1.initAgents(agentArray1);
  grid2.initAgents(agentArray2);
  grid3.initAgents(agentArray3);
  grid4.initAgents(agentArray4);
  grid5.initAgents(agentArray5);

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
  grid3.agents.forEach(agent => {
    agent.initPath(paths[agent.groupid]);
    agent.findCoords(grid3.entities);
    agent.spawn();
  });
  grid4.agents.forEach(agent => {
    agent.initPath(paths[agent.groupid]);
    agent.findCoords(grid4.entities);
    agent.spawn();
  });
  grid5.agents.forEach(agent => {
    agent.initPath(paths[agent.groupid]);
    agent.findCoords(grid5.entities);
    agent.spawn();
  });

  // Editing grid

  // GRID1
  const input1 = {
    step: true,
    stepMin: 10,
    stepMax: 20,
    smoothfactor: true,
    smoothMin: 200,
    smoothMax: 400,
    linearfactor: true,
    linearMin: 0.7,
    linearMax: 0.8,
    randomInterpol: true,
    interpolMin: 0.7,
    interpolMax: 0.8,
    // drawRadius: true,
    // drawMin: 3,
    // drawMax: 15
    delayFactor: true,
    delayValue: 0.1
  }
  grid1.makeUnique(input1);

  // GRID2
  const input2 = {
    step: true,
    stepMin: 2,
    stepMax: 3,
    smoothfactor: true,
    smoothMin: 200,
    smoothMax: 400,
    linearfactor: true,
    linearMin: 0.7,
    linearMax: 0.8,
    randomInterpol: true,
    interpolMin: 0.7,
    interpolMax: 0.8,
    drawRadius: true,
    drawMin: 5,
    drawMax: 13
    // delayFactor: true,
    // delayValue: 0.1
  }
  grid2.makeUnique(input2);

  // GRID3
  const input3 = {
    step: true,
    stepMin: 6,
    stepMax: 9,
    // smoothfactor: true,
    // smoothMin: 200,
    // smoothMax: 400,
    // linearfactor: true,
    // linearMin: 0.7,
    // linearMax: 0.8,
    randomInterpol: true,
    interpolMin: 0.3,
    interpolMax: 0.8,
    drawRadius: true,
    drawMin: 2,
    drawMax: 8,
    delayFactor: true,
    delayValue: 0.4
  }
  grid3.makeUnique(input3);

  // GRID4
  const input4 = {
    step: true,
    stepMin: 6,
    stepMax: 16,
    smoothfactor: true,
    smoothMin: 100,
    smoothMax: 600,
    // linearfactor: true,
    // linearMin: 0.7,
    // linearMax: 0.8,
    // randomInterpol: false,
    // interpolMin: 0.4,
    // interpolMax: 0.8,
    drawRadius: true,
    drawMin: 10,
    drawMax: 18,
    delayFactor: true,
    delayValue: 0.9
  }
  grid4.makeUnique(input4);
  grid4.setInterpol(0.1);

  // GRID5
  const input5 = {
    step: true,
    stepMin: 8,
    stepMax: 8,
    smoothfactor: true,
    smoothMin: 100,
    smoothMax: 600,
    // linearfactor: true,
    // linearMin: 0.7,
    // linearMax: 0.8,
    // randomInterpol: false,
    // interpolMin: 0.4,
    // interpolMax: 0.8,
    drawRadius: true,
    drawMin: 7,
    drawMax: 7,
    delayFactor: true,
    delayValue: 0.5
  }
  grid5.makeUnique(input5);
  grid5.setDrawLines(true);




  // ACTUAL RENDERING
  return ({ context, width, height, frame, time, playhead, exporting, recording }) => {
    const isCapturing = exporting || recording;
    if (isCapturing && frame == 0 && !didResetForExport) {
      resetAll();
      didResetForExport = true;
    }

    if (!isCapturing && didResetForExport) {
      didResetForExport = false;
    }


    // context.fillStyle = 'white';
    // context.fillRect(0, 0, width, height);
    context.clearRect(0, 0, width, height);
    // grid.drawEntities(context);

    grid1.setStep(params.step * playhead);
    grid1.agents.forEach(agent => {
      if (!agent.launched) {
        agent.launch(time);
      }
      else {
        agent.move();
        agent.updateTarget();
        agent.draw(context);
      }
    });

    grid2.setInterpol(1 - playhead);
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

    grid3.agents.forEach(agent => {
      if (!agent.launched) {
        agent.launch(time);
      }
      else {
        agent.move();
        agent.updateTarget();
        agent.draw(context);
      }
    });

    grid4.agents.forEach(agent => {
      if (!agent.launched) {
        agent.launch(time);
      }
      else {
        agent.move();
        agent.updateTarget();
        agent.draw(context);
      }
    });

    grid5.setStep(math.mapRange(playhead, 0, 1, 7, 10, true));
    grid5.agents.forEach(agent => {
      if (!agent.launched) {
        agent.launch(time);
      }
      else {
        agent.move();
        agent.updateTarget();
        agent.draw(context);
        if (agent.drawLines) {
          agent.drawConnections(context, grid5.agents, params.lineWidth);
        }
      }
    });

  };
};

// RUN THE SKETCH
canvasSketch(sketch, settings);




// CLASSES

// Grid class
class Grid {
  constructor(rows, cols, cellWidth, cellHeight, origin, id, color) {
    this.rows = rows;
    this.cols = cols;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.origin = origin;
    this.id = id;
    this.entities = [];
    this.init();
    this.agents = [];
    this.color = color;
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

  drawConnections(context) {
    this.agents.forEach(agent => {
      agent.drawConnections(context);
    })
  }

  initAgents(agentArray) {
    let groupcount = 0;
    agentArray.forEach(number => {
      // const selectedColor = shuffledColors[groupcount];
      // const color = Color.parse(sanzo.CMYK2RGB(selectedColor.CMYK)).hex;
      const offsetbounds = random.range(params.minOffset, params.maxOffset);
      const groupOffset = { x: random.range(-offsetbounds, offsetbounds), y: random.range((-offsetbounds, offsetbounds)) };
      for (let i = 0; i < number; i++) {
        const agent = new Agent(22, i, groupcount, params.lookRadius, params.smoothfactor, params.linearfactor, this.color, groupOffset, params.step)
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

  setInterpol(val) {
    this.agents.forEach(agent => {
      agent.setInterpol(val);
    });
  }

  setStep(val) {
    this.agents.forEach(agent => {
      agent.setStep(val);
    });
  }

  setDrawRadius(val) {
    this.agents.forEach(agent => {
      agent.setDrawRadius(val);
    });
  }

  setDrawLines(val) {
    this.agents.forEach(agent => {
      agent.setDrawLines(val);
    });
  }

  reset() {
    this.agents.forEach(agent => {
      agent.reset();
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
    this.delayFactor = params.delayFactor;
    this.connectAgents = [];
    this.connectAgentsCoords = [];
    this.drawLines = false;
  }

  launch(frame) {
    if (this.id * this.delayFactor < frame) {
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
    this.target = { x: this.pathCoords[this.targetDot].x, y: this.pathCoords[this.targetDot].y };
    this.dir = true;
    this.launched = false;
  }

  reset() {
    this.spawn();
  }

  updateTarget() {
    // ORDER DIRECTION
    if (this.dir) {
      if (distance(this.position, this.target) < this.lookRadius && this.targetDot < this.path.length - 1) {
        this.targetDot++;
        this.position = this.target;
      }
      else if (distance(this.position, this.target) < this.lookRadius && this.targetDot == this.path.length - 1) {
        this.dir = false;
        this.targetDot--;
        this.position = this.target;
      }
    }
    // REVERSE DIRECTION
    else {
      if (distance(this.position, this.target) < this.lookRadius && this.targetDot > 0) {
        this.targetDot--;
        this.position = this.target;
      }
      else if (distance(this.position, this.target) < this.lookRadius && this.targetDot == 0) {
        this.dir = true;
        this.targetDot++;
        this.position = this.target;
      }
    }
    this.target = { x: this.pathCoords[this.targetDot].x, y: this.pathCoords[this.targetDot].y };
  }

  move() {
    const dist = { x: this.target.x - this.position.x, y: this.target.y - this.position.y };
    const vector = {
      x: (dist.x / this.smoothfactor) * (1 - this.interpol) + normalize(dist).x * this.interpol * this.linearfactor,
      y: (dist.y / this.smoothfactor) * (1 - this.interpol) + normalize(dist).y * this.interpol * this.linearfactor
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
    if (input.randomInterpol) {
      this.interpol = random.range(input.interpolMin, input.interpolMax);
    }
    if (input.drawRadius) {
      this.drawRadius = random.range(input.drawMin, input.drawMax);
    }
    if (input.delayFactor) {
      this.delayFactor = input.delayValue;
    }
  }

  setInterpol(val) {
    this.interpol = val;
  }

  setStep(val) {
    this.step = val;
  }

  setDrawLines(val) {
    this.drawLines = val;
  }

  setDrawRadius(val) {
    this.drawRadius = val;
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

  drawConnections(context, agents, lineWidth) {
    context.strokeStyle = 'black';
    context.save();
    agents.forEach(agent => {
      if (agent.launched) {
        const dist = distance(agent.position, this.position);
        if (dist < params.connectRadius) {
          context.beginPath();
          context.lineWidth = math.mapRange(dist, 0, params.connectRadius, 0.01, lineWidth);
          context.moveTo(this.position.x, this.position.y);
          context.lineTo(agent.position.x, agent.position.y);
          context.stroke();
        }
      }
    });
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