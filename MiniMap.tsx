import React from 'react';
import type { MinimapGeometry } from '../game/minimap';

interface MiniMapProps {
  geometry: MinimapGeometry;
  showRivals: boolean;
  playerMarkerRef: React.RefObject<SVGGElement | null>;
  rival1Ref: React.RefObject<SVGCircleElement | null>;
  rival2Ref: React.RefObject<SVGCircleElement | null>;
  ghostPathD?: string;
  ghostMarkerRef?: React.RefObject<SVGGElement | null>;
  compact?: boolean;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  geometry,
  showRivals,
  playerMarkerRef,
  rival1Ref,
  rival2Ref,
  ghostPathD,
  ghostMarkerRef,
  compact = false,
}) => {
  return (
    <div
      data-testid="rally-minimap"
      aria-label="Circuit mini-map"
      className={`bg-[#0e1117]/84 border border-white/12 rounded-xl p-1.5 sm:p-2 shadow-lg shrink-0 ${
        compact ? 'w-20 h-20 sm:w-28 sm:h-28' : 'w-28 h-28 sm:w-36 sm:h-36'
      }`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full overflow-visible"
        role="img"
        aria-label="Circuit layout and car positions"
      >
        {/* Outer road border */}
        <path
          d={geometry.fullPathD}
          fill="none"
          stroke="#07090d"
          strokeWidth="7.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Paved tarmac circuit */}
        <path
          d={geometry.fullPathD}
          fill="none"
          stroke="#64748b"
          strokeWidth="4.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Alpine gravel ridge sector */}
        {geometry.gravelPathD && (
          <path
            d={geometry.gravelPathD}
            fill="none"
            stroke="#d97706"
            strokeWidth="4.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Personal-best ghost racing line */}
        {ghostPathD && (
          <path
            d={ghostPathD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.9"
            strokeDasharray="3.2 2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.82"
          />
        )}

        {/* Start / Finish line */}
        <line
          x1={geometry.startLine.x1}
          y1={geometry.startLine.y1}
          x2={geometry.startLine.x2}
          y2={geometry.startLine.y2}
          stroke="#f8fafc"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Rival rally cars */}
        {showRivals && (
          <>
            <circle
              ref={rival1Ref}
              cx={50}
              cy={50}
              r={3.2}
              fill="#3b82f6"
              stroke="#0f172a"
              strokeWidth="1.2"
            />
            <circle
              ref={rival2Ref}
              cx={50}
              cy={50}
              r={3.2}
              fill="#60a5fa"
              stroke="#0f172a"
              strokeWidth="1.2"
            />
          </>
        )}

        {/* Personal-best ghost directional chevron */}
        {ghostMarkerRef && (
          <g
            ref={ghostMarkerRef}
            transform="translate(50, 50) rotate(0)"
            style={{ display: 'none' }}
          >
            <path
              d="M0,-5 L3.8,4 L0,2 L-3.8,4 Z"
              fill="#38bdf8"
              fillOpacity="0.82"
              stroke="#e0f2fe"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* Player directional chevron */}
        <g ref={playerMarkerRef} transform="translate(50, 50) rotate(0)">
          <path
            d="M0,-5.5 L4.2,4.5 L0,2.2 L-4.2,4.5 Z"
            fill="#e05a2b"
            stroke="#ffffff"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
};
