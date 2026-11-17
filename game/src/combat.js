// Combat: fists up close, pistol at range. Shots are projectiles with short life.
// Hitting peds/cops/cars raises wanted. Misses don't raise wanted. Punch whiff doesn't raise wanted.
import { dist2 } from './random.js';

export function createCombat(world, peds) {
  const { state, rng, player } = world;
  let cooldown = 0;

  function shoot() {
    if (cooldown > 0 || player.ammo <= 0) return null;
    cooldown = 0.26;
    player.ammo -= 1;
    state.stats.shotsFired += 1;
    const fromX = player.x, fromY = player.y;
    const angle = player.inCar ? player.angle : player.aimAngle;
    state.bullets.push({ x: fromX, y: fromY, angle, speed: 900, life: 0.9, fromCop: false });
    world.addParticles(fromX + Math.cos(angle) * 22, fromY + Math.sin(angle) * 22, '#ffd23d', 4, 160);
    return 'shot';
  }

  function bulletHit(b) {
    if (b.fromCop) {
      if (!player.inCar && dist2(b.x, b.y, player.x, player.y) < 14 * 14) {
        world.damagePlayer(9);
        return true;
      }
      if (player.inCar && dist2(b.x, b.y, player.x, player.y) < 22 * 22) {
        player.inCar.health -= 4;
        return true;
      }
      return false;
    }
    for (const p of state.peds) {
      if (p.alive && dist2(b.x, b.y, p.x, p.y) < 13 * 13) {
        p.alive = false;
        peds.scare(p.x, p.y, 260);
        world.addWanted(2, 'You shot a pedestrian!');
        world.addParticles(p.x, p.y, '#e8483f', 10, 160);
        return true;
      }
    }
    for (const cop of state.cops) {
      if (dist2(b.x, b.y, cop.x, cop.y) < 13 * 13) {
        cop.health -= 34;
        if (cop.health <= 0) {
          const i = state.cops.indexOf(cop);
          if (i >= 0) state.cops.splice(i, 1);
          world.addWanted(1, 'Cop down!');
        }
        world.addParticles(cop.x, cop.y, '#e8483f', 8, 150);
        return true;
      }
    }
    for (const car of state.cars) {
      if (car.isPlayer) continue;
      if (dist2(b.x, b.y, car.x, car.y) < 24 * 24) {
        car.health -= 12;
        if (car.health <= 0 && !car.wrecked) {
          car.wrecked = true;
          world.addParticles(car.x, car.y, '#ff8833', 18, 220);
          world.addWanted(1, 'You wrecked a car!');
        }
        return true;
      }
    }
    return false;
  }

  function punch() {
    if (cooldown > 0 || player.inCar) return null;
    cooldown = 0.4;
    player.punchCooldown = 0.3;
    const px = player.x + Math.cos(player.aimAngle) * 20;
    const py = player.y + Math.sin(player.aimAngle) * 20;
    for (const p of state.peds) {
      if (p.alive && dist2(px, py, p.x, p.y) < 24 * 24) {
        p.alive = false;
        peds.scare(p.x, p.y, 200);
        world.addWanted(1, 'Assault!');
        return 'hit-ped';
      }
    }
    for (const cop of state.cops) {
      if (dist2(px, py, cop.x, cop.y) < 24 * 24) {
        cop.health -= 25;
        if (cop.health <= 0) state.cops.splice(state.cops.indexOf(cop), 1);
        world.addWanted(1, 'You hit a cop!');
        return 'hit-cop';
      }
    }
    return 'punch';
  }

  function update(dt) { cooldown = Math.max(0, cooldown - dt); }

  return { shoot, punch, bulletHit, update };
}
