// render.js — the 3D view, drawn with plain Canvas 2D.
// A tiny software projector (yaw, pitch, roll, perspective) turns world
// points into screen points; the terrain grid, runway, rings, clouds and
// the aircraft are all painted from that one projection.
import { CONFIG } from './config.js';
import { terrainHeight, terrainColour, terrainSlope, hasTrees, onRunway, RUNWAY } from './terrain.js';
import { BUILDINGS } from './world.js';
import { clamp, lerp } from './random.js';

const TAU = Math.PI * 2;

// --- Camera ---------------------------------------------------------------

export function makeCamera() {
  return { heading: 0, pitch: 0, roll: 0, x: 0, y: 60, z: 620 };
}

// Chase camera: settles behind the aircraft, smoothing its motion so the
// view never snaps when the pilot banks hard.
export function updateChaseCamera(cam, plane, dt) {
  const targetHeading = plane.heading;
  let dh = targetHeading - cam.heading;
  while (dh > Math.PI) dh -= TAU;
  while (dh < -Math.PI) dh += TAU;
  cam.heading += dh * Math.min(1, 3.2 * dt);
  cam.pitch += (plane.pitch * 0.85 - cam.pitch) * Math.min(1, 4 * dt);
  cam.roll += (plane.roll - cam.roll) * Math.min(1, 4 * dt);

  const fx = Math.sin(cam.heading) * Math.cos(cam.pitch);
  const fy = Math.sin(cam.pitch);
  const fz = -Math.cos(cam.heading) * Math.cos(cam.pitch);
  cam.x = plane.x - fx * CONFIG.cameraDistance;
  cam.y = plane.y - fy * CONFIG.cameraDistance + CONFIG.cameraHeight;
  cam.z = plane.z - fz * CONFIG.cameraDistance;
}

// --- Projection -----------------------------------------------------------

export function makeView(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  return {
    w,
    h,
    cx: w / 2,
    cy: h / 2,
    focal: (h / 2) / Math.tan((CONFIG.fovDegrees * Math.PI) / 360),
  };
}

// World point -> screen point. Returns null when behind the camera.
export function project(view, cam, x, y, z) {
  let vx = x - cam.x;
  let vy = y - cam.y;
  let vz = z - cam.z;
  // Yaw: turn the world so the camera looks down -Z.
  const ch = Math.cos(cam.heading);
  const sh = Math.sin(cam.heading);
  const x1 = vx * ch + vz * sh;
  const z1 = -vx * sh + vz * ch;
  const y1 = vy;
  // Pitch: nose-up rotates -Z toward +Y.
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;
  const x2 = x1;
  // Roll: rotate around the view axis.
  const cr = Math.cos(cam.roll);
  const sr = Math.sin(cam.roll);
  const x3 = x2 * cr - y2 * sr;
  const y3 = x2 * sr + y2 * cr;
  const z3 = z2;
  const depth = -z3;
  if (depth < CONFIG.nearPlane) return null;
  return {
    x: view.cx + (x3 / depth) * view.focal,
    y: view.cy - (y3 / depth) * view.focal,
    depth,
    scale: view.focal / depth,
  };
}

function projectClamped(view, cam, x, y, z) {
  const p = project(view, cam, x, y, z);
  if (p) return p;
  // Points just behind the near plane: pull them onto it so the ground
  // never leaves a hole at the bottom of the screen.
  let vx = x - cam.x;
  let vy = y - cam.y;
  let vz = z - cam.z;
  const ch = Math.cos(cam.heading);
  const sh = Math.sin(cam.heading);
  const x1 = vx * ch + vz * sh;
  const z1 = -vx * sh + vz * ch;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const y2 = vy * cp - z1 * sp;
  const z2 = vy * sp + z1 * cp;
  const cr = Math.cos(cam.roll);
  const sr = Math.sin(cam.roll);
  const x3 = x1 * cr - y2 * sr;
  const y3 = x1 * sr + y2 * cr;
  const depth = Math.max(1.2, -z2);
  return {
    x: view.cx + (x3 / depth) * view.focal,
    y: view.cy - (y3 / depth) * view.focal,
    depth,
    scale: view.focal / depth,
  };
}

// --- Sky ------------------------------------------------------------------

