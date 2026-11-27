import type { RallyTrack } from './track';

export type TrafficKind = 'taxi' | 'van' | 'compact' | 'coupe';

export interface TrafficCarState {
  id: number;
  kind: TrafficKind;
  colorHex: number;
  accentHex: number;
  progress: number;
  laneOffset: number;
  speedMps: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  wheelRotation: number;
  overtakenCooldown: number;
  hitCooldown: number;
}

export type ObstacleKind = 'cone' | 'barrier';

export interface RoadObstacleState {
  id: number;
  kind: ObstacleKind;
  progress: number;
  laneOffset: number;
  radius: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  knockedTimer: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
}

export interface TrafficStepResult {
  scoreDelta: number;
  combo: number;
  overtakesDelta: number;
  hitStrength: number;
}

const TRAFFIC_PALETTE: { kind: TrafficKind; colorHex: number; accentHex: number }[] = [
  { kind: 'taxi', colorHex: 0xfacc15, accentHex: 0x111827 },
  { kind: 'van', colorHex: 0x34d399, accentHex: 0xffffff },
  { kind: 'compact', colorHex: 0xfb7185, accentHex: 0xfef08a },
  { kind: 'coupe', colorHex: 0xa78bfa, accentHex: 0xe0f2fe },
  { kind: 'taxi', colorHex: 0x38bdf8, accentHex: 0xffffff },
  { kind: 'compact', colorHex: 0xf97316, accentHex: 0xfef3c7 },
];

export function createTrafficCars(track: RallyTrack, count = 6): TrafficCarState[] {
  const cars: TrafficCarState[] = [];
  for (let i = 0; i < count; i++) {
    // Keep starting grid [0.0..0.11] clear so player starts on open tarmac
    const progress = 0.14 + (i / count) * 0.82;
    const laneSide = i % 2 === 0 ? -1 : 1;
    const laneOffset = laneSide * (track.mapId === 'city' ? 3.2 : 2.7);
    const s = track.sampleAtProgress(progress);
    const spec = TRAFFIC_PALETTE[i % TRAFFIC_PALETTE.length];

    cars.push({
      id: i,
      kind: spec.kind,
      colorHex: spec.colorHex,
      accentHex: spec.accentHex,
      progress,
      laneOffset,
      speedMps: 11.5 + (i % 3) * 2.2,
      x: s.x + s.nx * laneOffset,
      y: s.y,
      z: s.z + s.nz * laneOffset,
      heading: Math.atan2(s.tx, s.tz),
      wheelRotation: 0,
      overtakenCooldown: 0,
      hitCooldown: 0,
    });
  }
  return cars;
}

export function createRoadObstacles(track: RallyTrack, count = 12): RoadObstacleState[] {
  const obstacles: RoadObstacleState[] = [];
  for (let i = 0; i < count; i++) {
    // Place obstacles from 0.12..0.94 so start/finish straight is unobstructed
    const progress = 0.12 + (i / count) * 0.82;
    const kind: ObstacleKind = i % 3 === 0 ? 'barrier' : 'cone';
    const laneSide = i % 2 === 0 ? 1 : -1;
    const mag = kind === 'barrier' ? 3.4 : 2.9;
    const laneOffset = laneSide * mag;
    const s = track.sampleAtProgress(progress);

    obstacles.push({
      id: i,
      kind,
      progress,
      laneOffset,
      radius: kind === 'barrier' ? 1.15 : 0.65,
      x: s.x + s.nx * laneOffset,
      y: s.y,
      z: s.z + s.nz * laneOffset,
      heading: Math.atan2(s.tx, s.tz),
      knockedTimer: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
    });
  }
  return obstacles;
}

export interface PlayerMotionProxy {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  speed: number;
}

