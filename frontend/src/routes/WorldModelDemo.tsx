import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionMode, WMGoalsResponse } from "../types";
import { listWMGoals } from "../lib/api";
import { useGameSession } from "../hooks/useGameSession";
import GameCanvas from "../components/GameCanvas";
import SessionControls from "../components/SessionControls";
import PlanningInfo from "../components/PlanningInfo";

type WMMode = "wm_base" | "hwm";

const MODE_META: Record<WMMode, { label: string; description: string }> = {
  wm_base: {
    label: "Base WM",
    description: "Flat CEM planning using only the base LeWM predictor.",
  },
  hwm: {
    label: "Hierarchical WM",
    description: "Two-level CEM: macro-actions from ActionEncoder + HighLevelPredictor.",
  },
};

interface AdvancedConfig {
  H_lo: number;
  H_hi: number;
  n_samples: number;
  n_iters: number;
}

const DEFAULT_CONFIG: AdvancedConfig = {
  H_lo: 10,
  H_hi: 3,
  n_samples: 100,
  n_iters: 3,
};

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-gray-400 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-violet-500"
      />
      <span className="w-8 text-xs text-white text-right font-mono">{value}</span>
    </div>
  );
}

export default function WorldModelDemo() {
  const navigate = useNavigate();
  const [wmMode, setWmMode] = useState<WMMode>("wm_base");
  const [achievement, setAchievement] = useState<string>("");
  const [config, setConfig] = useState<AdvancedConfig>(DEFAULT_CONFIG);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [goalsData, setGoalsData] = useState<WMGoalsResponse | null>(null);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  const activeMode: SessionMode = wmMode;

  const { phase, frame, error, start, stop, download } =
    useGameSession(activeMode);

  useEffect(() => {
    listWMGoals()
      .then(setGoalsData)
      .catch((e: unknown) =>
        setGoalsError(e instanceof Error ? e.message : "Failed to load goals"),
      );
  }, []);

  const handleStart = () => {
    start({
      wmAchievement: achievement || undefined,
      wmHLo: config.H_lo,
      wmHHi: config.H_hi,
      wmNSamples: config.n_samples,
      wmNIters: config.n_iters,
    });
  };

  const isActive = phase === "playing" || phase === "connecting";
  const wm_base_ok = goalsData?.wm_base_available ?? false;
  const hwm_ok = goalsData?.hwm_available ?? false;
  const goals = goalsData?.goals ?? [];

  const modeAvailable = wmMode === "wm_base" ? wm_base_ok : hwm_ok;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <button
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-base font-semibold">World Model Demo</h2>
        <SessionControls
          phase={phase}
          onStart={handleStart}
          onStop={stop}
          onDownload={download}
        />
      </div>

      {/* Config panel */}
      {!isActive && (
        <div className="px-6 py-4 bg-gray-900 border-b border-gray-800 space-y-4">
          {/* Model selector tabs */}
          <div className="flex gap-2">
            {(["wm_base", "hwm"] as WMMode[]).map((m) => {
              const available = m === "wm_base" ? wm_base_ok : hwm_ok;
              const active = wmMode === m;
              return (
                <button
                  key={m}
                  onClick={() => setWmMode(m)}
                  disabled={!available}
                  title={!available ? "Checkpoint not loaded" : MODE_META[m].description}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                    ${active
                      ? "bg-violet-700 border-violet-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                >
                  {MODE_META[m].label}
                  {!available && (
                    <span className="ml-2 text-xs text-gray-500">(unavailable)</span>
                  )}
                </button>
              );
            })}
          </div>

          {goalsError && (
            <p className="text-yellow-500 text-xs">{goalsError}</p>
          )}

          <div className="flex flex-wrap items-end gap-6">
            {/* Achievement selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Goal achievement</label>
              {goals.length > 0 ? (
                <select
                  value={achievement}
                  onChange={(e) => setAchievement(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">— no goal (random exploration) —</option>
                  {goals.map((g) => (
                    <option key={g} value={g}>
                      {g.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. collect_wood"
                  value={achievement}
                  onChange={(e) => setAchievement(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm w-52 focus:outline-none focus:border-violet-500"
                />
              )}
            </div>

            {/* Advanced config toggle */}
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-gray-400 hover:text-white underline underline-offset-2 pb-1.5"
            >
              {showAdvanced ? "Hide" : "Show"} advanced config
            </button>
          </div>

          {/* Advanced sliders */}
          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
              <SliderRow
                label="H_lo (horizon)"
                value={config.H_lo}
                min={3}
                max={20}
                step={1}
                onChange={(v) => setConfig((c) => ({ ...c, H_lo: v }))}
              />
              {wmMode === "hwm" && (
                <SliderRow
                  label="H_hi (macro)"
                  value={config.H_hi}
                  min={1}
                  max={6}
                  step={1}
                  onChange={(v) => setConfig((c) => ({ ...c, H_hi: v }))}
                />
              )}
              <SliderRow
                label="Samples"
                value={config.n_samples}
                min={20}
                max={500}
                step={10}
                onChange={(v) => setConfig((c) => ({ ...c, n_samples: v }))}
              />
              <SliderRow
                label="CEM iters"
                value={config.n_iters}
                min={1}
                max={8}
                step={1}
                onChange={(v) => setConfig((c) => ({ ...c, n_iters: v }))}
              />
            </div>
          )}

          {/* Mode description */}
          <p className="text-xs text-gray-500">{MODE_META[wmMode].description}</p>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 gap-6 p-6 overflow-auto">
        {/* Canvas */}
        <div className="flex flex-col items-center gap-3">
          <GameCanvas obs={frame?.obs ?? null} />

          {phase === "idle" && (
            <p className="text-gray-500 text-sm">
              {modeAvailable
                ? "Configure a goal and press Start."
                : "This model is not available — place the checkpoint in backend/checkpoints/."}
            </p>
          )}
          {phase === "playing" && (
            <p className="text-gray-400 text-xs">
              Planning in progress — frames stream as inference completes.
            </p>
          )}
          {phase === "error" && error && (
            <p className="text-red-400 text-sm font-medium max-w-md text-center">
              {error}
            </p>
          )}
          {phase === "done" && (
            <p className="text-emerald-400 text-sm font-medium">
              Episode complete — download your rollout above.
            </p>
          )}
        </div>

        {/* Planning info sidebar */}
        <div className="w-72 shrink-0 space-y-4">
          <PlanningInfo
            modelType={frame?.model_type ?? null}
            step={frame?.step ?? null}
            planningMs={frame?.planning_ms ?? null}
            zGoalDist={frame?.z_goal_dist ?? null}
            achievement={achievement}
            actionName={frame?.action_name ?? null}
          />

          {/* Achievements unlocked */}
          {frame && frame.achievements_unlocked_this_step.length > 0 && (
            <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                Achievements
              </h3>
              <ul className="space-y-1">
                {frame.achievements_unlocked_this_step.map((a) => (
                  <li key={a} className="text-xs text-emerald-300">
                    {a.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reward + inventory summary */}
          {frame && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Reward</span>
                <span className="font-mono text-white">{frame.reward.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Health</span>
                <span className="font-mono text-white">{frame.inventory.health}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
