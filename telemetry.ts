import type {
  GhostData,
  GhostFrame,
  MapId,
  RunRecording,
  TelemetryRivalSample,
  TelemetrySample,
} from './types';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

const GHOST_STORAGE_PREFIX = 'apex_ghost_v1';

export function getGhostStorageKey(mapId: MapId, totalLaps: number): string {
  return `${GHOST_STORAGE_PREFIX}_${mapId}_${Math.max(1, Math.round(totalLaps))}L`;
}

export function lerpNumber(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

/**
 * Shortest-arc angular interpolation (handles -pi..pi wraparound cleanly).
 */
export function lerpAngle(a: number, b: number, alpha: number): number {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * alpha;
}

function findFrameBracket<T extends { t: number }>(
  frames: readonly T[],
  timeMs: number
): { idx0: number; idx1: number; alpha: number } {
  const lastIdx = frames.length - 1;
  if (timeMs <= frames[0].t) {
    return { idx0: 0, idx1: 0, alpha: 0 };
  }
  if (timeMs >= frames[lastIdx].t) {
    return { idx0: lastIdx, idx1: lastIdx, alpha: 0 };
  }

  let lo = 0;
  let hi = lastIdx;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= timeMs) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const f0 = frames[lo];
  const f1 = frames[hi];
  const span = f1.t - f0.t;
  const alpha = span > 0.0001 ? Math.max(0, Math.min(1, (timeMs - f0.t) / span)) : 0;
  return { idx0: lo, idx1: hi, alpha };
}

export function sampleGhostAtTime(
  frames: readonly GhostFrame[],
  timeMs: number
): GhostFrame | null {
  if (frames.length === 0) return null;
  const { idx0, idx1, alpha } = findFrameBracket(frames, timeMs);
  if (idx0 === idx1 || alpha <= 0) {
    return frames[idx0];
  }

  const a = frames[idx0];
  const b = frames[idx1];
  return {
    t: lerpNumber(a.t, b.t, alpha),
    x: lerpNumber(a.x, b.x, alpha),
    y: lerpNumber(a.y, b.y, alpha),
    z: lerpNumber(a.z, b.z, alpha),
    heading: lerpAngle(a.heading, b.heading, alpha),
    pitch: lerpNumber(a.pitch, b.pitch, alpha),
    roll: lerpNumber(a.roll, b.roll, alpha),
    steer: lerpNumber(a.steer, b.steer, alpha),
    wheelRot: lerpNumber(a.wheelRot, b.wheelRot, alpha),
    totalProgress: lerpNumber(a.totalProgress, b.totalProgress, alpha),
  };
}

export function sampleRunAtTime(
  frames: readonly TelemetrySample[],
  timeMs: number
): TelemetrySample | null {
  if (frames.length === 0) return null;
  const { idx0, idx1, alpha } = findFrameBracket(frames, timeMs);
  if (idx0 === idx1 || alpha <= 0) {
    return frames[idx0];
  }

  const a = frames[idx0];
  const b = frames[idx1];

  const rivals: TelemetryRivalSample[] = [];
  const rivalCount = Math.min(a.rivals.length, b.rivals.length);
  for (let i = 0; i < rivalCount; i++) {
    const ra = a.rivals[i];
    const rb = b.rivals[i];
    rivals.push({
      x: lerpNumber(ra.x, rb.x, alpha),
      y: lerpNumber(ra.y, rb.y, alpha),
      z: lerpNumber(ra.z, rb.z, alpha),
      heading: lerpAngle(ra.heading, rb.heading, alpha),
      pitch: lerpNumber(ra.pitch, rb.pitch, alpha),
      roll: lerpNumber(ra.roll, rb.roll, alpha),
      steer: lerpNumber(ra.steer, rb.steer, alpha),
      wheelRot: lerpNumber(ra.wheelRot, rb.wheelRot, alpha),
    });
  }

  const snap = alpha < 0.5 ? a : b;

  return {
    t: lerpNumber(a.t, b.t, alpha),
    x: lerpNumber(a.x, b.x, alpha),
    y: lerpNumber(a.y, b.y, alpha),
    z: lerpNumber(a.z, b.z, alpha),
    heading: lerpAngle(a.heading, b.heading, alpha),
    pitch: lerpNumber(a.pitch, b.pitch, alpha),
    roll: lerpNumber(a.roll, b.roll, alpha),
    steer: lerpNumber(a.steer, b.steer, alpha),
    wheelRot: lerpNumber(a.wheelRot, b.wheelRot, alpha),
    speedKmh: Math.round(lerpNumber(a.speedKmh, b.speedKmh, alpha)),
    rpm: Math.round(lerpNumber(a.rpm, b.rpm, alpha)),
    gear: snap.gear,
    lap: snap.lap,
    progress: snap.progress,
    totalProgress: lerpNumber(a.totalProgress, b.totalProgress, alpha),
    brakeStrength: lerpNumber(a.brakeStrength, b.brakeStrength, alpha),
    surface: snap.surface,
    rivals,
  };
}

