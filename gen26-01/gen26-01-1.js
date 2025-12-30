const canvasSketch = require('canvas-sketch');
const { renderPaths, createPath, pathsToPolylines } = require('canvas-sketch-util/penplot');
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');
const Random = require('canvas-sketch-util/random');

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
  ncols: 20,
  nrows: 20,
  shapeType: 'curve', // 'block' | 'line' | 'curve'
  ncontrols: 10, // number of control points (excluiding start/end)
  scaleX: 0.3,
  scaleY: 0.3,
  margin: 20,
};

// FREE FORM HITOMEZASHI PATTERN FOR GENUARY 2026 DAY 1: ONE COLOR - ONE SHAPE
const sketch = (props) => {
  const { width, height, units } = props;

  // Holds all our 'path' objects
  // which could be from createPath, or SVGPath string, or polylines
  const paths = [];

  // POSITIONING OF DRAWING
  const gridWidth = width - params.margin * 2;
  const cellWidth = gridWidth / params.ncols;
  const cellHeight = cellWidth; // square cells
  const gridHeight = cellHeight * params.nrows;
  const origin = {
    x: params.margin,
    y: (height - gridHeight) / 2
  };


  // ------------------------------------------------------
  // ALLL GENERATIVE STUFF GOES HERE 
  // Create a Hitomezashi grid
  const hito = new Grid(params.ncols, params.nrows, origin, cellWidth, cellHeight);
  hito.generateShape();
  hito.generatePattern();
  hito.drawHito(paths);
  // Optional: draw grid edges
  hito.drawEdges(paths);

  console.log(hito.shape);
  console.log(hito.patternX);
  console.log(hito.patternY);




  // ------------------------------------------------------
  // ALLL PLOTTING STUFF GOES HERE vvvvvvvvvv
  // Convert the paths into polylines so we can apply line-clipping
  // When converting, pass the 'units' to get a nice default curve resolution
  let lines = pathsToPolylines(paths, { units });

  // Clip to bounds, using a margin in working units
  const margin = 1; // in working 'units' based on settings
  const box = [margin, margin, width - margin, height - margin];
  lines = clipPolylinesToBox(lines, box);

  // The 'penplot' util includes a utility to render
  // and export both PNG and SVG files
  return props => renderPaths(lines, {
    ...props,
    lineJoin: 'round',
    lineCap: 'round',
    // in working units; you might have a thicker pen
    lineWidth: 0.2,
    // Optimize SVG paths for pen plotter use
    optimize: false
  });
};

canvasSketch(sketch, settings);



// CLASSES

// Grid class
class Grid {
  constructor(ncols, nrows, origin, cellWidth, cellHeight) {
    this.ncols = ncols;
    this.nrows = nrows;
    this.origin = origin;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.shape = [];
    this.patternX = [];
    this.patternY = [];
  }

  generateShape() {
    this.shape = new Shape(params.ncontrols, params.shapeType);
  }

  generatePattern() {
    this.patternX = new Pattern(this.ncols);
    this.patternY = new Pattern(this.nrows);
  }

  drawHito(paths) {
    // Draw horizontal lines
    let startPoint = { x: 0, y: 0 };
    for (let row = 0; row <= this.nrows; row++) {
      const y = this.origin.y + row * this.cellHeight;
      if (this.patternY.pattern[row] === 1) {
        startPoint = {
          x: this.origin.x,
          y: y
        };
      }
      else {
        startPoint = {
          x: this.origin.x + this.cellWidth,
          y: y
        };
      }
      this.shape.drawHorizontal(startPoint, this.cellWidth, params.scaleY, paths);
      for (let col = 0; col < this.ncols - 2; col += 2) {
        startPoint.x += 2 * this.cellWidth;
        this.shape.drawHorizontal(startPoint, this.cellWidth, params.scaleY, paths);
      }
    }
    // Draw vertical lines
    for (let col = 0; col <= this.ncols; col++) {
      const x = this.origin.x + col * this.cellWidth;
      if (this.patternX.pattern[col] === 1) {
        startPoint = {
          x: x,
          y: this.origin.y
        };
      }
      else {
        startPoint = {
          x: x,
          y: this.origin.y + this.cellHeight
        };
      }
      this.shape.drawVertical(startPoint, this.cellHeight, params.scaleX, paths);
      for (let row = 0; row < this.nrows - 2; row += 2) {
        startPoint.y += 2 * this.cellHeight;
        this.shape.drawVertical(startPoint, this.cellHeight, params.scaleX, paths);
      }
    }
  }

