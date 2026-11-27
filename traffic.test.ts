import test from 'node:test';
import assert from 'node:assert/strict';
import { createRallyTrack } from './track';
import {
  createRoadObstacles,
  createTrafficCars,
  stepTrafficAndObstacles,
} from './traffic';

test('createTrafficCars and createRoadObstacles keep starting grid unobstructed', () => {
  const track = createRallyTrack(480, 'city');
  const cars = createTrafficCars(track, 6);
  const obstacles = createRoadObstacles(track, 12);

  assert.equal(cars.length, 6);
  assert.equal(obstacles.length, 12);

  for (const car of cars) {
    assert.ok(car.progress >= 0.12 && car.progress <= 0.96);
  }
  for (const obs of obstacles) {
    assert.ok(obs.progress >= 0.11 && obs.progress <= 0.95);
  }
});

test('stepTrafficAndObstacles awards overtake points on clean high-speed pass and resets combo on hit', () => {
  const track = createRallyTrack(480, 'alpine');
  const cars = createTrafficCars(track, 2);
  const obstacles = createRoadObstacles(track, 2);

  // Place car[0] 4m laterally aside from player moving at 22 m/s (near miss)
  const target = cars[0];
  const nearRes = stepTrafficAndObstacles(
    track,
    cars,
    obstacles,
    {
      x: target.x + 3.6,
      y: target.y,
      z: target.z,
      vx: 0,
      vz: 22,
      speed: 22,
    },
    1,
    0.05
  );

  assert.equal(nearRes.overtakesDelta, 1);
  assert.equal(nearRes.combo, 2);
  assert.ok(nearRes.scoreDelta >= 150);

  // Direct hit on car[1] resets combo and reports collision strength
  const hitTarget = cars[1];
  const hitRes = stepTrafficAndObstacles(
    track,
    cars,
    obstacles,
    {
      x: hitTarget.x + 0.4,
      y: hitTarget.y,
      z: hitTarget.z + 0.4,
      vx: 0,
      vz: 18,
      speed: 18,
    },
    3,
    0.05
  );

  assert.equal(hitRes.combo, 1);
  assert.ok(hitRes.hitStrength >= 0.5);
});
