import type { MapId, PaceNote, SurfaceType } from './types';

export interface TrackSample {
  index: number;
  x: number;
  y: number;
  z: number;
  tx: number; // unit tangent X
  tz: number; // unit tangent Z
  nx: number; // unit right normal X
  nz: number; // unit right normal Z
  distance: number; // cumulative meters along track
  progress: number; // 0..1
  halfWidth: number;
  surface: 'asphalt' | 'gravel';
  curvature: number; // signed curvature (+ = right turn, - = left turn)
}

export interface TrackProjection {
  sampleIndex: number;
  progress: number;
  distanceAlong: number;
  lateralOffset: number; // signed distance from centerline (+ = right, - = left)
  elevation: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  halfWidth: number;
  surface: SurfaceType;
  paceNote: PaceNote | null;
}

export interface RallyTrack {
  mapId: MapId;
  center: { x: number; z: number };
  samples: TrackSample[];
  totalLength: number;
  project: (x: number, z: number, hintIdx?: number) => TrackProjection;
  sampleAtProgress: (progress: number) => TrackSample;
  groundHeightAt: (x: number, z: number) => number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const ALPINE_CONTROL_POINTS: Vec3[] = [
  { x: 0, y: 1.0, z: -85 },
  { x: 0, y: 1.0, z: -38 },
  { x: 0, y: 1.0, z: 18 },
  { x: -18, y: 2.3, z: 60 },
  { x: -60, y: 4.8, z: 74 },
  { x: -96, y: 7.5, z: 42 },
  { x: -88, y: 9.2, z: -8 },
  { x: -45, y: 6.6, z: -20 },
  { x: -72, y: 4.4, z: -62 },
  { x: -48, y: 2.3, z: -104 },
  { x: -10, y: 1.2, z: -106 },
];

const CITY_CONTROL_POINTS: Vec3[] = [
  { x: 0, y: 1.0, z: -86 },
  { x: 0, y: 1.0, z: -26 },
  { x: 0, y: 1.0, z: 36 },
  { x: -24, y: 1.0, z: 68 },
  { x: -74, y: 1.5, z: 72 },
  { x: -104, y: 2.5, z: 40 },
  { x: -86, y: 2.8, z: 4 },
  { x: -112, y: 2.1, z: -34 },
  { x: -92, y: 1.3, z: -78 },
  { x: -56, y: 1.0, z: -102 },
  { x: -16, y: 1.0, z: -106 },
];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function evalClosedSpline(points: Vec3[], t: number): Vec3 {
  const n = points.length;
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * n;
  const i1 = Math.floor(scaled) % n;
  const localT = scaled - Math.floor(scaled);
  const i0 = (i1 - 1 + n) % n;
  const i2 = (i1 + 1) % n;
  const i3 = (i1 + 2) % n;

  const p0 = points[i0];
  const p1 = points[i1];
  const p2 = points[i2];
  const p3 = points[i3];

  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, localT),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, localT),
    z: catmullRom(p0.z, p1.z, p2.z, p3.z, localT),
  };
}

