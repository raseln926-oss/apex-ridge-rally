import React, { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

function isMobilePortrait(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth && window.innerWidth < 768;
}

export const LandscapeGuard: React.FC = () => {
  const [portrait, setPortrait] = useState<boolean>(() => isMobilePortrait());
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const check = () => {
      const next = isMobilePortrait();
      setPortrait(next);
      if (!next) {
        setDismissed(false);
      }
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!portrait || dismissed) {
    return null;
  }

  return (
    <div
      data-testid="landscape-guard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="landscape-guard-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0b0e14]/96 text-center"
    >
      <div className="max-w-xs w-full bg-[#131823] border border-white/14 rounded-xl p-6 shadow-2xl">
        <div className="mx-auto mb-4 w-14 h-14 rounded-xl bg-[#e05a2b]/18 border border-[#e05a2b]/45 flex items-center justify-center text-[#e05a2b]">
          <Smartphone className="w-7 h-7 rotate-90" />
        </div>
        <h2
          id="landscape-guard-title"
          className="font-display text-xl font-bold text-stone-50 mb-2"
        >
          Rotate Device to Landscape
        </h2>
        <p className="text-xs text-stone-300 leading-relaxed mb-5">
          Turn your phone sideways for wide-screen 3D racing and ergonomic left/right thumb controls.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-white/8 hover:bg-white/14 border border-white/12 text-xs font-semibold text-stone-200 transition-colors cursor-pointer"
        >
          Continue Anyway
        </button>
      </div>
    </div>
  );
};
