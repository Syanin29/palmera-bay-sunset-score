// Staged screenshot scenes: ?shot=chase|drive|foot|start&seed=N
// Each scene sets a fixed state, runs simulation forward, paints, sets window.__shotReady.
import { STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';

function placeChase(world, missions, wanted, timeOfDay) {
  const { state, player, city } = world;
  player.x = 1605; player.y = 1175; player.angle = 0;
  const sport = world.makeCar(world.rng, 1605, 1175, 0, { name: 'sport', color: '#e8483f', top: 420, accel: 330 });
  sport.isPlayer = true; sport.speed = 260;
  player.inCar = sport;
  state.cars.push(sport);
  state.wanted = wanted;
  state.heat = 100;
  state.timeOfDay = timeOfDay;
  missions.start();
  for (let i = 0; i < 2; i++) {
    const c = world.makeCar(world.rng, 1605 - 180 - i * 90, 1175 + (i === 0 ? 30 : -40), 0,
      { name: 'police', color: '#222831', top: 380, accel: 320 });
    c.isPolice = true; c.speed = 250;
    state.cars.push(c);
  }
  const spots = [
    [1750, 1175, 'sedan', '#4f7ec9'], [1950, 1197, 'taxi', '#f2c230'], [1500, 1153, 'van', '#8a8f96'],
    [1605, 1000, 'sedan', '#e8e8e8'], [1380, 1175, 'coupe', '#9b59b6'],
  ];
  for (const [x, y, kind, color] of spots) {
    const c = world.makeCar(world.rng, x, y, x === 1605 ? Math.PI / 2 : 0,
      { name: kind, color, top: 300, accel: 240 });
    c.traffic = true; c.axis = x === 1605 ? 'v' : 'h'; c.road = x === 1605 ? 1605 : 1175; c.lane = 22;
    c.speed = 90; c.parked = false;
    state.cars.push(c);
  }
  for (let i = 0; i < 8; i++) {
    const p = state.peds[i];
    if (p) { p.x = 1500 + i * 40; p.y = 1090 + (i % 2) * 160; p.flee = 1.2; p.fleeX = 1605; p.fleeY = 1175; }
  }
  const parked = world.makeCar(world.rng, 1400, 1480, 0.3, { name: 'sedan', color: '#2fbf9b', top: 300, accel: 240 });
  parked.parked = true;
  state.cars.push(parked);
  for (let i = 0; i < 3; i++) {
    const p = state.peds[8 + i];
    if (p) { p.x = 1500 + i * 130; p.y = 1420 + (i % 2) * 60; }
  }
}

function placeDrive(world) {
  const { state, player, city } = world;
  player.x = 745; player.y = 2470; player.angle = 0;
  const car = world.makeCar(world.rng, 745, 2470, 0, { name: 'sport', color: '#2fbf9b', top: 410, accel: 320 });
  car.isPlayer = true; car.speed = 380;
  player.inCar = car;
  state.cars.push(car);
  state.timeOfDay = 16.0;
  state.wanted = 0;
  for (let i = 0; i < 4; i++) {
    const c = world.makeCar(world.rng, 745 + 200 + i * 150, 2470, 0,
      { name: 'sedan', color: '#e8e8e8', top: 300, accel: 240 });
    c.traffic = true; c.axis = 'v'; c.road = 745; c.lane = i % 2 === 0 ? 22 : -22;
    c.speed = 100; c.parked = false;
    state.cars.push(c);
  }
}

function placeFoot(world, missions) {
  const { state, player, city } = world;
  player.x = 2035; player.y = 745; player.angle = 0;
  player.ammo = 18; player.health = 86;
  state.wanted = 1; state.heat = 100;
  state.timeOfDay = 11.0;
  missions.start();
  for (let i = 0; i < 2; i++) {
    state.cops.push({ x: 2180 + i * 70, y: 690 + i * 90, angle: Math.PI, speed: 0, health: 40, shootCooldown: 1, rival: true });
  }
  const pc = world.makeCar(world.rng, 1750, 745, 0, { name: 'police', color: '#222831', top: 380, accel: 320 });
  pc.isPolice = true; pc.speed = 120;
  state.cars.push(pc);
  for (let i = 0; i < 6; i++) {
    const p = state.peds[i];
    if (p) { p.x = 2050 + i * 45; p.y = 820 + (i % 2) * 60; p.flee = 2; p.fleeX = 2035; p.fleeY = 745; }
  }
  const car = world.makeCar(world.rng, 2100, 800, 0.4, { name: 'sedan', color: '#c94f4f', top: 300, accel: 240 });
  car.parked = true;
  state.cars.push(car);
}

export function stageShot(name, world, missions, police, peds, traffic) {
  const { state, player, city } = world;
  world.reset();
  if (name === 'chase') {
    placeChase(world, missions, 2, 15.5);
  } else if (name === 'drive') {
    placeDrive(world);
  } else if (name === 'foot') {
    placeFoot(world, missions);
  } else if (name === 'start') {
    return { screen: 'title' };
  } else {
    return { screen: 'title' };
  }
  // Run simulation forward so everything is mid-motion
  const steps = name === 'chase' ? 50 : 40;
  for (let i = 0; i < steps; i++) {
    traffic.step(STEP);
    peds.step(STEP);
    police.step(STEP);
    missions.update(STEP);
    world.stepTime(STEP);
    world.stepParticles(STEP);
    if (player.inCar) world.stepDriving(STEP, { held: { up: true, down: false, left: false, right: false, run: false, brake: false } });
    else world.stepPlayer(STEP, { held: { up: false, down: false, left: false, right: false, run: false, brake: false } }, { x: player.x + 100, y: player.y });
    // CRITICAL: updateCamera every staging step so camera follows player
    // (handled by renderer.draw which computes camera from player position)
  }
  return { screen: SCREEN_PLAY };
}
