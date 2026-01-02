const canvasSketch = require('canvas-sketch');
const { renderPaths, createPath, pathsToPolylines } = require('canvas-sketch-util/penplot');
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');
const random = require('canvas-sketch-util/random');
import list from './adressees.json';

// You can force a specific seed by replacing this with a string value
const defaultSeed = '';

// Set a random seed so we can reproduce this print later
random.setSeed(defaultSeed || random.getRandomSeed());

// Print to console so we can see which seed is being used and copy it if desired
console.log('Random Seed:', random.getSeed());

const settings = {
  suffix: random.getSeed(),
  dimensions: [100, 148], // in working 'units' based on settings
  orientation: 'portrait',
  pixelsPerInch: 300,
  scaleToView: true,
  units: 'mm'
};

const params = {
  // Define any parameters you want to tweak from the UI
  cellsize: 0.2,
  nBrushes: 200,
  margin: 5,
  lookRadius: 5,
  steps: 1000,
  forceFactor: 0.005,
  linethickness: 0.2,
  jitter: 0.2,
  text: "SCHOL"
};

let fontSize = 1;
let fontFamily = 'sans-serif';

let manager;

const typeCanvas = document.createElement('canvas');
const typeContext = typeCanvas.getContext('2d');

const textCanvas = document.createElement('canvas');
const textContext = textCanvas.getContext('2d');


const sketch = ({ context, width, height }) => {
  const cell = params.cellsize;
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);
  const numCells = cols * rows;

  typeCanvas.width = cols;
  typeCanvas.height = rows

  typeContext.fillStyle = 'black';
  typeContext.fillRect(0, 0, cols, rows);

  const text = params.text;

  fontSize = cols * 0.22;
  typeContext.fillStyle = 'white';
  typeContext.font = `${fontSize}px ${fontFamily}`;
  typeContext.textBaseline = 'top';

  const metrics = typeContext.measureText(text);
  const mx = metrics.actualBoundingBoxLeft * -1;
  const my = metrics.actualBoundingBoxAscent * -1;
  const mw = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const mh = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

  const tx = (cols - mw) / 2 - mx;
  const ty = 1 * (rows - mh) / 3 - my;


  typeContext.save();
  typeContext.translate(tx, ty);
  typeContext.fillText(text, 0, 0);
  typeContext.restore();


  const typeData = typeContext.getImageData(0, 0, cols, rows).data;
  const dots = [];

  for (let i = 0; i < numCells; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const x = col * cell;
    const y = row * cell;
    const r = typeData[4 * i];

    const isDot = checkVal(r);
    if (isDot) {
      const radius = cell * 0.3;
      const dot = new Dot(x + cell / 2, y + cell / 2, radius);
      dots.push(dot);
    }
  };




  const brushes = [];
  // BRUSH DOTS
  for (let i = 0; i < params.nBrushes; i++) {
    const bx = params.margin + i * ((width - 2 * params.margin) / params.nBrushes);
    const b = new Brush(bx, params.margin);
    brushes.push(b);
  }

  // create paths (i.e. brush strokes) for each brush and distort based on nearby dots
  const paths = [];
  const steps = params.steps;
  const stepSize = ((2 * height / 3)) / steps;
  brushes.forEach(b => {
    const path = createPath();
    path.moveTo(b.x, b.y);


    let currentY = b.y;
    for (let i = 0; i < steps; i++) {
      let currentX = b.x;
      // find nearby dots
      const nearbyDots = dots.filter(d => {
        const dx = d.x - currentX;
        const dy = d.y - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < params.lookRadius;
      });
      // calculate displacement
      let dispX = 0;
      dispX += params.jitter * random.gaussian(0, 0.1); // add some noise
      nearbyDots.forEach(d => {
        const dx = d.x - currentX;
        const dy = d.y - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (params.lookRadius - dist) / params.lookRadius;
        dispX -= (dx / dist) * force * params.forceFactor; // repel
      });
      // update brush position
      currentX += dispX;
      currentY += stepSize;
      path.lineTo(currentX, currentY);
    }
    paths.push(path);
  });

  // Create outline of entire drawing
  const outline = createPath();
  outline.moveTo(0, 0);
  outline.lineTo(width , 0);
  outline.lineTo(width , height);
  outline.lineTo(0, height);
  outline.closePath();
  paths.push(outline);
  





  // Convert the paths into polylines so we can apply line-clipping
  // When converting, pass the 'units' to get a nice default curve resolution
  let lines = pathsToPolylines(paths, { units: 'mm' });

  // Clip to bounds, using a margin in working units
  const margin = params.margin; // in working 'units' based on settings
  const box = [0, 0, width, height];
  lines = clipPolylinesToBox(lines, box);





  // The 'penplot' util includes a utility to render
  // and export both PNG and SVG files
  return props => renderPaths(lines, {
    ...props,
    lineJoin: 'round',
    lineCap: 'round',
    // in working units; you might have a thicker pen
    lineWidth: params.linethickness,
    // Optimize SVG paths for pen plotter use
    optimize: true
  });
};



const start = async () => {
  manager = await canvasSketch(sketch, settings);
};

start();

const checkVal = (v) => {
  return v > 50 ? true : false;
}

class Dot {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
  }

  draw(context) {
    context.save();
    context.translate(this.x, this.y);
    context.beginPath();
    context.arc(0, 0, this.r, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

class Brush {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  draw(context) {
    context.fillStyle = 'white';
    context.save();
    context.translate(this.x, this.y);
    context.beginPath();
    context.arc(0, 0, 0.2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}


class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}