  drawEdges(paths) {
    // Remaining Top Edge
    let startPoint = {
      x: this.origin.x,
      y: this.origin.y
    };
    if (this.patternY.pattern[0] === 1) {
      startPoint.x += this.cellWidth;
    }
    this.shape.drawHorizontal(startPoint, this.cellWidth, params.scaleY, paths);
    for (let col = 0; col < this.ncols - 2; col += 2) {
      startPoint.x += 2 * this.cellWidth;
      this.shape.drawHorizontal(startPoint, this.cellWidth, params.scaleY, paths);
    }
    // Remaining Bottom Edge
    startPoint = {
      x: this.origin.x,
      y: this.origin.y + this.nrows * this.cellHeight
    };
    if (this.patternY.pattern[this.patternY.pattern.length] === 1) {
      startPoint.x += this.cellWidth;
    }
    this.shape.drawHorizontal(startPoint, this.cellWidth, params.scaleY, paths);
    for (let col = 0; col < this.ncols - 2; col += 2) {
      startPoint.x += 2 * this.cellWidth;
      this.shape.drawHorizontal(startPoint, this.cellWidth, params.scaleY, paths);
    }

    // Remaining Left Edge
    startPoint = {
      x: this.origin.x,
      y: this.origin.y
    };
    if (this.patternX.pattern[0] === 1) {
      startPoint.y += this.cellHeight;
    }
    this.shape.drawVertical(startPoint, this.cellHeight, params.scaleX, paths);
    for (let row = 0; row < this.nrows - 2; row += 2) {
      startPoint.y += 2 * this.cellHeight;
      this.shape.drawVertical(startPoint, this.cellHeight, params.scaleX, paths);
    }
    // Remaining Right Edge
    startPoint = {
      x: this.origin.x + this.ncols * this.cellWidth,
      y: this.origin.y
    };
    if (this.patternX.pattern[this.patternX.pattern.length] === 1) {
      startPoint.y += this.cellHeight;
    }
    this.shape.drawVertical(startPoint, this.cellHeight, params.scaleX, paths);
    for (let row = 0; row < this.nrows - 2; row += 2) {
      startPoint.y += 2 * this.cellHeight;
      this.shape.drawVertical(startPoint, this.cellHeight, params.scaleX, paths);
    }


  }

}

// Single shape class for separation line (polyline/curve)
class Shape {
  constructor(ncontrols, type) {
    this.npoints = ncontrols;
    this.type = type;
    this.points = [{ x: 0, y: 0 }];
    this.initialize();
  }

  // Initialize shape creation based on type and control points + additional parameters
  // Shape is created in a normalized 1x1 space for later scaling (x - 0 to 1, y - -1 to 1)
  initialize() {
    if (this.type === 'block') {
      this.generateBlockShape();
    } else if (this.type === 'line') {
      this.generateLineShape();
    } else if (this.type === 'curve') {
      this.generateCurveShape();
    }
  }
  // Generate block shape (stepped)
  generateBlockShape() {
    for (let i = 0; i < this.npoints; i++) {
      this.points.push({
        x: Random.value(),
        y: (Random.value() - 0.5) * 2
      });
    }
    this.points.push({ x: 1, y: 0 });

    // Sort points by x value to ensure proper drawing order
    this.points.sort((a, b) => a.x - b.x);
  }

  // Generate line shape (straight line segments)
  generateLineShape() {
    this.points.push({ x: 1, y: 0 });
  }

