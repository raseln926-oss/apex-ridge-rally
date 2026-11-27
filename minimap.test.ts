import test from 'node:test';
import assert from 'node:assert/strict';
import { createRallyTrack } from './track';
import {
  buildMinimapGeometry,
  computeStageSummary,
  headingToMinimapDeg,
  worldToMinimap,
} from './minimap';

test('minimap geometry bounds fit all track samples within [8, 92] SVG viewport', () => {
  const track = createRallyTrack(480);
  const geo = buildMinimapGeometry(track);

  assert.ok(geo.fullPathD.startsWith('M') && geo.fullPathD.endsWith('Z'));
  assert.ok(geo.gravelPathD.startsWith('M'), 'Gravel sector path must be present');

  for (const s of track.samples) {
    const p = worldToMinimap(s.x, s.z, geo.bounds);
    assert.ok(p.x >= 9.9 && p.x <= 90.1, `Mapped X out of padded bounds: ${p.x}`);
    assert.ok(p.y >= 9.9 && p.y <= 90.1, `Mapped Y out of padded bounds: ${p.y}`);
  }
});

test('minimap orientation maps +Z forward to UP and -X right turn to RIGHT', () => {
  const track = createRallyTrack(480);
  const geo = buildMinimapGeometry(track);

  const p0 = worldToMinimap(0, 0, geo.bounds);
  const pForwardZ = worldToMinimap(0, 10, geo.bounds);
  const pRightMinusX = worldToMinimap(-10, 0, geo.bounds);

  assert.ok(pForwardZ.y < p0.y, '+Z world forward must move UP (-Y) on mini-map');
  assert.ok(pRightMinusX.x > p0.x, '-X world right turn must move RIGHT (+X) on mini-map');
  assert.equal(headingToMinimapDeg(0), 0);
  assert.equal(Math.round(headingToMinimapDeg(-Math.PI / 2)), 90);
});

test('computeStageSummary returns realistic lap length, multi-lap km, and surface mix', () => {
  const track = createRallyTrack(480);
  const twoLap = computeStageSummary(track, 2);
  const threeLap = computeStageSummary(track, 3);

  assert.ok(twoLap.lapLengthMeters > 400);
  assert.ok(Number(threeLap.totalDistanceKm) > Number(twoLap.totalDistanceKm));
  assert.ok(twoLap.gravelPercent > 0 && twoLap.gravelPercent < 100);
  assert.ok(twoLap.elevationRangeMeters > 0);
});

test('city GP minimap geometry fits viewport cleanly with 100% tarmac summary', () => {
  const cityTrack = createRallyTrack(480, 'city');
  const geo = buildMinimapGeometry(cityTrack);
  const summary = computeStageSummary(cityTrack, 2);

  assert.ok(geo.fullPathD.startsWith('M') && geo.fullPathD.endsWith('Z'));
  assert.equal(geo.gravelPathD, '');
  assert.equal(summary.gravelPercent, 0);
  assert.ok(summary.lapLengthMeters > 400);

  for (const s of cityTrack.samples) {
    const p = worldToMinimap(s.x, s.z, geo.bounds);
    assert.ok(p.x >= 9.9 && p.x <= 90.1, `City X out of padded bounds: ${p.x}`);
    assert.ok(p.y >= 9.9 && p.y <= 90.1, `City Y out of padded bounds: ${p.y}`);
  }
});