function drawSky(ctx, view, cam, palette, time) {
  // Horizon: far points at eye level (the camera's own altitude), left and
  // right of the view axis. Their screen line is the true horizon.
  const ahead = 3200;
  const fx = Math.sin(cam.heading);
  const fz = -Math.cos(cam.heading);
  const rx = Math.cos(cam.heading);
  const rz = Math.sin(cam.heading);
  const left = projectClamped(
    view, cam,
    cam.x + fx * ahead - rx * ahead * 0.9,
    cam.y,
    cam.z + fz * ahead - rz * ahead * 0.9,
  );
  const right = projectClamped(
    view, cam,
    cam.x + fx * ahead + rx * ahead * 0.9,
    cam.y,
    cam.z + fz * ahead + rz * ahead * 0.9,
  );
  const midX = (left.x + right.x) / 2;
  const midY = (left.y + right.y) / 2;
  // Gradient perpendicular to the horizon line.
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const g = ctx.createLinearGradient(
    midX - nx * view.h * 0.75, midY - ny * view.h * 0.75,
    midX + nx * 60, midY + ny * 60,
  );
  g.addColorStop(0, palette.skyTop);
  g.addColorStop(0.55, palette.skyMid);
  g.addColorStop(1, palette.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);

  // Sun: a soft disc with a glow, fixed in the world sky.
  const sunDir = { x: 0.55, y: 0.42, z: -0.72 };
  const sun = project(view, cam,
    cam.x + sunDir.x * 3800, cam.y + sunDir.y * 3800, cam.z + sunDir.z * 3800);
  if (sun && sun.x > -200 && sun.x < view.w + 200 && sun.y > -200 && sun.y < view.h + 200) {
    const r = view.h * 0.045;
    const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, r * 5);
    glow.addColorStop(0, palette.sun);
    glow.addColorStop(0.25, palette.sun + 'cc');
    glow.addColorStop(1, palette.sun + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, r * 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, r, 0, TAU);
    ctx.fill();
  }
}

// --- Terrain --------------------------------------------------------------

