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

const n = 5;
const f = fibonacci(n);


const params = {
  rows: 20,
  margin: 10,
  frequency: 0.025,
  noiseSpread: 1,
  textScale: 0.05,
  factor: f[f.length-1],
  n: n
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
  const valPaths = [];

  // ACTUAL GENERATIVE PART
  const grid = new Grid(rows, cols, cellWidth, cellHeight, origin, params.factor, params.n);
  grid.draw(framePaths, valPaths);
 

  return ({ context, width, height, units, exporting }) => {
    // Convert the paths into polylines so we can apply line-clipping
    // When converting, pass the 'units' to get a nice default curve resolution
    let frameLines = pathsToPolylines(framePaths, { units });
    let valLines = pathsToPolylines(valPaths, { units });


    // Clip to bounds, using a margin in working units
    const margin = 0; // in working 'units' based on settings
    const box = [margin, margin, width - margin, height - margin];
    frameLines = clipPolylinesToBox(frameLines, box);
    valLines = clipPolylinesToBox(valLines, box);
    const groups = [
      { id: 'frame-paths', lines: frameLines },
      { id: 'text-paths', lines: valLines }

    ];


    if (context && exporting) {
      const svg = renderGroupedSVG(groups, {
        width,
        height,
        units: settings.units,
        strokeWidth: 0.2,
        lineJoin: 'round',
        lineCap: 'round',
        inkscapeLayers: false // optioneel: dan worden het echte layers in inkscape
      });
      return { name: 'grouped-', suffix: `S-${Date.now()}`, data: svg, extension: '.svg' };
    }

    // PNG preview: render alles plat (zoals altijd)
    if (!exporting) {
      return renderPaths([...frameLines, ...valLines], {
        context,
        width,
        height,
        units: settings.units,
        lineJoin: 'round',
        lineCap: 'round',
        lineWidth: 0.2,
        optimize: false
      });
    }



  }
};

canvasSketch(sketch, settings);


// CLASSES
class Grid {
  constructor(rows, cols, cellWidth, cellHeight, origin, factor, n) {
    this.rows = rows;
    this.cols = cols;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.origin = origin;
    this.total = this.rows * this.cols;
    this.cells = [];
    this.factor = factor;
    this.n = n;
    this.initialize();
  }

  initialize() {
    let count = 1;
    const fibo = fibonacci(this.n)
    console.log(fibo);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const frameCorner = { x: this.origin.x + col * this.cellWidth, y: this.origin.y + row * this.cellHeight };
        // Sample noise
        let noise = Random.noise2D(col * params.noiseSpread, row * params.noiseSpread, params.frequency, 1);
        noise = (noise + 1) / 2;
        noise *= this.factor;
        noise = Math.round(noise);
        let difference = [];
        fibo.forEach(number => {
          console.log(number);
          difference.push(Math.abs(number - noise));
        });
        console.log(difference);
        const closestFibo = fibo[indexOfSmallest(difference)];
        const cell = new Cell(row, col, frameCorner, this.cellWidth, this.cellHeight, closestFibo, closestFibo/fibo[fibo.length-1]);
        this.cells.push(cell);
        count++;
      }
    }
  }

  draw(framePaths, valPaths) {
    this.cells.forEach(cell => {
      // cell.drawFrame(framePaths);
      cell.drawVal(valPaths);
    });

  }
}

class Cell {
  constructor(row, col, frameCorner, cellWidth, cellHeight, val, scale) {
    this.row = row;
    this.col = col;
    this.val = val;
    this.scale = scale;
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

  drawVal(paths) {
    // 1) genereer alles op 0,0 (hersheytext output is meestal al een <g>...</g>)
    const t = hershey.renderTextSVG(this.val.toString());
    // 2) positioneer elk blok in jouw units (cm/mm) -> px via toPx
    const x = this.frameCorner.x + this.cellWidth / 2;
    const y = this.frameCorner.y + this.cellHeight / 2;
    const p = placeRaw(t, { x, y, scale: this.cellHeight*params.textScale*this.scale }, {mode: 'paths'});
    paths.push(...p);
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

function indexOfSmallest(a) {
  var lowest = 0;
  for (var i = 1; i < a.length; i++) {
    if (a[i] < a[lowest]) lowest = i;
  }
  return lowest;
}