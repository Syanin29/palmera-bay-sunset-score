// Player: on-foot movement, health/armor, entering/exiting cars, punch, shoot.
// Driving is handled in world.js stepDriving.
import { clamp, angleTo } from './random.js';

export function createPlayer(city) {
  const player = {
    x: 745, y: 800, angle: -Math.PI / 2, speed: 0,
    health: 100, armor: 0, cash: 40, ammo: 24,
    weapon: 'pistol', inCar: null, punchCooldown: 0, hurtFlash: 0,
    aimAngle: 0, walkPhase: 0,
  };

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

  function enterOrExitCar(state, rng, audio, city) {
    if (player.inCar) {
      const car = player.inCar;
      car.isPlayer = false;
      car.speed = 0;
      player.inCar = null;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      const fixed = city.collideCircle(player.x, player.y, 14);
      player.x = fixed.x; player.y = fixed.y;
      return 'On foot.';
    }
    // Find nearest non-police car
    let best = null, bestD = 64 * 64;
    for (const car of state.cars) {
      if (car.isPolice) continue;
      const dx = car.x - player.x, dy = car.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { best = car; bestD = d2; }
    }
    if (!best) return null;
    const wasParked = best.parked;
    const hadDriver = !!best.driver;
    best.parked = false;
    best.traffic = false;
    best.isPlayer = true;
    player.inCar = best;
    player.x = best.x; player.y = best.y; player.angle = best.angle;
    if (!wasParked || hadDriver) {
      state.wanted = Math.max(state.wanted, 1);
      state.heat = Math.max(state.heat, 100);
      state.stats.carsStolen += 1;
      audio.crash();
      return 'Car stolen!';
    } else {
      return 'In the car. W to drive.';
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

  return { player, stepPlayer, enterOrExitCar, damagePlayer };
}
