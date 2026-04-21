import type { WMCheckpointSource } from "../types";

interface Props {
  modelType: string | null;
  step: number | null;
  planningMs: number | null;
  zGoalDist: number | null;
  achievement: string;
  actionName: string | null;
  checkpointSource?: WMCheckpointSource | null;
}

const MODEL_LABELS: Record<string, { label: string; color: string }> = {
  wm_base: { label: "Base WM", color: "text-indigo-400 bg-indigo-900/50 border-indigo-700" },
  hwm:     { label: "Hierarchical WM", color: "text-violet-400 bg-violet-900/50 border-violet-700" },
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  s3_bucket: {
    label: "S3 bucket",
    className: "text-emerald-300 bg-emerald-950/80 border-emerald-700",
  },
  local_disk: {
    label: "Local disk",
    className: "text-sky-300 bg-sky-950/50 border-sky-700",
  },
  none: {
    label: "No WM",
    className: "text-gray-500 bg-gray-900 border-gray-700",
  },
};

export default function PlanningInfo({
  modelType,
  step,
  planningMs,
  zGoalDist,
  achievement,
  actionName,
  checkpointSource,
}: Props) {
  const meta = modelType ? MODEL_LABELS[modelType] : null;
  const src =
    checkpointSource && SOURCE_LABELS[checkpointSource]
      ? SOURCE_LABELS[checkpointSource]
      : null;

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {/* Model badge */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Planning Info
        </h3>
        {src && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border ${src.className}`}
            title="Where the backend loaded LeWM / HWM weights"
          >
            {src.label}
          </span>
        )}
        {meta && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded border ${meta.color}`}
          >
            {meta.label}
          </span>
        )}
      </div>

      {step === null ? (
        <p className="text-gray-600 text-sm">Waiting for first frame…</p>
      ) : (
        <div className="space-y-2">
          {achievement && (
            <StatRow
              label="Goal"
              value={achievement.replace(/_/g, " ")}
            />
          )}
          <StatRow label="Step" value={step?.toString() ?? "—"} />
          <StatRow
            label="Latent dist"
            value={zGoalDist != null ? zGoalDist.toFixed(1) : "—"}
          />
          <StatRow
            label="Plan time"
            value={planningMs != null ? `${planningMs.toFixed(0)} ms` : "—"}
          />
          {actionName && (
            <StatRow label="Last action" value={actionName.replace(/_/g, " ")} />
          )}
        </div>
      )}

      {/* Latent distance progress bar */}
      {zGoalDist != null && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Far from goal</span>
            <span>Close</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-violet-500 transition-all duration-200"
              style={{
                // Clamp dist to [0, 100] and invert so full bar = close to goal
                width: `${Math.max(0, 100 - Math.min(100, zGoalDist))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
