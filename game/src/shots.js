// shots.js — fixed starting states for the maker's screenshots.
// `?shot=start|play|ring|end` puts the game straight into a scene that
// shows it at its best. These are the game's own states, reached through
// the same code the player runs — no staged images, no fake renders.
import { CONFIG } from './config.js';

export function applyShot(game, name) {
  if (!name) return false;
  if (name === 'start') {
    game.state = 'menu';
    game.time = 8;
    return true;
  }
  if (name === 'play') {
    // Mid-flight on mission 1: cruising toward the first ring, instruments lit.
    game.startMission(0);
    game.state = 'flying';
    game.time = 8;
    const p = game.plane;
    p.grounded = false;
    p.x = 0;
    p.y = 130;
    p.z = -50;
    p.heading = 0;
    p.pitch = 0.02;
    p.roll = 0;
    p.speed = 58;
    p.throttle = 0.72;
    p.fuel = 88;
    game.elapsed = 42;
    game.score = 0;
    game.cam.heading = 0;
    game.cam.pitch = 0.02;
    game.cam.roll = 0;
    return true;
  }
  if (name === 'ring') {
    // Closing on ring 2 of mission 1: the gold gate fills the view ahead.
    game.startMission(0);
    game.state = 'flying';
    game.time = 8;
    const p = game.plane;
    p.grounded = false;
    p.x = -190;
    p.y = 228;
    p.z = -210;
    p.heading = -0.46;
    p.pitch = 0.01;
    p.roll = -0.15;
    p.speed = 64;
    p.throttle = 0.78;
    p.fuel = 81;
    game.elapsed = 96;
    game.ringsPassed = 1;
    game.score = 138;
    game.ringPoints = 138;
    game.mission.rings[0].passed = true;
    game.nextRingIndex = 1;
    game.nextRing = game.mission.rings[1];
    game.cam.heading = -0.46;
    game.cam.pitch = 0.01;
    game.cam.roll = -0.15;
    return true;
  }
  if (name === 'end') {
    // Mission complete: all rings, a clean landing, the score breakdown.
    game.startMission(0);
    game.state = 'complete';
    game.time = 8;
    const p = game.plane;
    p.grounded = true;
    p.landed = true;
    p.x = 0;
    p.y = 1.5;
    p.z = 120;
    p.heading = 0;
    p.pitch = 0;
    p.roll = 0;
    p.speed = 12;
    p.throttle = 0;
    p.fuel = 47;
    game.elapsed = 212;
    game.ringsPassed = 5;
    game.ringPoints = 612;
    game.timeBonus = 176;
    game.fuelBonus = 94;
    game.score = 612 + CONFIG.landingScore + 176 + 94;
    game.mission.rings.forEach((r) => (r.passed = true));
    game.nextRingIndex = 5;
    game.nextRing = null;
    // Camera off the runway's shoulder, high enough to see the strip, the
    // airfield and the valley behind the score panel.
    game.cam.heading = -0.3;
    game.cam.pitch = -0.2;
    game.cam.roll = 0;
    game.cam.x = 70;
    game.cam.y = 60;
    game.cam.z = 280;
    return true;
  }
  return false;
}
