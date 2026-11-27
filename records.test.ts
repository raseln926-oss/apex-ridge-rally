import test from 'node:test';
import assert from 'node:assert/strict';

function sanitizeDriverName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Apex Driver';
  return trimmed.slice(0, 40);
}

function clampStagePayload(
  uid: string,
  rawName: string | null | undefined,
  result: {
    mode: 'race' | 'time_trial';
    totalLaps: number;
    position: number;
    totalTimeMs: number;
    bestLapMs: number | null;
    topSpeedKmh: number;
  }
) {
  const driverName = sanitizeDriverName(rawName);
  const mode = result.mode === 'time_trial' ? 'time_trial' : 'race';
  const totalLaps = result.totalLaps === 3 ? 3 : 2;
  const position = Math.max(1, Math.min(3, Math.round(result.position)));
  const totalTimeMs = Math.max(1000, Math.min(3600000, Math.round(result.totalTimeMs)));
  const bestLapRaw = result.bestLapMs ?? Math.round(totalTimeMs / totalLaps);
  const bestLapMs = Math.max(1000, Math.min(1800000, Math.round(bestLapRaw)));
  const topSpeedKmh = Math.max(1, Math.min(400, Math.round(result.topSpeedKmh)));

  return {
    ownerUid: uid,
    driverName,
    mode,
    totalLaps,
    position,
    totalTimeMs,
    bestLapMs,
    topSpeedKmh,
  };
}

test('driver name sanitization bounds length to 40 chars and falls back safely', () => {
  assert.equal(sanitizeDriverName('   '), 'Apex Driver');
  assert.equal(sanitizeDriverName(null), 'Apex Driver');
  const longName = 'A'.repeat(65);
  assert.equal(sanitizeDriverName(longName).length, 40);
});

test('stage payload clamping enforces Firestore blueprint ranges', () => {
  const out = clampStagePayload('uid_123', '  Sébastien   Loeb ', {
    mode: 'race',
    totalLaps: 5,
    position: 9,
    totalTimeMs: 250,
    bestLapMs: null,
    topSpeedKmh: 999,
  });

  assert.equal(out.driverName, 'Sébastien Loeb');
  assert.equal(out.totalLaps, 2);
  assert.equal(out.position, 3);
  assert.equal(out.totalTimeMs, 1000);
  assert.equal(out.bestLapMs, 1000);
  assert.equal(out.topSpeedKmh, 400);
});
