// terrain.js — the island of Nusaria: one heightmap, one runway, one lake.
// Height is a pure function of (x, z), so the physics, the renderer and the
// screenshot states all agree on where the ground is.
import { fbm, ridged, clamp, lerp, smoothstep } from './random.js';

// Runway 27/09: a flat asphalt strip along Z at the origin, 800 m long.
export const RUNWAY = {
  x: 0,
  zMin: -400,
  zMax: 400,
  halfWidth: 16,
  heading: 0, // runway points north (-Z); landing heading 0
};

// Danau Biru: a lake north-east of the field, low enough to hold water.
export const LAKE = { x: 1150, z: -950, radius: 720 };

const SEED = 20261126;

// Distance from a point to the runway rectangle (0 inside it).
function runwayDistance(x, z) {
  const dx = Math.max(Math.abs(x - RUNWAY.x) - RUNWAY.halfWidth, 0);
  const dz = Math.max(Math.max(RUNWAY.zMin - z, z - RUNWAY.zMax), 0);
  return Math.hypot(dx, dz);
}

export function terrainHeight(x, z) {
  // Rolling hills, then a mountain range that grows with distance.
  const distOrigin = Math.hypot(x, z);
  const hills = fbm(x, z, 340, 3, SEED) * 55;
  const mountainMask = smoothstep(1100, 2600, distOrigin);
  const mountains = ridged(x, z, 900, SEED + 7) * 300 * mountainMask;
  let h = 18 + hills + mountains;

  // A gentle valley around the airfield so the runway area stays flyable.
  const valley = 0.3 + 0.7 * smoothstep(500, 1800, distOrigin);
  h *= valley;

  // Carve the lake: ground sinks below the water line near its centre.
  const lakeDist = Math.hypot(x - LAKE.x, z - LAKE.z);
  const lakeBlend = smoothstep(LAKE.radius, LAKE.radius * 0.45, lakeDist);
  h = lerp(h, -9, lakeBlend);

  // Flatten the runway strip to exactly sea level.
  const runwayBlend = smoothstep(0, 90, runwayDistance(x, z));
  h = lerp(0, h, runwayBlend);

  return h;
}

export function isWater(x, z) {
  return terrainHeight(x, z) < 0.5;
}

export function onRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.halfWidth &&
    z >= RUNWAY.zMin &&
    z <= RUNWAY.zMax
  );
}

// Slope estimate, used to shade hillsides darker on the shadow side.
export function terrainSlope(x, z) {
  const e = 12;
  const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return { dx: dx / (2 * e), dz: dz / (2 * e) };
}

// --- Colour helpers -------------------------------------------------------

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgbCss(c, alpha = 1) {
  return alpha >= 1
    ? `rgb(${c[0]},${c[1]},${c[2]})`
    : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

// Colour of one terrain sample: height bands, slope shading, water, fog.
export function terrainColour(x, z, h, palette, distance, fogDistance) {
  const low = hexToRgb(palette.low);
  const mid = hexToRgb(palette.mid);
  const high = hexToRgb(palette.high);
  const peak = hexToRgb(palette.peak);
  const water = hexToRgb(palette.water);
  const fog = hexToRgb(palette.fog);

  let base;
  if (h < -1) {
    base = water; // the lake sits below sea level; flat airfield ground is grass
  } else if (h < 55) {
    base = mixRgb(low, mid, h / 55);
  } else if (h < 150) {
    base = mixRgb(mid, high, (h - 55) / 95);
  } else {
    base = mixRgb(high, peak, clamp((h - 150) / 110, 0, 1));
  }

  // Slope shading: faces tilted away from the sun go darker.
  const slope = terrainSlope(x, z);
  const shade = clamp(1 - (slope.dx * 0.7 + slope.dz * 0.4) * 2.2, 0.72, 1.12);
  base = [base[0] * shade, base[1] * shade, base[2] * shade].map((v) =>
    clamp(Math.round(v), 0, 255),
  );

  // Distance fog: far ground melts into the horizon colour.
  const fogT = clamp(Math.pow(distance / fogDistance, 1.4), 0, 0.82);
  const fogged = mixRgb(base, fog, fogT);
  return rgbCss(fogged);
}

// Patch of trees on a cell: deterministic, so the forest never moves.
export function hasTrees(x, z) {
  const h = terrainHeight(x, z);
  if (h < 4 || h > 90) return false;
  if (onRunway(x, z)) return false;
  const lakeDist = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (lakeDist < LAKE.radius * 0.9) return false;
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s) < 0.055;
}
