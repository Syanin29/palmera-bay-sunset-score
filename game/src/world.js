// World simulation: state, cars, peds, cops, bullets, particles, pickups, time.
// Fixed-step loop. All randomness from seeded RNG.
import { clamp, dist2, angleTo, angleDiff, turnToward } from './random.js';
import { WORLD_W, WORLD_H, ROAD_W, CAR_KINDS, STEP, SAVE_KEY } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_CASH = 8;

export function makeCar(rng, x, y, angle, kind) {
  return {
    x, y, angle, speed: 0, kind: kind.name, color: kind.color,
    top: kind.top, accel: kind.accel, health: 100, smoke: 0,
    isPolice: false, isPlayer: false, driver: null, parked: false,
    skid: 0, wrecked: false,
  };
}

export function createWorld(rng, city) {
  const player = {
    x: 745, y: 800, angle: -Math.PI / 2, speed: 0,
    health: 100, armor: 0, cash: 40, ammo: 24,
    weapon: 'pistol', inCar: null, punchCooldown: 0, hurtFlash: 0,
    aimAngle: 0, walkPhase: 0,
  };
  const state = {
    player, city, rng,
    cars: [], peds: [], cops: [], bullets: [], particles: [], skidmarks: [],
    wanted: 0, heat: 0, timeOfDay: 18.0, // sunset
    elapsed: 0, missionIndex: 0, missionsDone: 0, totalEarned: 0,
    bustedTimer: 0, message: '', messageTimer: 0,
    taxi: null,
    radio: 'SUNSET FM',
    stats: { carsStolen: 0, shotsFired: 0, pedsHit: 0 },
  };

  function spawnInitialTraffic() {
    for (let i = 0; i < 26; i++) {
      const rx = city.vRoads[Math.floor(rng.next() * city.vRoads.length)];
      const ry = city.hRoads[Math.floor(rng.next() * city.hRoads.length)];
      const vertical = rng.chance(0.5);
      const x = vertical ? rx + (rng.chance(0.5) ? 22 : -22) : rng.range(200, WORLD_W - 200);
      const y = vertical ? rng.range(200, WORLD_H - 200) : ry + (rng.chance(0.5) ? 22 : -22);
      const car = makeCar(rng, x, y,
        vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
        CAR_KINDS[Math.floor(rng.next() * CAR_KINDS.length)]
      );
      car.parked = rng.chance(0.4);
      car.speed = car.parked ? 0 : rng.range(60, 140);
      car.traffic = true;
      car.axis = vertical ? 'v' : 'h';
      car.road = vertical ? rx : ry;
      car.lane = vertical ? (car.x - rx) : (car.y - ry);
      state.cars.push(car);
    }
    // Starter car near safehouse
    const starter = makeCar(rng, 800, 800, 0, { name: 'sedan', color: '#4f7ec9', top: 300, accel: 240 });
    starter.parked = true;
    state.cars.push(starter);
  }

  function spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const rx = city.vRoads[Math.floor(rng.next() * city.vRoads.length)];
      const ry = city.hRoads[Math.floor(rng.next() * city.hRoads.length)];
      const vertical = rng.chance(0.5);
      state.peds.push({
        x: vertical ? rx + (rng.chance(0.5) ? 58 : -58) : rng.range(200, WORLD_W - 200),
        y: vertical ? rng.range(200, WORLD_H - 200) : ry + (rng.chance(0.5) ? 58 : -58),
        angle: rng.next() * Math.PI * 2, speed: rng.range(28, 55),
        color: rng.pick(['#e8b04b', '#7fb069', '#c96f4a', '#5a7d9a', '#d98a3d', '#8a6b8f', '#e8e8e8']),
        alive: true, flee: 0, fleeX: 0, fleeY: 0, phase: rng.next() * 6,
        inTaxi: false,
      });
    }
  }

  function reset() {
    player.x = 745; player.y = 800; player.angle = -Math.PI / 2; player.speed = 0;
    player.health = 100; player.armor = 0; player.cash = 40; player.ammo = 24;
    player.inCar = null; player.punchCooldown = 0; player.hurtFlash = 0;
    state.cars.length = 0; state.peds.length = 0; state.cops.length = 0;
    state.bullets.length = 0; state.particles.length = 0; state.skidmarks.length = 0;
    state.wanted = 0; state.heat = 0; state.timeOfDay = 18.0; state.elapsed = 0;
    state.missionIndex = 0; state.missionsDone = 0; state.totalEarned = 0;
    state.bustedTimer = 0; state.taxi = null; state.message = ''; state.messageTimer = 0;
    state.stats = { carsStolen: 0, shotsFired: 0, pedsHit: 0 };
    spawnInitialTraffic();
    spawnPeds(34);
  }

  function addWanted(level, reason) {
    if (state.wanted === 0) state.heat = 100;
    state.wanted = Math.min(5, state.wanted + level);
    showMessage(reason, 2);
  }

  function showMessage(msg, dur) {
    state.message = msg;
    state.messageTimer = dur;
  }

  function addParticles(x, y, color, count, maxLife) {
    for (let i = 0; i < count; i++) {
      const a = rng.next() * Math.PI * 2;
      const s = rng.range(0.5, 1.5) * 60;
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color, size: rng.range(2, 5),
        life: rng.range(0.2, maxLife / 1000), maxLife: maxLife / 1000,
      });
    }
  }

  function damagePlayer(amount) {
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, amount * 0.6);
      player.armor -= absorbed; amount -= absorbed;
    }
    player.health -= amount;
    player.hurtFlash = 0.25;
  }

  function stepPlayer(dt, input, aimWorld) {
    player.punchCooldown = Math.max(0, player.punchCooldown - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
    if (player.inCar) return;
    const h = input.held;
    let mx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    let my = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    const speed = h.run ? 235 : 150;
    player.x += mx * speed * dt;
    player.y += my * speed * dt;
    if (len > 0) {
      player.angle = Math.atan2(my, mx);
      player.walkPhase += dt * (h.run ? 14 : 9);
      player.speed = speed;
    } else player.speed = 0;
    player.aimAngle = angleTo(player.x, player.y, aimWorld.x, aimWorld.y);
    const fixed = city.collideCircle(player.x, player.y, 14);
    player.x = fixed.x; player.y = fixed.y;
    if (city.isWater(player.x)) player.x = 80;
  }

  function stepDriving(dt, input) {
    const car = player.inCar;
    if (!car) return;
    const h = input.held;
    const forward = (h.up ? 1 : 0) - (h.down ? 1 : 0);
    const steer = (h.left ? 1 : 0) - (h.right ? 1 : 0);
    const onRoad = city.onRoad(car.x, car.y);
    const top = car.top * (onRoad ? 1 : 0.55);
    if (forward > 0) car.speed += car.accel * dt;
    else if (forward < 0) car.speed -= car.accel * 1.4 * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
    if (h.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 520 * dt);
    car.speed = clamp(car.speed, -top * 0.45, top);
    const steerAmount = steer * 2.1 * dt * clamp(Math.abs(car.speed) / 90, 0, 1) * Math.sign(car.speed || 1);
    car.angle += steerAmount;
    if (h.brake && Math.abs(car.speed) > 120) {
      car.skid = 0.2;
      state.skidmarks.push({ x: car.x, y: car.y, angle: car.angle, life: 4 });
      if (state.skidmarks.length > 220) state.skidmarks.shift();
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = city.collideCircle(nx, ny, 20);
    const hitWall = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
    car.x = fixed.x; car.y = fixed.y;
    if (hitWall) {
      if (Math.abs(car.speed) > 130) { car.health -= 8; addParticles(car.x, car.y, '#888888', 6, 120); }
      car.speed *= 0.45;
    }
    if (city.isWater(car.x)) { car.x = 90; car.speed *= 0.3; }
    if (car.health < 45) car.smoke = 1;
    player.x = car.x; player.y = car.y; player.angle = car.angle;
    player.speed = Math.abs(car.speed);
  }

  function stepBullets(dt, combat) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) {
        const hit = combat.bulletHit(b);
        if (hit) { addParticles(b.x, b.y, '#ffd23d', 5, 140); dead = true; }
        const fixed = city.collideCircle(b.x, b.y, 2);
        if (fixed.x !== b.x || fixed.y !== b.y) { addParticles(b.x, b.y, '#aaaaaa', 4, 100); dead = true; }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.skidmarks.length - 1; i >= 0; i--) {
      state.skidmarks[i].life -= dt;
      if (state.skidmarks[i].life <= 0) state.skidmarks.splice(i, 1);
    }
    if (state.messageTimer > 0) state.messageTimer -= dt;
  }

  function stepPickups(dt) {
    for (const p of city.pickups) {
      if (p.taken) {
        p.respawn -= dt;
        if (p.respawn <= 0) p.taken = false;
        continue;
      }
      if (dist2(player.x, player.y, p.x, p.y) < 26 * 26) {
        p.taken = true; p.respawn = 45;
        if (p.kind === 'health') player.health = Math.min(100, player.health + 40);
        if (p.kind === 'armor') player.armor = Math.min(100, player.armor + 50);
        if (p.kind === 'ammo') player.ammo += 24;
        showMessage(p.kind === 'health' ? '+40 HEALTH' : p.kind === 'armor' ? '+50 ARMOR' : '+24 AMMO', 2);
      }
    }
  }

  function stepTime(dt) {
    state.elapsed += dt;
    state.timeOfDay = (state.timeOfDay + dt / 240) % 24;
  }

  reset();
  return {
    state, player, city, rng, reset, addWanted, showMessage, addParticles, damagePlayer,
    stepPlayer, stepDriving, stepBullets, stepParticles, stepPickups, stepTime,
    makeCar, spawnPeds,
  };
}
