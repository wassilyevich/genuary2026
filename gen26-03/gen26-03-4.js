const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random')
const math = require('canvas-sketch-util/math')
const { renderPaths, createPath, pathsToPolylines } = require('canvas-sketch-util/penplot');
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');
const sanzo = require('sanzo-color');
const { bundleRawGroups, placeRaw, makeUnitConverters, renderGroupedSVG } = require('./penplot-utils');
const hershey = require('hersheytext');



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






const sketch = ({ context, width, height, units, exporting }) => {
  // Holds all our 'path' objects
  const paths = [];
  const initPointPaths = [];

  // Initialize points arrays here so they reset on each save
  const points = [];
  const goldenPoints = [];

  // Calculate aspect ratio
  const aspect = width / height;

  // %%%%%%%%%%%%%%%%%%%%% GOLDEN RATIO PART %%%%%%%%%%%%%%%%%%%%%
  let theta = 0;
  for (let i = 0; i < goldenIter; i++) {
    let coords = goldenCoords(theta);
    // Adjust goldScale ranges based on aspect ratio
    const goldScaleX = goldScale * aspect;
    const goldScaleY = goldScale;
    // Map directly to the actual dimensions
    let goldX = math.mapRange(coords[0], -goldScaleX, goldScaleX, margin, width - margin);
    let goldY = math.mapRange(coords[1], -goldScaleY, goldScaleY, margin, height - margin);
    let goldenPoint = new GoldPoint(goldX, goldY, radius);
    goldenPoints.push(goldenPoint);
    theta += thetaInc;
  }
  // Create golden path
  const goldenPath = new Path(goldenPoints);

  // %%%%%%%%%%%%%%%%%% CLOUD PART %%%%%%%%%%%%%%%%%%%%%%%

  // Initialize points in the actual dimensions
  for (let i = 0; i < nPoints; i++) {
    let x = random.range(2 * margin, width - 2 * margin);
    let y = random.range(2 * margin, height - 2 * margin);
    let point = new Point(x, y, radius);
    const p = createPath();
    p.arc(x, y, radius*4, 0, 2*Math.PI);
    initPointPaths.push(p);
    points.push(point);
  }

  

  // Draw points and lines
  const path = new Path(points);

  // Create separate layers for each draw
  for (let i = 0; i < nDraws; i++) {
    const initPath = path.clone();
    for (let j = 0; j < maxIter; j++) {
      initPath.movePoints(amt, width, height, margin, goldenPath, width, move, p);
    }
    const polylines = initPath.toPolylines();
    paths.push(...polylines);
  }

  // EXPORT + RENDERING
  return ({ context, width, height, units, exporting }) => {



    // Convert the paths into polylines and clip to bounds
    let lines = pathsToPolylines(paths, { units: settings.units });
    let initPointLines = pathsToPolylines(initPointPaths, { units: settings.units });

    // Clip to bounds, using a margin in working units
    const box = [margin, margin, width - margin, height - margin];
    lines = clipPolylinesToBox(lines, box);
    initPointLines = clipPolylinesToBox(initPointLines, box);

    const groups = [
      { id: 'goldenLines', lines: lines },
      { id: 'initPoints', lines: initPointLines },

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
      return renderPaths([...lines, ...initPointLines], {
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

class Path {
  constructor(points) {
    this.points = points;
  }

  toPolylines() {
    const polylines = [];
    const steps = 50; // Number of points to sample along each curve

    // Create a single continuous polyline
    const continuousPolyline = [];

    for (let i = 1; i < this.points.length - 2; i += 2) {
      const start = [this.points[i - 1].x + this.points[i - 1].r, this.points[i - 1].y + this.points[i - 1].r];
      const control = [this.points[i].x + this.points[i].r, this.points[i].y + this.points[i].r];
      const end = [this.points[i + 1].x + this.points[i + 1].r, this.points[i + 1].y + this.points[i + 1].r];

      // For the first point, add it only if it's the first segment
      if (i === 1) {
        continuousPolyline.push(start);
      }

      // Add points along the curve
      for (let t = 0; t <= 1; t += 1 / steps) {
        // Quadratic Bézier curve formula
        const x = Math.pow(1 - t, 2) * start[0] + 2 * (1 - t) * t * control[0] + Math.pow(t, 2) * end[0];
        const y = Math.pow(1 - t, 2) * start[1] + 2 * (1 - t) * t * control[1] + Math.pow(t, 2) * end[1];
        continuousPolyline.push([x, y]);
      }
    }

    polylines.push(continuousPolyline);
    return polylines;
  }

  drawPath(context, drawRandom) {

    context.lineWidth = 0.1;
    context.strokeStyle = 'black';
    if (drawRandom) {
      const color = ['#da4167', '#43aa8b', '#e4b7e5', '#ed9b40', '#120d31']
      context.strokeStyle = random.pick(color);
    }



    for (let i = 1; i < this.points.length - 2; i += 2) {
      context.beginPath();
      context.moveTo(this.points[i - 1].x + this.points[i - 1].r, this.points[i - 1].y + this.points[i - 1].r);
      context.quadraticCurveTo(this.points[i].x + this.points[i].r, this.points[i].y + this.points[i].r, this.points[i + 1].x + this.points[i + 1].r, this.points[i + 1].y + this.points[i + 1].r);
      context.stroke();
    }
  }


  drawPoints(context) {
    for (let i = 0; i < this.points.length; i++) {
      context.save();
      context.beginPath();
      context.fillStyle = 'black';
      context.arc(this.points[i].x + this.points[i].r, this.points[i].y + this.points[i].r, this.points[i].r, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }


  movePoints(amt, width, height, margin, goldenPath, lookRadius, move, p) {

    // console.log(pointsCopy);
    for (let i = 0; i < this.points.length; i++) {
      let jitterX = random.range(-1, 1) * amt;
      let jitterY = random.range(-1, 1) * amt;
      this.points[i].attraction(goldenPath, lookRadius, move, p)
      let newX = this.points[i].x + jitterX;
      let newY = this.points[i].y + jitterY;
      if (newX < margin) newX = margin;
      if (newX > width - margin) newX = width - margin;
      if (newY < margin) newY = margin;
      if (newY > height - margin) newY = height - margin;
      this.points[i].x = newX;
      this.points[i].y = newY;
    }
  }



  clone() {
    return new Path(this.points);
  }


}

// Point class draws point on given location x,y with radius r
class Point {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.r = radius;
  }

  attraction(goldenPath, lookRadius, move, p) {
    let numerator = [0, 0];
    let denominator = 0;
    let vector = [0, 0];
    let count = 0;
    for (let j = 0; j < goldenPath.points.length; j++) {
      let dist = distance(this, goldenPath.points[j]);
      if (dist < lookRadius) {
        count = count + 1;
        let dx = goldenPath.points[j].x - this.x;
        let dy = goldenPath.points[j].y - this.y;
        numerator[0] += dx / (Math.pow(dist, p) * lookRadius);
        numerator[1] += dy / (Math.pow(dist, p) * lookRadius);
        denominator += 1 / Math.pow(dist, p);
      }
    }

    if (count >= 1) {
      vector[0] = numerator[0] / denominator;
      vector[1] = numerator[1] / denominator;
      // console.log(vector)
      this.x += vector[0] * move;
      this.y += vector[1] * move;
    }
  }

  draw(paths){
    const p = createPath();
    p.arc(this.x, this.y, this.radius, 0, 2*Math.PI);
    paths.push(p);
  }

}

// Point class draws Golden point on given location x,y with radius r
class GoldPoint {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.r = radius;
  }
}

class Vector {
  constructor(vx, vy) {
    this.vx = vx;
    this.vy = vy;
  }
}


// FUNCTIONS
const goldenCoords = (theta) => {
  const r = Math.pow(Math.E, 0.30635 * theta);
  const x = r * Math.cos(theta);
  const y = r * Math.sin(theta);
  const coords = [x, y];
  return coords;

}

const distance = (point1, point2) => {
  let dx = point1.x - point2.x;
  let dy = point1.y - point2.y;
  return Math.sqrt((dx * dx) + (dy * dy));
}
