// Palmera Bay: tuning constants and shared values. Single source of truth.
export const WORLD_W = 3400;
export const WORLD_H = 3000;
export const ROAD_W = 92;
export const STEP = 1 / 60;
export const SAVE_KEY = 'palmera-bay.save.v1';

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const CAR_KINDS = [
  { name: 'sedan', color: '#c94f4f', top: 300, accel: 240 },
  { name: 'sedan', color: '#4f7ec9', top: 300, accel: 240 },
  { name: 'taxi', color: '#f2c230', top: 290, accel: 230 },
  { name: 'sport', color: '#e8483f', top: 420, accel: 330 },
  { name: 'sport', color: '#2fbf9b', top: 410, accel: 320 },
  { name: 'van', color: '#8a8f96', top: 240, accel: 180 },
  { name: 'truck', color: '#b5651d', top: 220, accel: 160 },
  { name: 'sedan', color: '#e8e8e8', top: 300, accel: 240 },
  { name: 'sedan', color: '#3a3f4a', top: 300, accel: 240 },
  { name: 'coupe', color: '#9b59b6', top: 360, accel: 290 },
];

export const POLICE_CAR = { name: 'police', color: '#222831', top: 380, accel: 320 };
export const COMET_GT = { name: 'sport', color: '#ffd23d', top: 440, accel: 350 };

export const MISSIONS = [
  { id: 1, name: 'The Sunset Score', reward: 1200,
    intro: 'Mara: pick up the package at the pier, bring it to the motel. Cops will notice.' },
  { id: 2, name: 'Hot Wheels', reward: 1800,
    intro: 'Mara: steal the Comet GT from Coral Casino. Fast car, hot pursuit.' },
  { id: 3, name: 'Payday Run', reward: 2500,
    intro: 'Mara: three drops across the bay. No mistakes.' },
];

export const PALETTES = {
  'Sunset Marina': ['#e8b04b', '#d98a3d', '#c96f4a', '#7fb069'],
  'Old Harbor': ['#b5654a', '#a05a44', '#8f6b4f', '#c98a5a'],
  'Coral Heights': ['#5a7d9a', '#4a6b8a', '#6b8fa8', '#7a9ab0'],
  'Palm Row': ['#e8c96b', '#d9a04b', '#c98a6b', '#8fb069'],
  'North Docks': ['#6b7a8a', '#5a6b7a', '#8a6b4a', '#7a8a6b'],
};

export const DISTRICTS = [
  { name: 'Sunset Marina', x0: 0, y0: 0, x1: 1700, y1: 1000 },
  { name: 'Old Harbor', x0: 1700, y0: 0, x1: 3400, y1: 1000 },
  { name: 'Coral Heights', x0: 0, y0: 1000, x1: 1700, y1: 2000 },
  { name: 'Palm Row', x0: 1700, y0: 1000, x1: 3400, y1: 2000 },
  { name: 'North Docks', x0: 0, y0: 2000, x1: 3400, y1: 3000 },
];

export const BEACH = { x0: 0, x1: 150, waterX1: 70 };
export const ROAD_COORDS = [320, 745, 1175, 1605, 2035, 2470, 2890];
