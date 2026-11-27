import type { RallyTrack } from './track';

export interface MinimapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface MinimapPoint {
  x: number;
  y: number;
}

export interface MinimapGeometry {
  bounds: MinimapBounds;
  fullPathD: string;
  gravelPathD: string;
  startLine: { x1: number; y1: number; x2: number; y2: number };
}

export function computeMinimapBounds(track: RallyTrack, size = 100, padding = 10): MinimapBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const s of track.samples) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.z < minZ) minZ = s.z;
    if (s.z > maxZ) maxZ = s.z;
  }

  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const usable = size - padding * 2;
  const scale = Math.min(usable / spanX, usable / spanZ);

  const drawnW = spanX * scale;
  const drawnH = spanZ * scale;
  const offsetX = (size - drawnW) / 2;
  const offsetY = (size - drawnH) / 2;

  return { minX, maxX, minZ, maxZ, scale, offsetX, offsetY };
}

/**
 * Maps world (x, z) to [0..100] SVG coordinates where UP (-Y) corresponds
 * to +Z world heading (the start/finish straight direction) and RIGHT (+X)
 * corresponds to -X world direction (right turn from +Z).
 */
export function worldToMinimap(x: number, z: number, bounds: MinimapBounds): MinimapPoint {
  return {
    x: bounds.offsetX + (bounds.maxX - x) * bounds.scale,
    y: bounds.offsetY + (bounds.maxZ - z) * bounds.scale,
  };
}

export function headingToMinimapDeg(headingRad: number): number {
  return ((-headingRad * 180) / Math.PI) || 0;
}

export function buildMinimapGeometry(track: RallyTrack): MinimapGeometry {
  const bounds = computeMinimapBounds(track, 100, 10);

  const fullPts: string[] = [];
  const gravelPts: string[] = [];

  for (let i = 0; i < track.samples.length; i += 2) {
    const s = track.samples[i];
    const p = worldToMinimap(s.x, s.z, bounds);
    const cmd = `${fullPts.length === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    fullPts.push(cmd);

    if (s.surface === 'gravel') {
      const gCmd = `${gravelPts.length === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      gravelPts.push(gCmd);
    }
  }
  fullPts.push('Z');

  const startSample = track.sampleAtProgress(0.055);
  const pLeft = worldToMinimap(
    startSample.x - startSample.nx * (startSample.halfWidth + 1.5),
    startSample.z - startSample.nz * (startSample.halfWidth + 1.5),
    bounds
  );
  const pRight = worldToMinimap(
    startSample.x + startSample.nx * (startSample.halfWidth + 1.5),
    startSample.z + startSample.nz * (startSample.halfWidth + 1.5),
    bounds
  );

  return {
    bounds,
    fullPathD: fullPts.join(' '),
    gravelPathD: gravelPts.join(' '),
    startLine: {
      x1: pLeft.x,
      y1: pLeft.y,
      x2: pRight.x,
      y2: pRight.y,
    },
  };
}

export interface StageSummary {
  lapLengthMeters: number;
  totalDistanceKm: string;
  gravelPercent: number;
  elevationRangeMeters: number;
}

export function computeStageSummary(track: RallyTrack, laps: number): StageSummary {
  const safeLaps = Math.max(1, Math.round(laps));
  const lapLengthMeters = Math.round(track.totalLength);
  const totalDistanceKm = ((track.totalLength * safeLaps) / 1000).toFixed(2);

  let gravelCount = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of track.samples) {
    if (s.surface === 'gravel') gravelCount += 1;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }

  const gravelPercent =
    track.samples.length > 0 ? Math.round((gravelCount / track.samples.length) * 100) : 0;
  const elevationRangeMeters =
    Number.isFinite(minY) && Number.isFinite(maxY) ? Math.max(0, Math.round(maxY - minY)) : 0;

  return {
    lapLengthMeters,
    totalDistanceKm,
    gravelPercent,
    elevationRangeMeters,
  };
}

export function buildGhostMinimapPath(
  frames: readonly { x: number; z: number }[],
  bounds: MinimapBounds,
  maxPoints = 140
): string {
  if (frames.length < 2) return '';
  const step = Math.max(1, Math.floor(frames.length / maxPoints));
  const cmds: string[] = [];
  for (let i = 0; i < frames.length; i += step) {
    const p = worldToMinimap(frames[i].x, frames[i].z, bounds);
    cmds.push(`${cmds.length === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  const last = frames[frames.length - 1];
  const pLast = worldToMinimap(last.x, last.z, bounds);
  cmds.push(`L${pLast.x.toFixed(1)},${pLast.y.toFixed(1)}`);
  return cmds.join(' ');
}

