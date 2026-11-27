// main.js — Sayap Nusantara: bootstrap, game loop and state machine.
// States: menu -> flying -> (paused) -> landed / crashed / complete.
// The aircraft, the world and the renderer are separate modules; this file
// only wires them together and keeps the score.
import { CONFIG } from './config.js';
import { MISSIONS, makeClouds } from './world.js';
import { makePlane, stepPlane, bearingTo, distanceTo } from './plane.js';
import { terrainHeight } from './terrain.js';
import { makeInput, steering, consumePressed, clearPressed } from './input.js';
import { makeAudio } from './audio.js';
import { makeCamera, updateChaseCamera, makeView, drawScene } from './render.js';
import {
  drawCompass, drawFlightInstruments, drawAttitude, drawMissionPanel,
  drawWarnings, drawToast, drawHelpLine, drawMenu, drawEndScreen, drawPause,
} from './hud.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const input = makeInput(canvas);
const audio = makeAudio();
window.addEventListener('pointerdown', () => audio.unlock(), { once: false });
window.addEventListener('keydown', () => audio.unlock(), { once: false });

const game = {
  state: 'menu',
  missions: MISSIONS,
  missionIndex: 0,
  mission: null,
  plane: null,
  clouds: [],
  cam: makeCamera(),
  time: 0,
  elapsed: 0,
  score: 0,
  ringPoints: 0,
  timeBonus: 0,
  fuelBonus: 0,
  ringsPassed: 0,
  nextRingIndex: 0,
  nextRing: null,
  nextRingDistance: 0,
  prevRingSigned: -1,
  toast: null,
  pullUp: false,
  stalled: false,
  timeUp: false,
  menuRects: [],
  shotMode: false,
};

function showToast(text, sub, colour, seconds = 2.2) {
  game.toast = { text, sub: sub || '', colour: colour || '#ffd34d', until: game.time + seconds };
}

game.startMission = function startMission(index) {
  game.missionIndex = index;
  // Fresh copy: ring state must not leak between attempts.
  const def = MISSIONS[index];
  game.mission = {
    ...def,
    rings: def.rings.map((r) => ({ ...r, passed: false, missed: false })),
  };
  game.plane = makePlane(def.start);
  game.clouds = makeClouds(def, 1000 + index * 77);
  game.cam = makeCamera();
  game.cam.heading = def.start.heading;
  game.cam.x = def.start.x;
  game.cam.y = def.start.y + CONFIG.cameraHeight;
  game.cam.z = def.start.z + CONFIG.cameraDistance;
  game.elapsed = 0;
  game.score = 0;
  game.ringPoints = 0;
  game.timeBonus = 0;
  game.fuelBonus = 0;
  game.ringsPassed = 0;
  game.nextRingIndex = 0;
  game.nextRing = game.mission.rings[0];
  game.prevRingSigned = -1;
  game.toast = null;
  game.pullUp = false;
  game.stalled = false;
  game.timeUp = false;
  game.state = 'flying';
  showToast(`MISI ${index + 1} — ${def.title}`, def.briefing, '#ffffff', 3.5);
};

function finishLanding() {
  const p = game.plane;
  const total = game.mission.rings.length;
  if (game.ringsPassed >= total) {
    game.timeBonus = Math.max(0, Math.round(game.mission.timeLimit - game.elapsed)) * 2;
    game.fuelBonus = Math.round(p.fuel) * 2;
    game.score += CONFIG.landingScore + game.timeBonus + game.fuelBonus;
    game.state = 'complete';
    audio.win();
    showToast('MISI SELESAI!', `Skor akhir ${game.score}`, '#7ee787', 3);
  } else {
    game.state = 'landed';
    audio.land();
    showToast('MENDARAT', `${game.ringsPassed}/${total} cincin — tekan T untuk lepas landas lagi`, '#ffd34d', 3);
  }
}

function failCrash(reason) {
  game.plane.crashed = true;
  game.plane.crashReason = reason;
  game.state = 'crashed';
  audio.crash();
}

let lastTime = performance.now() / 1000;
let lastWarningBeep = 0;

