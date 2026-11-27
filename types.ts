export type GameState = 'title' | 'playing' | 'paused' | 'gameover' | 'replay';

export type MapId = 'alpine' | 'city';

export interface MapInfo {
  id: MapId;
  stageTag: string;
  title: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  loadingPhases: readonly [string, string, string];
}

export const MAP_INFO: Record<MapId, MapInfo> = {
  alpine: {
    id: 'alpine',
    stageTag: 'Stage 07 · Alpine Canyon',
    title: 'Apex Ridge Rally',
    shortLabel: 'Alpine Canyon',
    subtitle: 'Mixed Tarmac & Gravel',
    description:
      'Carve hairpins across weathered alpine tarmac and loose mountain gravel. Built for Android touch pedals and desktop controls.',
    loadingPhases: [
      'Sculpting Alpine Canyon Terrain',
      'Surfacing Tarmac & Gravel Sectors',
      'Staging Rally Grid',
    ],
  },
  city: {
    id: 'city',
    stageTag: 'Circuit 02 · Metro Street GP',
    title: 'Metro Apex GP',
    shortLabel: 'Metro City GP',
    subtitle: '100% High-Grip Street Tarmac',
    description:
      'Thread skyscraper chicanes, sweeping downtown boulevards, and harbourside hairpins on a fast urban street circuit.',
    loadingPhases: [
      'Raising Downtown Skyline Towers',
      'Laying High-Grip Street Tarmac',
      'Staging Street Grid',
    ],
  },
};

export type RaceMode = 'race' | 'time_trial';

export type CameraMode = 'chase' | 'hood' | 'bumper';

export type ReplayCameraMode = 'broadcast' | 'heli' | 'chase';

export type SurfaceType = 'asphalt' | 'gravel' | 'offtrack';

export interface PaceNote {
  label: string;
  severity: 'info' | 'warn' | 'sharp';
  direction: 'left' | 'right' | 'straight';
}

export interface ControlInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. +1 (right)
  handbrake: boolean;
}

export interface TelemetryRivalSample {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  steer: number;
  wheelRot: number;
}

export interface TelemetrySample {
  t: number; // ms from race start
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  steer: number;
  wheelRot: number;
  speedKmh: number;
  rpm: number;
  gear: number;
  lap: number;
  progress: number;
  totalProgress: number;
  brakeStrength: number;
  surface: SurfaceType;
  rivals: TelemetryRivalSample[];
}

export interface RunRecording {
  mapId: MapId;
  mode: RaceMode;
  totalLaps: number;
  totalTimeMs: number;
  bestLapMs: number | null;
  frames: TelemetrySample[];
}

export interface GhostFrame {
  t: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  steer: number;
  wheelRot: number;
  totalProgress: number;
}

export interface GhostData {
  version: 1;
  mapId: MapId;
  totalLaps: number;
  totalTimeMs: number;
  bestLapMs: number | null;
  recordedAt: number;
  frames: GhostFrame[];
}

export interface HudSnapshot {
  speedKmh: number;
  rpm: number;
  gear: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalCars: number;
  lapTimeMs: number;
  totalTimeMs: number;
  bestLapMs: number | null;
  surface: SurfaceType;
  paceNote: PaceNote | null;
  countdown: number; // 0 when racing, >0 during 3-2-1 grid start
  wrongWay: boolean;
  ghostDeltaMs: number | null;
  hasGhost: boolean;
  score: number;
  combo: number;
  overtakes: number;
}

export interface RaceResultSnapshot {
  mapId?: MapId;
  mode: RaceMode;
  outcome: 'finished' | 'timeout';
  position: number;
  totalCars: number;
  totalTimeMs: number;
  bestLapMs: number | null;
  topSpeedKmh: number;
  lapsCompleted: number;
  totalLaps: number;
  isNewGhostPb?: boolean;
  score?: number;
  overtakes?: number;
}