  // Generate curve shape (Bezier curve)
  generateCurveShape() {
    for (let i = 0; i < this.npoints; i++) {
      this.points.push({
        x: Random.value(),
        y: 0
      });
    }
    this.points.push({ x: 1, y: 0 });
    this.points.sort((a, b) => a.x - b.x);
  }

  drawHorizontal(startPoint, cellWidth, scaleY, paths) {
    // Draw shape based on type
    if (this.type === 'block') {
      const path = createPath();
      path.moveTo(
        startPoint.x + this.points[0].x,
        startPoint.y + this.points[0].y
      );
      for (let i = 1; i < this.points.length; i++) {
        const pt = this.points[i];
        path.lineTo(
          startPoint.x + pt.x * cellWidth,
          startPoint.y + pt.y * scaleY
        );
      }
    }
    else if (this.type === 'line') {
      const path = createPath();

      path.moveTo(
        startPoint.x + this.points[0].x,
        startPoint.y + this.points[0].y
      );
      for (let i = 1; i < this.points.length; i++) {
        const pt = this.points[i];
        path.lineTo(
          startPoint.x + pt.x * cellWidth,
          startPoint.y + pt.y * scaleY
        );
      }
    }
    else if (this.type === 'curve') {
      // For simplicity, using lineTo for curve points; can be replaced with bezierCurveTo for smoother curves
      let travelledX = 0;
      for (let i = 1; i < this.points.length; i++) {
        let path = createPath();
        const pt1 = this.points[i - 1];
        const pt2 = this.points[i];
        const segW = (pt2.x - pt1.x) * cellWidth;
        const r = segW / 2;
        const cx = startPoint.x + travelledX + r;
        const cy = startPoint.y;

        const startAngle = 0;
        const endAngle = Math.PI;
        const ccw = (i % 2 === 0);
        // Arc start point in canvas coordinates
        path.arc(cx, cy, r, startAngle, endAngle, ccw);
        travelledX += segW;
        paths.push(path);

      }

    }

    if (this.type !== 'curve') {
      paths.push(path);
    }

  }


  drawVertical(startPoint, cellHeight, scaleX, paths) {
    // Move to start point

    // Draw shape based on type
    if (this.type === 'block') {
      const path = createPath();
      path.moveTo(
        startPoint.x + this.points[0].x,
        startPoint.y + this.points[0].y
      );
      for (let i = 1; i < this.points.length; i++) {
        const pt = this.points[i];
        path.lineTo(
          startPoint.x + pt.y * scaleX,
          startPoint.y + pt.x * cellHeight,
        );
      }
    }
    else if (this.type === 'line') {
      const path = createPath();

      path.moveTo(
        startPoint.x + this.points[0].x,
        startPoint.y + this.points[0].y
      );
      for (let i = 1; i < this.points.length; i++) {
        const pt = this.points[i];
        path.lineTo(
          startPoint.x + pt.y * scaleX,
          startPoint.y + pt.x * cellHeight,
        );
      }
    }
    else if (this.type === 'curve') {
      let travelledY = 0;
      for (let i = 1; i < this.points.length; i++) {
        let path = createPath();
        const pt1 = this.points[i - 1];
        const pt2 = this.points[i];
        const segH = (pt2.x - pt1.x) * cellHeight;
        const r = segH / 2;
        const cx = startPoint.x;
        const cy = startPoint.y + travelledY + r;

        const startAngle = Math.PI / 2;
        const endAngle = 3 * Math.PI/2;
        const ccw = (i % 2 === 0);
        path.arc(cx, cy, r, startAngle, endAngle, ccw);
        travelledY += segH;
        paths.push(path);
      }
    }
    if (this.type !== 'curve') {
      paths.push(path);
    }
  }
}

// Pattern class for generating the hitomezashi pattern
class Pattern {
  constructor(n) {
    this.pattern = [];
    this.initialize(n);
  }

  initialize(n) {
    for (let i = 0; i < n; i++) {
      this.pattern.push(Random.value() > 0.5 ? 1 : 0);
    }
  }
}



// FUNCTIONS