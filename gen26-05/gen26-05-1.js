const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random')
const math = require('canvas-sketch-util/math')


const settings = {
  dimensions: [2048, 2048],
  animate: true,
  duration: 5,
  fps: 30
};

const params = {
  
}
const points = [];
const goldenPoints = [];
const nPoints = 3000;
const radius = 0.8;
const maxIter = 100;
const nDraws = 40;
const drawInitPoints = false;
const drawRandomColors = false;
const drawColor = false;
const goldScale = 200;
const thetaInc = 0.07;
const goldenIter = 500;
const move = 30;
const p = 10;





const sketch = ({ context, width, height }) => {

  // Initialize points




  // SETTINGS
  const lookRadius = width / 2;
  const margin = width / 30;


  // %%%%%%%%%%%%%%%%%%%%% GOLDEN RATIO PART %%%%%%%%%%%%%%%%%%%%%
  let theta = 0;
  for (let i = 0; i < goldenIter; i++) {
    let coords = goldenCoords(theta);
    let goldX = math.mapRange(coords[0], -goldScale, goldScale, margin, width - margin);
    let goldY = math.mapRange(coords[1], -goldScale, goldScale, margin, height - margin);
    goldenPoint = new GoldPoint(goldX, goldY, radius);
    goldenPoints.push(goldenPoint);
    theta += thetaInc;
  }
  // console.log(goldenPoints);

  goldenPath = new Path(goldenPoints);
  // goldenPath.drawPoints(context);

  for (let i = 0; i < nPoints; i++) {
    point = new Point(random.range(0, width), random.range(0, height), radius);
    points.push(point);
  }

  //Background
  context.fillStyle = 'white';
  if (drawColor) {
    const color = ['#330a14', '#0c1d18', '#2d102d', '#251603', '#120d30'];
    context.fillStyle = random.pick(color);
  }
  context.fillRect(0, 0, width, height);

  // %%%%%%%%%%%%%%%%%% CLOUD PART %%%%%%%%%%%%%%%%%%%%%%%
  const amt = 5;



  return ({ context, width, height }) => {

    // Background
    context.fillStyle = 'white';
    if (drawColor) {
      const color = ['#330a14', '#0c1d18', '#2d102d', '#251603', '#120d30'];
      context.fillStyle = random.pick(color);
    }
    context.fillRect(0, 0, width, height);

    // Draw points and lines

    for (let i = 0; i < points.length; i++) {
      const agent = points[i];
      for (let j = i + 1; j < points.length; j++) {
        const other = points[j];

        const dist = distance(agent, other);
        if (dist > width / 80) continue;

        context.lineWidth = math.mapRange(dist, 0, lookRadius, 0.2, 0.01);
        context.beginPath();
        context.moveTo(agent.x, agent.y);
        context.lineTo(other.x, other.y);
        context.stroke();
      }
    }

      points.forEach(agent =>{
        agent.movePoint(amt,width,height,margin,goldenPath,lookRadius,move,p);
        agent.drawPoint(context)

    });




  };
};



// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%CLASSES AND FUNCTIONS
canvasSketch(sketch, settings);



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

  movePoint(amt, width, height, margin, goldenPath, lookRadius, move, p) {

    // console.log(pointsCopy);

    let jitterX = random.range(-1, 1) * amt;
    let jitterY = random.range(-1, 1) * amt;
    this.attraction(goldenPath, lookRadius, move, p)
    let newX = this.x + jitterX;
    let newY = this.y + jitterY;
    if (newX < margin) newX = margin;
    if (newX > width - margin) newX = width - margin;
    if (newY < margin) newY = margin;
    if (newY > height - margin) newY = height - margin;
    this.x = newX;
    this.y = newY;

  }

  drawPoint(context) {

    context.save();
    context.beginPath();
    context.fillStyle = 'black';
    context.arc(this.x + this.r, this.y + this.r, this.r, 0, Math.PI * 2);
    context.fill();
    context.restore();

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


class Path {
  constructor(points) {
    this.points = points;
  }

  drawPath(context, drawRandom) {

    context.lineWidth = 0.04;
    context.strokeStyle = 'black';
    if (drawRandom) {
      const color = ['#da4167', '#43aa8b', '#e4b7e5', '#ed9b40', '#120d31']
      context.strokeStyle = random.pick(color);
    }
    let j = 0;
    for (let i = 1; i < this.points.length - 2; i += 2) {
      context.beginPath();
      context.moveTo(this.points[i - 1].x + this.points[i - 1].r, this.points[i - 1].y + this.points[i - 1].r);
      context.quadraticCurveTo(this.points[i].x + this.points[i].r, this.points[i].y + this.points[i].r, this.points[i + 1].x + this.points[i + 1].r, this.points[i + 1].y + this.points[i + 1].r);
      context.stroke();
      j = i;
    }
    context.beginPath();
    context.moveTo(this.points[j - 1].x + this.points[j - 1].r, this.points[j - 1].y + this.points[j - 1].r);
    context.quadraticCurveTo(this.points[j].x + this.points[j].r, this.points[j].y + this.points[j].r, this.points[j + 1].x + this.points[j + 1].r, this.points[j + 1].y + this.points[j + 1].r);
    context.stroke();
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