/**
 * Returns playerElapsedMs - ghostTimeAtSameProgress (negative = faster / ahead of PB).
 */
export function computeGhostDeltaMs(
  frames: readonly GhostFrame[],
  playerTotalProgress: number,
  playerElapsedMs: number
): number | null {
  if (frames.length < 2) return null;
  if (!Number.isFinite(playerTotalProgress) || !Number.isFinite(playerElapsedMs)) {
    return null;
  }

  const first = frames[0];
  const last = frames[frames.length - 1];

  if (playerTotalProgress <= first.totalProgress) {
    return Math.round(playerElapsedMs - first.t);
  }
  if (playerTotalProgress >= last.totalProgress) {
    return Math.round(playerElapsedMs - last.t);
  }

  let lo = 0;
  let hi = frames.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].totalProgress <= playerTotalProgress) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const f0 = frames[lo];
  const f1 = frames[hi];
  const span = f1.totalProgress - f0.totalProgress;
  const alpha =
    span > 0.00001
      ? Math.max(0, Math.min(1, (playerTotalProgress - f0.totalProgress) / span))
      : 0;
  const ghostTimeAtProgress = lerpNumber(f0.t, f1.t, alpha);
  return Math.round(playerElapsedMs - ghostTimeAtProgress);
}

export function formatDeltaSeconds(deltaMs: number): string {
  const sign = deltaMs > 0 ? '+' : deltaMs < 0 ? '-' : '';
  const absSec = Math.abs(deltaMs) / 1000;
  return `${sign}${absSec.toFixed(2)}s`;
}

export function buildGhostDataFromRun(
  recording: RunRecording,
  recordedAt = Date.now(),
  minStepMs = 60
): GhostData | null {
  if (recording.frames.length < 2) return null;

  const compact: GhostFrame[] = [];
  let maxProgress = 0;
  let lastT = -Infinity;

  for (let i = 0; i < recording.frames.length; i++) {
    const f = recording.frames[i];
    const isLast = i === recording.frames.length - 1;
    if (!isLast && i > 0 && f.t - lastT < minStepMs) {
      continue;
    }
    maxProgress = Math.max(maxProgress, f.totalProgress);
    lastT = f.t;
    compact.push({
      t: Math.round(f.t),
      x: Number(f.x.toFixed(3)),
      y: Number(f.y.toFixed(3)),
      z: Number(f.z.toFixed(3)),
      heading: Number(f.heading.toFixed(4)),
      pitch: Number(f.pitch.toFixed(3)),
      roll: Number(f.roll.toFixed(3)),
      steer: Number(f.steer.toFixed(3)),
      wheelRot: Number(f.wheelRot.toFixed(3)),
      totalProgress: Number(maxProgress.toFixed(5)),
    });
  }

  if (compact.length < 2) return null;

  return {
    version: 1,
    mapId: recording.mapId,
    totalLaps: recording.totalLaps,
    totalTimeMs: Math.round(recording.totalTimeMs),
    bestLapMs: recording.bestLapMs !== null ? Math.round(recording.bestLapMs) : null,
    recordedAt,
    frames: compact,
  };
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function isValidGhostData(value: unknown): value is GhostData {
  if (!value || typeof value !== 'object') return false;
  const g = value as Partial<GhostData>;
  if (
    g.version !== 1 ||
    (g.mapId !== 'alpine' && g.mapId !== 'city') ||
    typeof g.totalLaps !== 'number' ||
    typeof g.totalTimeMs !== 'number' ||
    !Array.isArray(g.frames) ||
    g.frames.length < 2
  ) {
    return false;
  }
  const first = g.frames[0] as Partial<GhostFrame>;
  return (
    typeof first?.t === 'number' &&
    typeof first?.x === 'number' &&
    typeof first?.y === 'number' &&
    typeof first?.z === 'number' &&
    typeof first?.heading === 'number' &&
    typeof first?.totalProgress === 'number'
  );
}

export function loadGhostForStage(
  mapId: MapId,
  totalLaps: number,
  storage: StorageLike | null = getDefaultStorage()
): GhostData | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(getGhostStorageKey(mapId, totalLaps));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidGhostData(parsed) && parsed.mapId === mapId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBestGhostIfFaster(
  recording: RunRecording,
  storage: StorageLike | null = getDefaultStorage()
): { updated: boolean; ghost: GhostData | null } {
  const existing = loadGhostForStage(recording.mapId, recording.totalLaps, storage);
  if (existing && recording.totalTimeMs >= existing.totalTimeMs) {
    return { updated: false, ghost: existing };
  }

  const candidate = buildGhostDataFromRun(recording);
  if (!candidate) {
    return { updated: false, ghost: existing };
  }

  if (storage) {
    try {
      storage.setItem(
        getGhostStorageKey(recording.mapId, recording.totalLaps),
        JSON.stringify(candidate)
      );
    } catch {
      // Ignore quota errors while keeping in-memory ghost active
    }
  }

  return { updated: true, ghost: candidate };
}
