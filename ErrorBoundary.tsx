import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1015] p-6 text-stone-100">
          <div className="max-w-md w-full bg-[#141822] border border-white/14 rounded-xl p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400 mb-1">
              Application Error
            </p>
            <h1 className="font-display text-xl font-bold mb-2">
              Unable to Sync Session
            </h1>
            <p className="text-sm text-stone-300 mb-4 break-words">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-[#e05a2b] hover:bg-[#eb693b] text-white font-display text-sm font-bold uppercase tracking-wider cursor-pointer"
            >
              Reload Game
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
