const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random')
const math = require('canvas-sketch-util/math')
const { renderPaths, createPath, pathsToPolylines } = require('canvas-sketch-util/penplot');
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');
const sanzo = require('sanzo-color');
const { bundleRawGroups, placeRaw, makeUnitConverters, renderGroupedSVG } = require('./penplot-utils');
const hershey = require('hersheytext');
const load = require('load-asset');


// You can force a specific seed by replacing this with a string value
const defaultSeed = '';
// Set a random seed so we can reproduce this print later
random.setSeed(defaultSeed || random.getRandomSeed());

// Print to console so we can see which seed is being used and copy it if desired
console.log('Random Seed:', random.getSeed());

const settings = {
  suffix: random.getSeed(),
  dimensions: 'A4',
  units: 'mm',  // Set units to millimeters
  orientation: 'portrait',
  pixelsPerInch: 300,
  scaleToView: true,
};


const params = {
  rows: 100,
  margin: 10
}




const sketch = async ({ context, width, height, units, exporting, update }) => {
  // Initialize all path arrays
  const framePaths = [];




  // POSITIONING
  const margin = 0;
  const drawWidth = width - 2 * params.margin;
  const drawHeight = height - 2 * params.margin;
  const rows = params.rows;
  const cellHeight = drawHeight / rows;
  const cols = Math.floor(drawWidth / cellHeight);
  const cellWidth = drawWidth / cols;
  const origin = { x: params.margin, y: params.margin };

  // Actual code
  const grid = new Grid(rows, cols, cellWidth, cellHeight, origin)

  // OTHER CANVAS
  const typeCanvas = document.createElement('canvas');
  typeCanvas.width = cols;
  typeCanvas.height = rows;
  const typeContext = typeCanvas.getContext('2d');
  typeContext.clearRect(0, 0, cols, rows);
  const image = await load('./inspiration/jongens.jpeg');
  const r = fitRect(image.width, image.height, cols, rows, 'contain');
  typeContext.drawImage(image, r.x, r.y, r.w, r.h);
  const typeData = typeContext.getImageData(0, 0, cols, rows).data;
  let count = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = grid.cells[count];
      const x = col * cell;
      const y = row * cell;
      const r = typeData[4 * count];

      const isDot = checkVal(r);
      if (isDot) {
        const radius = r / 200;
        cell.drawDot(framePaths, radius);
      }
      count++;
    }
  }





  // EXPORT + RENDERING
  return ({ context, width, height, units, exporting }) => {



    // Convert the paths into polylines and clip to bounds
    let lines = pathsToPolylines(framePaths, { units: settings.units });

    // Clip to bounds, using a margin in working units
    const box = [margin, margin, width - margin, height - margin];
    lines = clipPolylinesToBox(lines, box);

    const groups = [
      { id: 'lines', lines: lines },

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
      return renderPaths([...lines], {
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
  };
};



// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%CLASSES AND FUNCTIONS
canvasSketch(sketch, settings);



class Grid {
  constructor(rows, cols, cellWidth, cellHeight, origin) {
    this.rows = rows;
    this.cols = cols;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.origin = origin;
    this.cells = [];
    this.initialize();
  }

  initialize() {
    let count = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.cells.push(new Cell(row, col, this.cellWidth, this.cellHeight, this.origin, count));
        count++;
      }
    }
  }

  drawFrames(paths) {
    this.cells.forEach(cell => {
      cell.drawFrame(paths);
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
  }

  drawFrame(paths) {
    const p = createPath();
    p.moveTo(this.origin.x + this.col * this.cellWidth, this.origin.y + this.row * this.cellHeight);
    p.lineTo(this.origin.x + this.col * this.cellWidth + this.cellWidth, this.origin.y + this.row * this.cellHeight);
    p.lineTo(this.origin.x + this.col * this.cellWidth + this.cellWidth, this.origin.y + this.row * this.cellHeight + this.cellHeight);
    p.lineTo(this.origin.x + this.col * this.cellWidth, this.origin.y + this.row * this.cellHeight + this.cellHeight);
    p.closePath();
    paths.push(p);
  }

  drawDot(paths, radius) {
    const p = createPath();
    p.arc(this.origin.x + this.col * this.cellWidth + this.cellWidth / 2, this.origin.y + this.row * this.cellHeight + this.cellHeight / 2, radius, 0, 2 * Math.PI)
    paths.push(p);
  }
}

const checkVal = (v) => {
  return v > 1 ? true : false;
}

function fitRect(srcW, srcH, dstW, dstH, mode = 'contain') {
  const s = mode === 'cover'
    ? Math.max(dstW / srcW, dstH / srcH)
    : Math.min(dstW / srcW, dstH / srcH);

  const w = srcW * s;
  const h = srcH * s;
  const x = (dstW - w) / 2;
  const y = (dstH - h) / 2;
  return { x, y, w, h };
}
