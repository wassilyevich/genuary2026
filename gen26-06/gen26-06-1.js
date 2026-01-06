const canvasSketch = require('canvas-sketch');
const math = require('canvas-sketch-util/math');
const random = require('canvas-sketch-util/random');
const color = require('canvas-sketch-util/color');
const penplot = require('canvas-sketch-util/penplot')
const sanzo = require('sanzo-color');
const { viewBox, namedPaths } = require('./lamp.paths');



const settings = {
  dimensions: [2048, 2048],
  animate: true
};


const params = {
  // bulb controls (you'll tune these)
  bulbCenter: { x: 1024, y: 2048 / 4 },   // default-ish near your lamp's light area
  bulbRadius: 100,

  // mosquito flock tuning
  mosquitoCount: 160,
  neighborRadius: 85,
  desiredSeparation: 18,

  maxSpeed: 2.1,
  maxForce: 0.085,

  // flock weights (mosquito-ish)
  wSeparation: 1.8,
  wAlignment: 0.55,
  wCohesion: 0.65,

  // bulb behaviors
  wAttract: 1.2,          // attraction to bulb (lamp on)
  wRepelBurn: 3.2,        // strong push out when inside radius
  burnCooldownFrames: 18, // prevents instant re-entry "orbiting"

  // extra mosquito flavor
  wWander: 0.35,
  wanderJitter: 0.7
};


const sketch = ({ context, width, height }) => {

  const lamp = new Lamp(namedPaths, true);

  const mosquitoes = Array.from({ length: params.mosquitoCount }, () =>
    new Mosquito(
      random.range(0, width),
      random.range(0, height),
      { maxSpeed: params.maxSpeed, maxForce: params.maxForce }
    )
  );

  // FUNCTIONALITIES
  window.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
      lamp.click();
      console.log(lamp)
    }
  });






  return ({ context, width, height }) => {
    if (lamp.state) {
      context.fillStyle = 'white';
    }
    else {
      context.fillStyle = 'rgba(48, 48, 48, 1)';
    }
    context.fillRect(0, 0, width, height);


    lamp.draw(context, 4, width, height);

    // draw + update mosquitoes
    context.save();
    context.strokeStyle = lamp.state ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.25)';
    context.lineWidth = 4;

    for (const m of mosquitoes) {
      m.flockAndUpdate(mosquitoes, width, height, lamp.state, params);
      m.draw(context);
    }
    context.restore();

    // // (optional) visualize bulb radius while tuning
    // context.save();
    // context.strokeStyle = 'rgba(0,0,0,0.15)';
    // context.beginPath();
    // context.arc(params.bulbCenter.x, params.bulbCenter.y, params.bulbRadius, 0, Math.PI*2);
    // context.stroke();
    // context.restore();





  };
};

canvasSketch(sketch, settings);


// CLASSES
class Lamp {
  constructor(paths, state) {
    this.paths = paths;
    this.state = state;
  }

  draw(context, lineWidth, width, height) {
    // Als je lineWidth “in pixels” constant wil houden:
    context.strokeStyle = 'black';
    context.lineWidth = lineWidth;  // 2px op het scherm, ongeacht schaal
    // Redraw cord
    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height / 8)
    context.stroke();
    context.save();
    const s = applyViewBoxTransform(context, width, height, viewBox, 0);
    context.lineWidth = lineWidth / s;  // 2px op het scherm, ongeacht schaal
    if (this.state) {
      // Socket
      const socket = new Path2D(this.paths[1].d);
      context.fillStyle = 'red'
      context.fill(socket);
      context.stroke(socket);
      // Shade
      const shade = new Path2D(this.paths[2].d);
      context.fillStyle = 'blue';
      context.fill(shade);
      context.stroke(shade);
      // Light
      const light = new Path2D(this.paths[4].d);
      const gradient = context.createRadialGradient(width / (2 * s), height / (6 * s), height / (4 * s), width / (2 * s), height / (6 * s), height / (2 * s));
      gradient.addColorStop(0, 'rgba(251, 228, 100, 1)')
      gradient.addColorStop(1, 'rgba(255,207,28,1)')
      context.fillStyle = gradient;
      context.fill(light);
      // Bulb
      const bulb = new Path2D(this.paths[3].d);
      context.fillStyle = 'yellow';
      context.fill(bulb);
      context.stroke(bulb);
      context.restore();
    }

    else {
      // Socket
      const socket = new Path2D(this.paths[1].d);
      context.fillStyle = 'rgba(153, 0, 0, 1)'
      context.fill(socket);
      context.stroke(socket);
      // Shade
      const shade = new Path2D(this.paths[2].d);
      context.fillStyle = 'rgba(0, 0, 153, 1)';
      context.fill(shade);
      context.stroke(shade);
      // Bulb
      const bulb = new Path2D(this.paths[3].d);
      context.fillStyle = 'gray';
      context.fill(bulb);
      context.stroke(bulb);
      context.restore();

    }
  }

  click() {
    if (this.state) {
      this.state = false;
    }
    else {
      this.state = true;
    }
  }
}

