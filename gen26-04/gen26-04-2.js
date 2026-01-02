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
  rows: 400,
  margin: 10,
  limitValue: 1,
  vasTop: 210,
  vas4: 155,
  vas3: 100,
  vas2: 50,
  vasBottom: 10,
  plinTop: 210,
  plin4: 155,
  plin3: 100,
  plin2: 50,
  plinBottom: 10
}




const sketch = async ({ context, width, height, units, exporting, update }) => {
  // Initialize all path arrays
  const plinoPaths = [];
  const vasilPaths = [];




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
  const vasilCanvas = document.createElement('canvas');
  vasilCanvas.width = cols;
  vasilCanvas.height = rows;
  const vasilContext = vasilCanvas.getContext('2d');
  vasilContext.clearRect(0, 0, cols, rows);
  const vasil = await load('./inspiration/vasil-bw.jpg');
  const vr = fitRect(vasil.width, vasil.height, cols, rows, 'contain');
  vasilContext.drawImage(vasil, vr.x, vr.y, vr.w, vr.h);
  const vasilData = vasilContext.getImageData(0, 0, cols, rows).data;

  const plinoCanvas = document.createElement('canvas');
  plinoCanvas.width = cols;
  plinoCanvas.height = rows;
  const plinoContext = plinoCanvas.getContext('2d');
  plinoContext.clearRect(0, 0, cols, rows);
  const plino = await load('./inspiration/plino-bw.jpg');
  const pr = fitRect(plino.width, plino.height, cols, rows, 'contain');
  plinoContext.drawImage(plino, pr.x, pr.y, pr.w, pr.h);
  const plinoData = plinoContext.getImageData(0, 0, cols, rows).data;
  let count = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = grid.cells[count];
      const vd = vasilData[4 * count];
      const pd = plinoData[4 * count];
      const isVasil = checkVal(vd);
      const isPlino = checkVal(pd);
      if (isVasil) {
        cell.drawLetter('vasil', vasilPaths, vd, 0.05, 0.05);
      }
      if (isPlino) {
        cell.drawLetter('plino', plinoPaths, pd, 0.05, 0.05);
      }
      count++;
    }
  }





  // EXPORT + RENDERING
  return ({ context, width, height, units, exporting }) => {

    let vasilLines = pathsToPolylines(vasilPaths, { units });
    let plinoLines = pathsToPolylines(plinoPaths, { units });

    const groups = [
      { id: 'vasilLines', lines: vasilLines },
      { id: 'plinoLines', lines: plinoLines },

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
      return renderPaths([...vasilLines, ...plinoLines], {
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
    this.frameCorner = { x: this.origin.x + this.col * this.cellWidth, y: this.origin.y + this.row * this.cellHeight };
    this.cellCenter = { x: this.frameCorner.x + this.cellWidth / 2, y: this.frameCorner.y + this.cellHeight / 2 };
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

  drawLetter(type, paths, value, scaleMin, scaleMax) {
    // $@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\|()1{}[]?-_+~<>i!lI;:,"^`'.
    // SaLvi
    let letter = [];
    let valMin = [];
    let valMax = [];

    if (type === 'vasil') {
      if (value > params.vasTop) {
        letter = 'i'
        valMin = params.vasTop;
        valMax = 255;
      }
      else if (value > params.vas4 && value <= params.vasTop) {
        letter = 'v';
        valMin = params.vas4;
        valMax = params.vasTop;
      }
      else if (value > params.vas3 && value <= params.vas4) {
        letter = 'L';
        valMin = params.vas3;
        valMax = params.vas4;
      }
      else if (value > params.vas2 && value <= params.vas3) {
        letter = 'a';
        valMin = params.vas2;
        valMax = params.vas3;
      }
      else if (value > params.vasBottom && value <= params.vas2) {
        letter = 'S';
        valMin = params.vasBottom;
        valMax = params.vas2;
      }

    }
    // opLni
    else if (type === 'plino') {
      if (value > params.plinTop) {
        letter = 'i'
        valMin = params.plinTop;
        valMax = 255;
      }
      else if (value > params.plin4 && value <= params.plinTop) {
        letter = 'n';
        valMin = params.plin4;
        valMax = params.plinTop;
      }
      else if (value > params.plin3 && value <= params.plin4) {
        letter = 'L';
        valMin = params.plin3;
        valMax = params.plin4;
      }
      else if (value > params.plin2 && value <= params.plin3) {
        letter = 'p';
        valMin = params.plin2;
        valMax = params.plin3;
      }
      else if (value > params.plinBottom && value <= params.plin2) {
        letter = 'o';
        valMin = params.plinBottom;
        valMax = params.plin2;
      }

    }
    const scale = math.mapRange(value, valMin, valMax, scaleMin, scaleMax);
    const t = hershey.renderTextSVG(letter.toString());
    console.log(this.cellCenter);
    const p = placeRaw(t, { x: this.cellCenter.x, y: this.cellCenter.y, scale: scale }, { mode: 'paths' });
    paths.push(...p);
  }
}

const checkVal = (v) => {
  return v > params.limitValue ? true : false;
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

