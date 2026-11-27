import React from 'react';
import { ArrowLeft, Camera, Pause, Play, RotateCcw } from 'lucide-react';
import type { HudSnapshot, ReplayCameraMode } from '../game/types';
import type { MinimapGeometry } from '../game/minimap';
import { formatRaceTime } from './formatTime';
import { MiniMap } from './MiniMap';

interface ReplayControlsProps {
  mapTitle: string;
  hud: HudSnapshot;
  durationMs: number;
  replayPaused: boolean;
  replaySpeed: 0.5 | 1 | 2;
  replayCamera: ReplayCameraMode;
  minimapGeometry: MinimapGeometry;
  speedRef: React.RefObject<HTMLSpanElement | null>;
  gearRef: React.RefObject<HTMLSpanElement | null>;
  rpmBarRef: React.RefObject<HTMLDivElement | null>;
  scrubberRef: React.RefObject<HTMLInputElement | null>;
  replayTimeRef: React.RefObject<HTMLSpanElement | null>;
  playerMarkerRef: React.RefObject<SVGGElement | null>;
  rival1Ref: React.RefObject<SVGCircleElement | null>;
  rival2Ref: React.RefObject<SVGCircleElement | null>;
  onTogglePlay: () => void;
  onSelectSpeed: (speed: 0.5 | 1 | 2) => void;
  onCycleCamera: () => void;
  onSeek: (timeMs: number) => void;
  onExitReplay: () => void;
  onRestart: () => void;
}

const CAMERA_LABELS: Record<ReplayCameraMode, string> = {
  broadcast: 'Broadcast Cam',
  heli: 'Heli Cam',
  chase: 'Chase Cam',
};

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  mapTitle,
  hud,
  durationMs,
  replayPaused,
  replaySpeed,
  replayCamera,
  minimapGeometry,
  speedRef,
  gearRef,
  rpmBarRef,
  scrubberRef,
  replayTimeRef,
  playerMarkerRef,
  rival1Ref,
  rival2Ref,
  onTogglePlay,
  onSelectSpeed,
  onCycleCamera,
  onSeek,
  onExitReplay,
  onRestart,
}) => {
  return (
    <div
      data-testid="replay-hud"
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5"
    >
      {/* Top Broadcast Overlay */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          <div className="bg-[#0e1117]/88 border border-white/14 rounded-lg px-3 py-2 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">
                Stage Replay
              </span>
              <span className="text-[11px] font-medium text-stone-300 truncate max-w-[160px]">
                {mapTitle}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-stone-400">
                  Lap
                </span>
                <span className="font-display text-lg font-bold text-stone-50 font-mono-num">
                  {hud.lap}
                  <span className="text-xs text-stone-400">/{hud.totalLaps}</span>
                </span>
              </div>
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-stone-400">
                  Speed
                </span>
                <span className="font-mono-num text-lg font-bold text-stone-50">
                  <span ref={speedRef}>{hud.speedKmh}</span>
                  <span className="text-[10px] text-stone-400 ml-1">km/h</span>
                </span>
              </div>
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-stone-400">
                  Gear
                </span>
                <span
                  ref={gearRef}
                  className="font-display text-lg font-bold text-[#e05a2b] font-mono-num"
                >
                  {hud.gear}
                </span>
              </div>
            </div>
            <div className="mt-1.5 h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
              <div
                ref={rpmBarRef}
                className="h-full bg-[#e05a2b] origin-left transition-none"
                style={{ transform: 'scaleX(0.2)' }}
              />
            </div>
          </div>

          <div className="hidden sm:block">
            <MiniMap
              geometry={minimapGeometry}
              showRivals={hud.totalCars > 1}
              playerMarkerRef={playerMarkerRef}
              rival1Ref={rival1Ref}
              rival2Ref={rival2Ref}
              compact
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
          <button
            type="button"
            onClick={onExitReplay}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0e1117]/88 hover:bg-[#191f2b] border border-white/14 text-xs font-semibold text-stone-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Results
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#e05a2b] hover:bg-[#eb693b] text-xs font-display font-bold uppercase tracking-wider text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Race Again
          </button>
        </div>
      </div>

      {/* Bottom Playback Transport Dock */}
      <div className="w-full max-w-2xl mx-auto bg-[#0e1117]/92 border border-white/14 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-3 mb-2">
          <span
            ref={replayTimeRef}
            className="font-mono-num text-xs font-semibold text-stone-100 min-w-[66px]"
          >
            00:00.00
          </span>
          <input
            ref={scrubberRef}
            type="range"
            aria-label="Replay timeline"
            min={0}
            max={Math.max(1, durationMs)}
            step={25}
            defaultValue={0}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="flex-1 accent-[#38bdf8] h-1.5 bg-stone-800 rounded-lg cursor-pointer"
          />
          <span className="font-mono-num text-xs text-stone-400 min-w-[66px] text-right">
            {formatRaceTime(durationMs)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={replayPaused ? 'Play replay' : 'Pause replay'}
              onClick={onTogglePlay}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {replayPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Play
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  Pause
                </>
              )}
            </button>

            <div
              role="group"
              aria-label="Replay playback speed"
              className="flex items-center gap-1 p-0.5 bg-[#080a0f] border border-white/10 rounded-lg"
            >
              {([0.5, 1, 2] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  aria-pressed={replaySpeed === spd}
                  onClick={() => onSelectSpeed(spd)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-mono-num font-semibold transition-colors cursor-pointer ${
                    replaySpeed === spd
                      ? 'bg-stone-100 text-stone-950'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            aria-label={`Replay camera: ${CAMERA_LABELS[replayCamera]}`}
            onClick={onCycleCamera}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#191f2b] hover:bg-[#232b3b] border border-white/12 text-xs font-semibold text-stone-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            {CAMERA_LABELS[replayCamera]}
          </button>
        </div>
      </div>
    </div>
  );
};
