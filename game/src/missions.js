// Missions: 3 story missions for Mara. Waypoints on road centrelines.
// Mission 1: Pier pickup -> Motel delivery (+$1200, wanted 2)
// Mission 2: Steal Comet GT at Casino (+$1800)
// Mission 3: Three drops across the bay (+$2500)
import { dist2 } from './random.js';
import { MISSIONS, COMET_GT } from './config.js';

export function createMissions(world, police) {
  const { state, rng, city, player } = world;
  const places = city.places;
  let active = false;
  let step = 0;
  let waypoint = null;
  let raceTimer = 0;
  let resprayCooldown = 0;
  let taxiCooldown = 0;

  function mission() { return MISSIONS[state.missionIndex] ?? null; }

  function waypointsFor(m) {
    if (m.id === 1) return [
      { x: places.pier.x, y: places.pier.y, label: 'Pick up the package — Sunset Pier' },
      { x: places.motel.x, y: places.motel.y, label: 'Deliver to Coral Motel' },
    ];
    if (m.id === 2) return [
      { x: places.casino.x, y: places.casino.y, label: 'Steal the Comet GT — Coral Casino' },
      { x: places.respray.x, y: places.respray.y, label: 'Lose the heat — Sunset Respray' },
    ];
    return [
      { x: places.drop1.x, y: places.drop1.y, label: 'Drop 1 — Palm Row' },
      { x: places.drop2.x, y: places.drop2.y, label: 'Drop 2 — Marina' },
      { x: places.drop3.x, y: places.drop3.y, label: 'Drop 3 — Beachfront' },
    ];
  }

  function start() {
    const m = mission();
    if (!m) return null;
    active = true;
    step = 0;
    waypoint = waypointsFor(m)[0];
    raceTimer = m.id === 3 ? 180 : 0;
    world.showMessage(`MISSION ${m.id}: ${m.name}`, 4);
    return m;
  }

  function complete() {
    const m = mission();
    active = false;
    waypoint = null;
    player.cash += m.reward;
    state.totalEarned += m.reward;
    state.missionsDone += 1;
    state.missionIndex += 1;
    world.showMessage(`MISSION COMPLETE — ${m.name}  +$${m.reward}`, 4);
    if (m.id === 2) police.clearWanted();
    return 'complete';
  }

  function reachRadius() { return player.inCar ? 70 : 46; }

  function update(dt) {
    resprayCooldown = Math.max(0, resprayCooldown - dt);
    taxiCooldown = Math.max(0, taxiCooldown - dt);
    // Respray shop
    if (resprayCooldown <= 0 && state.wanted > 0 && player.cash >= 150 &&
        dist2(player.x, player.y, places.respray.x, places.respray.y) < 110 * 110) {
      player.cash -= 150;
      police.clearWanted();
      world.showMessage('Respray — fresh paint, clean slate. -$150', 3);
      resprayCooldown = 8;
    }
    updateTaxi(dt);
    if (!active) return null;
    const m = mission();
    if (!m) return null;
    if (m.id === 3) {
      raceTimer -= dt;
      if (raceTimer <= 0) {
        active = false; waypoint = null;
        world.showMessage('Payday Run — too slow. Press M to retry.', 4);
        return null;
      }
    }
    if (!waypoint) return null;
    // Mission 2: must be in the Comet GT
    if (m.id === 2 && step === 0) {
      if (player.inCar && player.inCar.kind === 'sport' && player.inCar.color === '#ffd23d') {
        step = 1;
        world.addWanted(3, 'Comet GT stolen! Police en route.');
        world.showMessage('Comet GT taken — lose the heat!', 3);
        waypoint = waypointsFor(m)[1]; // Update to respray waypoint
        return 'advance';
      }
      return null;
    }
    if (dist2(player.x, player.y, waypoint.x, waypoint.y) < reachRadius() * reachRadius()) {
      step += 1;
      const chain = waypointsFor(m);
      if (step >= chain.length) return complete();
      waypoint = chain[step];
      if (m.id === 1 && step === 1) {
        world.addWanted(2, 'The package was hot — cops on you!');
      }
      if (m.id === 3) world.showMessage(`Drop ${step}/3 — keep going!`, 2);
      return 'advance';
    }
    return null;
  }

  function updateTaxi(dt) {
    const t = state.taxi;
    if (t) {
      const tx = t.phase === 'pickup' ? t.ped.x : t.destX;
      const ty = t.phase === 'pickup' ? t.ped.y : t.destY;
      if (t.phase === 'pickup' && player.inCar && dist2(player.x, player.y, t.ped.x, t.ped.y) < 60 * 60) {
        t.phase = 'dropoff';
        t.ped.inTaxi = true;
        world.showMessage(`Passenger aboard — take them to the marker. Fare $${t.fare}`, 3);
      } else if (t.phase === 'dropoff' && dist2(player.x, player.y, t.destX, t.destY) < 70 * 70) {
        player.cash += t.fare;
        state.totalEarned += t.fare;
        t.ped.inTaxi = false;
        t.ped.alive = true;
        state.taxi = null;
        world.showMessage(`Taxi fare paid +$${t.fare}`, 3);
      }
      if (!player.inCar && taxiCooldown <= 0) {
        if (t.ped) t.ped.inTaxi = false;
        state.taxi = null;
      }
      return;
    }
    if (taxiCooldown <= 0 && player.inCar && player.inCar.kind === 'taxi') {
      let best = null, bestD = 700 * 700;
      for (const p of state.peds) {
        if (!p.alive || p.inTaxi) continue;
        const d = dist2(player.x, player.y, p.x, p.y);
        if (d < bestD) { best = p; bestD = d; }
      }
      if (best) {
        const rx = city.vRoads[Math.floor(rng.next() * city.vRoads.length)];
        const ry = city.hRoads[Math.floor(rng.next() * city.hRoads.length)];
        state.taxi = { ped: best, destX: rx, destY: ry, fare: 60 + rng.int(0, 5) * 20, phase: 'pickup' };
        world.showMessage('Taxi fare waiting — pick up the passenger (yellow marker).', 3);
        taxiCooldown = 4;
      }
    }
  }

  function objectiveText() {
    if (active && waypoint) {
      const m = mission();
      return `M${m.id} ${m.name} — ${waypoint.label}`;
    }
    const m = mission();
    if (m) return `Press M — next mission: ${m.name} ($${m.reward})`;
    return 'All missions done — free roam. Taxi fares and respray still pay.';
  }

  function startMissionKey() {
    const m = mission();
    if (!m) return;
    if (active) { world.showMessage('Mission already running — follow the yellow marker.', 2); return; }
    start();
    if (m.id === 1) world.addWanted(1, 'The package was hot — cops on you!');
    if (m.id === 2) world.addWanted(2, 'Cops are on you — run!');
  }

  // Spawn the Comet GT at the casino for mission 2
  function ensureCometGT() {
    const m = mission();
    if (m && m.id === 2 && state.missionIndex === 1) {
      // Check if Comet GT already exists
      const hasComet = state.cars.some(c => c.kind === 'sport' && c.color === '#ffd23d' && c.x === places.casino.x && c.y === places.casino.y);
      if (!hasComet) {
        const comet = world.makeCar(rng, places.casino.x, places.casino.y, 0, COMET_GT);
        comet.parked = true;
        state.cars.push(comet);
      }
    }
  }

  return {
    get active() { return active; },
    get waypoint() { return waypoint; },
    get mission() { return mission(); },
    get raceTimer() { return raceTimer; },
    start, update, objectiveText, startMissionKey, ensureCometGT,
  };
}
