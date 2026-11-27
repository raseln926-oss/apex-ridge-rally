import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { MAP_INFO, type MapId, type RaceMode } from '../game/types';
import type { MinimapGeometry, StageSummary } from '../game/minimap';
import type { DriverProfileData, StageRecordData } from '../game/records';
import { formatRaceTime } from './formatTime';

interface TitleScreenProps {
  mapId: MapId;
  mode: RaceMode;
  laps: number;
  minimapGeometry: MinimapGeometry;
  stageSummary: StageSummary;
  user: User | null;
  authReady: boolean;
  driverProfile: DriverProfileData | null;
  recentRecords: StageRecordData[];
  authBusy: boolean;
  onSelectMap: (mapId: MapId) => void;
  onSelectMode: (mode: RaceMode) => void;
  onSelectLaps: (laps: number) => void;
  onStart: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onDeleteRecord: (recordId: string) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  mapId,
  mode,
  laps,
  minimapGeometry,
  stageSummary,
  user,
  authReady,
  driverProfile,
  recentRecords,
  authBusy,
  onSelectMap,
  onSelectMode,
  onSelectLaps,
  onStart,
  onSignIn,
  onSignOut,
  onDeleteRecord,
}) => {
  const [showLogbook, setShowLogbook] = useState(false);
  const mapInfo = MAP_INFO[mapId];

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-10 pointer-events-none">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
        {/* Top-Left Lobby Card over negative space */}
        <div className="animate-lobby-enter w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto touch-pan-y pointer-events-auto bg-[#0e1117]/88 border border-white/12 rounded-xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center gap-3.5 mb-3">
            <svg
              viewBox="0 0 48 48"
              className="w-11 h-11 shrink-0"
              aria-hidden="true"
            >
              <path
                d="M6 10 L24 4 L42 10 L42 26 C42 35 33 42 24 45 C15 42 6 35 6 26 Z"
                fill="#191d26"
                stroke="#e05a2b"
                strokeWidth="2.5"
              />
              {mapId === 'city' ? (
                <path
                  d="M14 33 V19 H20 V33 M22 33 V13 H28 V33 M30 33 V22 H35 V33"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M11 30 L20 17 L26 24 L31 19 L37 30 Z"
                  fill="#e05a2b"
                />
              )}
              <path
                d="M14 34 L34 34"
                stroke="#f4f2ec"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">
                {mapInfo.stageTag}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-stone-50 leading-none mt-0.5">
                {mapInfo.title}
              </h1>
            </div>
          </div>

          <p className="text-sm text-stone-300 leading-relaxed mb-4">
            {mapInfo.description}
          </p>

          {/* Circuit, Event Format & Laps Segmented Selectors */}
          <div className="space-y-2.5 mb-4">
            <div>
              <span className="block text-xs font-medium text-stone-400 mb-1">
                Circuit
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#090b10] rounded-lg border border-white/10">
                {(['alpine', 'city'] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={mapId === id}
                    onClick={() => onSelectMap(id)}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      mapId === id
                        ? 'bg-stone-100 text-stone-950'
                        : 'text-stone-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {MAP_INFO[id].shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-400 mb-1">
                Event Format
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#090b10] rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => onSelectMode('race')}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    mode === 'race'
                      ? 'bg-[#e05a2b] text-white'
                      : 'text-stone-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {mapId === 'city' ? '3-Car Street GP' : '3-Car Rally'}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMode('time_trial')}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    mode === 'time_trial'
                      ? 'bg-[#e05a2b] text-white'
                      : 'text-stone-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Time Trial
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-400 mb-1">
                Stage Distance
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#090b10] rounded-lg border border-white/10">
                {[2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => onSelectLaps(count)}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      laps === count
                        ? 'bg-stone-100 text-stone-950'
                        : 'text-stone-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {count} Laps
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="w-full min-h-[48px] px-6 py-3 rounded-lg bg-[#e05a2b] hover:bg-[#eb693b] active:scale-[0.99] text-white font-display text-base font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg"
          >
            Start Race
          </button>

          {/* Driver Cloud Sync Bar */}
          {authReady && (
            <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between gap-3">
              {user ? (
                <>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-100 truncate">
                      {driverProfile?.driverName ?? user.displayName ?? 'Apex Driver'}
                    </p>
                    <p className="text-[11px] text-stone-400 font-mono-num">
                      {driverProfile
                        ? `Best ${formatRaceTime(driverProfile.bestLapMs)} · ${driverProfile.racesCompleted} runs`
                        : 'Cloud logbook ready'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowLogbook((v) => !v)}
                      className="min-h-[34px] px-2.5 py-1 rounded-md bg-white/8 hover:bg-white/14 text-xs font-medium text-stone-200 transition-colors cursor-pointer"
                    >
                      {showLogbook ? 'Hide Log' : 'Logbook'}
                    </button>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="min-h-[34px] px-2.5 py-1 rounded-md text-xs font-medium text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-xs text-stone-400">
                    Save personal bests across devices
                  </span>
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={onSignIn}
                    className="min-h-[36px] px-3 py-1.5 rounded-md bg-[#1a202c] hover:bg-[#232b3b] border border-white/14 text-xs font-semibold text-stone-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    {authBusy ? 'Signing in...' : 'Sign in with Google'}
                  </button>
                </>
              )}
            </div>
          )}

          {user && showLogbook && (
            <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
              {recentRecords.length === 0 ? (
                <p className="text-xs text-stone-400">
                  Complete a stage to log your first cloud lap record.
                </p>
              ) : (
                recentRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-2 text-xs bg-[#090b10] border border-white/8 rounded-md px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <span className="font-mono-num font-semibold text-stone-100">
                        {formatRaceTime(rec.totalTimeMs)}
                      </span>
                      <span className="text-stone-400 ml-2">
                        {rec.mode === 'race' ? `P${rec.position}` : 'TT'} · {rec.totalLaps}L · Best {formatRaceTime(rec.bestLapMs)}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete run ${formatRaceTime(rec.totalTimeMs)}`}
                      onClick={() => onDeleteRecord(rec.id)}
                      className="text-[11px] text-stone-400 hover:text-red-400 px-1.5 py-0.5 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Safe Margin: Control Hint + Desktop Stage Circuit Briefing */}
      <div className="flex items-end justify-between gap-6">
        <div className="w-full sm:w-auto text-center sm:text-left">
          <p className="inline-block text-xs font-medium text-stone-200 hud-text-stroke tracking-wide">
            WASD / Arrows Drive · Space Handbrake · C Camera · Touch Controls Ready
          </p>
        </div>

        <aside
          aria-label="Stage briefing"
          className="hidden md:flex animate-lobby-enter-delayed items-center gap-4 bg-[#0e1117]/88 border border-white/12 rounded-xl px-4 py-3 shadow-2xl shrink-0"
        >
          <svg
            key={mapId}
            viewBox="0 0 100 100"
            className="w-20 h-20 shrink-0"
            aria-label={`${mapInfo.title} circuit preview`}
          >
            <path
              d={minimapGeometry.fullPathD}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="7"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {minimapGeometry.gravelPathD && (
              <path
                d={minimapGeometry.gravelPathD}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="7"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            <path
              d={minimapGeometry.fullPathD}
              pathLength={100}
              fill="none"
              stroke={mapId === 'city' ? '#38bdf8' : '#e05a2b'}
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="animate-circuit-draw"
            />
            <line
              x1={minimapGeometry.startLine.x1}
              y1={minimapGeometry.startLine.y1}
              x2={minimapGeometry.startLine.x2}
              y2={minimapGeometry.startLine.y2}
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>

          <div className="space-y-1.5 min-w-[168px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400">
              Circuit Briefing
            </p>
            <p className="font-display text-base font-bold text-stone-50 leading-tight">
              {stageSummary.totalDistanceKm} km · {laps} Laps
            </p>
            <div className="text-xs text-stone-300 font-mono-num space-y-0.5">
              <p>{stageSummary.lapLengthMeters}m lap · {stageSummary.elevationRangeMeters}m climb</p>
              <p className="text-stone-400">
                {stageSummary.gravelPercent > 0
                  ? `${100 - stageSummary.gravelPercent}% Tarmac · ${stageSummary.gravelPercent}% Gravel`
                  : '100% High-Grip Street Tarmac'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