function update(dt) {
  game.time += dt;
  const p = game.plane;

  if (game.state === 'menu') {
    // Attract camera: slow orbit over the airfield.
    const angle = game.time * 0.045;
    game.cam.x = Math.sin(angle) * 560;
    game.cam.z = Math.cos(angle) * 560 - 150;
    game.cam.y = 235;
    game.cam.heading = Math.atan2(-game.cam.x, game.cam.z);
    game.cam.pitch = -0.13;
    game.cam.roll = 0;
    if (consumePressed(input, '1')) game.startMission(0);
    if (consumePressed(input, '2')) game.startMission(1);
    if (consumePressed(input, '3')) game.startMission(2);
    if (consumePressed(input, 'Enter') || consumePressed(input, ' ')) game.startMission(0);
    if (input.clicked) {
      const mx = input.clickX;
      const my = input.clickY;
      for (const rect of game.menuRects) {
        if (mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
          audio.click();
          game.startMission(rect.mission);
          break;
        }
      }
    }
    return;
  }

  if (game.state === 'paused') {
    if (consumePressed(input, 'p') || consumePressed(input, 'P') || consumePressed(input, 'Escape')) {
      game.state = 'flying';
    }
    if (consumePressed(input, 'r') || consumePressed(input, 'R')) game.startMission(game.missionIndex);
    if (consumePressed(input, 'm') || consumePressed(input, 'M')) game.state = 'menu';
    return;
  }

  if (game.state === 'flying') {
    game.elapsed += dt;
    if (game.elapsed > game.mission.timeLimit && !game.timeUp) {
      game.timeUp = true;
      showToast('WAKTU HABIS', 'Bonus waktu hangus — mendaratlah secepatnya', '#ff8a7a', 3);
    }

    const steer = steering(input, game.time);
    const wasLanded = p.landed;
    const wasCrashed = p.crashed;
    stepPlane(p, steer, dt, game.mission.wind, game.time);
    updateChaseCamera(game.cam, p, dt);

    // Warnings: terrain ahead, stall, fuel.
    const aheadX = p.x + Math.sin(p.heading) * 90;
    const aheadZ = p.z - Math.cos(p.heading) * 90;
    const clearance = p.y - terrainHeight(aheadX, aheadZ);
    game.pullUp = !p.grounded && clearance < 55 && p.verticalSpeed < -1;
    game.stalled = !p.grounded && p.speed < CONFIG.stallSpeed;
    if ((game.pullUp || game.stalled) && game.time - lastWarningBeep > 1.2) {
      audio.warning();
      lastWarningBeep = game.time;
    }

    // Ring gates, in order: cross the plane, score the centre distance.
    if (game.nextRing && !p.grounded) {
      const ring = game.nextRing;
      const nx = Math.sin(ring.face);
      const nz = -Math.cos(ring.face);
      const signed = (p.x - ring.x) * nx + (p.z - ring.z) * nz;
      if (game.prevRingSigned < 0 && signed >= 0) {
        const centre = Math.hypot(
          p.x - ring.x - signed * nx,
          p.y - ring.y,
          p.z - ring.z - signed * nz,
        );
        if (centre <= CONFIG.ringRadius) {
          const centreBonus = Math.round((1 - centre / CONFIG.ringRadius) * CONFIG.ringCentreBonus);
          const gained = CONFIG.ringScore + centreBonus;
          game.score += gained;
          game.ringPoints += gained;
          game.ringsPassed += 1;
          ring.passed = true;
          audio.ring();
          showToast(
            `CINCIN ${game.ringsPassed}/${game.mission.rings.length}  +${gained}`,
            centre < 8 ? 'Tembakan tengah sempurna!' : 'Bagus — cincin berikutnya di depan',
            '#7ee787',
          );
          game.nextRingIndex += 1;
          game.nextRing = game.mission.rings[game.nextRingIndex] || null;
        } else {
          audio.miss();
          showToast('CINCIN TERLEWAT', 'Putar balik dan coba lagi', '#ff8a7a');
        }
      }
      game.prevRingSigned = signed;
      game.nextRingDistance = distanceTo(p, ring.x, ring.y, ring.z);
    } else if (game.nextRing) {
      game.nextRingDistance = distanceTo(p, game.nextRing.x, game.nextRing.y, game.nextRing.z);
    }

    if (p.landed && !wasLanded) finishLanding();
    if (p.crashed && !wasCrashed) failCrash(p.crashReason);

    audio.update(p.throttle, p.speed, !p.grounded);

    if (consumePressed(input, 'p') || consumePressed(input, 'P') || consumePressed(input, 'Escape')) {
      game.state = 'paused';
    }
    if (consumePressed(input, 'r') || consumePressed(input, 'R')) game.startMission(game.missionIndex);
    if (consumePressed(input, 'm') || consumePressed(input, 'M')) game.state = 'menu';
    return;
  }

  if (game.state === 'landed') {
    // On the runway, engines idling: T takes off again, R restarts, M menu.
    if (consumePressed(input, 't') || consumePressed(input, 'T')) {
      game.plane.landed = false;
      game.plane.grounded = true;
      game.plane.throttle = 0.7;
      game.state = 'flying';
      showToast('LEPAS LANDAS LAGI', 'Gas penuh, tarik kemudi di 120 knot', '#ffffff', 2.5);
    }
    if (consumePressed(input, 'r') || consumePressed(input, 'R')) game.startMission(game.missionIndex);
    if (consumePressed(input, 'm') || consumePressed(input, 'M')) game.state = 'menu';
    return;
  }

  if (game.state === 'crashed' || game.state === 'complete') {
    if (consumePressed(input, 'r') || consumePressed(input, 'R')) game.startMission(game.missionIndex);
    if (consumePressed(input, 'm') || consumePressed(input, 'M')) game.state = 'menu';
    return;
  }
}

