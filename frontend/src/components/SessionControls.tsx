// Cursor (AI-assisted).

import type { SessionPhase } from "../hooks/useGameSession";

interface Props {
  phase: SessionPhase;
  onStart: () => void;
  onStop: () => void;
  onDownload: () => void;
}

const PHASE_BADGE: Record<SessionPhase, { label: string; className: string }> = {
  idle:       { label: "idle",       className: "bg-gray-800 text-gray-500 border-gray-700" },
  connecting: { label: "connecting", className: "bg-yellow-950 text-yellow-400 border-yellow-700 animate-pulse" },
  playing:    { label: "live",       className: "bg-emerald-950 text-emerald-400 border-emerald-700" },
  done:       { label: "done",       className: "bg-sky-950 text-sky-400 border-sky-700" },
  error:      { label: "error",      className: "bg-red-950 text-red-400 border-red-800" },
};

export default function SessionControls({ phase, onStart, onStop, onDownload }: Props) {
  const isActive = phase === "playing" || phase === "connecting";
  const isDone   = phase === "done";
  const badge    = PHASE_BADGE[phase];

  return (
    <div className="flex items-center gap-2" aria-label="Session controls">
      {/* Phase pill */}
      <span
        className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}
      >
        {phase === "playing" && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
        )}
        {badge.label}
      </span>

      {/* Start */}
      <button
        onClick={onStart}
        disabled={isActive}
        aria-label="Start session"
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold
          bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed
          text-white transition-all duration-150 shadow-sm hover:shadow-violet-500/30 hover:shadow-md"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
          <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
        </svg>
        {phase === "connecting" ? "Connecting…" : "Start"}
      </button>

      {/* Stop */}
      <button
        onClick={onStop}
        disabled={!isActive}
        aria-label="Stop session"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
          border border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-gray-600
          disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-all duration-150"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
        </svg>
        Stop
      </button>

      {/* Download (only after done) */}
      {isDone && (
        <button
          onClick={onDownload}
          aria-label="Download rollout"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
            bg-emerald-700 hover:bg-emerald-600 text-white transition-all duration-150
            shadow-sm hover:shadow-emerald-500/30 hover:shadow-md"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v7m0 0l-3-3m3 3l3-3M3 13h10" />
          </svg>
          Save
        </button>
      )}
    </div>
  );
}
