// Wanted system and police response. Stars 1-5 rise with crimes, fall when hiding.
// Police cars spawn, chase, ram. More/faster at higher levels.
import { clamp, dist2, angleTo, turnToward } from './random.js';
import { WORLD_W, WORLD_H, POLICE_CAR } from './config.js';

export function createPolice(world) {
  const { state, rng, city, player } = world;
  let sirenPhase = 0;

  function wantCount() {
    if (state.wanted === 0) return 0;
    // Levels 1-5: 1, 2, 3, 4, 5 cars
    return Math.min(5, state.wanted + 1);
  }

  function spawnCopCar() {
    const a = rng.next() * Math.PI * 2;
    const d = 500 + rng.next() * 250;
    const x = clamp(player.x + Math.cos(a) * d, 120, WORLD_W - 120);
    const y = clamp(player.y + Math.sin(a) * d, 120, WORLD_H - 120);
    const car = world.makeCar(rng, x, y, angleTo(x, y, player.x, player.y), POLICE_CAR);
    car.isPolice = true;
    car.health = 100;
    car.traffic = false;
    state.cars.push(car);
    return car;
  }

  function spawnFootCop() {
    const a = rng.next() * Math.PI * 2;
    const d = 320 + rng.next() * 120;
    const cop = {
      x: clamp(player.x + Math.cos(a) * d, 120, WORLD_W - 120),
      y: clamp(player.y + Math.sin(a) * d, 120, WORLD_H - 120),
      angle: 0, speed: 0, health: 60, shootCooldown: rng.range(0.5, 1.5),
    };
    state.cops.push(cop);
    return cop;
  }

  function ensurePolice() {
    const wantCars = wantCount();
    const cars = state.cars.filter(c => c.isPolice);
    while (cars.length < wantCars) cars.push(spawnCopCar());
    while (cars.length > wantCars) {
      const c = cars.pop();
      const i = state.cars.indexOf(c);
      if (i >= 0) state.cars.splice(i, 1);
    }
    const wantFoot = state.wanted >= 2 ? Math.min(3, state.wanted - 1) : 0;
    while (state.cops.length < wantFoot) spawnFootCop();
    while (state.cops.length > wantFoot) state.cops.pop();
  }

  function step(dt) {
    sirenPhase += dt * 6;
    if (state.wanted === 0) {
      state.heat = Math.max(0, state.heat - dt * 6);
      ensurePolice();
      return null;
    }
    const hiding = state.cops.length === 0 && state.cars.filter(c => c.isPolice).length === 0;
    state.heat = Math.max(0, state.heat - dt * (hiding ? 14 : player.inCar ? 1.5 : 3));
    if (state.heat <= 0) {
      state.wanted -= 1;
      state.heat = state.wanted > 0 ? 55 : 0;
      if (state.wanted === 0) world.showMessage('You lost them. Clean getaway.', 3);
    }
    ensurePolice();

    const tx = player.x, ty = player.y;
    for (const car of state.cars) {
      if (!car.isPolice) continue;
      const d = Math.hypot(tx - car.x, ty - car.y) || 1;
      const wantAngle = angleTo(car.x, car.y, tx, ty);
      car.angle = turnToward(car.angle, wantAngle, 2.6 * dt);
      const top = 300 + state.wanted * 26;
      car.speed = Math.min(top, car.speed + 300 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = city.collideCircle(nx, ny, 20);
      car.x = fixed.x; car.y = fixed.y;
      if (d < 46) {
        if (player.inCar) {
          player.inCar.speed *= 0.94;
          player.inCar.health -= 6 * dt;
          if (rng.next() < dt * 2) world.addParticles(car.x, car.y, '#ffaa00', 4, 120);
        } else {
          world.damagePlayer(16 * dt);
          state.bustedTimer += dt;
        }
      }
    }
    for (const cop of state.cops) {
      const d = Math.hypot(tx - cop.x, ty - cop.y) || 1;
      const wantAngle = angleTo(cop.x, cop.y, tx, ty);
      cop.angle = turnToward(cop.angle, wantAngle, 5 * dt);
      const speed = player.inCar ? 0 : 175;
      cop.x += Math.cos(cop.angle) * speed * dt;
      cop.y += Math.sin(cop.angle) * speed * dt;
      const fixed = city.collideCircle(cop.x, cop.y, 12);
      cop.x = fixed.x; cop.y = fixed.y;
      cop.shootCooldown -= dt;
      if (state.wanted >= 3 && !player.inCar && d < 420 && cop.shootCooldown <= 0) {
        cop.shootCooldown = rng.range(0.9, 1.6);
        const aim = wantAngle + rng.range(-0.12, 0.12);
        state.bullets.push({ x: cop.x, y: cop.y, angle: aim, speed: 700, life: 1.1, fromCop: true });
      }
      if (!player.inCar && d < 30) {
        state.bustedTimer += dt * 1.5;
        if (state.bustedTimer > 1.4) return 'busted';
      }
    }
    if (!player.inCar && state.bustedTimer > 0) {
      let near = false;
      for (const cop of state.cops) if (dist2(cop.x, cop.y, tx, ty) < 60 * 60) near = true;
      for (const car of state.cars) if (car.isPolice && dist2(car.x, car.y, tx, ty) < 60 * 60) near = true;
      if (!near) state.bustedTimer = Math.max(0, state.bustedTimer - dt);
    }
    return null;
  }

  function clearWanted() {
    state.wanted = 0; state.heat = 0; state.bustedTimer = 0;
    for (let i = state.cars.length - 1; i >= 0; i--) if (state.cars[i].isPolice) state.cars.splice(i, 1);
    state.cops.length = 0;
  }

  function addWanted(level, reason) {
    if (state.wanted === 0) state.heat = 100;
    state.wanted = Math.min(5, state.wanted + level);
    world.showMessage(reason, 2);
  }

  return { step, ensurePolice, clearWanted, addWanted, sirenPhase: () => sirenPhase };
}
