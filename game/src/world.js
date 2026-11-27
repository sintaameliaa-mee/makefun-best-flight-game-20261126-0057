// world.js — missions, target rings, clouds and airfield buildings.
// Missions are data: a name, a palette, a ring course, fuel and a time limit.
import { mulberry32 } from './random.js';
import { PALETTES } from './config.js';

function ring(x, y, z, faceHeading) {
  return { x, y, z, face: faceHeading, passed: false, missed: false };
}

// Ring courses are hand-placed over the island: each next ring is visible
// from the previous one, so the pilot always knows where to fly.
export const MISSIONS = [
  {
    id: 'lembah',
    title: 'Lembah Hijau',
    subtitle: 'Pagi tenang di atas lembah hijau',
    palette: PALETTES.valley,
    timeLimit: 300,
    fuel: 100,
    wind: 0,
    cloudBase: 520,
    cloudCount: 30,
    start: { x: 0, y: 60, z: 350, heading: 0, speed: 0 },
    rings: [
      ring(0, 110, -200, 0),
      ring(-260, 190, -450, 0.35),
      ring(240, 220, -800, -0.3),
      ring(-180, 200, -1150, 0.25),
      ring(60, 160, -1500, 0),
    ],
    briefing:
      'Lepas landas dari runway 27, terbang melewati 5 cincin emas, lalu mendarat kembali di runway yang sama.',
  },
  {
    id: 'senja',
    title: 'Senja Pegunungan',
    subtitle: 'Senja menembus pegunungan',
    palette: PALETTES.dusk,
    timeLimit: 360,
    fuel: 100,
    wind: 2.5,
    cloudBase: 620,
    cloudCount: 26,
    start: { x: 0, y: 60, z: 350, heading: 0, speed: 0 },
    rings: [
      ring(0, 220, 100, 0),
      ring(420, 300, -450, -0.5),
      ring(-350, 380, -900, 0.55),
      ring(650, 430, -1400, -0.45),
      ring(-650, 400, -1750, 0.6),
      ring(200, 330, -2100, -0.2),
      ring(0, 350, -2100, 0),
    ],
    briefing:
      'Cincin-cincin senja menanjak ke pegunungan. Jaga kecepatan di tikungan tajam dan awasi bahan bakar.',
  },
  {
    id: 'badai',
    title: 'Danau Badai',
    subtitle: 'Angin kencang di atas Danau Biru',
    palette: PALETTES.storm,
    timeLimit: 420,
    fuel: 100,
    wind: 7,
    cloudBase: 300,
    cloudCount: 42,
    start: { x: 0, y: 60, z: 350, heading: 0, speed: 0 },
    rings: [
      ring(0, 180, 100, 0),
      ring(500, 200, -300, -0.7),
      ring(950, 170, -750, -0.35),
      ring(1250, 150, -1150, 0.1),
      ring(900, 190, -1500, 0.5),
      ring(350, 220, -1350, 0.9),
      ring(-250, 260, -1000, 0.7),
      ring(-600, 230, -600, 0.4),
      ring(0, 190, -300, 0),
    ],
    briefing:
      'Sembilan cincin melingkari Danau Biru. Angin badai mendorong pesawatmu — koreksi terus dengan kemudi.',
  },
];

// Clouds: seeded positions spread over the island, drifting slowly.
export function makeClouds(mission, seed) {
  const rng = mulberry32(seed);
  const clouds = [];
  for (let i = 0; i < mission.cloudCount; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 400 + rng() * 2400;
    clouds.push({
      x: Math.cos(angle) * radius,
      y: mission.cloudBase + rng() * 220,
      z: Math.sin(angle) * radius - 600,
      s: 90 + rng() * 170, // size in metres
      drift: 2 + rng() * 5,
      puffs: 4 + Math.floor(rng() * 3),
      seed: rng() * 100,
    });
  }
  return clouds;
}

// Airfield buildings beside the runway: hangars and a control tower.
// Drawn as simple flat-shaded boxes, so they read at any distance.
export const BUILDINGS = [
  { x: 55, z: 120, w: 34, d: 26, h: 12, colour: '#b8b0a4', roof: '#7d7468' },
  { x: 58, z: 175, w: 28, d: 22, h: 10, colour: '#a8a89c', roof: '#6f6a5e' },
  { x: -58, z: 90, w: 30, d: 24, h: 11, colour: '#c0b8ac', roof: '#857c6e' },
  { x: -62, z: 240, w: 16, d: 16, h: 30, colour: '#d8d2c6', roof: '#5a6a7a' }, // tower
];
