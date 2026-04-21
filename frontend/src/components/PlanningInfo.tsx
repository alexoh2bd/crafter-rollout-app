// Cursor (AI-assisted).

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

const MODEL_LABELS: Record<string, { label: string; gradient: string; dot: string }> = {
  wm_base: {
    label: "Base WM",
    gradient: "from-indigo-500 to-indigo-600",
    dot: "bg-indigo-400",
  },
  hwm: {
    label: "Hierarchical WM",
    gradient: "from-violet-500 to-purple-600",
    dot: "bg-violet-400",
  },
};

const SOURCE_CFG: Record<string, { label: string; cls: string }> = {
  s3_bucket: { label: "S3",   cls: "text-emerald-400 bg-emerald-950/80 border-emerald-700/60" },
  local_disk: { label: "Disk", cls: "text-sky-400 bg-sky-950/50 border-sky-700/60" },
  none:       { label: "No WM", cls: "text-gray-500 bg-gray-900 border-gray-700/60" },
};

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-700/40 last:border-0">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`text-xs font-mono ${accent ? "text-violet-300 font-semibold" : "text-gray-200"}`}>
        {value}
      </span>
    </div>
  );
}

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
  const src  = checkpointSource ? (SOURCE_CFG[checkpointSource] ?? null) : null;

  const proximity = zGoalDist != null
    ? Math.max(0, Math.min(100, 100 - zGoalDist))
    : null;

  return (
    <div
      className="rounded-xl border border-gray-700/50 overflow-hidden"
      style={{
        background: "linear-gradient(145deg, rgba(17,17,27,0.9) 0%, rgba(24,24,37,0.9) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Planning
        </span>
        <div className="flex items-center gap-1.5">
          {src && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${src.cls}`}>
              {src.label}
            </span>
          )}
          {meta && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${meta.gradient}`}
            >
              {meta.label}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-0.5">
        {step === null ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="w-6 h-6 rounded-full border-2 border-gray-700 border-t-violet-500 animate-spin" />
            <p className="text-gray-600 text-xs">Waiting for first frame…</p>
          </div>
        ) : (
          <>
            {achievement && (
              <StatRow label="Goal" value={achievement.replace(/_/g, " ")} accent />
            )}
            <StatRow label="Step" value={step.toString()} />
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
          </>
        )}
      </div>

      {/* Goal proximity bar */}
      {proximity != null && (
        <div className="px-4 pb-4 pt-1">
          <div className="flex justify-between text-[10px] text-gray-600 mb-1.5">
            <span>Goal proximity</span>
            <span className="text-gray-400 font-mono">{proximity.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${proximity}%`,
                background: `linear-gradient(90deg, #7c3aed, #a78bfa)`,
                boxShadow: proximity > 60 ? "0 0 8px rgba(167,139,250,0.6)" : undefined,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