function drawTerrain(ctx, view, cam, palette) {
  const cell = CONFIG.terrainCell;
  const half = CONFIG.terrainHalf;
  const baseX = Math.round(cam.x / cell) * cell;
  const baseZ = Math.round(cam.z / cell) * cell;
  const fx = Math.sin(cam.heading);
  const fz = -Math.cos(cam.heading);

  // Rows far-to-near: painter's algorithm over the grid.
  const rows = [];
  for (let j = -half; j <= half; j++) rows.push(j);
  rows.sort((a, b) => {
    const da = (baseZ + a * cell - cam.z) * fz + (baseX - cam.x) * fx;
    const db = (baseZ + b * cell - cam.z) * fz + (baseX - cam.x) * fx;
    return db - da;
  });

  // Precompute heights and projections for the grid nodes.
  const n = half * 2 + 1;
  const heights = new Float32Array(n * n);
  const proj = new Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = baseX + (i - half) * cell;
      const z = baseZ + (j - half) * cell;
      const idx = j * n + i;
      heights[idx] = terrainHeight(x, z);
      // project(), not the clamped variant: a node behind the camera is
      // skipped, while clamping it onto the near plane would stretch its
      // quad across the whole screen and paint over the sky.
      proj[idx] = project(view, cam, x, heights[idx], z);
    }
  }

  for (const j of rows) {
    const jj = j + half;
    if (jj < 0 || jj >= n - 1) continue;
    for (let i = 0; i < n - 1; i++) {
      const a = proj[jj * n + i];
      const b = proj[jj * n + i + 1];
      const c = proj[(jj + 1) * n + i + 1];
      const d = proj[(jj + 1) * n + i];
      if (!a || !b || !c || !d) continue;
      const x = baseX + (i - half + 0.5) * cell;
      const z = baseZ + (jj - half + 0.5) * cell;
      const h = heights[jj * n + i];
      const dist = Math.hypot(x - cam.x, z - cam.z);
      const colour = terrainColour(x, z, h, palette, dist, CONFIG.fogDistance);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      // Stroke with the same colour: adjacent quads share an edge, and
      // without this the antialiasing leaves a hairline grid over the land.
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Trees: small dark triangles on grassy cells, drawn after the ground.
  for (let j = 0; j < n; j += 2) {
    for (let i = 0; i < n; i += 2) {
      const x = baseX + (i - half) * cell;
      const z = baseZ + (j - half) * cell;
      if (!hasTrees(x, z)) continue;
      const h = heights[j * n + i];
      const base = project(view, cam, x, h, z);
      if (!base) continue;
      const top = project(view, cam, x, h + 11, z);
      if (!top) continue;
      const wdt = Math.max(1.5, base.scale * 3.2);
      const dist = base.depth;
      const fogT = clamp(Math.pow(dist / CONFIG.fogDistance, 1.4), 0, 0.8);
      ctx.fillStyle = `rgba(${Math.round(34 + fogT * 160)},${Math.round(74 + fogT * 130)},${Math.round(38 + fogT * 120)},${1 - fogT * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(base.x - wdt, base.y);
      ctx.lineTo(base.x + wdt, base.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// --- Runway, buildings ----------------------------------------------------

function quad(ctx, p1, p2, p3, p4, fill) {
  if (!p1 || !p2 || !p3 || !p4) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.fill();
}

function drawRunway(ctx, view, cam) {
  const y = 0.6;
  const x0 = RUNWAY.x - RUNWAY.halfWidth;
  const x1 = RUNWAY.x + RUNWAY.halfWidth;
  const z0 = RUNWAY.zMin;
  const z1 = RUNWAY.zMax;
  // The slab in 100 m segments: the near end is often behind the camera,
  // and a single quad would vanish whole when any corner does.
  for (let z = z0; z < z1; z += 100) {
    const za = z;
    const zb = Math.min(z + 100, z1);
    quad(
      ctx,
      project(view, cam, x0, y, za), project(view, cam, x1, y, za),
      project(view, cam, x1, y, zb), project(view, cam, x0, y, zb),
      '#33363c',
    );
    quad(ctx,
      project(view, cam, x0 + 0.8, y + 0.1, za), project(view, cam, x0 + 2.2, y + 0.1, za),
      project(view, cam, x0 + 2.2, y + 0.1, zb), project(view, cam, x0 + 0.8, y + 0.1, zb),
      '#e8e8e0');
    quad(ctx,
      project(view, cam, x1 - 2.2, y + 0.1, za), project(view, cam, x1 - 0.8, y + 0.1, za),
      project(view, cam, x1 - 0.8, y + 0.1, zb), project(view, cam, x1 - 2.2, y + 0.1, zb),
      '#e8e8e0');
  }
  // Centreline dashes, one every 60 m.
  for (let z = z0 + 20; z < z1 - 10; z += 60) {
    quad(ctx,
      project(view, cam, -1.4, y + 0.1, z), project(view, cam, 1.4, y + 0.1, z),
      project(view, cam, 1.4, y + 0.1, z + 28), project(view, cam, -1.4, y + 0.1, z + 28),
      '#f2f2ea');
  }
  // Threshold bars at both ends.
  for (const zt of [z0 + 8, z1 - 8]) {
    for (let k = -2; k <= 2; k++) {
      quad(ctx,
        project(view, cam, k * 5.4 - 2, y + 0.1, zt - 6), project(view, cam, k * 5.4 + 2, y + 0.1, zt - 6),
        project(view, cam, k * 5.4 + 2, y + 0.1, zt + 6), project(view, cam, k * 5.4 - 2, y + 0.1, zt + 6),
        '#f2f2ea');
    }
  }
  // Runway numbers, painted flat on the asphalt.
  drawRunwayNumber(ctx, view, cam, '27', 0, z0 + 42, 0);
  drawRunwayNumber(ctx, view, cam, '09', 0, z1 - 42, Math.PI);
}

function drawRunwayNumber(ctx, view, cam, text, x, z, rot) {
  const p = project(view, cam, x, 1, z);
  if (!p) return;
  const p2 = project(view, cam, x, 1, z + (rot === 0 ? 18 : -18));
  if (!p2) return;
  const angle = Math.atan2(p2.y - p.y, p2.x - p.x) + (rot === 0 ? -Math.PI / 2 : Math.PI / 2);
  const size = Math.max(6, p.scale * 13);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.fillStyle = '#f2f2ea';
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawBuildings(ctx, view, cam) {
  // Far-to-near so nearer boxes overlap farther ones.
  const sorted = [...BUILDINGS].sort(
    (a, b) => Math.hypot(b.x - cam.x, b.z - cam.z) - Math.hypot(a.x - cam.x, a.z - cam.z),
  );
  for (const b of sorted) {
    const x0 = b.x - b.w / 2;
    const x1 = b.x + b.w / 2;
    const z0 = b.z - b.d / 2;
    const z1 = b.z + b.d / 2;
    const y0 = 0;
    const y1 = b.h;
    const corners = {
      a: project(view, cam, x0, y0, z0), b: project(view, cam, x1, y0, z0),
      c: project(view, cam, x1, y0, z1), d: project(view, cam, x0, y0, z1),
      e: project(view, cam, x0, y1, z0), f: project(view, cam, x1, y1, z0),
      g: project(view, cam, x1, y1, z1), h: project(view, cam, x0, y1, z1),
    };
    if (!corners.a || !corners.g) continue;
    const toCamX = cam.x - b.x;
    const toCamZ = cam.z - b.z;
    // Roof.
    quad(ctx, corners.e, corners.f, corners.g, corners.h, b.roof);
    // The two side faces that look at the camera.
    if (toCamZ < 0) quad(ctx, corners.a, corners.b, corners.f, corners.e, shade(b.colour, 0.82));
    else quad(ctx, corners.d, corners.c, corners.g, corners.h, shade(b.colour, 0.82));
    if (toCamX < 0) quad(ctx, corners.b, corners.c, corners.g, corners.f, shade(b.colour, 0.66));
    else quad(ctx, corners.a, corners.d, corners.h, corners.e, shade(b.colour, 0.66));
  }
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

// --- Clouds ---------------------------------------------------------------

function drawClouds(ctx, view, cam, clouds, palette, time) {
  const sorted = [...clouds].sort(
    (a, b) =>
      Math.hypot(b.x - cam.x, b.z - cam.z) - Math.hypot(a.x - cam.x, a.z - cam.z),
  );
  for (const c of sorted) {
    const driftX = ((time * c.drift) % 600) - 300;
    const p = project(view, cam, c.x + driftX, c.y, c.z);
    if (!p) continue;
    const size = p.scale * c.s;
    if (size < 4) continue;
    const fogT = clamp(p.depth / CONFIG.fogDistance, 0, 0.75);
    ctx.globalAlpha = (1 - fogT) * 0.9;
    for (let k = 0; k < c.puffs; k++) {
      const hash = Math.sin(c.seed + k * 17.3) * 43758.5453;
      const frac = hash - Math.floor(hash);
      const px = p.x + (frac - 0.5) * size * 1.15;
      const py = p.y + (Math.sin(c.seed + k * 9.1) * 0.5) * size * 0.32;
      const pr = size * (0.26 + frac * 0.14);
      ctx.fillStyle = k % 2 ? palette.cloudShadow : palette.cloud;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.55, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// --- Rings ----------------------------------------------------------------

function drawRings(ctx, view, cam, rings, nextIndex, time) {
  const pulse = 0.75 + Math.sin(time * 3) * 0.25;
  rings.forEach((ring, idx) => {
    if (ring.passed) return;
    const centre = project(view, cam, ring.x, ring.y, ring.z);
    if (!centre || centre.depth < 8) return;
    const isNext = idx === nextIndex;
    const nx = Math.sin(ring.face);
    const nz = -Math.cos(ring.face);
    // Ring plane basis: u across, v up-ish.
    let ux = -nz;
    let uz = nx;
    const ul = Math.hypot(ux, uz) || 1;
    ux /= ul;
    uz /= ul;
    const pts = [];
    const N = 28;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * TAU;
      const px = ring.x + ux * Math.cos(a) * CONFIG.ringRadius;
      const py = ring.y + Math.sin(a) * CONFIG.ringRadius;
      const pz = ring.z + uz * Math.cos(a) * CONFIG.ringRadius;
      const p = project(view, cam, px, py, pz);
      pts.push(p);
    }
    if (pts.some((p) => !p)) return;
    const width = Math.max(2, centre.scale * CONFIG.ringRadius * 0.14);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Glow pass, then the bright core.
    for (const [w, colour, alpha] of [
      [width * 3.2, isNext ? '#ffbf2e' : '#4dd8ff', 0.22 * pulse],
      [width, isNext ? '#ffd34d' : '#9feaff', 0.95],
    ]) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    // Faint disc so the ring reads as a gate, not a line.
    ctx.globalAlpha = isNext ? 0.1 : 0.05;
    ctx.fillStyle = isNext ? '#ffd34d' : '#4dd8ff';
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Distance label on the next ring.
    if (isNext) {
      ctx.font = `bold ${Math.max(11, Math.min(20, centre.scale * 2.2))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      const label = `${Math.round(centre.depth)} m`;
      ctx.strokeText(label, centre.x, centre.y - centre.scale * CONFIG.ringRadius - 10);
      ctx.fillText(label, centre.x, centre.y - centre.scale * CONFIG.ringRadius - 10);
    }
  });
}

// --- Aircraft sprite (chase view) -----------------------------------------

export function drawPlaneSprite(ctx, view, plane, time) {
  const px = view.cx;
  const py = view.cy + view.h * 0.17;
  const size = Math.min(view.w, view.h) * 0.46;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(plane.roll * 0.85);
  // Slight pitch cue: nose up lifts the sprite, nose down drops it.
  ctx.translate(0, -plane.pitch * size * 0.22);
  const s = size / 340;
  ctx.scale(s, s);

  // Engine glow first, behind the wings.
  const throttle = plane.throttle;
  for (const side of [-1, 1]) {
    const gx = side * 92;
    const gy = 34;
    const glowR = 26 + throttle * 26 + Math.sin(time * 31 + side) * 3;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, glowR);
    glow.addColorStop(0, `rgba(255,170,60,${0.5 + throttle * 0.4})`);
    glow.addColorStop(0.5, `rgba(255,120,30,${0.25 + throttle * 0.2})`);
    glow.addColorStop(1, 'rgba(255,110,20,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(gx, gy, glowR, 0, TAU);
    ctx.fill();
  }

  // Wings: swept, silver with a teal tip stripe.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#d7e0e8';
    ctx.strokeStyle = '#8ba0b2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(side * 18, -6);
    ctx.lineTo(side * 168, 26);
    ctx.lineTo(side * 168, 44);
    ctx.lineTo(side * 22, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0e7c86';
    ctx.beginPath();
    ctx.moveTo(side * 138, 20);
    ctx.lineTo(side * 168, 26);
    ctx.lineTo(side * 168, 44);
    ctx.lineTo(side * 138, 38);
    ctx.closePath();
    ctx.fill();
  }

  // Fuselage: nose far (narrow, top), tail near (wide, bottom).
  const fus = ctx.createLinearGradient(0, -120, 0, 70);
  fus.addColorStop(0, '#f7fafc');
  fus.addColorStop(0.6, '#dbe4ec');
  fus.addColorStop(1, '#aebfcc');
  ctx.fillStyle = fus;
  ctx.strokeStyle = '#7e93a6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -128);
  ctx.bezierCurveTo(20, -120, 26, -70, 26, -10);
  ctx.bezierCurveTo(26, 40, 20, 62, 0, 66);
  ctx.bezierCurveTo(-20, 62, -26, 40, -26, -10);
  ctx.bezierCurveTo(-26, -70, -20, -120, 0, -128);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Livery stripe down the fuselage.
  ctx.fillStyle = '#0e7c86';
  ctx.beginPath();
  ctx.moveTo(0, -126);
  ctx.bezierCurveTo(7, -110, 9, -60, 9, 0);
  ctx.lineTo(9, 40);
  ctx.lineTo(-9, 40);
  ctx.lineTo(-9, 0);
  ctx.bezierCurveTo(-9, -60, -7, -110, 0, -126);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f59e2c';
  ctx.fillRect(-9, 8, 18, 5);

  // Canopy glint near the nose.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(0, -92, 7, 16, 0, 0, TAU);
  ctx.fill();

  // Tailplane (near, bottom) and vertical fin.
  ctx.fillStyle = '#c4d0db';
  ctx.strokeStyle = '#8ba0b2';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 14, 44);
    ctx.lineTo(side * 78, 66);
    ctx.lineTo(side * 78, 76);
    ctx.lineTo(side * 16, 62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#0e7c86';
  ctx.beginPath();
  ctx.moveTo(0, 44);
  ctx.lineTo(16, 92);
  ctx.lineTo(8, 96);
  ctx.lineTo(-8, 96);
  ctx.lineTo(-16, 92);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f59e2c';
  ctx.beginPath();
  ctx.moveTo(0, 88);
  ctx.lineTo(9, 95);
  ctx.lineTo(-9, 95);
  ctx.closePath();
  ctx.fill();

  // Engine nacelles under the wings.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#8b9aa8';
    ctx.beginPath();
    ctx.ellipse(side * 92, 34, 13, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3c4a58';
    ctx.beginPath();
    ctx.ellipse(side * 92, 40, 9, 5, 0, 0, TAU);
    ctx.fill();
  }

  // Navigation lights: red port, green starboard, white strobe on the tail.
  ctx.fillStyle = '#ff2e2e';
  ctx.beginPath();
  ctx.arc(-168, 34, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2eff5e';
  ctx.beginPath();
  ctx.arc(168, 34, 4, 0, TAU);
  ctx.fill();
  if (Math.sin(time * 6) > 0.4) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 96, 4, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

// --- Whole scene ----------------------------------------------------------

export function drawScene(ctx, view, cam, scene) {
  drawSky(ctx, view, cam, scene.palette, scene.time);
  drawTerrain(ctx, view, cam, scene.palette);
  drawRunway(ctx, view, cam);
  drawBuildings(ctx, view, cam);
  drawClouds(ctx, view, cam, scene.clouds, scene.palette, scene.time);
  drawRings(ctx, view, cam, scene.rings, scene.nextRing, scene.time);
  if (scene.plane) drawPlaneSprite(ctx, view, scene.plane, scene.time);
}
