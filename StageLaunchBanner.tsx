import React from 'react';
import type { MapInfo, RaceMode } from '../game/types';

interface StageLaunchBannerProps {
  launchKey: number;
  mapInfo: MapInfo;
  mode: RaceMode;
  laps: number;
  visible: boolean;
}

export const StageLaunchBanner: React.FC<StageLaunchBannerProps> = ({
  launchKey,
  mapInfo,
  mode,
  laps,
  visible,
}) => {
  if (!visible || launchKey === 0) return null;

  return (
    <div
      key={launchKey}
      aria-hidden="true"
      className="fixed inset-x-0 top-20 sm:top-24 z-20 flex justify-center pointer-events-none px-4"
    >
      <div className="animate-launch-sweep bg-[#0e1117]/94 border border-amber-400/35 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3.5">
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#e05a2b] shrink-0" aria-hidden="true">
          <path
            d="M4 21V4m0 0h11l-2 4 2 4H4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="6.5" y="5.5" width="2.5" height="2.5" fill="currentColor" />
          <rect x="10.5" y="7.5" width="2.5" height="2.5" fill="currentColor" />
        </svg>
        <div className="h-6 w-px bg-white/12" />
        <div>
          <p className="font-display text-sm sm:text-base font-bold uppercase tracking-[0.14em] text-stone-50 leading-none">
            {mapInfo.shortLabel} · Rolling Start
          </p>
          <p className="text-[11px] text-amber-300 mt-1">
            {mode === 'race' ? '3-Car Grid' : 'Time Trial'} · {laps} Laps
          </p>
        </div>
      </div>
    </div>
  );
};
