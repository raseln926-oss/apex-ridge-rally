import React, { useRef, useState } from 'react';

export interface TouchPadState {
  left: boolean;
  right: boolean;
  gas: boolean;
  brake: boolean;
  handbrake: boolean;
}

interface TouchControlsProps {
  onChange: (state: TouchPadState) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ onChange }) => {
  const stateRef = useRef<TouchPadState>({
    left: false,
    right: false,
    gas: false,
    brake: false,
    handbrake: false,
  });
  const activePointers = useRef<Map<number, keyof TouchPadState>>(new Map());
  const [visual, setVisual] = useState<TouchPadState>(stateRef.current);

  const recompute = () => {
    const next: TouchPadState = {
      left: false,
      right: false,
      gas: false,
      brake: false,
      handbrake: false,
    };
    activePointers.current.forEach((key) => {
      next[key] = true;
    });
    stateRef.current = next;
    setVisual(next);
    onChange(next);
  };

  const handleDown = (key: keyof TouchPadState) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    activePointers.current.set(e.pointerId, key);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(10);
    }
    recompute();
  };

  const handleUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.delete(e.pointerId);
      recompute();
    }
  };

  const padBase =
    'pointer-events-auto select-none touch-none rounded-xl border font-display font-bold uppercase tracking-wider flex items-center justify-center transition-transform cursor-pointer';

  return (
    <div
      data-testid="touch-controls"
      className="fixed inset-x-0 bottom-0 z-20 pointer-events-none flex items-end justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6"
    >
      {/* Left Thumb: Steer Left / Right */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Steer left"
          onPointerDown={handleDown('left')}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`${padBase} w-14 h-14 sm:w-20 sm:h-20 ${
            visual.left
              ? 'bg-[#e05a2b]/90 border-amber-300/60 text-white scale-95'
              : 'bg-[#0e1117]/80 border-white/15 text-stone-100'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true">
            <path
              d="M15 5 L8 12 L15 19"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Steer right"
          onPointerDown={handleDown('right')}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`${padBase} w-14 h-14 sm:w-20 sm:h-20 ${
            visual.right
              ? 'bg-[#e05a2b]/90 border-amber-300/60 text-white scale-95'
              : 'bg-[#0e1117]/80 border-white/15 text-stone-100'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true">
            <path
              d="M9 5 L16 12 L9 19"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Right Thumb: Handbrake + Brake + Gas Pedals */}
      <div className="flex items-end gap-1.5 sm:gap-2">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Handbrake drift"
          onPointerDown={handleDown('handbrake')}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`${padBase} w-12 h-12 sm:w-14 sm:h-14 text-[10px] sm:text-[11px] ${
            visual.handbrake
              ? 'bg-amber-500/95 border-amber-200/70 text-stone-950 scale-95'
              : 'bg-[#0e1117]/80 border-white/15 text-amber-300'
          }`}
        >
          Drift
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Brake pedal"
          onPointerDown={handleDown('brake')}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`${padBase} w-14 h-14 sm:w-16 sm:h-20 text-xs ${
            visual.brake
              ? 'bg-red-600/95 border-red-300/70 text-white scale-95'
              : 'bg-[#0e1117]/80 border-white/15 text-red-400'
          }`}
        >
          Brake
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Throttle pedal"
          onPointerDown={handleDown('gas')}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`${padBase} w-16 h-20 sm:w-20 sm:h-28 text-xs sm:text-sm ${
            visual.gas
              ? 'bg-emerald-600/95 border-emerald-300/70 text-white scale-95'
              : 'bg-[#0e1117]/82 border-white/18 text-emerald-400'
          }`}
        >
          Gas
        </button>
      </div>
    </div>
  );
};
