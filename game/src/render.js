// Rendering only: world state in, pixels out. Top-down camera follows player.
// City painted from seeded map: roads, sidewalks, buildings, palms, beach, sea, containers.
// 1280x720 logical frame scaled to window.
import { WORLD_W, WORLD_H, ROAD_W } from './config.js';
import { districtAt } from './city.js';
import { clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createRenderer(canvas, hud) {
  const g = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let shake = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.x = (canvas.width - VIEW_W * view.scale) / 2;
    view.y = (canvas.height - VIEW_H * view.scale) / 2;
  }
  // Defer initial resize until layout is stable
  requestAnimationFrame(resize);
  window.addEventListener('resize', resize);

  function addShake(amount) { shake = Math.min(14, shake + amount); }

  function isNight(t) { return t < 6 || t >= 19; }
  function daylight(t) {
    if (t >= 7 && t <= 17) return 1;
    if (t >= 6 && t < 7) return (t - 6);
    if (t > 17 && t < 19) return (19 - t) / 2;
    return 0;
  }

  function drawCar(x, y, angle, car, t, night) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    const len = car.kind === 'truck' ? 52 : car.kind === 'van' ? 46 : 42;
    const wid = car.kind === 'truck' ? 24 : 20;
    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    // Body
    g.fillStyle = car.color;
    g.beginPath();
    g.roundRect(-len / 2, -wid / 2, len, wid, 6);
    g.fill();
    // Cabin + windows
    g.fillStyle = 'rgba(20,28,38,0.85)';
    const cab = car.kind === 'truck' ? 12 : 16;
    g.fillRect(car.kind === 'truck' ? len / 2 - 14 : -cab / 2, -wid / 2 + 3, car.kind === 'truck' ? 12 : cab, wid - 6);
    // Windshield glint
    g.fillStyle = 'rgba(180,220,255,0.5)';
    g.fillRect(len / 2 - 6, -wid / 2 + 4, 3, wid - 8);
    // Police livery
    if (car.isPolice) {
      g.fillStyle = '#ffffff';
      g.fillRect(-len / 2 + 4, -wid / 2 + 2, len - 8, 4);
      g.fillStyle = '#111111';
      g.font = 'bold 9px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('POLICE', 0, 0);
      const phase = Math.floor(t * 6) % 2 === 0;
      g.fillStyle = phase ? '#ff2222' : '#552222';
      g.fillRect(-6, -wid / 2 - 3, 6, 5);
      g.fillStyle = phase ? '#2222ff' : '#222255';
      g.fillRect(0, -wid / 2 - 3, 6, 5);
      g.fillStyle = '#ff2222';
      g.fillRect(-6, wid / 2 - 2, 6, 5);
      g.fillStyle = '#2222ff';
      g.fillRect(0, wid / 2 - 2, 6, 5);
    }
    if (car.kind === 'taxi') {
      g.fillStyle = '#111111';
      g.font = 'bold 8px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('TAXI', 0, 0);
    }
    // Headlights at night
    if (night) {
      g.fillStyle = 'rgba(255,240,180,0.9)';
      g.beginPath(); g.arc(len / 2, -wid / 2 + 4, 3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(len / 2, wid / 2 - 4, 3, 0, Math.PI * 2); g.fill();
    }
    // Damage smoke
    if (car.health < 45) {
      g.fillStyle = 'rgba(120,120,120,0.7)';
      g.beginPath(); g.arc(-len / 2 + 6, 0, 6 + Math.sin(t * 9) * 2, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawPed(x, y, angle, p, t) {
    const bob = Math.sin(p.phase * 6) * 1.5;
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(1, 3, 10, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.color;
    g.beginPath(); g.arc(0, bob * 0.3, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2c9a0';
    g.beginPath(); g.arc(3, bob * 0.3, 5.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, bob * 0.3, 10, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  function drawPlayer(player, t, night, day) {
    g.save();
    g.translate(player.x, player.y);
    g.rotate(player.angle);
    const bob = Math.sin(player.walkPhase) * 1.5;
    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(0, 3, 12, 7, 0, 0, Math.PI * 2); g.fill();
    // Body - Mara: sunset jacket, dark jeans, gold accent
    g.fillStyle = '#e87a2a';
    g.beginPath(); g.arc(0, bob * 0.3, 13, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23d'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, bob * 0.3, 13, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f2c9a0';
    g.beginPath(); g.arc(6, bob * 0.3, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 10px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('M', -1, 0);
    g.restore();
    // Name tag above player
    g.font = 'bold 13px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.strokeText('MARA', player.x, player.y - 20);
    g.fillStyle = '#ffd23d';
    g.fillText('MARA', player.x, player.y - 20);
    if (player.punchCooldown > 0.15) {
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath();
      g.arc(player.x + Math.cos(player.aimAngle) * 24, player.y + Math.sin(player.aimAngle) * 24, 7, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawWorld(state, city, missions, t) {
    const player = state.player;
    const speed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;
    const zoom = clamp(1.05 - speed / 1400, 0.78, 1.05);
    const camX = clamp(player.x - VIEW_W / 2 / zoom, 0, WORLD_W - VIEW_W / zoom);
    const camY = clamp(player.y - VIEW_H / 2 / zoom, 0, WORLD_H - VIEW_H / zoom);
    shake = Math.max(0, shake - 0.6);
    const shX = shake > 0 ? (Math.sin(t * 91) * shake * 0.5) : 0;
    const shY = shake > 0 ? (Math.cos(t * 83) * shake * 0.5) : 0;

    g.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    g.translate(-camX * zoom + shX, -camY * zoom + shY);

    const night = isNight(state.timeOfDay);
    const day = daylight(state.timeOfDay);

    // Sky gradient
    const sky = g.createLinearGradient(0, 0, 0, VIEW_H / zoom);
    if (night) {
      sky.addColorStop(0, '#0a0f1a'); sky.addColorStop(0.5, '#1a1030'); sky.addColorStop(1, '#2a1a3a');
    } else if (day < 0.5) {
      sky.addColorStop(0, '#ff6b35'); sky.addColorStop(0.5, '#ff9a4a'); sky.addColorStop(1, '#ffc87a');
    } else {
      sky.addColorStop(0, '#4a90d9'); sky.addColorStop(0.5, '#6ab0e8'); sky.addColorStop(1, '#8fd0f0');
    }
    g.fillStyle = sky;
    g.fillRect(camX, camY, VIEW_W / zoom, VIEW_H / zoom);

    // Sea (west)
    const seaX = 0;
    const seaW = 70;
    const seaGrad = g.createLinearGradient(seaX, 0, seaX + seaW, 0);
    if (night) { seaGrad.addColorStop(0, '#081530'); seaGrad.addColorStop(1, '#0a2040'); }
    else { seaGrad.addColorStop(0, '#1a5a8a'); seaGrad.addColorStop(1, '#2a7ab8'); }
    g.fillStyle = seaGrad;
    g.fillRect(seaX, camY, seaW, VIEW_H / zoom);

    // Beach sand
    g.fillStyle = night ? '#2a2018' : '#e8d4a8';
    g.fillRect(70, camY, 80, VIEW_H / zoom);

    // Roads
    g.fillStyle = night ? '#1a1a2a' : '#2a2a3a';
    for (const rx of city.vRoads) g.fillRect(rx - ROAD_W / 2, camY, ROAD_W, VIEW_H / zoom);
    for (const ry of city.hRoads) g.fillRect(camX, ry - ROAD_W / 2, VIEW_W / zoom, ROAD_W);
    // Road lines
    g.strokeStyle = night ? '#3a3a4a' : '#5a5a6a';
    g.lineWidth = 2; g.setLineDash([24, 16]);
    for (const rx of city.vRoads) {
      g.beginPath(); g.moveTo(rx, camY); g.lineTo(rx, camY + VIEW_H / zoom); g.stroke();
    }
    for (const ry of city.hRoads) {
      g.beginPath(); g.moveTo(camX, ry); g.lineTo(camX + VIEW_W / zoom, ry); g.stroke();
    }
    g.setLineDash([]);

    // Sidewalks
    g.fillStyle = night ? '#2a2a3a' : '#3a3a4a';
    for (const rx of city.vRoads) {
      g.fillRect(rx - ROAD_W / 2 - 14, camY, 14, VIEW_H / zoom);
      g.fillRect(rx + ROAD_W / 2, camY, 14, VIEW_H / zoom);
    }
    for (const ry of city.hRoads) {
      g.fillRect(camX, ry - ROAD_W / 2 - 14, VIEW_W / zoom, 14);
      g.fillRect(camX, ry + ROAD_W / 2, VIEW_W / zoom, 14);
    }

    // Buildings
    for (const b of city.buildings) {
      const bx = b.x, by = b.y, bw = b.w, bh = b.h;
      if (bx + bw < camX || bx > camX + VIEW_W / zoom || by + bh < camY || by > camY + VIEW_H / zoom) continue;
      const h = 20 + b.height * 30;
      // Roof
      g.fillStyle = b.roof;
      g.fillRect(bx, by - h, bw, bh);
      // Walls
      const wallGrad = g.createLinearGradient(bx, by - h, bx, by);
      wallGrad.addColorStop(0, b.color);
      wallGrad.addColorStop(1, '#1a1a2a');
      g.fillStyle = wallGrad;
      g.fillRect(bx, by - h, bw, h);
      // Windows
      g.fillStyle = night ? 'rgba(255,220,120,0.7)' : 'rgba(180,220,255,0.4)';
      const wx = Math.floor(bw / 24), wy = Math.floor(h / 24);
      for (let ix = 0; ix < wx; ix++) {
        for (let iy = 0; iy < wy; iy++) {
          if ((ix + iy + Math.floor(b.x / 100)) % 3 === 0) {
            g.fillRect(bx + 6 + ix * 24, by - h + 6 + iy * 24, 12, 12);
          }
        }
      }
      // Neon accent
      if (b.neon) {
        g.strokeStyle = b.neonColor;
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(bx, by - h); g.lineTo(bx + bw, by - h); g.stroke();
      }
    }

    // Parks
    g.fillStyle = night ? '#1a3a1a' : '#2f7a3a';
    for (const p of city.parks) {
      if (p.x + p.w < camX || p.x > camX + VIEW_W / zoom || p.y + p.h < camY || p.y > camY + VIEW_H / zoom) continue;
      g.fillRect(p.x, p.y, p.w, p.h);
    }

    // Palms
    for (const p of city.palms) {
      if (p.x < camX - 20 || p.x > camX + VIEW_W / zoom + 20 || p.y < camY - 20 || p.y > camY + VIEW_H / zoom + 20) continue;
      g.fillStyle = night ? '#1a3a1a' : '#2f5a2f';
      g.fillRect(p.x - 3, p.y - 24, 6, 24);
      g.fillStyle = night ? '#1a4a1a' : '#3f7a3f';
      g.beginPath(); g.arc(p.x, p.y - 24, 12, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(p.x + 8, p.y - 30, 8, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(p.x - 8, p.y - 30, 8, 0, Math.PI * 2); g.fill();
    }

    // Containers
    for (const c of city.containers) {
      if (c.x + c.w < camX || c.x > camX + VIEW_W / zoom || c.y + c.h < camY || c.y > camY + VIEW_H / zoom) continue;
      g.save();
      g.translate(c.x + c.w / 2, c.y + c.h / 2);
      g.rotate(c.angle);
      g.fillStyle = c.color;
      g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      g.strokeStyle = '#00000055'; g.lineWidth = 1;
      g.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
      g.restore();
    }

    // Pickups
    for (const p of city.pickups) {
      if (p.taken) continue;
      if (p.x < camX - 20 || p.x > camX + VIEW_W / zoom + 20 || p.y < camY - 20 || p.y > camY + VIEW_H / zoom + 20) continue;
      const pulse = 8 + Math.sin(t * 5) * 2;
      g.fillStyle = p.kind === 'health' ? '#37c978' : p.kind === 'armor' ? '#3fa8ff' : '#ffd23d';
      g.beginPath(); g.arc(p.x, p.y, pulse, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.arc(p.x, p.y, pulse, 0, Math.PI * 2); g.stroke();
    }

    // Mission waypoint beacon
    if (missions.waypoint) {
      const wx = missions.waypoint.x, wy = missions.waypoint.y;
      if (wx > camX - 30 && wx < camX + VIEW_W / zoom + 30 && wy > camY - 30 && wy < camY + VIEW_H / zoom + 30) {
        const pulse = 14 + Math.sin(t * 4) * 4;
        g.strokeStyle = '#ffd23d'; g.lineWidth = 3;
        g.beginPath(); g.arc(wx, wy, pulse, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#ffd23d88'; g.beginPath(); g.arc(wx, wy, 8, 0, Math.PI * 2); g.fill();
      }
    }

    // Cars
    for (const car of state.cars) {
      const sx = (car.x - camX) * zoom, sy = (car.y - camY) * zoom;
      if (sx < -80 || sx > VIEW_W + 80 || sy < -80 || sy > VIEW_H + 80) continue;
      drawCar(car.x, car.y, car.angle, car, t, night);
    }

    // Police foot cops
    for (const cop of state.cops) {
      const sx = (cop.x - camX) * zoom, sy = (cop.y - camY) * zoom;
      if (sx < -40 || sx > VIEW_W + 40 || sy < -40 || sy > VIEW_H + 40) continue;
      drawPed(cop.x, cop.y, cop.angle, { color: '#222831', phase: 0 }, t);
    }

    // Pedestrians
    for (const p of state.peds) {
      if (!p.alive) continue;
      const sx = (p.x - camX) * zoom, sy = (p.y - camY) * zoom;
      if (sx < -30 || sx > VIEW_W + 30 || sy < -30 || sy > VIEW_H + 30) continue;
      drawPed(p.x, p.y, p.angle, p, t);
    }

    // Bullets (tracers)
    for (const b of state.bullets) {
      const sx = (b.x - camX) * zoom, sy = (b.y - camY) * zoom;
      if (sx < -20 || sx > VIEW_W + 20 || sy < -20 || sy > VIEW_H + 20) continue;
      g.strokeStyle = b.fromCop ? '#ff4444' : '#ffd23d';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx - Math.cos(b.angle) * 12, sy - Math.sin(b.angle) * 12);
      g.stroke();
    }

    // Player
    if (!player.inCar) {
      drawPlayer(player, t, night, day);
    }

    // Particles
    for (const p of state.particles) {
      g.globalAlpha = Math.max(0, p.life / p.maxLife);
      g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;

    // Skid marks
    g.strokeStyle = 'rgba(40,40,40,0.5)';
    g.lineWidth = 3;
    for (const s of state.skidmarks) {
      const sx = (s.x - camX) * zoom, sy = (s.y - camY) * zoom;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(s.angle) * 10, sy + Math.sin(s.angle) * 10); g.stroke();
    }

    g.restore();

    // Day/night light overlay
    if (night || day < 1) {
      const dark = night ? 0.55 : (1 - day) * 0.35;
      g.fillStyle = `rgba(8,12,34,${dark})`;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      // Headlight cones at night
      if (night) {
        for (const car of state.cars) {
          const sx = (car.x - camX) * zoom, sy = (car.y - camY) * zoom;
          if (sx < -80 || sx > VIEW_W + 80 || sy < -80 || sy > VIEW_H + 80) continue;
          g.save();
          g.translate(sx, sy);
          g.rotate(car.angle);
          const grad = g.createLinearGradient(0, 0, 120, 0);
          grad.addColorStop(0, 'rgba(255,240,180,0.18)');
          grad.addColorStop(1, 'rgba(255,240,180,0)');
          g.fillStyle = grad;
          g.beginPath();
          g.moveTo(20, -8); g.lineTo(120, -34); g.lineTo(120, 34); g.lineTo(20, 8);
          g.closePath(); g.fill();
          g.restore();
        }
      }
    }
    if (day > 0.85) {
      g.fillStyle = 'rgba(255,190,90,0.06)';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function panel(title, lines, prompt, accent) {
    g.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    g.fillStyle = 'rgba(8,12,20,0.72)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 760;
    const h = 150 + lines.length * 36;
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    g.fillStyle = 'rgba(16,22,34,0.96)';
    g.fillRect(x, y, w, h);
    g.strokeStyle = accent; g.lineWidth = 4;
    g.strokeRect(x, y, w, h);
    hud.text(g, title, VIEW_W / 2, y + 28, 52, accent, 'center');
    lines.forEach((line, i) => hud.text(g, line, VIEW_W / 2, y + 104 + i * 36, 21, '#e8ecf2', 'center', 'normal'));
    hud.text(g, prompt, VIEW_W / 2, y + h - 44, 22, '#ffd23d', 'center');
  }

  function draw(state, city, missions, screen, best, t) {
    if (screen === SCREEN_TITLE) {
      drawWorld(state, city, missions, t);
      panel('PALMERA BAY', [
        'Sunset Score — an open-world crime game',
        'Mara Voss is back in town. The job pays well.',
        'Three missions. A whole city. Steal cars, lose the cops, get paid.',
        'WASD move / drive · E steal a car · F punch · Click shoot · M mission',
        'Shift run · Space handbrake · P pause · N mute · progress saves itself',
      ], 'Press Enter or click to start  —  Continue loads your save', '#ffd23d');
      return;
    }
    drawWorld(state, city, missions, t);
    hud.draw(g, VIEW_W, VIEW_H, { state, player: state.player, city }, missions, screen);
    if (screen === SCREEN_PAUSED) {
      panel('PAUSED', ['The city waits for no one — except now.', 'Progress is saved automatically.'], 'Press P or Enter to keep playing', '#7ec8ff');
    } else if (screen === SCREEN_OVER) {
      panel('WASTED', [
        `Mara went down in ${districtAt(state.player.x, state.player.y)}.`,
        `Cash kept: $${state.player.cash} · Missions done: ${state.missionsDone} · Earned: $${state.totalEarned}`,
      ], 'Press Enter to get back on your feet', '#ff5a5a');
    } else if (screen === SCREEN_BUSTED) {
      panel('BUSTED', [
        'The Palmera Bay police finally caught up with Mara.',
        `Cash kept: $${state.player.cash} · Missions done: ${state.missionsDone}`,
      ], 'Press Enter to walk free and try again', '#3fa8ff');
    }
  }

  return { draw, addShake, resize };
}
