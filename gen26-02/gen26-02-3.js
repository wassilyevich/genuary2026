const canvasSketch = require('canvas-sketch');
const { renderPaths, createPath, pathsToPolylines } = require('canvas-sketch-util/penplot');
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');
const Random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');
const { renderGroupedSVG } = require('./penplot-utils');

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
  margin: 20,
  error: 0.9,
  tries: 10,
  frames: 240,
  frameAspect: [4, 5], // width to height ratio
  resolution: 100,
  flight: 0.25, // <= 0.5
  kmax: 1.2,
  kmin: 0.65,
  nmax: 3
};

const sketch = ({ context, width, height, units }) => {
  return ({ context, width, height, units, exporting }) => {

    const flight = params.flight;
    const squash = (1 - 2 * flight) / 2;

    // PATH GROUPS
    const framePaths = [];
    const ballPaths = [];
    const wallPaths = [];

    // ACTUAL SKETCH CODE GOES HERE
    // MAKE GRID WITH CELL FOR EACH FRAME OF THE ANIMATION
    const ratio = params.frameAspect[0] / params.frameAspect[1];
    let drawWidth = width - params.margin * 2;
    let drawHeight = height - params.margin * 2;
    let frameHeight = 0;
    let frameWidth = 0;
    let nb = 0;
    let nh = 0;
    let e = 0;

    for (let i = 0; i < params.tries; i++) {
      let D = (drawWidth / ratio) ** 2 + 4 * ((drawWidth * drawHeight) / ratio) * (params.frames - e);
      let h = (- (drawWidth / ratio) + Math.sqrt(D)) / (2 * (params.frames - e));
      if (h > 0) {
        frameHeight = h;
        frameWidth = h * ratio;
        nb = Math.floor(drawWidth / frameWidth);
        nh = Math.floor(drawHeight / frameHeight);
        console.log(`Try ${i}: nb=${nb}, nh=${nh}, fw=${frameWidth}, fh=${frameHeight}`);
        if (nb * nh >= params.frames && nb * frameWidth > width - 2 * params.error * params.margin) {
          break;
        } else {
          e++;
        }
      }
    }

    let totalframes = nb * nh;
    if (e > 0) {
      totalframes += e;
      nb += 1;
    }

    const gridOrigin = {
      x: (width - (nb * frameWidth)) / 2,
      y: (height - (nh * frameHeight)) / 2
    };

    drawWidth = nb * frameWidth;
    drawHeight = nh * frameHeight;
    const grid = new Grid(nb, nh, totalframes, frameWidth, frameHeight, gridOrigin, flight, squash);
    console.log(`Final: nb=${nb}, nh=${nh}, fw=${frameWidth}, fh=${frameHeight}, totalframes=${totalframes}`);
    grid.drawFrames(framePaths);
    grid.drawBalls(ballPaths, wallPaths);

    // Convert the paths into polylines so we can apply line-clipping
    // When converting, pass the 'units' to get a nice default curve resolution
    let frameLines = pathsToPolylines(framePaths, { units });
    let ballLines = pathsToPolylines(ballPaths, { units });
    let wallLines = pathsToPolylines(wallPaths, { units });

    // Clip to bounds, using a margin in working units
    const margin = 0; // in working 'units' based on settings
    const box = [margin, margin, width - margin, height - margin];
    frameLines = clipPolylinesToBox(frameLines, box);
    ballLines = clipPolylinesToBox(ballLines, box);
    wallLines = clipPolylinesToBox(wallLines, box);

    const groups = [
      { id: 'frame-paths', lines: frameLines },
      { id: 'ball-paths', lines: ballLines },
      { id: 'wall-paths', lines: wallLines }
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
      return { name: 'grouped-', suffix: `S-${Random.getSeed()}`, data: svg, extension: '.svg' };
    }

    // PNG preview: render alles plat (zoals altijd)
    if (!exporting) {
      return renderPaths([...frameLines, ...ballLines, ...wallLines], {
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

class SuperEllipse {
  constructor(position, n, radius, resolution = 360) {
    this.position = position;
    this.a = radius;
    this.b = radius;
    this.n = n;
    this.radius = radius;
    this.resolution = resolution;
  }

  updateEllipse(position, n, k) {
    this.position = position;
    this.n = n;
    this.a = this.radius * k;
    this.b = this.radius / k;
  }

  getPoint(theta) {
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const e = 2 / this.n;
    const x = this.a * sign(cos) * Math.pow(Math.abs(cos), e);
    const y = this.b * sign(sin) * Math.pow(Math.abs(sin), e);
    return { x: x + this.position.x, y: y + this.position.y };
  }

  rotate2D(point, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: point.x * cos - point.y * sin,
      y: point.x * sin + point.y * cos
    };
  }

  draw(paths, frameCorner) {
    const path = createPath();
    for (let i = 0; i <= this.resolution; i++) {
      const theta = (i / this.resolution) * Math.PI * 2;
      const point = this.getPoint(theta);
      if (i === 0) {
        path.moveTo(point.x + frameCorner.x, point.y + frameCorner.y);
      } else {
        path.lineTo(point.x + frameCorner.x, point.y + frameCorner.y);
      }
    }
    path.closePath();
    paths.push(path);

  }


}

class Grid {
  constructor(cols, rows, frames, frameWidth, frameHeight, origin, flight, squash) {
    this.cols = cols;
    this.rows = rows;
    this.frames = frames;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.origin = origin;
    this.width = frameWidth * cols;
    this.height = frameHeight * rows;
    this.allFrames = [];
    this.flight = flight;
    this.squash = squash;
    this.initialize();
  }

  initialize() {
    let count = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (count >= this.frames) break;
        this.allFrames.push(new Frame(row, col, this.frameWidth, this.frameHeight, count / this.frames, this.flight, this.squash));
        count++;
      }
    }
  }


  drawFrames(framePaths) {
    this.allFrames.forEach(frame => {
      frame.drawFrame(framePaths, this.origin);
    });
  }

  drawBalls(ballPaths, wallPaths) {
    this.allFrames.forEach(frame => {
      frame.drawBall(ballPaths, this.origin, wallPaths);
    });
  }

}

class Frame {
  constructor(row, col, frameWidth, frameHeight, index, flight, squash) {
    this.row = row;
    this.col = col;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.index = index;
    this.ball = [];
    this.wall = [];
    this.drawWall = false;
    this.flight = flight;
    this.squash = squash;
    this.initiateBall();
  }

  initiateBall() {
    this.ball = new SuperEllipse({ x: this.frameWidth / 2, y: this.frameHeight / 2 }, 2, this.frameHeight / 4, params.resolution);
    this.wall = new Wall({ x: this.frameWidth / 2, y: this.frameHeight / 2 });
    this.updateFrame(this.flight, this.squash);
  }

  // CLASSIFY FRAMES
  updateFrame(flight, squash) {
    // PERFECT LOOP
    // flight A/2 --> squash C --> flight B --> squash D --> flight A/2
    // FLIGHT A/2 (end): k: 1 --> 1.5
    let kmax = params.kmax;
    let kmin = params.kmin;
    let nmax = params.nmax;
    if (this.index < flight / 2) {
      let k = math.mapRange(this.index, 0, flight / 2, 1, kmax);
      this.ball.updateEllipse(this.ball.position, 2, k);
    }
    // SQUASH C/2 (start): k: 1.5 --> 0.5
    else if (this.index >= flight / 2 && this.index < flight / 2 + squash / 2) {
      let k = math.mapRange(this.index, flight / 2, flight / 2 + squash / 2, kmax, kmin);
      let n = math.mapRange(this.index, flight / 2, flight / 2 + squash / 2, 2, nmax);
      this.ball.updateEllipse(this.ball.position, n, k);
      this.drawWall = true;
      this.wall.position = { x: this.frameWidth / 2 + this.ball.a, y: this.frameHeight / 2 };
    }
    // SQUASH C/2 (end): k: 0.5 --> 1.5
    else if (this.index >= flight / 2 + squash / 2 && this.index < flight / 2 + squash) {
      let k = math.mapRange(this.index, flight / 2 + squash / 2, flight / 2 + squash, kmin, kmax);
      let n = math.mapRange(this.index, flight / 2 + squash / 2, flight / 2 + squash, nmax, 2);
      this.ball.updateEllipse(this.ball.position, n, k);
      this.drawWall = true;
      this.wall.position = { x: this.frameWidth / 2 + this.ball.a, y: this.frameHeight / 2 };
    }
    // FLIGHT B/2 (start): k: 1.5 --> 1
    else if (this.index >= flight / 2 + squash && this.index < flight + squash) {
      let k = math.mapRange(this.index, flight / 2 + squash / 2, flight + squash, kmax, 1);
      this.ball.updateEllipse(this.ball.position, 2, k);
    }
    // FLIGHT B/2 (end): k: 1 --> 1.5
    else if (this.index >= flight + squash && this.index < 3 * flight / 2 + squash) {
      let k = math.mapRange(this.index, flight + squash, 3 * flight / 2 + squash, 1, kmax);
      this.ball.updateEllipse(this.ball.position, 2, k);
    }
    // SQUASH D/2 (start): k: 1.5 --> 0.5
    else if (this.index >= 3 * flight / 2 + squash && this.index < 3 * flight / 2 + 3 * squash / 2) {
      let k = math.mapRange(this.index, 3 * flight / 2 + squash, 3 * flight / 2 + 3 * squash / 2, kmax, kmin);
      let n = math.mapRange(this.index, 3 * flight / 2 + squash, 3 * flight / 2 + 3 * squash / 2, 2, nmax);
      this.ball.updateEllipse(this.ball.position, n, k);
      this.drawWall = true;
      this.wall.position = { x: this.frameWidth / 2 - this.ball.a, y: this.frameHeight / 2 };
    }
    // SQUASH D/2 (end): k: 0.5 --> 1.5
    else if (this.index >= 3 * flight / 2 + 3 * squash / 2 && this.index < 3 * flight / 2 + 2 * squash) {
      let k = math.mapRange(this.index, 3 * flight / 2 + 3 * squash / 2, 3 * flight / 2 + 2 * squash, kmin, kmax);
      let n = math.mapRange(this.index, 3 * flight / 2 + 3 * squash / 2, 3 * flight / 2 + 2 * squash, nmax, 2);
      this.ball.updateEllipse(this.ball.position, n, k);
      this.drawWall = true;
      this.wall.position = { x: this.frameWidth / 2 - this.ball.a, y: this.frameHeight / 2 };
    }
    // FLIGHT A/2 (start): k: 1.5 --> 1
    else {
      let k = math.mapRange(this.index, 3 * flight / 2 + 2 * squash, 1, kmax, 1);
      this.ball.updateEllipse(this.ball.position, 2, k);
    }
  }

  drawFrame(paths, origin) {
    const path = createPath();
    const x = this.col * this.frameWidth + origin.x;
    const y = this.row * this.frameHeight + origin.y;
    path.moveTo(x, y);
    path.lineTo(x + this.frameWidth, y);
    path.lineTo(x + this.frameWidth, y + this.frameHeight);
    path.lineTo(x, y + this.frameHeight);
    path.closePath();
    paths.push(path);
  }

  drawBall(paths, origin, wallPaths) {
    let frameCorner = {
      x: this.col * this.frameWidth + origin.x,
      y: this.row * this.frameHeight + origin.y
    };
    this.ball.draw(paths, frameCorner);
    if (this.drawWall) {
      this.wall.draw(wallPaths, frameCorner, this.frameWidth, this.frameHeight);
    }
  }
}

class Wall {
  constructor(position) {
    this.position = position;
  }

  draw(paths, frameCorner, frameWidth, frameHeight) {
    const path = createPath();
    if (this.position.x > frameWidth / 2) {
      path.moveTo(this.position.x + frameCorner.x, frameCorner.y);
      path.lineTo(this.position.x + frameCorner.x, frameCorner.y + frameHeight);
      path.lineTo(frameCorner.x + frameWidth, frameCorner.y + frameHeight);
      path.lineTo(frameCorner.x + frameWidth, frameCorner.y);
      path.closePath();
    }
    else {
      path.moveTo(this.position.x + frameCorner.x, frameCorner.y);
      path.lineTo(this.position.x + frameCorner.x, frameCorner.y + frameHeight);
      path.lineTo(frameCorner.x, frameCorner.y + frameHeight);
      path.lineTo(frameCorner.x, frameCorner.y);
      path.closePath();
    }
    paths.push(path);
  }
}


// FUNCTIONS

function sign(x) {
  return (x < 0 ? -1 : 1);
}


// UTIL

function groupSVGExport(context, groups, { width, height, units, ...style } = {}) {
  // Render in vaste volgorde: frame -> ball -> wall
  for (const g of groups) {
    renderPaths(g.lines, {
      context,
      width,
      height,
      units,
      ...style,
      optimize: false // belangrijk: geen samenvoegen
    });
  }

  const svgString =
    typeof context.getSerializedSvg === 'function'
      ? context.getSerializedSvg()
      : (typeof context.getSvg === 'function' ? context.getSvg().outerHTML : null);

  if (!svgString) return { data: null, extension: '.svg' };

  // Zoek de eerste wrapper group (die met stroke attrs in jouw output)
  const gBlockRegex = /(<g\b[^>]*>)([\s\S]*?)(<\/g>)/;
  const m = svgString.match(gBlockRegex);
  if (!m) return { data: svgString, extension: '.svg' };

  const gOpen = m[1];
  const gInner = m[2];
  const gClose = m[3];

  // Pak enkel self-closing path/polyline/line nodes binnen die wrapper
  const elementRegex = /<(path|polyline|line)\b[^>]*\/>\s*/g;
  const elements = gInner.match(elementRegex) || [];

  const counts = groups.map(g => g.lines.length);
  const totalExpected = counts.reduce((a, b) => a + b, 0);

  if (elements.length < totalExpected) {
    console.warn(
      `groupSVGExport: SVG elements (${elements.length}) < expected (${totalExpected}). ` +
      `Controleer optimize:false en of renderPaths niet batched.`
    );
  }

  // Verwijder de originele elementen uit de wrapper (alleen binnen wrapper!)
  const innerWithoutElements = gInner.replace(elementRegex, '');

  // Maak nieuwe subgroepen
  let cursor = 0;
  const groupedBlocks = groups.map((g, i) => {
    const n = counts[i];
    const chunk = elements.slice(cursor, cursor + n).join('');
    cursor += n;
    return `<g id="${g.id}">\n${chunk}\n</g>\n`;
  }).join('\n');

  const newInner = `${innerWithoutElements}\n${groupedBlocks}\n`;

  // Vervang wrapper inhoud
  const out = svgString.replace(gBlockRegex, `${gOpen}${newInner}${gClose}`);

  return { data: out, extension: '.svg', name: 'tester' };
}
