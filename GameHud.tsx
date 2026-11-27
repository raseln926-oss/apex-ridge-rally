import React from 'react';
import { Camera, Gamepad2, Ghost, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { CameraMode, HudSnapshot } from '../game/types';
import type { MinimapGeometry } from '../game/minimap';
import { formatDeltaSeconds } from '../game/telemetry';
import { formatRaceTime } from './formatTime';
import { MiniMap } from './MiniMap';

interface GameHudProps {
  hud: HudSnapshot;
  cameraMode: CameraMode;
  muted: boolean;
  touchEnabled: boolean;
  ghostEnabled: boolean;
  ghostPathD: string;
  minimapGeometry: MinimapGeometry;
  speedRef: React.RefObject<HTMLSpanElement | null>;
  gearRef: React.RefObject<HTMLSpanElement | null>;
  rpmBarRef: React.RefObject<HTMLDivElement | null>;
  playerMarkerRef: React.RefObject<SVGGElement | null>;
  rival1Ref: React.RefObject<SVGCircleElement | null>;
  rival2Ref: React.RefObject<SVGCircleElement | null>;
  ghostMarkerRef: React.RefObject<SVGGElement | null>;
  onCycleCamera: () => void;
  onToggleGhost: () => void;
  onToggleTouch: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  cameraMode,
  muted,
  touchEnabled,
  ghostEnabled,
  ghostPathD,
  minimapGeometry,
  speedRef,
  gearRef,
  rpmBarRef,
  playerMarkerRef,
  rival1Ref,
  rival2Ref,
  ghostMarkerRef,
  onCycleCamera,
  onToggleGhost,
  onToggleTouch,
  onToggleMute,
  onPause,
  onRestart,
}) => {
  const paceColor =
    hud.paceNote?.severity === 'sharp'
      ? 'bg-red-600/90 border-red-400/50 text-white'
      : hud.paceNote?.severity === 'warn'
      ? 'bg-amber-500/90 border-amber-300/50 text-stone-950'
      : 'bg-[#12161f]/88 border-white/15 text-stone-100';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.625rem,env(safe-area-inset-left))] pr-[max(0.625rem,env(safe-area-inset-right))] sm:p-5">
      <div>
        {/* Top Row: Left Telemetry Cluster + Right Utility Controls */}
        <div className="flex items-start justify-between gap-2">
          {/* Top-Left Cluster: Pos, Lap, Time, Score + Mobile MiniMap */}
          <div className="flex flex-col items-start gap-2 shrink-0">
            <div className="bg-[#0e1117]/84 border border-white/12 rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 shadow-lg">
              <div className="flex items-baseline gap-2.5 sm:gap-4">
                {hud.totalCars > 1 && (
                  <div>
                    <span className="block text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                      Pos
                    </span>
                    <span className="font-display text-lg sm:text-2xl font-bold text-amber-400 leading-none font-mono-num">
                      {hud.position}
                      <span className="text-xs sm:text-sm text-stone-400">/{hud.totalCars}</span>
                    </span>
                  </div>
                )}
                <div>
                  <span className="block text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    Lap
                  </span>
                  <span className="font-display text-lg sm:text-2xl font-bold text-stone-50 leading-none font-mono-num">
                    {hud.lap}
                    <span className="text-xs sm:text-sm text-stone-400">/{hud.totalLaps}</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    Time
                  </span>
                  <span className="font-mono-num text-sm sm:text-lg font-bold text-stone-100 leading-none whitespace-nowrap">
                    {formatRaceTime(hud.lapTimeMs)}
                  </span>
                </div>
                <div className="text-right pl-1 sm:pl-2 border-l border-white/10">
                  <span className="block text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    Score
                  </span>
                  <span
                    data-testid="score-readout"
                    className="font-mono-num text-sm sm:text-lg font-bold text-emerald-400 leading-none whitespace-nowrap"
                  >
                    {hud.score.toLocaleString()}
                    {hud.combo > 1 && (
                      <span className="ml-1 text-[10px] sm:text-xs font-display font-bold text-amber-300">
                        x{hud.combo}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between gap-3 text-[10px] sm:text-[11px] text-stone-300 font-mono-num whitespace-nowrap">
                <span>Best {formatRaceTime(hud.bestLapMs)}</span>
                {hud.hasGhost && ghostEnabled && hud.ghostDeltaMs !== null ? (
                  <span
                    data-testid="ghost-delta-readout"
                    className={`font-semibold ${
                      hud.ghostDeltaMs < 0
                        ? 'text-emerald-400'
                        : hud.ghostDeltaMs > 0
                        ? 'text-amber-400'
                        : 'text-sky-300'
                    }`}
                  >
                    PB {formatDeltaSeconds(hud.ghostDeltaMs)}
                  </span>
                ) : (
                  <span className="uppercase tracking-wider text-stone-400">
                    {hud.surface}
                  </span>
                )}
              </div>
            </div>

            {touchEnabled && (
              <MiniMap
                geometry={minimapGeometry}
                showRivals={hud.totalCars > 1}
                playerMarkerRef={playerMarkerRef}
                rival1Ref={rival1Ref}
                rival2Ref={rival2Ref}
                ghostPathD={ghostEnabled ? ghostPathD : undefined}
                ghostMarkerRef={ghostMarkerRef}
                compact
              />
            )}
          </div>

          {/* Top-Right Compact Utility Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto shrink-0">
            {hud.hasGhost && (
              <button
                type="button"
                tabIndex={-1}
                aria-pressed={ghostEnabled}
                aria-label={ghostEnabled ? 'Hide personal best ghost' : 'Show personal best ghost'}
                title="Toggle Personal Best Ghost [G]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleGhost();
                }}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                  ghostEnabled
                    ? 'bg-sky-600/90 border-sky-300/45 text-white'
                    : 'bg-[#0e1117]/84 hover:bg-[#191f2b] border-white/12 text-stone-300'
                }`}
              >
                <Ghost className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            <button
              type="button"
              tabIndex={-1}
              aria-label={`Switch camera (${cameraMode})`}
              title={`Camera: ${cameraMode} [C]`}
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCamera();
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#0e1117]/84 hover:bg-[#191f2b] border border-white/12 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={touchEnabled ? 'Hide touch controls' : 'Show touch controls'}
              title="Toggle Android Touch Pedals [T]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleTouch();
              }}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                touchEnabled
                  ? 'bg-[#e05a2b]/90 border-amber-300/40 text-white'
                  : 'bg-[#0e1117]/84 hover:bg-[#191f2b] border-white/12 text-stone-200'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title="Mute [M]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#0e1117]/84 hover:bg-[#191f2b] border border-white/12 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart race"
              title="Restart [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#0e1117]/84 hover:bg-[#191f2b] border border-white/12 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause game"
              title="Pause [P / Esc]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#0e1117]/84 hover:bg-[#191f2b] border border-white/12 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Dedicated Centered Co-Driver Pace Note Row */}
        <div className="mt-2 flex flex-col items-center gap-1.5">
          {hud.wrongWay && (
            <div className="bg-red-600/95 border border-red-300/60 text-white px-4 py-1.5 rounded-md font-display text-xs sm:text-sm font-bold uppercase tracking-widest shadow-lg">
              Wrong Way
            </div>
          )}
          {hud.paceNote && !hud.wrongWay && (
            <div
              className={`border rounded-lg px-3 py-1 shadow-lg flex items-center gap-2 ${paceColor}`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                {hud.paceNote.direction === 'left' && (
                  <path
                    d="M15 4 L7 12 L15 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {hud.paceNote.direction === 'right' && (
                  <path
                    d="M9 4 L17 12 L9 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {hud.paceNote.direction === 'straight' && (
                  <path
                    d="M12 19 L12 5 M6 11 L12 5 L18 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
              <span className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                {hud.paceNote.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Desktop MiniMap (bottom-left) + Speedometer */}
      <div
        className={`flex items-end ${
          touchEnabled ? 'justify-center mb-0.5 sm:mb-2' : 'justify-between gap-4'
        }`}
      >
        {!touchEnabled && (
          <MiniMap
            geometry={minimapGeometry}
            showRivals={hud.totalCars > 1}
            playerMarkerRef={playerMarkerRef}
            rival1Ref={rival1Ref}
            rival2Ref={rival2Ref}
            ghostPathD={ghostEnabled ? ghostPathD : undefined}
            ghostMarkerRef={ghostMarkerRef}
          />
        )}

        <div className="bg-[#0e1117]/86 border border-white/12 rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 shadow-xl min-w-[126px] sm:min-w-[168px]">
          <div className="flex items-baseline justify-between gap-2.5 sm:gap-4">
            <div className="flex items-baseline gap-1">
              <span
                ref={speedRef}
                className="font-mono-num text-xl sm:text-4xl font-bold text-stone-50 leading-none"
              >
                0
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                km/h
              </span>
            </div>
            <div className="text-right">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-stone-400">
                Gear
              </span>
              <span
                ref={gearRef}
                className="font-display text-base sm:text-xl font-bold text-[#e05a2b] leading-none font-mono-num"
              >
                1
              </span>
            </div>
          </div>

          {/* 60Hz DOM-mutated RPM Bar */}
          <div className="mt-1 sm:mt-2 h-1.5 sm:h-2 w-full bg-stone-800 rounded-full overflow-hidden">
            <div
              ref={rpmBarRef}
              className="h-full bg-[#e05a2b] origin-left transition-none"
              style={{ transform: 'scaleX(0.15)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
