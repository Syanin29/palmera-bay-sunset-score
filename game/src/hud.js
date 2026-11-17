// HUD: health/armor bars, cash, wanted stars, weapon/ammo, speed, clock, district,
// mission banner, circular minimap with blips for player, police, mission, traffic.
import { districtAt } from './city.js';

export function createHud() {
  function bar(g, x, y, w, h, frac, color, bg) {
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = color; g.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  }
  function text(g, s, x, y, size, color, align = 'left', weight = 'bold') {
    g.font = `${weight} ${size}px system-ui, sans-serif`;
    g.textAlign = align; g.textBaseline = 'top';
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.strokeText(s, x, y);
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  function drawMinimap(g, world, missions, cx, cy, r) {
    const { state, city } = world;
    const scale = (r * 2) / 3400;
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(10,16,26,0.92)'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Ocean (west edge)
    g.fillStyle = '#1f6f9f'; g.fillRect(cx - r, cy - r, 70 * scale + 4, r * 2);
    // Roads
    g.strokeStyle = '#5a6068'; g.lineWidth = 4;
    for (const rx of city.vRoads) {
      const x = cx - r + rx * scale;
      g.beginPath(); g.moveTo(x, cy - r); g.lineTo(x, cy + r); g.stroke();
    }
    for (const ry of city.hRoads) {
      const y = cy - r + ry * scale;
      g.beginPath(); g.moveTo(cx - r, y); g.lineTo(cx + r, y); g.stroke();
    }
    // Parks
    g.fillStyle = '#2f7a3a';
    for (const p of city.parks) g.fillRect(cx - r + p.x * scale, cy - r + p.y * scale, p.w * scale, p.h * scale);
    const dot = (x, y, color, rad) => {
      g.fillStyle = color;
      g.beginPath(); g.arc(cx - r + x * scale, cy - r + y * scale, rad, 0, Math.PI * 2); g.fill();
    };
    for (const c of state.cars) if (c.isPolice) dot(c.x, c.y, '#3fa8ff', 5);
    for (const c of state.cars) if (!c.isPolice && !c.isPlayer) dot(c.x, c.y, '#bbbbbb', 2.5);
    if (state.taxi) dot(state.taxi.phase === 'pickup' ? state.taxi.ped.x : state.taxi.destX, state.taxi.phase === 'pickup' ? state.taxi.ped.y : state.taxi.destY, '#f2c230', 6);
    if (missions.waypoint) {
      const wx = cx - r + missions.waypoint.x * scale, wy = cy - r + missions.waypoint.y * scale;
      g.strokeStyle = '#ffd23d'; g.lineWidth = 3;
      g.beginPath(); g.arc(wx, wy, 9 + Math.sin(state.elapsed * 5) * 2, 0, Math.PI * 2); g.stroke();
      dot(missions.waypoint.x, missions.waypoint.y, '#ffd23d', 5);
    }
    // Player arrow
    const px = cx - r + state.player.x * scale, py = cy - r + state.player.y * scale;
    g.save(); g.translate(px, py); g.rotate(state.player.angle);
    g.fillStyle = '#ff5a3c';
    g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 7); g.lineTo(-7, 7); g.closePath(); g.fill();
    g.restore();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillStyle = '#fff'; g.fillText('N', cx, cy - r + 6);
  }

  function draw(g, W, H, world, missions, screen) {
    const { state, player } = world;
    const m = missions.mission;
    // Top-left: health, armour, cash
    text(g, `♥ ${Math.max(0, Math.ceil(player.health))}`, 18, 14, 26, '#ff5a5a');
    bar(g, 18, 46, 210, 16, player.health / 100, '#37c978', 'rgba(0,0,0,0.55)');
    text(g, `ARMOR ${Math.ceil(player.armor)}`, 18, 68, 18, '#7ec8ff');
    bar(g, 18, 90, 210, 10, player.armor / 100, '#3fa8ff', 'rgba(0,0,0,0.55)');
    text(g, `$${player.cash.toLocaleString('en-US')}`, 18, 108, 30, '#ffd23d');
    // Top-centre: wanted stars
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    text(g, stars, W / 2, 10, 40, state.wanted > 0 ? '#ffd23d' : 'rgba(255,255,255,0.4)', 'center');
    if (state.wanted > 0) text(g, 'WANTED', W / 2, 54, 16, '#ff5a5a', 'center');
    // Top-right: minimap + clock + district
    drawMinimap(g, world, missions, W - 108, 108, 88);
    const hh = String(Math.floor(state.timeOfDay) % 24).padStart(2, '0');
    const mm = String(Math.floor((state.timeOfDay % 1) * 60)).padStart(2, '0');
    text(g, `${hh}:${mm}`, W - 108, 204, 22, '#ffffff', 'center');
    text(g, districtAt(player.x, player.y).toUpperCase(), W - 108, 230, 15, '#ffd97a', 'center');
    // Bottom-left: mission banner
    const obj = missions.objectiveText();
    text(g, obj, 18, H - 64, 20, '#ffffff');
    if (missions.active && m) text(g, `MISSION ${m.id}/3 — ${m.name.toUpperCase()}`, 18, H - 92, 17, '#ffd23d');
    if (missions.active && m && m.id === 3) text(g, `TIME ${Math.max(0, Math.ceil(missions.raceTimer))}s`, 18, H - 118, 17, '#ff8a5a');
    // Bottom-right: speed + weapon
    const speedKmh = Math.round(Math.abs(player.inCar ? player.inCar.speed : player.speed) * 0.55);
    text(g, player.inCar ? `${speedKmh} km/h` : 'ON FOOT', W - 18, H - 92, 26, '#ffffff', 'right');
    text(g, player.inCar ? player.inCar.kind.toUpperCase() : `PISTOL  ▸ ${player.ammo} ammo`, W - 18, H - 56, 20, '#cfe8ff', 'right');
    text(g, 'WASD move · E car · F punch · Click shoot · M mission · P pause', W - 18, H - 28, 13, 'rgba(255,255,255,0.65)', 'right');
    // Toast message
    if (state.messageTimer > 0 && state.message) {
      g.font = 'bold 24px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'top';
      const tw = g.measureText(state.message).width + 36;
      g.fillStyle = 'rgba(8,12,20,0.8)';
      g.beginPath();
      g.roundRect(W / 2 - tw / 2, 96, tw, 40, 20);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillText(state.message, W / 2, 104);
    }
    if (player.hurtFlash > 0) {
      g.fillStyle = `rgba(255,40,40,${player.hurtFlash * 0.5})`;
      g.fillRect(0, 0, W, H);
    }
  }

  return { draw, text };
}
