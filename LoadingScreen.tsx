import React, { useEffect, useState } from 'react';
import type { MinimapGeometry } from '../game/minimap';
import type { MapInfo } from '../game/types';

interface LoadingScreenProps {
  mapInfo: MapInfo;
  geometry: MinimapGeometry;
  sceneReady: boolean;
  fadingOut: boolean;
  visible: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  mapInfo,
  geometry,
  sceneReady,
  fadingOut,
  visible,
}) => {
  const [progress, setProgress] = useState(0.24);

  useEffect(() => {
    if (!visible) return;
    if (sceneReady) {
      setProgress(1);
      return;
    }

    const t1 = window.setTimeout(() => setProgress((p) => Math.max(p, 0.56)), 140);
    const t2 = window.setTimeout(() => setProgress((p) => Math.max(p, 0.84)), 340);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [sceneReady, visible]);

  if (!visible) return null;

  const phaseIndex = progress >= 0.99 ? 2 : progress >= 0.5 ? 1 : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${mapInfo.title}`}
      className={`fixed inset-0 z-40 flex items-center justify-center bg-[#0d1015] p-6 transition-opacity duration-350 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* Animated Circuit Trace Emblem */}
        <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            aria-hidden="true"
          >
            <path
              d={geometry.fullPathD}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {geometry.gravelPathD && (
              <path
                d={geometry.gravelPathD}
                fill="none"
                stroke="rgba(245,158,11,0.35)"
                strokeWidth="6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            <path
              d={geometry.fullPathD}
              pathLength={100}
              fill="none"
              stroke="#e05a2b"
              strokeWidth="6.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="animate-circuit-draw"
            />
            <line
              x1={geometry.startLine.x1}
              y1={geometry.startLine.y1}
              x2={geometry.startLine.x2}
              y2={geometry.startLine.y2}
              stroke="#f8fafc"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400 mb-1">
          {mapInfo.stageTag}
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-stone-50 mb-5">
          {mapInfo.title}
        </h2>

        {/* GPU-composited Loading Progress Bar */}
        <div className="w-full h-1.5 bg-[#191f2b] rounded-full overflow-hidden mb-3 border border-white/10">
          <div
            className="h-full w-full bg-[#e05a2b] origin-left transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>

        <div className="w-full flex items-center justify-between text-xs text-stone-400">
          <span>{mapInfo.loadingPhases[phaseIndex]}</span>
          <span className="font-mono-num text-stone-300">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
