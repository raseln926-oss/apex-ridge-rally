import type { RallyTrack, TrackProjection } from './track';
import type { ControlInput, SurfaceType } from './types';

export interface VehicleState {
  x: number;
  y: number;
  z: number;
  heading: number; // radians; 0 = +Z, + = left, - = right
  vx: number;
  vz: number;
  angularVel: number;
  speed: number; // m/s signed forward speed
  rpm: number; // 1000..8000
  gear: number; // 1..6
  steerAngle: number; // visual wheel angle (rad)
  slipAngle: number; // drift slip magnitude
  bodyPitch: number;
  bodyRoll: number;
  wheelRotation: number;
  surface: SurfaceType;
  sampleIndex: number;
  progress: number;
  sectorMask: number; // bitmask 1 | 2 | 4 to validate real full laps
  lap: number;
  totalProgress: number;
  topSpeedKmh: number;
  hitWallCooldown: number;
  lastImpactStrength: number;
}

export interface PhysicsStepEvent {
  wallHitStrength: number; // 0 if none, >0 if collision
  completedLap: boolean;
}

const GEAR_RATIOS = [0, 3.25, 2.28, 1.68, 1.28, 1.0, 0.81];
const MAX_ENGINE_FORCE = 25.5;
const BRAKE_DECEL = 32.0;
const HANDBRAKE_DECEL = 16.0;
const DRAG_COEFF = 0.0029;
const ROLLING_RESISTANCE: Record<SurfaceType, number> = {
  asphalt: 0.45,
  gravel: 0.85,
  offtrack: 2.4,
};
const LATERAL_GRIP: Record<SurfaceType, number> = {
  asphalt: 9.8,
  gravel: 6.4,
  offtrack: 4.5,
};

export function createInitialVehicleState(
  track: RallyTrack,
  startProgress = 0.04,
  lateralOffset = 0
): VehicleState {
  const s = track.sampleAtProgress(startProgress);
  const x = s.x + s.nx * lateralOffset;
  const z = s.z + s.nz * lateralOffset;
  const heading = Math.atan2(s.tx, s.tz);

  return {
    x,
    y: s.y,
    z,
    heading,
    vx: 0,
    vz: 0,
    angularVel: 0,
    speed: 0,
    rpm: 1150,
    gear: 1,
    steerAngle: 0,
    slipAngle: 0,
    bodyPitch: 0,
    bodyRoll: 0,
    wheelRotation: 0,
    surface: s.surface,
    sampleIndex: s.index,
    progress: s.progress,
    sectorMask: 0,
    lap: 1,
    totalProgress: 0,
    topSpeedKmh: 0,
    hitWallCooldown: 0,
    lastImpactStrength: 0,
  };
}

