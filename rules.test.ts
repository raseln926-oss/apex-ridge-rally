import test from 'node:test';
import assert from 'node:assert/strict';
import { createRallyTrack } from './track';
import { createInitialVehicleState, stepVehiclePhysics, stepAiVehicle } from './physics';

test('rally track forms a smooth closed loop with both asphalt and gravel sectors', () => {
  const track = createRallyTrack(480);
  assert.ok(track.totalLength > 400, `Expected track length > 400m, got ${track.totalLength}`);

  const first = track.samples[0];
  const last = track.samples[track.samples.length - 1];
  const closureGap = Math.hypot(first.x - last.x, first.z - last.z);
  assert.ok(closureGap < 4.0, `Closure gap too large: ${closureGap}`);

  const surfaces = new Set(track.samples.map((s) => s.surface));
  assert.ok(surfaces.has('asphalt'));
  assert.ok(surfaces.has('gravel'));
});

test('groundHeightAt matches roadbed elevation along centerline', () => {
  const track = createRallyTrack();
  for (let i = 0; i < track.samples.length; i += 24) {
    const s = track.samples[i];
    const h = track.groundHeightAt(s.x, s.z);
    assert.ok(Math.abs(h - s.y) < 0.05, `Sample ${i} height mismatch: ${h} vs ${s.y}`);
  }
});

test('vehicle accelerates, shifts gears, and steers in the expected direction', () => {
  const track = createRallyTrack();
  let car = createInitialVehicleState(track, 0.04, 0);

  // Accelerate straight for 3 seconds
  for (let i = 0; i < 90; i++) {
    car = stepVehiclePhysics(car, { throttle: 1, brake: 0, steer: 0, handbrake: false }, track, 1 / 30).state;
  }

  assert.ok(car.speed > 20, `Expected forward speed > 20 m/s, got ${car.speed}`);
  assert.ok(car.gear >= 2, `Expected upshift to gear >= 2, got ${car.gear}`);

  // Steer right (+1) should decrease heading (turn toward -X from +Z)
  const headingBefore = car.heading;
  for (let i = 0; i < 15; i++) {
    car = stepVehiclePhysics(car, { throttle: 1, brake: 0, steer: 1, handbrake: false }, track, 1 / 30).state;
  }
  assert.ok(car.heading < headingBefore, 'Steering right must decrease heading');
});

test('handbrake induces lateral drift slip and guardrail clamps lateral offset', () => {
  const track = createRallyTrack();
  let car = createInitialVehicleState(track, 0.04, 0);

  for (let i = 0; i < 60; i++) {
    car = stepVehiclePhysics(car, { throttle: 1, brake: 0, steer: 0, handbrake: false }, track, 1 / 30).state;
  }

  // Induce drift with handbrake + steering
  for (let i = 0; i < 18; i++) {
    car = stepVehiclePhysics(car, { throttle: 0.8, brake: 0, steer: 1, handbrake: true }, track, 1 / 30).state;
  }
  assert.ok(car.slipAngle > 0.05, `Expected slipAngle > 0.05 during handbrake turn, got ${car.slipAngle}`);

  // Start near the right edge angled outward to verify guardrail collision impulse
  let wallCar = createInitialVehicleState(track, 0.04, 5.2);
  wallCar.heading -= 0.45;
  let wallEvent = 0;
  for (let i = 0; i < 60; i++) {
    const res = stepVehiclePhysics(wallCar, { throttle: 1, brake: 0, steer: 0, handbrake: false }, track, 1 / 30);
    wallCar = res.state;
    if (res.event.wallHitStrength > 0) wallEvent++;
  }
  const proj = track.project(wallCar.x, wallCar.z, wallCar.sampleIndex);
  assert.ok(Math.abs(proj.lateralOffset) <= proj.halfWidth + 1.65, `Lateral offset exceeded barrier: ${proj.lateralOffset}`);
  assert.ok(wallEvent > 0, 'Expected at least one guardrail collision impulse');
});

test('AI rival completes a full monotonic lap around the circuit', () => {
  const track = createRallyTrack();
  let ai = createInitialVehicleState(track, 0.02, -2.5);
  let completed = false;

  // Simulate up to 40 seconds at 30Hz
  for (let i = 0; i < 1200; i++) {
    ai = stepAiVehicle(ai, track, 1 / 30, -1.5, 1.0);
    if (ai.lap >= 2) {
      completed = true;
      break;
    }
  }
  assert.equal(completed, true, `AI failed to complete a lap, progress=${ai.totalProgress.toFixed(2)}`);
});

test('city GP track forms a closed 100% tarmac street circuit and AI completes a lap', () => {
  const city = createRallyTrack(480, 'city');
  assert.equal(city.mapId, 'city');
  assert.ok(city.totalLength > 400, `Expected city track length > 400m, got ${city.totalLength}`);

  const first = city.samples[0];
  const last = city.samples[city.samples.length - 1];
  assert.ok(Math.hypot(first.x - last.x, first.z - last.z) < 4.0);

  const surfaces = new Set(city.samples.map((s) => s.surface));
  assert.equal(surfaces.size, 1);
  assert.ok(surfaces.has('asphalt'));
  assert.ok(first.halfWidth > 6.0, 'City circuit should have wide racing street width');

  for (let i = 0; i < city.samples.length; i += 24) {
    const s = city.samples[i];
    const h = city.groundHeightAt(s.x, s.z);
    assert.ok(Math.abs(h - s.y) < 0.05, `City sample ${i} height mismatch: ${h} vs ${s.y}`);
  }

  let ai = createInitialVehicleState(city, 0.02, -2.0);
  let completed = false;
  for (let i = 0; i < 1200; i++) {
    ai = stepAiVehicle(ai, city, 1 / 30, -1.5, 1.0);
    if (ai.lap >= 2) {
      completed = true;
      break;
    }
  }
  assert.equal(completed, true, `AI failed to complete a lap on city circuit, progress=${ai.totalProgress.toFixed(2)}`);
});