function computePaceNote(samples: TrackSample[], idx: number, mapId: MapId): PaceNote | null {
  const count = samples.length;
  const current = samples[idx];
  // Look ahead 12..42 samples (~15..55m) for upcoming peak curvature or surface switch
  let maxAbsCurv = 0;
  let signedCurv = 0;
  let gravelSoon = false;

  for (let offset = 12; offset <= 42; offset++) {
    const s = samples[(idx + offset) % count];
    if (Math.abs(s.curvature) > maxAbsCurv) {
      maxAbsCurv = Math.abs(s.curvature);
      signedCurv = s.curvature;
    }
    if (current.surface === 'asphalt' && s.surface === 'gravel' && offset < 28) {
      gravelSoon = true;
    }
  }

  if (maxAbsCurv > 0.036) {
    const dir = signedCurv > 0 ? 'right' : 'left';
    return {
      label: dir === 'right' ? 'HAIRPIN RIGHT' : 'HAIRPIN LEFT',
      severity: 'sharp',
      direction: dir,
    };
  }
  if (maxAbsCurv > 0.021) {
    const dir = signedCurv > 0 ? 'right' : 'left';
    if (mapId === 'city') {
      return {
        label: dir === 'right' ? '90° RIGHT' : '90° LEFT',
        severity: 'warn',
        direction: dir,
      };
    }
    return {
      label: dir === 'right' ? '3 RIGHT' : '3 LEFT',
      severity: 'warn',
      direction: dir,
    };
  }
  if (gravelSoon) {
    return {
      label: 'GRAVEL SECTOR',
      severity: 'info',
      direction: 'straight',
    };
  }
  if (maxAbsCurv > 0.011) {
    const dir = signedCurv > 0 ? 'right' : 'left';
    return {
      label:
        mapId === 'city'
          ? dir === 'right'
            ? 'SWEEP RIGHT'
            : 'SWEEP LEFT'
          : dir === 'right'
          ? '5 RIGHT'
          : '5 LEFT',
      severity: 'info',
      direction: dir,
    };
  }
  return null;
}