export function stepVehiclePhysics(
  state: VehicleState,
  input: ControlInput,
  track: RallyTrack,
  rawDt: number
): { state: VehicleState; proj: TrackProjection; event: PhysicsStepEvent } {
  const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

  const fx = Math.sin(state.heading);
  const fz = Math.cos(state.heading);
  // Right unit vector in XZ plane (screen right when looking along forward)
  const rx = -fz;
  const rz = fx;

  let vForward = state.vx * fx + state.vz * fz;
  let vLateral = state.vx * rx + state.vz * rz;

  const projBefore = track.project(state.x, state.z, state.sampleIndex);
  const surface = projBefore.surface;

  // Steering smoothing (-1 = left, +1 = right)
  const targetSteer = -input.steer * 0.56; // +heading turns left
  const steerLerp = 1 - Math.exp(-12 * dt);
  const steerAngle = state.steerAngle + (targetSteer - state.steerAngle) * steerLerp;

  // Engine drive & gearing
  const speedAbs = Math.abs(vForward);
  const gearRatio = GEAR_RATIOS[state.gear] ?? 1.0;
  const throttleForce =
    input.throttle > 0.02
      ? input.throttle * MAX_ENGINE_FORCE * (0.52 + 0.48 * Math.min(1.3, gearRatio * 0.52))
      : 0;

  let accelForward = throttleForce;

  if (input.brake > 0.02) {
    if (vForward > 1.2) {
      accelForward -= input.brake * BRAKE_DECEL;
    } else {
      // Reverse gear
      accelForward -= input.brake * 13.5;
    }
  }

  if (input.handbrake && vForward > 1.5) {
    accelForward -= HANDBRAKE_DECEL;
  }

  // Aerodynamic drag & surface rolling resistance
  const drag = DRAG_COEFF * vForward * Math.abs(vForward);
  const roll = ROLLING_RESISTANCE[surface] * Math.sign(vForward) * Math.min(1, speedAbs * 0.5);
  accelForward -= drag + roll;

  // Uphill / downhill gravity slope influence
  const lookAhead = track.sampleAtProgress(projBefore.progress + 0.006);
  const lookBehind = track.sampleAtProgress(projBefore.progress - 0.006);
  const slope = (lookAhead.y - lookBehind.y) / Math.max(2, track.totalLength * 0.012);
  accelForward -= slope * 5.2;

  vForward += accelForward * dt;

  // Clamp top speeds (forward ~44 m/s = ~158 km/h, reverse ~12 m/s)
  if (vForward > 44) vForward = 44;
  if (vForward < -12) vForward = -12;

  // Stop dead creep when coasting very slowly
  if (input.throttle < 0.05 && input.brake < 0.05 && Math.abs(vForward) < 0.25) {
    vForward = 0;
  }

  // Yaw rate from steering & speed
  const steerAuthority = Math.min(1, speedAbs / 6.5) * (vForward >= -0.2 ? 1 : -1);
  const handbrakeYawBoost = input.handbrake && speedAbs > 6 ? 1.52 : 1.0;
  const speedSteerDamp = 1 / (1 + speedAbs * 0.024);
  const targetAngularVel = steerAngle * 4.4 * steerAuthority * handbrakeYawBoost * speedSteerDamp;
  const angularVel =
    state.angularVel + (targetAngularVel - state.angularVel) * (1 - Math.exp(-14 * dt));
  const heading = state.heading + angularVel * dt;

  // Lateral grip & realistic rally drift
  const effectiveGrip =
    LATERAL_GRIP[surface] * (input.handbrake ? 0.36 : 1.0);
  const lateralDamp = Math.exp(-effectiveGrip * dt);
  vLateral *= lateralDamp;

  // Reconstruct world velocity along updated heading
  const nfx = Math.sin(heading);
  const nfz = Math.cos(heading);
  const nrx = -nfz;
  const nrz = nfx;

  let vx = nfx * vForward + nrx * vLateral;
  let vz = nfz * vForward + nrz * vLateral;

  let x = state.x + vx * dt;
  let z = state.z + vz * dt;

  // Guardrail / Canyon Wall Collision
  const proj = track.project(x, z, projBefore.sampleIndex);
  const barrierLimit = proj.halfWidth + 1.55;
  let wallHitStrength = 0;
  let hitWallCooldown = Math.max(0, state.hitWallCooldown - dt);

  if (Math.abs(proj.lateralOffset) > barrierLimit) {
    const sign = Math.sign(proj.lateralOffset);
    const excess = Math.abs(proj.lateralOffset) - barrierLimit;
    x -= proj.nx * sign * excess;
    z -= proj.nz * sign * excess;

    // Velocity component into wall
    const vNormal = vx * proj.nx + vz * proj.nz;
    if (vNormal * sign > 0) {
      const impact = Math.abs(vNormal);
      // Bounce gently back along road tangent & scrub 28% speed
      vx -= proj.nx * vNormal * 1.32;
      vz -= proj.nz * vNormal * 1.32;
      vx *= 0.82;
      vz *= 0.82;

      if (impact > 3.5 && hitWallCooldown <= 0) {
        wallHitStrength = Math.min(1, impact / 18);
        hitWallCooldown = 0.28;
      }
    }
    // Nudge heading slightly toward track tangent so player never gets wedged perpendicular
    const trackHeading = Math.atan2(proj.tx, proj.tz);
    const angleDiff = Math.atan2(Math.sin(trackHeading - heading), Math.cos(trackHeading - heading));
    if (Math.abs(angleDiff) > 0.65) {
      // Softly align
      vx += proj.tx * 2.5;
      vz += proj.tz * 2.5;
    }
  }

  // Recompute forward speed after collision
  const finalForward = vx * nfx + vz * nfz;
  const finalLateral = vx * nrx + vz * nrz;
  const speedKmh = Math.abs(finalForward) * 3.6;

  // Automatic 6-speed gearbox + RPM calculation
  let gear = state.gear;
  const speedForGear = Math.abs(finalForward);
  const wheelRpmProxy = speedForGear * 185 * (GEAR_RATIOS[gear] ?? 1);
  let rpm = Math.max(1150, Math.min(8200, 1150 + wheelRpmProxy + input.throttle * 950));

  if (rpm > 7250 && gear < 6 && finalForward > 3) {
    gear += 1;
    rpm = 4800;
  } else if (rpm < 3100 && gear > 1) {
    gear -= 1;
    rpm = 5600;
  }
  if (speedAbs < 1.5 && input.throttle < 0.05) {
    gear = 1;
    rpm = 1150;
  }

  // Slip angle magnitude for drift dust & tire audio
  const slipAngle =
    speedAbs > 3 ? Math.min(1, Math.abs(finalLateral) / Math.max(4, speedAbs * 0.45)) : 0;

  // Suspension pitch & roll
  const targetPitch = Math.max(-0.06, Math.min(0.06, -accelForward * 0.0018));
  const targetRoll = Math.max(-0.09, Math.min(0.09, angularVel * 0.032));
  const bodyPitch = state.bodyPitch + (targetPitch - state.bodyPitch) * (1 - Math.exp(-10 * dt));
  const bodyRoll = state.bodyRoll + (targetRoll - state.bodyRoll) * (1 - Math.exp(-10 * dt));

  // Monotonic 3-sector lap tracking
  let sectorMask = state.sectorMask;
  if (proj.progress >= 0.15 && proj.progress < 0.45) sectorMask |= 1;
  if (proj.progress >= 0.45 && proj.progress < 0.78 && (sectorMask & 1)) sectorMask |= 2;
  if (proj.progress >= 0.78 && (sectorMask & 2)) sectorMask |= 4;

  let lap = state.lap;
  let completedLap = false;
  if (state.progress > 0.85 && proj.progress < 0.15 && sectorMask === 7) {
    lap += 1;
    sectorMask = 0;
    completedLap = true;
  }

  const totalProgress = (lap - 1) + proj.progress;
  const y = track.groundHeightAt(x, z);

  return {
    state: {
      x,
      y,
      z,
      heading,
      vx,
      vz,
      angularVel,
      speed: finalForward,
      rpm,
      gear,
      steerAngle,
      slipAngle,
      bodyPitch,
      bodyRoll,
      wheelRotation: state.wheelRotation + finalForward * dt * 2.6,
      surface: proj.surface,
      sampleIndex: proj.sampleIndex,
      progress: proj.progress,
      sectorMask,
      lap,
      totalProgress,
      topSpeedKmh: Math.max(state.topSpeedKmh, speedKmh),
      hitWallCooldown,
      lastImpactStrength: wallHitStrength,
    },
    proj,
    event: {
      wallHitStrength,
      completedLap,
    },
  };
}

