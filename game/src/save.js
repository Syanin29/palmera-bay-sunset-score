// Save/load: cash, mission progress, earnings, position in localStorage.
import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  try {
    const { state, player } = world;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      totalEarned: state.totalEarned,
      health: player.health,
      armor: player.armor,
      ammo: player.ammo,
      x: player.x, y: player.y,
      timeOfDay: state.timeOfDay,
    }));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function applySave(world, data) {
  if (!data) return false;
  const { state, player } = world;
  player.cash = data.cash ?? 40;
  state.missionIndex = data.missionIndex ?? 0;
  state.missionsDone = data.missionsDone ?? 0;
  state.totalEarned = data.totalEarned ?? 0;
  player.health = data.health ?? 100;
  player.armor = data.armor ?? 0;
  player.ammo = data.ammo ?? 24;
  player.x = data.x ?? 745;
  player.y = data.y ?? 800;
  state.timeOfDay = data.timeOfDay ?? 10.5;
  return true;
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