export function createRallyTrack(sampleCount = 480, mapId: MapId = 'alpine'): RallyTrack {
  const controlPoints = mapId === 'city' ? CITY_CONTROL_POINTS : ALPINE_CONTROL_POINTS;
  const rawPoints: Vec3[] = [];
  for (let i = 0; i < sampleCount; i++) {
    rawPoints.push(evalClosedSpline(controlPoints, i / sampleCount));
  }

  const samples: TrackSample[] = [];
  let cumulativeDist = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < sampleCount; i++) {
    const prev = rawPoints[(i - 1 + sampleCount) % sampleCount];
    const curr = rawPoints[i];
    const next = rawPoints[(i + 1) % sampleCount];

    if (curr.x < minX) minX = curr.x;
    if (curr.x > maxX) maxX = curr.x;
    if (curr.z < minZ) minZ = curr.z;
    if (curr.z > maxZ) maxZ = curr.z;

    if (i > 0) {
      const dx = curr.x - prev.x;
      const dz = curr.z - prev.z;
      cumulativeDist += Math.hypot(dx, dz);
    }

    const vx = next.x - prev.x;
    const vz = next.z - prev.z;
    const len = Math.hypot(vx, vz) || 1;
    const tx = vx / len;
    const tz = vz / len;

    // Right-hand normal when looking along (tx, tz) with +Y up:
    // forward x up = (tx, 0, tz) x (0, 1, 0) = (-tz, 0, tx)
    const nx = -tz;
    const nz = tx;

    const progress = i / sampleCount;
    // Alpine has gravel rally sector (progress 0.34 .. 0.74); City Street GP is 100% tarmac
    const surface: 'asphalt' | 'gravel' =
      mapId === 'alpine' && progress >= 0.34 && progress <= 0.74 ? 'gravel' : 'asphalt';

    samples.push({
      index: i,
      x: curr.x,
      y: curr.y,
      z: curr.z,
      tx,
      tz,
      nx,
      nz,
      distance: cumulativeDist,
      progress,
      halfWidth: mapId === 'city' ? 6.6 : 5.8, // Wider street circuit deck vs rally road
      surface,
      curvature: 0,
    });
  }

  const center = {
    x: (minX + maxX) * 0.5,
    z: (minZ + maxZ) * 0.5,
  };

  const last = rawPoints[sampleCount - 1];
  const first = rawPoints[0];
  const totalLength = cumulativeDist + Math.hypot(first.x - last.x, first.z - last.z);

  // Compute smoothed signed curvature (+ = turning right, - = turning left)
  for (let i = 0; i < sampleCount; i++) {
    const pPrev = samples[(i - 4 + sampleCount) % sampleCount];
    const pNext = samples[(i + 4) % sampleCount];
    const segLen = Math.max(1, Math.hypot(pNext.x - pPrev.x, pNext.z - pPrev.z));
    const dtx = pNext.tx - pPrev.tx;
    const dtz = pNext.tz - pPrev.tz;
    const curr = samples[i];
    const rightTurnComponent = dtx * curr.nx + dtz * curr.nz;
    curr.curvature = rightTurnComponent / segLen;
  }

  function findNearestIndex(x: number, z: number, hintIdx?: number): number {
    let bestIdx = 0;
    let bestDistSq = Infinity;

    if (hintIdx !== undefined) {
      // Search local window first
      for (let offset = -32; offset <= 32; offset++) {
        const idx = (hintIdx + offset + sampleCount) % sampleCount;
        const s = samples[idx];
        const dx = x - s.x;
        const dz = z - s.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = idx;
        }
      }
      if (bestDistSq < 180) {
        return bestIdx;
      }
    }

    for (let i = 0; i < sampleCount; i++) {
      const s = samples[i];
      const dx = x - s.x;
      const dz = z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function project(x: number, z: number, hintIdx?: number): TrackProjection {
    const idx = findNearestIndex(x, z, hintIdx);
    const s = samples[idx];
    const dx = x - s.x;
    const dz = z - s.z;
    const along = dx * s.tx + dz * s.tz;
    const lateralOffset = dx * s.nx + dz * s.nz;

    const absLat = Math.abs(lateralOffset);
    const surface: SurfaceType =
      absLat <= s.halfWidth + 0.35 ? s.surface : 'offtrack';

    const distanceAlong = ((s.distance + along) % totalLength + totalLength) % totalLength;
    const progress = distanceAlong / totalLength;

    return {
      sampleIndex: idx,
      progress,
      distanceAlong,
      lateralOffset,
      elevation: s.y,
      tx: s.tx,
      tz: s.tz,
      nx: s.nx,
      nz: s.nz,
      halfWidth: s.halfWidth,
      surface,
      paceNote: computePaceNote(samples, idx, mapId),
    };
  }

  function sampleAtProgress(progress: number): TrackSample {
    const wrapped = ((progress % 1) + 1) % 1;
    const idx = Math.floor(wrapped * sampleCount) % sampleCount;
    return samples[idx];
  }

  function groundHeightAt(x: number, z: number): number {
    // Find nearest track sample for seamless roadbed height blending
    let bestDistSq = Infinity;
    let bestY = 1.0;
    for (let i = 0; i < sampleCount; i += 2) {
      const s = samples[i];
      const dx = x - s.x;
      const dz = z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestY = s.y;
      }
    }
    const dist = Math.sqrt(bestDistSq);

    if (mapId === 'city') {
      if (dist <= 8.4) {
        return bestY;
      }
      const blend = Math.min(1, (dist - 8.4) / 10);
      const smoothBlend = blend * blend * (3 - 2 * blend);
      const urbanDeck = 0.85;
      return bestY * (1 - smoothBlend) + urbanDeck * smoothBlend;
    }

    // Outer mountain canyon ridge rises naturally outside the alpine circuit
    const cx = x + 42;
    const cz = z + 15;
    const radial = Math.hypot(cx, cz);
    const outerRidge = Math.max(0, radial - 92) * 0.42;
    const rockNoise =
      Math.sin(x * 0.045) * Math.cos(z * 0.045) * 3.8 +
      Math.sin(x * 0.11 + z * 0.08) * 1.4;

    if (dist <= 7.2) {
      return bestY;
    }
    const blend = Math.min(1, (dist - 7.2) / 14);
    const smoothBlend = blend * blend * (3 - 2 * blend);
    const naturalTerrain = Math.max(0.2, bestY * 0.75 + outerRidge + rockNoise);
    return bestY * (1 - smoothBlend) + naturalTerrain * smoothBlend;
  }

  return {
    mapId,
    center,
    samples,
    totalLength,
    project,
    sampleAtProgress,
    groundHeightAt,
  };
}
