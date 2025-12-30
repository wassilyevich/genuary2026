const canvasSketch = require('canvas-sketch');
const { renderPaths, createPath, pathsToPolylines } = require('canvas-sketch-util/penplot');
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');
const Random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');
const { bundleRawGroups, placeRaw, makeUnitConverters, renderGroupedSVG } = require('./penplot-utils');
const hershey = require('hersheytext');

// You can force a specific seed by replacing this with a string value
const defaultSeed = '';

// Set a random seed so we can reproduce this print later
Random.setSeed(defaultSeed || Random.getRandomSeed());

// Print to console so we can see which seed is being used and copy it if desired
console.log('Random Seed:', Random.getSeed());

const settings = {
  suffix: Random.getSeed(),
  dimensions: 'A4',
  orientation: 'portrait',
  pixelsPerInch: 300,
  scaleToView: true,
  units: 'mm'
};

const params = {
  rows: 100,
  margin: 10
}

const sketch = ({ context, width, height, units }) => {

  // POSITIONING
  const drawWidth = width - 2 * params.margin;
  const drawHeight = height - 2 * params.margin;
  const rows = params.rows;
  const cellHeight = drawHeight / rows;
  const cols = Math.floor(drawWidth / cellHeight);
  const cellWidth = drawWidth / cols;
  const origin = { x: params.margin, y: params.margin };


  // ALL PATH GROUPS
  const framePaths = [];

  // ACTUAL GENERATIVE PART
  const grid = new Grid(rows, cols, cellWidth, cellHeight, origin)
  grid.draw(framePaths);





  // Convert the paths into polylines so we can apply line-clipping
  // When converting, pass the 'units' to get a nice default curve resolution
  let frameLines = pathsToPolylines(framePaths, { units });

  // Clip to bounds, using a margin in working units
  const margin = 1; // in working 'units' based on settings
  const box = [margin, margin, width - margin, height - margin];
  frameLines = clipPolylinesToBox(frameLines, box);

  // The 'penplot' util includes a utility to render
  // and export both PNG and SVG files
  return props => renderPaths(frameLines, {
    ...props,
    lineJoin: 'round',
    lineCap: 'round',
    // in working units; you might have a thicker pen
    lineWidth: 0.08,
    // Optimize SVG paths for pen plotter use
    optimize: true
  });
};

canvasSketch(sketch, settings);


// CLASSES
class Grid {
  constructor(rows, cols, cellWidth, cellHeight, origin) {
    this.rows = rows;
    this.cols = cols;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.origin = origin;
    this.total = this.rows * this.cols;
    this.cells = [];
    this.initialize();
  }

  initialize() {
    let count = 1;
    const fibo = fibonacci(this.total);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const frameCorner = { x: this.origin.x + col * this.cellWidth, y: this.origin.y + row * this.cellHeight };
        const isFibo = fibo.includes(count) ? true : false;
        const cell = new Cell(row, col, frameCorner, this.cellWidth, this.cellHeight, count, isFibo);
        this.cells.push(cell);
        count++;
      }
    }
  }

  draw(paths) {
    this.cells.forEach(cell => {
      cell.drawFrame(paths);
      if (cell.isFibo){
        cell.drawCenter(paths, cell.cellWidth/4);
      }
    });

  }
}

class Cell {
  constructor(row, col, frameCorner, cellWidth, cellHeight, id, isFibo) {
    this.row = row;
    this.col = col;
    this.id = id;
    this.isFibo = isFibo;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.frameCorner = frameCorner;
  }

  drawFrame(paths) {
    const p = createPath();
    p.moveTo(this.frameCorner.x, this.frameCorner.y);
    p.lineTo(this.frameCorner.x + this.cellWidth, this.frameCorner.y);
    p.lineTo(this.frameCorner.x + this.cellWidth, this.frameCorner.y + this.cellHeight);
    p.lineTo(this.frameCorner.x, this.frameCorner.y + this.cellHeight);
    p.closePath();
    paths.push(p);
  }

  drawCenter(paths, radius){
    const p = createPath();
    p.arc(this.frameCorner.x + this.cellWidth/2, this.frameCorner.y + this.cellHeight/2, radius, 0, 2*Math.PI);
    paths.push(p);
  }
}



// FUNCTIONS

// Returns first n fibonacci numbers starting from 1
function fibonacci(n) {
  const sequence = [1, 1];
  for (let i = 2; i < n; i++) {
    sequence.push(sequence[i - 2] + sequence[i - 1]);
  }
  return sequence;
}

// Returns nth value from the fibonacci sequence starting from 1 (very inefficiently)
function fibonacciN(n) {
  return fibonacci(n).pop();
}