class Mosquito {
  constructor(x, y, opts = {}) {
    this.pos = { x, y };
    const a = random.range(0, Math.PI * 2);
    this.vel = { x: Math.cos(a), y: Math.sin(a) };
    this.vel = clampMag(this.vel.x, this.vel.y, opts.maxSpeed || 2);

    this.acc = { x: 0, y: 0 };

    this.maxSpeed = opts.maxSpeed ?? 2.1;
    this.maxForce = opts.maxForce ?? 0.085;

    // "burn" state
    this.burnCooldown = 0;

    // wander state
    this.wanderTheta = random.range(0, Math.PI * 2);
  }

  applyForce(f) {
    this.acc.x += f.x;
    this.acc.y += f.y;
  }

  // --- Boids core rules ---
  separation(boids, desiredSeparation, neighborRadius) {
    let steerX = 0, steerY = 0;
    let count = 0;

    for (const other of boids) {
      if (other === this) continue;
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < desiredSeparation) {
        // weighted by inverse distance (strong close-range)
        const inv = 1 / d;
        steerX += dx * inv;
        steerY += dy * inv;
        count++;
      }
      // also a softer separation inside neighborRadius to keep them “twitchy”
      else if (d > 0 && d < neighborRadius * 0.55) {
        const inv = 1 / (d * d);
        steerX += dx * inv;
        steerY += dy * inv;
        count += 0.35;
      }
    }

