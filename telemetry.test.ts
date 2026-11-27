import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGhostDataFromRun,
  computeGhostDeltaMs,
  formatDeltaSeconds,
  loadGhostForStage,
  lerpAngle,
  sampleGhostAtTime,
  sampleRunAtTime,
  saveBestGhostIfFaster,
  type StorageLike,
} from './telemetry';
import type { GhostFrame, RunRecording, TelemetrySample } from './types';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => {
      map.set(key, val);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test('lerpAngle takes shortest arc across -pi/pi boundary', () => {
  const a = Math.PI - 0.1;
  const b = -Math.PI + 0.1;
  const mid = lerpAngle(a, b, 0.5);
  // Midpoint between (pi - 0.1) and (-pi + 0.1) should cross pi (~3.14159)
  assert.ok(Math.abs(Math.abs(mid) - Math.PI) < 0.01);

  const reverseMid = lerpAngle(b, a, 0.5);
  assert.ok(Math.abs(Math.abs(reverseMid) - Math.PI) < 0.01);
});

test('sampleGhostAtTime clamps and interpolates position and heading accurately', () => {
  const frames: GhostFrame[] = [
    {
      t: 0,
      x: 0,
      y: 1,
      z: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      steer: 0,
      wheelRot: 0,
      totalProgress: 0,
    },
    {
      t: 1000,
      x: 20,
      y: 3,
      z: 40,
      heading: 1.0,
      pitch: 0.04,
      roll: -0.04,
      steer: 0.2,
      wheelRot: 10,
      totalProgress: 0.5,
    },
  ];

  assert.equal(sampleGhostAtTime([], 500), null);
  assert.equal(sampleGhostAtTime(frames, -100)?.x, 0);
  assert.equal(sampleGhostAtTime(frames, 2500)?.x, 20);

  const mid = sampleGhostAtTime(frames, 500);
  assert.ok(mid);
  assert.equal(mid.x, 10);
  assert.equal(mid.y, 2);
  assert.equal(mid.z, 20);
  assert.ok(Math.abs(mid.heading - 0.5) < 1e-6);
  assert.equal(mid.totalProgress, 0.25);
});

test('sampleRunAtTime interpolates player telemetry and rival poses smoothly', () => {
  const frames: TelemetrySample[] = [
    {
      t: 0,
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      steer: 0,
      wheelRot: 0,
      speedKmh: 0,
      rpm: 1200,
      gear: 1,
      lap: 1,
      progress: 0.02,
      totalProgress: 0.02,
      brakeStrength: 0,
      surface: 'asphalt',
      rivals: [{ x: 2, y: 0, z: 4, heading: 0, pitch: 0, roll: 0, steer: 0, wheelRot: 0 }],
    },
    {
      t: 1000,
      x: 10,
      y: 0,
      z: 30,
      heading: 0.4,
      pitch: 0,
      roll: 0,
      steer: -0.1,
      wheelRot: 12,
      speedKmh: 100,
      rpm: 6200,
      gear: 3,
      lap: 1,
      progress: 0.12,
      totalProgress: 0.12,
      brakeStrength: 1,
      surface: 'gravel',
      rivals: [{ x: 6, y: 0, z: 24, heading: 0.2, pitch: 0, roll: 0, steer: 0, wheelRot: 8 }],
    },
  ];

  const sampled = sampleRunAtTime(frames, 250);
  assert.ok(sampled);
  assert.equal(sampled.speedKmh, 25);
  assert.equal(sampled.rpm, 2450);
  assert.equal(sampled.rivals.length, 1);
  assert.equal(sampled.rivals[0].x, 3);
  assert.equal(sampled.rivals[0].z, 9);
});

test('computeGhostDeltaMs measures ahead (negative) and behind (positive) splits accurately', () => {
  const ghost: GhostFrame[] = [
    { t: 0, x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, steer: 0, wheelRot: 0, totalProgress: 0 },
    { t: 10000, x: 0, y: 0, z: 100, heading: 0, pitch: 0, roll: 0, steer: 0, wheelRot: 0, totalProgress: 1 },
    { t: 20000, x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, steer: 0, wheelRot: 0, totalProgress: 2 },
  ];

  // Ghost was at progress 1.0 at 10000ms. Player reached progress 1.0 at 9550ms -> -450ms (ahead!)
  assert.equal(computeGhostDeltaMs(ghost, 1.0, 9550), -450);
  // Player reached progress 1.5 at 15420ms -> +420ms (behind!)
  assert.equal(computeGhostDeltaMs(ghost, 1.5, 15420), 420);
  assert.equal(formatDeltaSeconds(-450), '-0.45s');
  assert.equal(formatDeltaSeconds(420), '+0.42s');
});

test('saveBestGhostIfFaster stores PB ghost in storage and only overwrites when faster', () => {
  const storage = createMemoryStorage();
  const makeRun = (totalTimeMs: number, mapId: 'alpine' | 'city' = 'alpine'): RunRecording => ({
    mapId,
    mode: 'race',
    totalLaps: 2,
    totalTimeMs,
    bestLapMs: Math.round(totalTimeMs / 2),
    frames: [
      {
        t: 0,
        x: 0,
        y: 0,
        z: 0,
        heading: 0,
        pitch: 0,
        roll: 0,
        steer: 0,
        wheelRot: 0,
        speedKmh: 0,
        rpm: 1150,
        gear: 1,
        lap: 1,
        progress: 0.02,
        totalProgress: 0.02,
        brakeStrength: 0,
        surface: 'asphalt',
        rivals: [],
      },
      {
        t: totalTimeMs,
        x: 5,
        y: 0,
        z: 10,
        heading: 0.1,
        pitch: 0,
        roll: 0,
        steer: 0,
        wheelRot: 40,
        speedKmh: 120,
        rpm: 6500,
        gear: 4,
        lap: 2,
        progress: 0.04,
        totalProgress: 2.04,
        brakeStrength: 0,
        surface: 'asphalt',
        rivals: [],
      },
    ],
  });

  const first = saveBestGhostIfFaster(makeRun(38500), storage);
  assert.equal(first.updated, true);
  assert.equal(first.ghost?.totalTimeMs, 38500);

  // Slower run should NOT overwrite PB ghost
  const slower = saveBestGhostIfFaster(makeRun(41200), storage);
  assert.equal(slower.updated, false);
  assert.equal(slower.ghost?.totalTimeMs, 38500);

  // Faster run SHOULD overwrite PB ghost
  const faster = saveBestGhostIfFaster(makeRun(36200), storage);
  assert.equal(faster.updated, true);
  assert.equal(faster.ghost?.totalTimeMs, 36200);

  const loaded = loadGhostForStage('alpine', 2, storage);
  assert.equal(loaded?.totalTimeMs, 36200);
  assert.equal(loadGhostForStage('city', 2, storage), null);
  assert.ok(buildGhostDataFromRun(makeRun(35000)));
});
