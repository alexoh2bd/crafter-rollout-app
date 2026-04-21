// Cursor (AI-assisted).

export interface AchievementEvent {
  step: number;
  names: string[];
}

interface Props {
  currentStep: number;
  /** Monotonic upper bound for the bar (e.g. last step when episode ends). */
  maxStep: number;
  events: AchievementEvent[];
  visible?: boolean;
}

/**
 * Horizontal episode bar with ticks at achievement steps and a playhead for current step.
 */
export default function EpisodeTimeline({
  currentStep,
  maxStep,
  events,
  visible = true,
}: Props) {
  if (!visible || maxStep <= 0) {
    return (
      <p className="text-[10px] text-gray-600 text-center w-full max-w-3xl">
        Timeline appears during playback.
      </p>
    );
  }

  const cap = Math.max(maxStep, 1);
  const playPct = Math.min(100, (currentStep / cap) * 100);

  return (
    <div className="w-full max-w-3xl mx-auto px-1">
      <div className="relative h-14 mb-1">
        {events.map((ev, i) => {
          const left = Math.min(100, (ev.step / cap) * 100);
          const label = ev.names.map((n) => n.replace(/_/g, " ")).join(", ");
          const short =
            label.length > 28 ? `${label.slice(0, 26)}…` : label;
          return (
            <div
              key={`${ev.step}-${i}`}
              className="absolute flex flex-col items-center pointer-events-none"
              style={{ left: `${left}%`, transform: "translateX(-50%)" }}
            >
              <span
                className="text-[9px] text-gray-500 max-w-[120px] text-center leading-tight truncate"
                title={label}
              >
                {short}
              </span>
              <span className="w-px h-3 bg-violet-500/80 mt-0.5" aria-hidden />
            </div>
          );
        })}
      </div>
      <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-violet-900/50 rounded-full transition-[width] duration-75"
          style={{ width: `${playPct}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)] z-10 transition-[left] duration-75"
          style={{ left: `${playPct}%`, transform: "translateX(-50%)" }}
          aria-label={`Current step ${currentStep}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
        <span>0</span>
        <span>
          step {currentStep} / {cap}
        </span>
        <span>{cap}</span>
      </div>
    </div>
  );
}