export function stepTrafficAndObstacles(
  track: RallyTrack,
  traffic: TrafficCarState[],
  obstacles: RoadObstacleState[],
  player: PlayerMotionProxy,
  currentCombo: number,
  dt: number
): TrafficStepResult {
  let scoreDelta = 0;
  let combo = Math.max(1, currentCombo);
  let overtakesDelta = 0;
  let hitStrength = 0;

  // Distance-based speed points
  const absSpeed = Math.abs(player.speed);
  if (player.speed > 4) {
    scoreDelta += absSpeed * dt * 1.6 * combo;
  }

  // Advance traffic cars & check collisions + near-miss overtakes
  const trackLen = Math.max(100, track.totalLength);
  for (let i = 0; i < traffic.length; i++) {
    const car = traffic[i];
    car.overtakenCooldown = Math.max(0, car.overtakenCooldown - dt);
    car.hitCooldown = Math.max(0, car.hitCooldown - dt);

    const dp = (car.speedMps * dt) / trackLen;
    car.progress = (car.progress + dp) % 1;
    const s = track.sampleAtProgress(car.progress);
    car.x = s.x + s.nx * car.laneOffset;
    car.y = s.y;
    car.z = s.z + s.nz * car.laneOffset;
    car.heading = Math.atan2(s.tx, s.tz);
    car.wheelRotation += car.speedMps * dt * 2.8;

    const dx = player.x - car.x;
    const dz = player.z - car.z;
    const distSq = dx * dx + dz * dz;
    const minSep = 2.45;

    if (distSq > 0.001 && distSq < minSep * minSep) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      const push = minSep - dist;
      player.x += nx * push;
      player.z += nz * push;
      player.vx = player.vx * 0.62 + nx * 4.2;
      player.vz = player.vz * 0.62 + nz * 4.2;

      if (car.hitCooldown <= 0) {
        car.hitCooldown = 0.7;
        car.overtakenCooldown = 2.0;
        hitStrength = Math.max(hitStrength, 0.55);
        combo = 1;
      }
    } else if (
      distSq < 34 &&
      absSpeed > 15 &&
      car.overtakenCooldown <= 0 &&
      car.hitCooldown <= 0
    ) {
      // Clean high-speed near-miss overtake bonus
      car.overtakenCooldown = 4.5;
      overtakesDelta += 1;
      scoreDelta += 150 * combo;
      combo = Math.min(5, combo + 1);
    }
  }

  // Update road obstacles & check collisions
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (obs.knockedTimer > 0) {
      obs.knockedTimer = Math.max(0, obs.knockedTimer - dt);
      obs.x += obs.vx * dt;
      obs.z += obs.vz * dt;
      obs.vy -= 14 * dt;
      obs.y += obs.vy * dt;
      const floorY = track.groundHeightAt(obs.x, obs.z);
      if (obs.y < floorY) {
        obs.y = floorY;
        obs.vy = Math.abs(obs.vy) * 0.35;
      }
      obs.vx *= 0.92;
      obs.vz *= 0.92;
      obs.spin += dt * 7;

      if (obs.knockedTimer === 0) {
        const s = track.sampleAtProgress(obs.progress);
        obs.x = s.x + s.nx * obs.laneOffset;
        obs.y = s.y;
        obs.z = s.z + s.nz * obs.laneOffset;
        obs.heading = Math.atan2(s.tx, s.tz);
        obs.vx = 0;
        obs.vy = 0;
        obs.vz = 0;
        obs.spin = 0;
      }
      continue;
    }

    const dx = player.x - obs.x;
    const dz = player.z - obs.z;
    const hitRadius = obs.radius + 1.05;
    if (dx * dx + dz * dz < hitRadius * hitRadius) {
      if (obs.kind === 'cone') {
        obs.knockedTimer = 3.5;
        obs.vx = player.vx * 0.65 + (dx >= 0 ? -3 : 3);
        obs.vz = player.vz * 0.65 + (dz >= 0 ? -3 : 3);
        obs.vy = 4.8;
        hitStrength = Math.max(hitStrength, 0.22);
        player.vx *= 0.92;
        player.vz *= 0.92;
        combo = 1;
      } else {
        // Chicane barrier bounce
        const dist = Math.max(0.1, Math.hypot(dx, dz));
        const nx = dx / dist;
        const nz = dz / dist;
        const push = hitRadius - dist;
        player.x += nx * push;
        player.z += nz * push;
        player.vx = player.vx * 0.55 + nx * 4.5;
        player.vz = player.vz * 0.55 + nz * 4.5;
        obs.knockedTimer = 3.0;
        obs.vx = -nx * 4;
        obs.vz = -nz * 4;
        obs.vy = 2.6;
        hitStrength = Math.max(hitStrength, 0.62);
        combo = 1;
      }
    }
  }

  return {
    scoreDelta,
    combo,
    overtakesDelta,
    hitStrength,
  };
}