function render() {
  const view = makeView(canvas);
  const mission = game.mission || MISSIONS[0];
  const palette = mission.palette;
  const scene = {
    palette,
    clouds: game.clouds.length ? game.clouds : makeClouds(mission, 1000),
    rings: game.mission ? game.mission.rings : [],
    nextRing: game.nextRingIndex,
    // The chase sprite only flies while airborne; on the ground and on the
    // end screens the camera shows the runway and the terrain itself.
    plane: game.state === 'flying' || game.state === 'paused' ? game.plane : null,
    time: game.time,
  };

  drawScene(ctx, view, game.cam, scene);

  if (game.state === 'menu') {
    const mouse = { x: (input.mouseX + 1) / 2 * view.w, y: (input.mouseY + 1) / 2 * view.h };
    game.menuRects = drawMenu(ctx, view, game, mouse);
  } else if (game.state === 'flying' || game.state === 'paused') {
    const p = game.plane;
    // Compass degrees: 0 = north, 90 = east, matching the heading angle.
    const compassDeg = (((p.heading * 180) / Math.PI) % 360 + 360) % 360;
    let ringBearing = null;
    if (game.nextRing) {
      const b = bearingTo(p, game.nextRing.x, game.nextRing.z);
      ringBearing = (((b * 180) / Math.PI) % 360 + 360) % 360;
    }
    drawCompass(ctx, view, compassDeg, ringBearing);
    drawFlightInstruments(ctx, view, p);
    drawAttitude(ctx, view, p, palette);
    drawMissionPanel(ctx, view, game);
    drawWarnings(ctx, view, game, p, game.time);
    drawToast(ctx, view, game.toast, game.time);
    if (!p.grounded && game.elapsed < 12) {
      drawHelpLine(ctx, view, 'W/S naik-turun · A/D belok · Shift/Ctrl gas · Mouse juga bisa kemudi · G roda pendarat');
    }
    if (game.state === 'paused') drawPause(ctx, view);
  } else if (game.state === 'landed' || game.state === 'crashed' || game.state === 'complete') {
    // Keep the instruments visible behind the end screen.
    const p = game.plane;
    drawFlightInstruments(ctx, view, p);
    drawAttitude(ctx, view, p, palette);
    drawMissionPanel(ctx, view, game);
    drawEndScreen(ctx, view, game);
  }
}

function frame(nowMs) {
  const now = nowMs / 1000;
  let dt = now - lastTime;
  lastTime = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;
  // Screenshot mode freezes the simulation so the frame the maker took is
  // exactly the state the game was put in — no drift, no luck.
  if (game.shotMode) dt = 0;
  update(dt);
  render();
  clearPressed(input);
  requestAnimationFrame(frame);
}

// Screenshot states (?shot=...) come first; otherwise start at the menu.
const params = new URLSearchParams(window.location.search);
game.shotMode = applyShot(game, params.get('shot'));
if (!game.shotMode) {
  game.state = 'menu';
  game.clouds = makeClouds(MISSIONS[0], 1000);
}
window.__game = game;

requestAnimationFrame(frame);