    if (count > 0) {
      steerX /= count;
      steerY /= count;

      // turn into desired velocity
      const n = norm(steerX, steerY);
      const desired = { x: n.x * this.maxSpeed, y: n.y * this.maxSpeed };
      return steerTowards(this.vel, desired, this.maxForce);
    }
    return { x: 0, y: 0 };
  }

  alignment(boids, neighborRadius) {
    let sumX = 0, sumY = 0;
    let count = 0;

    for (const other of boids) {
      if (other === this) continue;
      const dx = other.pos.x - this.pos.x;
      const dy = other.pos.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < neighborRadius) {
        sumX += other.vel.x;
        sumY += other.vel.y;
        count++;
      }
    }

    if (count > 0) {
      sumX /= count;
      sumY /= count;
      const n = norm(sumX, sumY);
      const desired = { x: n.x * this.maxSpeed, y: n.y * this.maxSpeed };
      return steerTowards(this.vel, desired, this.maxForce);
    }
    return { x: 0, y: 0 };
  }

  cohesion(boids, neighborRadius) {
    let sumX = 0, sumY = 0;
    let count = 0;

    for (const other of boids) {
      if (other === this) continue;
      const dx = other.pos.x - this.pos.x;
      const dy = other.pos.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < neighborRadius) {
        sumX += other.pos.x;
        sumY += other.pos.y;
        count++;
      }
    }

    if (count > 0) {
      const target = { x: sumX / count, y: sumY / count };
      return this.seek(target, 1.0);
    }
    return { x: 0, y: 0 };
  }

  // --- steering helpers ---
  seek(target, slowDown = 0) {
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const n = norm(dx, dy);

    let speed = this.maxSpeed;
    if (slowDown) {
      // gentle slow-down near target (mosquitoes still orbit a bit)
      const r = 90;
      speed = this.maxSpeed * Math.min(1, n.m / r);
      speed = Math.max(speed, this.maxSpeed * 0.35);
    }

    const desired = { x: n.x * speed, y: n.y * speed };
    return steerTowards(this.vel, desired, this.maxForce);
  }

  flee(target) {
    const dx = this.pos.x - target.x;
    const dy = this.pos.y - target.y;
    const n = norm(dx, dy);
    const desired = { x: n.x * this.maxSpeed, y: n.y * this.maxSpeed };
    return steerTowards(this.vel, desired, this.maxForce);
  }

  wander(wanderJitter = 0.7) {
    // classic wander: project a circle ahead of velocity and pick a jittered point
    const vnorm = norm(this.vel.x, this.vel.y);
    const forward = { x: vnorm.x, y: vnorm.y };

    // jitter theta a bit (mosquito feel)
    this.wanderTheta += random.range(-wanderJitter, wanderJitter);

    const circleDist = 18;
    const circleRadius = 14;

    const circleCenter = {
      x: this.pos.x + forward.x * circleDist,
      y: this.pos.y + forward.y * circleDist
    };

    const target = {
      x: circleCenter.x + Math.cos(this.wanderTheta) * circleRadius,
      y: circleCenter.y + Math.sin(this.wanderTheta) * circleRadius
    };

    return this.seek(target, 0);
  }

  // --- bulb behavior ---
  bulbForces(bulbCenter, bulbRadius, lampOn, wAttract, wRepelBurn, burnCooldownFrames) {
    if (!lampOn) {
      // lamp off: mild drift away so they don't all camp the bulb position
      return { x: 0, y: 0 };
    }

    const dx = bulbCenter.x - this.pos.x;
    const dy = bulbCenter.y - this.pos.y;
    const d = Math.hypot(dx, dy);

    // if inside bulb radius: "burn" repulsion
    if (d < bulbRadius) {
      this.burnCooldown = burnCooldownFrames;

      // hard push outward
      const out = norm(this.pos.x - bulbCenter.x, this.pos.y - bulbCenter.y);
      const push = {
        x: out.x * this.maxSpeed,
        y: out.y * this.maxSpeed
      };
      // scale force stronger the deeper they are inside
      const depth = 1 - (d / bulbRadius);
      const f = steerTowards(this.vel, push, this.maxForce * (1 + depth * 6));

      return { x: f.x * wRepelBurn, y: f.y * wRepelBurn };
    }

    // while cooling down: keep them repelled a bit so they don't instantly re-enter
    if (this.burnCooldown > 0) {
      const f = this.flee(bulbCenter);
      return { x: f.x * (wRepelBurn * 0.6), y: f.y * (wRepelBurn * 0.6) };
    }

    // outside: attraction that rises near the bulb (but not infinite)
    // mosquitoes often “orbit” near light, so we don't go full magnet.
    const attract = this.seek(bulbCenter, 1.0);

    // slightly stronger in a ring around the bulb
    const ring = Math.max(0, Math.min(1, (bulbRadius * 3 - d) / (bulbRadius * 3)));
    const gain = 0.55 + ring * 0.75;

    return { x: attract.x * wAttract * gain, y: attract.y * wAttract * gain };
  }

  // --- main update ---
  flockAndUpdate(boids, width, height, lampOn, opts) {
    // countdown burn
    if (this.burnCooldown > 0) this.burnCooldown--;

    const sep = this.separation(boids, opts.desiredSeparation, opts.neighborRadius);
    const ali = this.alignment(boids, opts.neighborRadius);
    const coh = this.cohesion(boids, opts.neighborRadius);

    // mosquito “nervousness”: more separation + wander, less alignment
    this.applyForce({ x: sep.x * opts.wSeparation, y: sep.y * opts.wSeparation });
    this.applyForce({ x: ali.x * opts.wAlignment, y: ali.y * opts.wAlignment });
    this.applyForce({ x: coh.x * opts.wCohesion, y: coh.y * opts.wCohesion });

    // bulb attraction / burn repel
    const bulbF = this.bulbForces(
      opts.bulbCenter,
      opts.bulbRadius,
      lampOn,
      opts.wAttract,
      opts.wRepelBurn,
      opts.burnCooldownFrames
    );
    this.applyForce(bulbF);

    // extra wander (reduced when close to bulb so they don't explode)
    const dToBulb = Math.hypot(this.pos.x - opts.bulbCenter.x, this.pos.y - opts.bulbCenter.y);
    const wanderGain = lampOn ? Math.max(0.15, Math.min(1, dToBulb / (opts.bulbRadius * 2))) : 1.0;
    const w = this.wander(opts.wanderJitter);
    this.applyForce({ x: w.x * opts.wWander * wanderGain, y: w.y * opts.wWander * wanderGain });

    // integrate
    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;

    // cap speed (mosquito-ish: keep it tight)
    const capped = clampMag(this.vel.x, this.vel.y, this.maxSpeed);
    this.vel.x = capped.x;
    this.vel.y = capped.y;

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    // reset acceleration
    this.acc.x = 0;
    this.acc.y = 0;

    // wrap edges (nice for sketches)
    if (this.pos.x < 0) this.pos.x += width;
    if (this.pos.y < 0) this.pos.y += height;
    if (this.pos.x > width) this.pos.x -= width;
    if (this.pos.y > height) this.pos.y -= height;
  }

  draw(context) {
    // tiny streak
    context.beginPath();
    context.moveTo(this.pos.x, this.pos.y);
    context.lineTo(this.pos.x - this.vel.x * 3, this.pos.y - this.vel.y * 3);
    context.stroke();
  }
}

// FUNCTIONS
function applyViewBoxTransform(context, width, height, vb, marginPx = 0) {
  // marginPx in canvas pixels
  const sx = (width - 2 * marginPx) / vb.w;
  const sy = (height - 2 * marginPx) / vb.h;
  const s = Math.min(sx, sy);

  const tx = (width - vb.w * s) / 2 - vb.x * s;
  const ty = (height - vb.h * s) / 2 - vb.y * s;

  context.setTransform(s, 0, 0, s, tx, ty);
  return s; // handig voor lineWidth-compensatie
}

function clampMag(vx, vy, max) {
  const m = Math.hypot(vx, vy) || 1e-9;
  if (m <= max) return { x: vx, y: vy };
  const s = max / m;
  return { x: vx * s, y: vy * s };
}

function norm(vx, vy) {
  const m = Math.hypot(vx, vy) || 1e-9;
  return { x: vx / m, y: vy / m, m };
}

function steerTowards(vel, desired, maxForce) {
  // desired is a velocity vector (already sized to maxSpeed typically)
  const sx = desired.x - vel.x;
  const sy = desired.y - vel.y;
  return clampMag(sx, sy, maxForce);
}


