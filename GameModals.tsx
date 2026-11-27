import React from 'react';
import { Film } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { GameState, RaceResultSnapshot } from '../game/types';
import { formatRaceTime } from './formatTime';

interface GameModalsProps {
  gameState: GameState;
  mapTitle: string;
  result: RaceResultSnapshot | null;
  hasReplay: boolean;
  user: User | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  authBusy: boolean;
  onSignInToSave: () => void;
  onWatchReplay: () => void;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export const GameModals: React.FC<GameModalsProps> = ({
  gameState,
  mapTitle,
  result,
  hasReplay,
  user,
  saveStatus,
  authBusy,
  onSignInToSave,
  onWatchReplay,
  onResume,
  onRestart,
  onTitle,
}) => {
  if (gameState !== 'paused' && gameState !== 'gameover') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/60">
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          className="w-full max-w-sm bg-[#12161f] border border-white/14 rounded-xl p-6 shadow-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400 mb-1">
            Stage Paused
          </p>
          <h2 id="pause-title" className="font-display text-2xl font-bold text-stone-50 mb-5">
            {mapTitle}
          </h2>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-lg bg-[#e05a2b] hover:bg-[#eb693b] text-white font-display text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#1b212e] hover:bg-[#232b3b] border border-white/12 text-stone-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              Restart Stage
            </button>
            <button
              type="button"
              onClick={onTitle}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-transparent hover:bg-white/5 border border-white/10 text-stone-300 font-semibold text-sm transition-colors cursor-pointer"
            >
              Title Screen
            </button>
          </div>
        </div>
      )}

      {gameState === 'gameover' && result && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-title"
          className="w-full max-w-lg max-h-[92dvh] overflow-y-auto touch-pan-y bg-[#12161f] border border-white/14 rounded-xl p-5 sm:p-6 shadow-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400 mb-1">
            {result.mode === 'race' ? 'Stage Complete' : 'Time Trial Complete'}
          </p>
          <h2 id="results-title" className="font-display text-2xl sm:text-3xl font-bold text-stone-50 mb-4">
            {result.mode === 'race'
              ? result.position === 1
                ? '1st Place Finish'
                : `${result.position}${result.position === 2 ? 'nd' : 'rd'} Place Finish`
              : 'Stage Cleared'}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
            <div className="bg-[#0b0e14] border border-white/10 rounded-lg p-3">
              <span className="block text-[11px] font-medium text-stone-400">
                Total Time
              </span>
              <span className="font-mono-num text-lg sm:text-xl font-bold text-stone-50">
                {formatRaceTime(result.totalTimeMs)}
              </span>
            </div>
            <div className="bg-[#0b0e14] border border-white/10 rounded-lg p-3">
              <span className="block text-[11px] font-medium text-stone-400">
                Best Lap
              </span>
              <span className="font-mono-num text-lg sm:text-xl font-bold text-amber-400">
                {formatRaceTime(result.bestLapMs)}
              </span>
            </div>
            <div className="bg-[#0b0e14] border border-white/10 rounded-lg p-3">
              <span className="block text-[11px] font-medium text-stone-400">
                Final Score
              </span>
              <span className="font-mono-num text-lg sm:text-xl font-bold text-emerald-400">
                {(result.score ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-[#0b0e14] border border-white/10 rounded-lg p-3">
              <span className="block text-[11px] font-medium text-stone-400">
                Top Speed
              </span>
              <span className="font-mono-num text-lg sm:text-xl font-bold text-stone-50">
                {result.topSpeedKmh} <span className="text-xs text-stone-400">km/h</span>
              </span>
            </div>
            <div className="bg-[#0b0e14] border border-white/10 rounded-lg p-3">
              <span className="block text-[11px] font-medium text-stone-400">
                {result.mode === 'race' ? 'Position' : 'Laps'}
              </span>
              <span className="font-mono-num text-lg sm:text-xl font-bold text-stone-50">
                {result.mode === 'race'
                  ? `${result.position}/${result.totalCars}`
                  : `${result.lapsCompleted}/${result.totalLaps}`}
              </span>
            </div>
            <div className="bg-[#0b0e14] border border-white/10 rounded-lg p-3">
              <span className="block text-[11px] font-medium text-stone-400">
                Near-Miss Passes
              </span>
              <span className="font-mono-num text-lg sm:text-xl font-bold text-sky-300">
                {result.overtakes ?? 0}
              </span>
            </div>
          </div>

          {result.isNewGhostPb && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-sky-950/60 border border-sky-400/30 text-xs font-medium text-sky-200">
              Personal Best Ghost recorded — race against your line next run.
            </div>
          )}

          {/* Cloud Logbook Status */}
          <div className="mb-5 px-3 py-2 rounded-lg bg-[#0b0e14] border border-white/10 flex items-center justify-between gap-3">
            {user ? (
              <span className="text-xs text-stone-300">
                {saveStatus === 'saving' && 'Saving run to cloud logbook...'}
                {saveStatus === 'saved' && 'Run saved to your cloud logbook.'}
                {saveStatus === 'error' && 'Could not save run to cloud.'}
                {saveStatus === 'idle' && 'Signed in to cloud logbook.'}
              </span>
            ) : (
              <>
                <span className="text-xs text-stone-400">
                  Sign in to save this run
                </span>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={onSignInToSave}
                  className="px-3 py-1.5 rounded-md bg-[#1b212e] hover:bg-[#232b3b] border border-white/14 text-xs font-semibold text-stone-100 cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  {authBusy ? 'Signing in...' : 'Sign in with Google'}
                </button>
              </>
            )}
          </div>

          <div className="space-y-2.5">
            {hasReplay && (
              <button
                type="button"
                onClick={onWatchReplay}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-display text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Film className="w-4 h-4" />
                Watch Replay
              </button>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onRestart}
                className="flex-1 min-h-[46px] px-5 py-2.5 rounded-lg bg-[#e05a2b] hover:bg-[#eb693b] text-white font-display text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Race Again
              </button>
              <button
                type="button"
                onClick={onTitle}
                className="flex-1 min-h-[46px] px-5 py-2.5 rounded-lg bg-[#1b212e] hover:bg-[#232b3b] border border-white/12 text-stone-100 font-semibold text-sm transition-colors cursor-pointer"
              >
                Title Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