export function stepAiVehicle(
  state: VehicleState,
  track: RallyTrack,
  dt: number,
  targetLaneOffset: number,
  paceMultiplier: number
): VehicleState {
  const proj = track.project(state.x, state.z, state.sampleIndex);
  const lookAheadProgress = (proj.progress + 0.035) % 1;
  const targetSample = track.sampleAtProgress(lookAheadProgress);
  const tx = targetSample.x + targetSample.nx * targetLaneOffset;
  const tz = targetSample.z + targetSample.nz * targetLaneOffset;

  const desiredHeading = Math.atan2(tx - state.x, tz - state.z);
  const headingError = Math.atan2(
    Math.sin(desiredHeading - state.heading),
    Math.cos(desiredHeading - state.heading)
  );

  // Remember: steer > 0 turns right (decreases heading), steer < 0 turns left (increases heading)
  const steer = Math.max(-1, Math.min(1, -headingError * 1.85));

  // Modulate throttle around sharp corners
  const sharpTurn = Math.abs(targetSample.curvature) > 0.024;
  const throttle = (sharpTurn ? 0.62 : 0.92) * paceMultiplier;
  const brake = sharpTurn && state.speed > 23 ? 0.45 : 0;

  const res = stepVehiclePhysics(
    state,
    {
      throttle,
      brake,
      steer,
      handbrake: false,
    },
    track,
    dt
  );
  return res.state;
}
