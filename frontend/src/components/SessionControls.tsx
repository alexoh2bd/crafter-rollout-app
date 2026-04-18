import type { SessionPhase } from "../hooks/useGameSession";

interface Props {
  phase: SessionPhase;
  onStart: () => void;
  onStop: () => void;
  onDownload: () => void;
}

export default function SessionControls({
  phase,
  onStart,
  onStop,
  onDownload,
}: Props) {
  const isActive = phase === "playing" || phase === "connecting";
  const isDone = phase === "done";

  return (
    <div className="flex items-center gap-3" aria-label="Session controls">
      <button
        onClick={onStart}
        disabled={isActive}
        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {phase === "connecting" ? "Connecting…" : "Start"}
      </button>

      <button
        onClick={onStop}
        disabled={!isActive}
        className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        Stop
      </button>

      {isDone && (
        <button
          onClick={onDownload}
          className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
        >
          Download Rollout
        </button>
      )}

      <span className="text-xs text-gray-500 capitalize">{phase}</span>
    </div>
  );
}
