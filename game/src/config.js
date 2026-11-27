// config.js — tuning constants and mission palettes for Sayap Nusantara.
// Everything the game needs to know about feel, limits and look lives here.
export const CONFIG = {
  // Physics (arcade, forgiving — fun first, punishment second).
  minSpeed: 26, // m/s — below this the wing stops flying
  maxSpeed: 118, // m/s at full throttle, level flight
  cruiseSpeed: 62,
  throttleAccel: 0.55, // how fast speed chases its throttle target
  climbBleed: 0.55, // speed lost per second while climbing hard
  diveGain: 0.45, // speed gained per second while diving
  pitchRate: 0.85, // rad/s of pitch authority
  rollRate: 1.9, // rad/s of roll authority
  maxPitch: 0.62, // rad (~35 deg)
  maxRoll: 1.15, // rad (~66 deg)
  turnFactor: 0.62, // heading change per rad of bank, scaled by speed
  fuelCapacity: 100,
  fuelBurnBase: 0.10, // units per second
  fuelBurnThrottle: 0.30, // extra units per second at full throttle
  cameraDistance: 15, // metres behind the aircraft
  cameraHeight: 4.2, // metres above the aircraft
  fovDegrees: 68,
  nearPlane: 0.5,
  terrainCell: 60, // metres per terrain grid cell
  terrainHalf: 22, // cells in each direction from the camera
  fogDistance: 2600, // metres — terrain fully fogged beyond this
  stallSpeed: 30, // m/s — controls go soft below this
  landingMaxSpeed: 58, // m/s — faster than this on touchdown is a crash
  landingMaxSink: 5.5, // m/s of vertical speed allowed on touchdown
  ringRadius: 26, // metres
  ringScore: 100,
  ringCentreBonus: 50,
  landingScore: 500,
};

// One palette per mission: sky, fog, terrain tints and light.
export const PALETTES = {
  valley: {
    name: 'Lembah Hijau',
    skyTop: '#2f6fc4',
    skyMid: '#7fb8e8',
    horizon: '#cfe9f5',
    fog: '#cfe0ea',
    sun: '#fff3c4',
    sunX: 0.78,
    sunY: 0.2,
    low: '#3f7a34', // lowland green
    mid: '#5d8a3c', // hills
    high: '#8a6a42', // high ground
    peak: '#e9edf0', // snow
    water: '#2e6f9e',
    waterDeep: '#1d4e74',
    cloud: 'rgba(255,255,255,0.92)',
    cloudShadow: 'rgba(210,225,235,0.85)',
  },
  dusk: {
    name: 'Senja Pegunungan',
    skyTop: '#2c3566',
    skyMid: '#c65f3f',
    horizon: '#f7b267',
    fog: '#e8a06a',
    sun: '#ffd9a0',
    sunX: 0.22,
    sunY: 0.3,
    low: '#6d5a33',
    mid: '#7a5a38',
    high: '#5e4630',
    peak: '#d8c9b8',
    water: '#7a4a5a',
    waterDeep: '#54303e',
    cloud: 'rgba(255,214,170,0.92)',
    cloudShadow: 'rgba(190,120,90,0.85)',
  },
  storm: {
    name: 'Danau Badai',
    skyTop: '#3c4a58',
    skyMid: '#6d7f8e',
    horizon: '#a8b6bf',
    fog: '#9fb0ba',
    sun: '#e8eef2',
    sunX: 0.5,
    sunY: 0.12,
    low: '#3d5c40',
    mid: '#4d6a45',
    high: '#5c5340',
    peak: '#cfd6da',
    water: '#274b63',
    waterDeep: '#16303f',
    cloud: 'rgba(228,234,238,0.95)',
    cloudShadow: 'rgba(140,152,162,0.9)',
  },
};

// Keyboard + mouse bindings, shown on the menu and the help line.
export const CONTROLS = [
  ['W / Panah Atas', 'Naik (tarik kemudi)'],
  ['S / Panah Bawah', 'Turun (dorong kemudi)'],
  ['A D / Panah Kiri Kanan', 'Belok (miringkan sayap)'],
  ['Shift / +', 'Gas tambah'],
  ['Ctrl / -', 'Gas kurang'],
  ['Mouse', 'Gerakkan untuk kemudi, roda = gas'],
  ['G', 'Roda pendarat turun / naik'],
  ['P', 'Jeda'],
  ['R', 'Ulangi misi'],
  ['M', 'Kembali ke menu'],
];
