// Palmera Bay city: road grid at fixed coords, districts, buildings, palms, beach, sea, containers, pickups.
// Generation is pure: same seed = same city. Spawns/waypoints ONLY on road centrelines.
import { WORLD_W, WORLD_H, ROAD_W, PALETTES, DISTRICTS, BEACH, ROAD_COORDS } from './config.js';
import { clamp } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Sunset Marina';
}

export function createCity(rng) {
  const vRoads = [...ROAD_COORDS];
  const hRoads = [...ROAD_COORDS];

  const buildings = [];
  const parks = [];
  const palms = [];
  const containers = [];
  const pickups = [];

  for (let i = 0; i < vRoads.length - 1; i++) {
    for (let j = 0; j < hRoads.length - 1; j++) {
      const bx0 = vRoads[i] + ROAD_W / 2 + 14;
      const by0 = hRoads[j] + ROAD_W / 2 + 14;
      const bx1 = vRoads[i + 1] - ROAD_W / 2 - 14;
      const by1 = hRoads[j + 1] - ROAD_W / 2 - 14;
      if (bx1 - bx0 < 90 || by1 - by0 < 90) continue;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      if (rng.next() < 0.16) {
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        for (let k = 0; k < 5; k++) palms.push({ x: rng.range(bx0 + 20, bx1 - 20), y: rng.range(by0 + 20, by1 - 20) });
        continue;
      }
      const n = rng.chance(0.45) ? 2 : 1;
      for (let b = 0; b < n; b++) {
        const w = rng.range(90, Math.min(200, (bx1 - bx0) / n - 16));
        const h = rng.range(80, Math.min(190, by1 - by0 - 16));
        const x = n === 1 ? cx - w / 2 : bx0 + 8 + b * ((bx1 - bx0) / 2);
        const y = cy - h / 2 + (n === 1 ? 0 : rng.range(-10, 10));
        const district = districtAt(cx, cy);
        const pal = PALETTES[district];
        buildings.push({
          x, y, w, h,
          color: pal[Math.floor(rng.next() * pal.length)],
          roof: rng.pick(['#3a3f4a', '#4a3a3f', '#2f3a4a', '#5a4a3a']),
          height: rng.int(1, 4),
          district,
          neon: rng.chance(0.35),
          neonColor: rng.pick(['#ff2d78', '#00e5ff', '#ffd23d', '#7cff4a']),
        });
      }
      for (let k = 0; k < 3; k++) palms.push({ x: rng.range(bx0, bx1), y: by0 + 4 });
    }
  }

  // Harbour containers in North Docks
  for (let i = 0; i < 26; i++) {
    containers.push({
      x: rng.range(2500, 3250), y: rng.range(2350, 2850),
      w: 86, h: 34, angle: rng.chance(0.5) ? 0 : Math.PI / 2,
      color: rng.pick(['#c0392b', '#2980b9', '#e67e22', '#27ae60', '#8e44ad', '#f1c40f']),
    });
  }

  const places = {
    safehouse: { x: 745, y: 745, name: "Mara's Safehouse" },
    pier: { x: 745, y: 1180, name: 'Sunset Pier' },
    motel: { x: 2470, y: 745, name: 'Coral Motel' },
    casino: { x: 2035, y: 1175, name: 'Coral Casino' },
    respray: { x: 1175, y: 1605, name: 'Sunset Respray' },
    clinic: { x: 2035, y: 2035, name: 'Palm Row Clinic' },
    drop1: { x: 1605, y: 2035, name: 'Palm Row Drop' },
    drop2: { x: 2890, y: 1175, name: 'Marina Drop' },
    drop3: { x: 320, y: 1605, name: 'Beachfront Drop' },
  };

  const pickupSpots = [
    { x: 745, y: 1180, kind: 'health' }, { x: 2035, y: 745, kind: 'armor' },
    { x: 1175, y: 2470, kind: 'ammo' }, { x: 2890, y: 1175, kind: 'health' },
    { x: 320, y: 1605, kind: 'ammo' }, { x: 2470, y: 2035, kind: 'armor' },
  ];
  for (const p of pickupSpots) pickups.push({ ...p, taken: false, respawn: 0 });

  function collideCircle(x, y, r) {
    let nx = x, ny = y;
    for (const b of buildings) {
      const cx = clamp(nx, b.x, b.x + b.w), cy = clamp(ny, b.y, b.y + b.h);
      const dx = nx - cx, dy = ny - cy, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.01) { const d = Math.sqrt(d2); nx = cx + (dx / d) * r; ny = cy + (dy / d) * r; }
        else { nx += r; }
      }
    }
    for (const c of containers) {
      const hw = c.w / 2, hh = c.h / 2;
      const lx = nx - c.x, ly = ny - c.y;
      const rx = c.angle === 0 ? lx : ly, ry = c.angle === 0 ? ly : -lx;
      const cx = clamp(rx, -hw, hw), cy = clamp(ry, -hh, hh);
      const dx = rx - cx, dy = ry - cy, d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const px = cx + (dx / d) * r, py = cy + (dy / d) * r;
        if (c.angle === 0) { nx = c.x + px; ny = c.y + py; } else { nx = c.x - py; ny = c.y + px; }
      }
    }
    nx = clamp(nx, 30, WORLD_W - 30);
    ny = clamp(ny, 30, WORLD_H - 30);
    return { x: nx, y: ny };
  }

  function isWater(x) { return x < BEACH.waterX1; }
  function isSand(x) { return x >= BEACH.waterX1 && x < BEACH.x1; }

  return {
    vRoads, hRoads, buildings, parks, palms, containers, pickups, places, beach: BEACH,
    collideCircle, isWater, isSand,
    onRoad(x, y) {
      for (const rx of vRoads) if (Math.abs(x - rx) < ROAD_W / 2 + 26) return true;
      for (const ry of hRoads) if (Math.abs(y - ry) < ROAD_W / 2 + 26) return true;
      return false;
    },
    nearestRoadX(x) { let best = vRoads[0]; for (const rx of vRoads) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx; return best; },
    nearestRoadY(y) { let best = hRoads[0]; for (const ry of hRoads) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry; return best; },
  };
}
