// Cursor (AI-assisted).

interface Props {
  step: number | null;
  reward: number | null;
  achievementTotal: number;
  health?: number | null;
  /** Show overlay (e.g. when frame exists or session active) */
  show?: boolean;
}

/**
 * Top-right readout on the game frame: running state, not a control.
 */
export default function FrameStatusOverlay({
  step,
  reward,
  achievementTotal,
  health,
  show = true,
}: Props) {
  if (!show || step === null) return null;

  return (
    <div
      className="pointer-events-none absolute top-2 right-2 z-10 max-w-[min(100%,20rem)] rounded-md border border-gray-700/80 bg-black/70 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-gray-200 shadow-lg backdrop-blur-sm sm:text-xs"
      aria-live="polite"
    >
      <span className="text-gray-500">STEP</span>{" "}
      <span className="tabular-nums text-white">{step}</span>
      <span className="mx-1.5 text-gray-600">·</span>
      <span className="text-gray-500">REWARD</span>{" "}
      <span className="tabular-nums text-white">
        {reward != null ? reward.toFixed(1) : "—"}
      </span>
      {health != null && (
        <>
          <span className="mx-1.5 text-gray-600">·</span>
          <span className="text-gray-500">HP</span>{" "}
          <span className="tabular-nums text-white">{health}</span>
        </>
      )}
      <span className="mx-1.5 text-gray-600">·</span>
      <span className="tabular-nums text-violet-300">{achievementTotal}</span>{" "}
      <span className="text-gray-500">achievements</span>
    </div>
  );
}
