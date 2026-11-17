// Game bootstrap + main loop. Screens: title, play, paused, wasted, busted.
// ?shot=chase|drive|foot|start&seed=N stages screenshot, sets window.__shotReady.
import { createRandom, clamp, dist2, angleTo } from './random.js';
import { createCity } from './city.js';
import { createWorld, EVENT_WASTED, EVENT_BUSTED } from './world.js';
import { STEP } from './config.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_PUNCH, ACTION_MISSION, ACTION_MUTE, ACTION_SHOOT } from './input.js';
import { createTraffic } from './vehicles.js';
import { createPedestrians } from './people.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_BUSTED } from './render.js';
import { AudioEngine } from './audio.js';
import { stageShot } from './shots.js';
import { saveGame, loadGame, applySave, hasSave } from './save.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 20;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const city = createCity(rng);
const world = createWorld(rng, city);
const traffic = createTraffic(world);
const peds = createPedestrians(world);
const police = createPolice(world);
const combat = createCombat(world, peds);
const missions = createMissions(world, police);
const hud = createHud();
const renderer = createRenderer(canvas, hud);
const audio = new AudioEngine();

const { state, player } = world;

function announce(message) { status.textContent = message; }

function nearestCar(maxDist) {
  let best = null, bestD = maxDist * maxDist;
  for (const car of state.cars) {
    if (car.isPolice) continue;
    const d = dist2(player.x, player.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function runShot(name) {
  const scene = stageShot(name, world, missions, police, peds, traffic);
  let painted = 0;
  function paint() {
    renderer.draw(state, city, missions, scene.screen, 0, state.elapsed + 2);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let autosaveTimer = AUTOSAVE_SECONDS;
  let accumulator = 0;
  let last = performance.now();
  let t = 0;

  function startGame(fresh) {
    if (fresh) {
      world.reset();
      missions.mission; // keep index 0
    } else {
      const data = loadGame();
      if (data) applySave(world, data);
    }
    screen = SCREEN_PLAY;
    audio.ensure();
    announce('Playing Palmera Bay. Press M for your first mission.');
  }

  function endGame(kind) {
    screen = kind === 'busted' ? SCREEN_BUSTED : SCREEN_OVER;
    audio.busted();
    if (player.inCar) { player.inCar.isPlayer = false; player.inCar = null; }
    player.health = 100;
    player.armor = 0;
    saveGame(world);
    announce(kind === 'busted' ? 'Busted by the police.' : 'Wasted.');
  }

  function aimWorld() {
    const m = input.mouse();
    const rect = canvas.getBoundingClientRect();
    const sx = (m.x / rect.width) * 1280;
    const sy = (m.y / rect.height) * 720;
    const speed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;
    const zoom = clamp(1.05 - speed / 1400, 0.78, 1.05);
    const camX = clamp(player.x - 1280 / 2 / zoom, 0, 3400 - 1280 / zoom);
    const camY = clamp(player.y - 720 / 2 / zoom, 0, 3000 - 720 / zoom);
    return { x: camX + sx / zoom, y: camY + sy / zoom };
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      world.showMessage(muted ? 'Sound off (N to turn back on)' : 'Sound on', 2);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(!hasSave());
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        player.health = 100;
        player.x = city.places.safehouse.x;
        player.y = city.places.safehouse.y + 60;
        police.clearWanted();
        screen = SCREEN_PLAY;
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = screen === SCREEN_PAUSED ? SCREEN_PLAY : SCREEN_PAUSED;
      announce(screen === SCREEN_PAUSED ? 'Paused.' : 'Playing.');
      if (screen === SCREEN_PAUSED) saveGame(world);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER_CAR) {
      const msg = world.enterOrExitCar(state, rng, audio, city);
      if (msg) announce(msg);
    }
    if (actions & ACTION_PUNCH) {
      combat.punch();
      audio.punch();
    }
    if (actions & ACTION_MISSION) {
      missions.ensureCometGT();
      missions.startMissionKey();
    }
    if ((actions & ACTION_SHOOT) || input.mouse().down) {
      if (!player.inCar) {
        const r = combat.shoot();
        if (r) audio.gunshot();
      }
    }
  }

  function step() {
    t += STEP;
    if (screen === SCREEN_TITLE) {
      traffic.step(STEP);
      peds.step(STEP);
      world.stepTime(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const aim = aimWorld();
    if (player.inCar) world.stepDriving(STEP, input);
    else world.stepPlayer(STEP, input, aim);
    traffic.step(STEP);
    peds.step(STEP);
    const busted = police.step(STEP);
    combat.update(STEP);
    world.stepBullets(STEP, combat);
    world.stepParticles(STEP);
    world.stepPickups(STEP);
    world.stepTime(STEP);
    const missionEvent = missions.update(STEP);
    if (missionEvent === 'complete') {
      audio.cash();
      saveGame(world);
    }
    // Car wrecked under player
    if (player.inCar && player.inCar.health <= 0) {
      world.addParticles(player.inCar.x, player.inCar.y, '#ff8833', 20, 240);
      renderer.addShake(10);
      player.inCar.isPlayer = false;
      player.inCar.wrecked = true;
      player.inCar = null;
      world.damagePlayer(20);
      audio.crash();
    }
    if (player.inCar && Math.abs(player.inCar.speed) > 240) renderer.addShake(1);
    audio.setEngine(player.inCar ? player.inCar.speed * 0.55 : 0, !!player.inCar);
    audio.setSiren(state.wanted > 0);
    autosaveTimer -= STEP;
    if (autosaveTimer <= 0) { autosaveTimer = AUTOSAVE_SECONDS; saveGame(world); }
    if (busted === 'busted') endGame('busted');
    // Health regen must NOT revive a wasted player: check 'wasted' BEFORE regen
    else if (player.health <= 0) endGame('wasted');
    else if (player.health < 100) {
      player.health = Math.min(100, player.health + STEP * 8);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(state, city, missions, screen, 0, t);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(world);
      announce('Paused.');
    }
  });

  canvas.addEventListener('pointerdown', () => audio.ensure());
  // Read-only handle for playtesting
  window.__game = { world, missions, police, city, player: state.player };
  announce('Palmera Bay: Sunset Score. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
