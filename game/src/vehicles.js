// Vehicles: player car, traffic cars, police cars. All cars share the same structure.
// Traffic follows road grid, respects lanes, turns at intersections.
import { WORLD_W, WORLD_H, CAR_KINDS, POLICE_CAR, COMET_GT } from './config.js';
import { clamp, dist2 } from './random.js';

export function makeCar(rng, x, y, angle, kind) {
  return {
    x, y, angle, speed: 0, kind: kind.name, color: kind.color,
    top: kind.top, accel: kind.accel, health: 100, smoke: 0,
    isPolice: false, isPlayer: false, driver: null, parked: false,
    skid: 0, wrecked: false,
  };
}

export function createTraffic(world) {
  const { state, rng, city } = world;

  function carAhead(car) {
    let best = null, bestD = 90;
    for (const other of state.cars) {
      if (other === car || other.isPlayer) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      if (ahead > 0 && ahead < bestD) {
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (side < 26) { best = other; bestD = ahead; }
      }
    }
    return best;
  }

  function pickTurn(car) {
    const r = rng.next();
    if (r < 0.55) return;
    const turn = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    if (car.axis === 'v') {
      car.axis = 'h';
      car.road = city.nearestRoadY(car.y);
      car.lane = car.angle > 0 ? 22 : -22;
      car.angle = car.angle > 0 ? 0 : Math.PI;
      if (turn < 0) car.angle = car.angle > 0 ? Math.PI : 0;
    } else {
      car.axis = 'v';
      car.road = city.nearestRoadX(car.x);
      car.lane = car.angle === 0 ? 22 : -22;
      car.angle = car.angle === 0 ? Math.PI / 2 : -Math.PI / 2;
      if (turn < 0) car.angle = car.angle > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
  }

  function atIntersection(car) {
    if (car.axis === 'v') {
      const ry = city.nearestRoadY(car.y);
      return Math.abs(car.y - ry) < 14;
    }
    const rx = city.nearestRoadX(car.x);
    return Math.abs(car.x - rx) < 14;
  }

  function stepCar(car, dt) {
    if (car.isPlayer || car.isPolice) return;
    if (car.parked) return;
    const ahead = carAhead(car);
    const target = ahead ? Math.max(0, ahead.speed) : car.top * 0.55;
    const accel = ahead ? 200 : 120;
    if (car.speed < target) car.speed = Math.min(target, car.speed + accel * dt);
    else car.speed = Math.max(target, car.speed - 220 * dt);
    if (car.axis === 'v') {
      const wantX = car.road + car.lane;
      car.x += clamp(wantX - car.x, -60 * dt, 60 * dt);
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.y < 160 || car.y > WORLD_H - 160) { car.angle = -car.angle; car.lane = -car.lane; }
    } else {
      const wantY = car.road + car.lane;
      car.y += clamp(wantY - car.y, -60 * dt, 60 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      if (car.x < 160 || car.x > WORLD_W - 160) { car.angle = car.angle === 0 ? Math.PI : 0; car.lane = -car.lane; }
    }
    if (atIntersection(car) && !car.turned) {
      pickTurn(car);
      car.turned = true;
    } else if (!atIntersection(car)) car.turned = false;
    const fixed = city.collideCircle(car.x, car.y, 18);
    car.x = fixed.x; car.y = fixed.y;
  }

  function step(dt) {
    for (const car of state.cars) stepCar(car, dt);
    // Car-car separation
    for (let i = 0; i < state.cars.length; i++) {
      for (let j = i + 1; j < state.cars.length; j++) {
        const a = state.cars[i], b = state.cars[j];
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 < 38 * 38 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (38 - d) / 2;
          const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
          if (!a.isPlayer) { a.x -= ux * push; a.y -= uy * push; }
          if (!b.isPlayer) { b.x += ux * push; b.y += uy * push; }
          if (a.isPlayer || b.isPlayer) {
            const pc = a.isPlayer ? a : b;
            pc.speed *= 0.7;
          }
        }
      }
    }
    // Keep streets busy
    if (state.cars.filter(c => !c.isPlayer && !c.isPolice).length < 22) {
      const rx = city.vRoads[Math.floor(rng.next() * city.vRoads.length)];
      const ry = city.hRoads[Math.floor(rng.next() * city.hRoads.length)];
      const vertical = rng.chance(0.5);
      const car = world.makeCar(rng,
        vertical ? rx : rng.range(200, WORLD_W - 200),
        vertical ? rng.range(200, WORLD_H - 200) : ry, 0,
        CAR_KINDS[Math.floor(rng.next() * CAR_KINDS.length)]
      );
      car.traffic = true;
      car.axis = vertical ? 'v' : 'h';
      car.road = vertical ? rx : ry;
      car.lane = rng.chance(0.5) ? 22 : -22;
      car.angle = car.axis === 'v' ? (car.lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.lane > 0 ? 0 : Math.PI);
      car.speed = rng.range(60, 140);
      state.cars.push(car);
    }
  }

  return { step };
}
