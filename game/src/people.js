// Pedestrians: stroll sidewalks, turn at intersections, run when scared.
// Scared by gunshots, cars bearing down, bodies. Can flag taxi.
import { clamp, dist2, angleTo, turnToward } from './random.js';
import { WORLD_W, WORLD_H } from './config.js';

export function createPedestrians(world) {
  const { state, rng, city } = world;

  function scare(x, y, radius) {
    for (const p of state.peds) {
      if (!p.alive) continue;
      if (dist2(p.x, p.y, x, y) < radius * radius) {
        p.flee = rng.range(1.5, 3);
        p.fleeX = x; p.fleeY = y;
      }
    }
  }

  function stepPed(p, dt) {
    if (!p.alive) return;
    if (p.flee > 0) {
      p.flee -= dt;
      const away = angleTo(p.fleeX, p.fleeY, p.x, p.y);
      p.angle = turnToward(p.angle, away, 6 * dt);
      const sp = 190;
      p.x += Math.cos(p.angle) * sp * dt;
      p.y += Math.sin(p.angle) * sp * dt;
    } else {
      p.phase += dt;
      if (rng.next() < dt * 0.15) {
        const nearV = Math.abs(p.x - city.nearestRoadX(p.x)) < 70;
        const nearH = Math.abs(p.y - city.nearestRoadY(p.y)) < 70;
        if (nearV && nearH) p.angle = Math.floor(rng.next() * 4) * (Math.PI / 2);
        else if (nearV) p.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        else if (nearH) p.angle = rng.chance(0.5) ? 0 : Math.PI;
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
    }
    const fixed = city.collideCircle(p.x, p.y, 10);
    p.x = fixed.x; p.y = fixed.y;
    p.x = clamp(p.x, 90, WORLD_W - 90);
    p.y = clamp(p.y, 90, WORLD_H - 90);
    // Car hits pedestrian
    const pc = state.player.inCar;
    if (pc && Math.abs(pc.speed) > 60 && dist2(p.x, p.y, pc.x, pc.y) < 30 * 30) {
      p.alive = false;
      world.addWanted(1, 'Pedestrian hit!');
      world.addParticles(p.x, p.y, '#e8483f', 10, 160);
      state.stats.pedsHit += 1;
    }
    if (!pc && state.player.speed > 0 && dist2(p.x, p.y, state.player.x, state.player.y) < 16 * 16) {
      p.flee = 1; p.fleeX = state.player.x; p.fleeY = state.player.y;
    }
  }

  function step(dt) {
    for (const p of state.peds) stepPed(p, dt);
    // Keep ~34 walkers around
    const alive = state.peds.filter(p => p.alive).length;
    if (alive < 26 && rng.next() < dt * 2) {
      const fresh = state.peds.filter(p => !p.alive);
      const p = fresh.length ? fresh[0] : null;
      if (p) {
        const rx = city.vRoads[Math.floor(rng.next() * city.vRoads.length)];
        const ry = city.hRoads[Math.floor(rng.next() * city.hRoads.length)];
        p.x = rx + 58; p.y = ry + 58; p.alive = true; p.flee = 0;
      }
    }
  }

  return { step, scare };
}
