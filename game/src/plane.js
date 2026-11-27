// plane.js — the aircraft: state, arcade flight physics and landing logic.
// One aircraft, one set of rules: throttle sets a target speed, banking
// turns the nose, pitch trades speed for height, and the ground is final.
import { CONFIG } from './config.js';
import { terrainHeight, onRunway, RUNWAY } from './terrain.js';
import { clamp, wrapAngle, angleDiff } from './random.js';

export function makePlane(start) {
  return {
    x: start.x,
    y: start.y,
    z: start.z,
    heading: start.heading,
    pitch: 0,
    roll: 0,
    speed: start.speed,
    throttle: 0.65,
    fuel: 100,
    gearDown: false,
    flaps: false,
    verticalSpeed: 0,
    grounded: true, // starts on the runway, ready for takeoff
    flown: false, // true once the aircraft has climbed clear of the ground
    grace: 0, // seconds after rotation during which the runway cannot kill it
    crashed: false,
    crashReason: '',
    landed: false,
    airTime: 0,
  };
}

// Steering input: pitchInput -1..1 (1 = pull up), rollInput -1..1 (1 = right).
export function stepPlane(plane, input, dt, wind, time) {
  if (plane.crashed || plane.landed) return;

  // Throttle: Shift / wheel up adds, Ctrl / wheel down cuts.
  plane.throttle = clamp(
    plane.throttle + (input.throttleDelta || 0) * dt,
    0,
    1,
  );

  // On the ground the aircraft rolls along the runway until rotation speed.
  if (plane.grounded) {
    const target = 20 + plane.throttle * 95;
    // Linear takeoff roll: a few seconds of runway, not a catapult launch.
    plane.speed = Math.min(target, plane.speed + (6 + plane.throttle * 10) * dt);
    plane.pitch = 0;
    plane.roll *= 0.9;
    const fwdX = Math.sin(plane.heading);
    const fwdZ = -Math.cos(plane.heading);
    plane.x += fwdX * plane.speed * dt;
    plane.z += fwdZ * plane.speed * dt;
    plane.y = 1.5;
    if (plane.speed > 34 && input.pitch > 0.25) {
      plane.grounded = false; // rotate!
      plane.flown = false; // must climb clear before a landing can count
      plane.grace = 1.2; // climb away from the runway before the ground bites
      plane.pitch = 0.12;
    }
    plane.fuel = Math.max(
      0,
      plane.fuel - (CONFIG.fuelBurnBase + CONFIG.fuelBurnThrottle * plane.throttle) * dt,
    );
    return;
  }

  plane.airTime += dt;

  // Fuel: empty tanks mean the engine is out and the glide begins.
  plane.fuel = Math.max(
    0,
    plane.fuel - (CONFIG.fuelBurnBase + CONFIG.fuelBurnThrottle * plane.throttle) * dt,
  );
  const engineOut = plane.fuel <= 0;

  // Speed chases the throttle target; climbing bleeds it, diving restores it.
  const targetSpeed = engineOut
    ? CONFIG.minSpeed
    : CONFIG.minSpeed + plane.throttle * (CONFIG.maxSpeed - CONFIG.minSpeed);
  plane.speed += (targetSpeed - plane.speed) * CONFIG.throttleAccel * dt;
  plane.speed -= Math.sin(plane.pitch) * 9 * dt; // climbing bleeds speed
  plane.speed = clamp(plane.speed, 12, CONFIG.maxSpeed + 12);

  // Stall: below stall speed the nose drops and the controls go soft.
  const stalled = plane.speed < CONFIG.stallSpeed;
  const authority = stalled ? 0.35 : 1;

  // Pitch and roll answer the stick, then relax toward level flight.
  const targetPitch = clamp(input.pitch * CONFIG.maxPitch, -CONFIG.maxPitch, CONFIG.maxPitch);
  const targetRoll = clamp(input.roll * CONFIG.maxRoll, -CONFIG.maxRoll, CONFIG.maxRoll);
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, CONFIG.pitchRate * 2.2 * dt) * authority;
  plane.roll += (targetRoll - plane.roll) * Math.min(1, CONFIG.rollRate * 1.6 * dt) * authority;
  if (stalled) plane.pitch -= 0.35 * dt; // nose drops in a stall
  plane.pitch = clamp(plane.pitch, -CONFIG.maxPitch, CONFIG.maxPitch);
  plane.roll = clamp(plane.roll, -CONFIG.maxRoll, CONFIG.maxRoll);

  // A banked wing turns the nose: coordinated turn, scaled by speed.
  plane.heading +=
    Math.sin(plane.roll) * CONFIG.turnFactor * (plane.speed / 60) * dt;
  plane.heading = wrapAngle(plane.heading);

  // Wind gusts push the aircraft sideways, stronger in the storm mission.
  const gust = wind * Math.sin(time * 0.7) * 0.6 + wind * Math.sin(time * 1.7 + 2) * 0.4;
  plane.x += gust * dt;

  // Move along the flight direction.
  const fwdX = Math.sin(plane.heading) * Math.cos(plane.pitch);
  const fwdY = Math.sin(plane.pitch);
  const fwdZ = -Math.cos(plane.heading) * Math.cos(plane.pitch);
  plane.x += fwdX * plane.speed * dt;
  plane.z += fwdZ * plane.speed * dt;
  plane.y += fwdY * plane.speed * dt;
  plane.verticalSpeed = fwdY * plane.speed;

  // The ground is final: check terrain, water and the runway.
  const ground = terrainHeight(plane.x, plane.z);
  if (!plane.flown && plane.y - ground > 10) plane.flown = true;
  plane.grace = Math.max(0, plane.grace - dt);
  if (plane.grace <= 0 && plane.y <= ground + 1.6) {
    const overRunway = onRunway(plane.x, plane.z);
    const sink = -plane.verticalSpeed;
    const gentle =
      plane.flown &&
      overRunway &&
      Math.abs(plane.pitch) < 0.14 &&
      Math.abs(plane.roll) < 0.26 &&
      plane.speed < CONFIG.landingMaxSpeed &&
      sink < CONFIG.landingMaxSink;
    if (gentle) {
      plane.landed = true;
      plane.grounded = true;
      plane.y = 1.5;
      plane.pitch = 0;
      plane.roll = 0;
      plane.speed = Math.min(plane.speed, 40);
    } else if (ground < -1) {
      plane.crashed = true;
      plane.crashReason = 'Mendarat di danau — pesawat tenggelam.';
    } else {
      plane.crashed = true;
      plane.crashReason =
        plane.speed < CONFIG.stallSpeed
          ? 'Stall di ketinggian rendah — pesawat jatuh.'
          : 'Menabrak tanah.';
    }
    plane.y = Math.max(plane.y, ground + 1.6);
  }

  // Soft ceiling: the sky ends at 1200 m, the aircraft just levels off.
  if (plane.y > 1200) {
    plane.y = 1200;
    plane.pitch = Math.min(plane.pitch, 0);
  }

  // Keep the island in reach: turn back past 4 km out.
  const dist = Math.hypot(plane.x, plane.z);
  if (dist > 4200) {
    plane.heading = wrapAngle(plane.heading + Math.PI);
  }
}

// Bearing from the aircraft to a point, as a heading angle.
export function bearingTo(plane, x, z) {
  return Math.atan2(x - plane.x, -(z - plane.z));
}

export function distanceTo(plane, x, y, z) {
  return Math.hypot(x - plane.x, y - plane.y, z - plane.z);
}

// How far off the nose the target is, in radians (-PI..PI).
export function bearingError(plane, x, z) {
  return angleDiff(bearingTo(plane, x, z), plane.heading);
}

// Ring crossing: the aircraft passed through the ring's plane this step.
export function checkRing(plane, ring, prevSigned) {
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  const nx = Math.sin(ring.face);
  const nz = -Math.cos(ring.face);
  const signed = dx * nx + dz * nz;
  if (prevSigned < 0 && signed >= 0) {
    // Distance from the ring centre inside the ring's own plane.
    const ox = dx - signed * nx;
    const oz = dz - signed * nz;
    return { crossed: true, centre: Math.hypot(ox, dy, oz) };
  }
  return { crossed: false, centre: 0 };
}

export { RUNWAY };
