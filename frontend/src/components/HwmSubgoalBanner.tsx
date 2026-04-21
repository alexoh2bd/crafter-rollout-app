// Cursor (AI-assisted).

import { useEffect, useState } from "react";

interface Props {
  goalLabel: string;
  subgoalDist: number | null | undefined;
  replanned: boolean | null | undefined;
  step: number;
}

/**
 * Persistent HWM context: session goal + L1 to current latent subgoal; flashes on macro replan.
 */
export default function HwmSubgoalBanner({
  goalLabel,
  subgoalDist,
  replanned,
  step,
}: Props) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (replanned) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 650);
      return () => clearTimeout(t);
    }
  }, [replanned, step]);

  return (
    <div
      className={`w-full max-w-[384px] rounded-lg border px-3 py-2 text-[11px] leading-snug transition-colors duration-200 ${
        flash
          ? "border-amber-500/80 bg-amber-950/40 text-amber-100"
          : "border-violet-800/60 bg-gray-900/90 text-gray-300"
      }`}
      role="status"
    >
      <span className="text-gray-500">Goal</span>{" "}
      <span className="font-medium text-white">
        {goalLabel ? goalLabel.replace(/_/g, " ") : "—"}
      </span>
      <span className="text-gray-600"> · </span>
      <span className="text-gray-500">Latent subgoal L1</span>{" "}
      <span className="font-mono text-violet-300 tabular-nums">
        {subgoalDist != null ? subgoalDist.toFixed(2) : "—"}
      </span>
      {replanned && (
        <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300 font-medium">
          macro replan
        </span>
      )}
    </div>
  );
}
