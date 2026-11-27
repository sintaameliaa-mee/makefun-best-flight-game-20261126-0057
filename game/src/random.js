// random.js — small deterministic noise: a seeded RNG and 2D value noise.
// The world is generated from these alone, so every flight sees the same
// mountains, lake and runway, and screenshots are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a lattice point to [0, 1). Deterministic, no tables to ship.
function hash2(ix, iz, seed) {
  const s = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Value noise in [-1, 1] at (x, z), wavelength `cell` metres.
export function valueNoise(x, z, cell, seed) {
  const gx = x / cell;
  const gz = z / cell;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = smooth(gx - ix);
  const fz = smooth(gz - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return (top + (bottom - top) * fz) * 2 - 1;
}

// Fractal brownian motion: a few octaves of value noise.
export function fbm(x, z, cell, octaves, seed) {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let c = cell;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x, z, c, seed + o * 13) * amp;
    total += amp;
    amp *= 0.5;
    c *= 0.5;
  }
  return sum / total;
}

// Ridged noise in [0, 1]: sharp crests, good for mountain ranges.
export function ridged(x, z, cell, seed) {
  const n = fbm(x, z, cell, 3, seed);
  return 1 - Math.abs(n);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smoothstep between edges, 0 below `lo`, 1 above `hi`.
export function smoothstep(lo, hi, v) {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
}

// Angle helpers for headings, which wrap at 2*PI.
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(a, b) {
  return wrapAngle(a - b);
}
