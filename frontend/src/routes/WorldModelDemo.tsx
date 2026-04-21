// Cursor (AI-assisted).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionMode, WMGoalsResponse } from "../types";
import { API_URL, isProductionBuildPointingAtLocalhost, listWMGoals } from "../lib/api";
import { useGameSession } from "../hooks/useGameSession";
import GameCanvas from "../components/GameCanvas";
import LatentHeatmap from "../components/LatentHeatmap";
import SessionControls from "../components/SessionControls";
import PlanningInfo from "../components/PlanningInfo";

type WMMode = "wm_base" | "hwm" | "random_policy";

const MODE_META: Record<WMMode, { label: string; description: string; icon: string }> = {
  wm_base: {
    label: "Base WM",
    description: "Flat CEM planning using the base LeWM predictor.",
    icon: "🧠",
  },
  hwm: {
    label: "Hierarchical WM",
    description: "Two-level CEM: ActionEncoder + HighLevelPredictor.",
    icon: "🏗️",
  },
  random_policy: {
    label: "Random",
    description: "Uniform random actions — no neural network.",
    icon: "🎲",
  },
};

interface AdvancedConfig {
  H_lo: number;
  H_hi: number;
  n_samples: number;
  n_iters: number;
  fps: number;
}

const DEFAULT_CONFIG: AdvancedConfig = {
  H_lo: 10,
  H_hi: 3,
  n_samples: 100,
  n_iters: 3,
  fps: 4,
};

function apiHostLabel(): string {
  try {
    return new URL(API_URL).host;
  } catch {
    return API_URL;
  }
}

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
      <span className="w-24 text-xs text-gray-500 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-violet-500 cursor-pointer"
      />
      <span className="w-8 text-xs text-gray-200 text-right font-mono tabular-nums">{value}</span>
    </div>
  );
}

/** Small section label */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
      {children}
    </span>
  );
}

/** Glass-style panel */
function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-700/50 ${className}`}
      style={{
        background: "linear-gradient(145deg, rgba(17,17,27,0.85) 0%, rgba(24,24,37,0.85) 100%)",
        backdropFilter: "blur(10px)",
      }}
    >
      {children}
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
  const [goalsLoading, setGoalsLoading] = useState(true);

  const sessionMode: SessionMode =
    wmMode === "random_policy" ? "agent" : wmMode;

  const { phase, frame, error, start, stop, download } =
    useGameSession(sessionMode);

  useEffect(() => {
    setGoalsLoading(true);
    listWMGoals()
      .then((data) => {
        setGoalsData(data);
        setGoalsError(null);
      })
      .catch((e: unknown) =>
        setGoalsError(e instanceof Error ? e.message : "Failed to load goals"),
      )
      .finally(() => setGoalsLoading(false));
  }, []);

  const handleStart = () => {
    if (wmMode === "random_policy") {
      start({ checkpointId: "random", fps: config.fps });
      return;
    }
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
  const prodLocalApi = isProductionBuildPointingAtLocalhost();
  const goals = goalsData?.goals ?? [];

  const modeAvailable =
    wmMode === "random_policy"
      ? true
      : wmMode === "wm_base"
        ? wm_base_ok
        : hwm_ok;

  const isTabAvailable = (m: WMMode) => {
    if (goalsError) return false;
    if (m === "random_policy") return true;
    if (goalsLoading) return false;
    return m === "wm_base" ? wm_base_ok : hwm_ok;
  };

  const ckSource = goalsData?.checkpoint_source;
  const latentDim = goalsData?.latent_dim;

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{ background: "#09090b" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-800/80 bg-[#0e0e14]/90 backdrop-blur-sm sticky top-0 z-20">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8l5 5" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-100">World Model Demo</span>
          {ckSource === "s3_bucket" && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700/70 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              S3 live
              {goalsData?.s3_prefix != null && (
                <span className="font-mono text-emerald-300/70 ml-0.5">{goalsData.s3_prefix}</span>
              )}
            </span>
          )}
          {ckSource === "local_disk" && (
            <span className="hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-950 border border-sky-700/70 text-sky-400">
              Disk
            </span>
          )}
          {latentDim != null && (
            <span className="hidden md:inline text-[10px] text-gray-600 font-mono">
              z={latentDim}
            </span>
          )}
          <span className="hidden md:inline text-[10px] text-gray-700 font-mono">
            {apiHostLabel()}
          </span>
        </div>

        <SessionControls
          phase={phase}
          onStart={handleStart}
          onStop={stop}
          onDownload={download}
        />
      </header>

      {/* ── Production API misconfiguration banner ──────────────────── */}
      {prodLocalApi && (
        <div className="px-5 py-2.5 bg-amber-950/80 border-b border-amber-800/60 text-amber-200/90 text-xs leading-relaxed">
          <strong className="font-semibold text-amber-100">API URL misconfigured.</strong>{" "}
          This build uses <code className="text-amber-300">localhost</code> — set{" "}
          <code className="text-amber-300">VITE_API_URL</code> to your Railway URL in Vercel
          → Settings → Environment Variables, then redeploy.
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col xl:flex-row gap-5 p-5 overflow-auto">

        {/* ── Left column ─────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 gap-5">

          {/* Config panel (hidden while active) */}
          {!isActive && (
            <Panel className="overflow-hidden">
              {/* Mode tabs */}
              <div className="flex border-b border-gray-700/40">
                {(["wm_base", "hwm", "random_policy"] as const).map((m) => {
                  const available = isTabAvailable(m);
                  const active    = wmMode === m;
                  const showUnavail =
                    !goalsLoading && !available && !prodLocalApi && !goalsError && m !== "random_policy";
                  return (
                    <button
                      key={m}
                      onClick={() => setWmMode(m)}
                      disabled={!available}
                      title={
                        goalsError
                          ? "Could not reach API"
                          : goalsLoading && m !== "random_policy"
                            ? "Loading model status…"
                            : !available && m !== "random_policy"
                              ? "Checkpoint not loaded on server"
                              : MODE_META[m].description
                      }
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all
                        ${active
                          ? "border-violet-500 text-white"
                          : "border-transparent text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                        }`}
                    >
                      <span className="text-base leading-none">{MODE_META[m].icon}</span>
                      {MODE_META[m].label}
                      {goalsLoading && m !== "random_policy" && (
                        <span className="text-xs text-gray-600">(…)</span>
                      )}
                      {showUnavail && (
                        <span className="text-[10px] text-gray-600 bg-gray-800 rounded px-1">off</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-4 space-y-4">
                {/* Error / status messages */}
                {goalsError && (
                  <div className="flex items-start gap-2 text-yellow-400 text-xs bg-yellow-950/40 border border-yellow-800/50 rounded-lg px-3 py-2">
                    <span aria-hidden>⚠</span>
                    {goalsError}
                    {prodLocalApi && " — fix VITE_API_URL on Vercel and redeploy."}
                  </div>
                )}

                {!goalsLoading &&
                  wmMode !== "random_policy" &&
                  goalsData &&
                  !wm_base_ok &&
                  goalsData.checkpoint_source === "none" &&
                  !prodLocalApi && (
                    <div
                      role="status"
                      className="text-amber-200/90 text-xs border border-amber-800/50 bg-amber-950/30 rounded-lg px-3 py-2.5 space-y-2 leading-relaxed"
                    >
                      <p className="font-medium text-amber-100">
                        <code className="font-mono text-amber-50">lewm_base.pt</code> not loaded
                        (checkpoint source: none).
                      </p>
                      <ul className="list-disc pl-4 space-y-1.5 text-amber-200/80">
                        <li>
                          <span className="text-amber-100/95">From S3:</span>{" "}
                          <code className="text-amber-50">CHECKPOINTS_INFERENCE_SOURCE=s3</code> + bucket
                          creds (<code className="text-amber-50">AWS_S3_BUCKET_NAME</code>,{" "}
                          <code className="text-amber-50">AWS_ENDPOINT_URL</code>,{" "}
                          <code className="text-amber-50">AWS_ACCESS_KEY_ID</code>,{" "}
                          <code className="text-amber-50">AWS_SECRET_ACCESS_KEY</code>).
                        </li>
                        <li>
                          <span className="text-amber-100/95">From disk:</span>{" "}
                          <code className="text-amber-50">CHECKPOINTS_DIR</code> → place{" "}
                          <code className="text-amber-50">lewm_base.pt</code> there → restart.
                        </li>
                      </ul>
                    </div>
                  )}

                {/* Mode description */}
                <p className="text-xs text-gray-600">{MODE_META[wmMode].description}</p>

                {wmMode === "random_policy" ? (
                  <div className="max-w-sm">
                    <SectionLabel>Speed</SectionLabel>
                    <div className="mt-2">
                      <SliderRow
                        label="FPS"
                        value={config.fps}
                        min={1}
                        max={30}
                        step={1}
                        onChange={(v) => setConfig((c) => ({ ...c, fps: v }))}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end gap-5">
                      {/* Goal selector */}
                      <div className="flex flex-col gap-1.5">
                        <SectionLabel>Goal achievement</SectionLabel>
                        {goals.length > 0 ? (
                          <select
                            value={achievement}
                            onChange={(e) => setAchievement(e.target.value)}
                            className="bg-gray-800/80 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                          >
                            <option value="">— random exploration —</option>
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
                            className="bg-gray-800/80 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:border-violet-500 transition-colors"
                          />
                        )}
                      </div>

                      <button
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 pb-1.5 transition-colors"
                      >
                        {showAdvanced ? "Hide" : "Show"} advanced
                      </button>
                    </div>

                    {showAdvanced && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg bg-gray-800/40 rounded-lg p-3 border border-gray-700/40">
                        <SectionLabel>CEM config</SectionLabel>
                        <div className="col-span-full space-y-2">
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
                      </div>
                    )}
                  </div>
                )}

                {/* Idle hint */}
                {phase === "idle" && (
                  <p className="text-xs text-gray-600">
                    {!modeAvailable
                      ? "This model is not available — upload checkpoints or enable S3 inference."
                      : wmMode === "random_policy"
                        ? "Adjust FPS then press Start."
                        : "Configure a goal then press Start."}
                  </p>
                )}
              </div>
            </Panel>
          )}

          {/* ── Live views ─────────────────── */}
          <div className="flex flex-col lg:flex-row gap-5 items-start justify-center">
            {/* Game view */}
            <Panel className="flex flex-col items-center gap-3 p-4 flex-1 min-w-0">
              <SectionLabel>Environment · Crafter</SectionLabel>
              <GameCanvas obs={frame?.obs ?? null} />

              {/* Reward / health strip */}
              {frame && (
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-gray-500">
                    Reward <span className="text-gray-200 ml-1">{frame.reward.toFixed(2)}</span>
                  </span>
                  <span className="text-gray-700">·</span>
                  <span className="text-gray-500">
                    ❤️ <span className="text-gray-200 ml-0.5">{frame.inventory.health}</span>
                  </span>
                  <span className="text-gray-700">·</span>
                  <span className="text-gray-500">
                    Step <span className="text-gray-200 ml-1">{frame.step}</span>
                  </span>
                </div>
              )}
            </Panel>

            {/* Latent heatmap */}
            <Panel className="flex flex-col items-center gap-3 p-4 flex-1 min-w-0">
              <SectionLabel>Encoder latent · LeWM</SectionLabel>
              <LatentHeatmap latent={frame?.latent ?? null} size={512} />
              <p className="text-gray-700 text-[10px] max-w-[28rem] text-center leading-snug">
                {wmMode === "random_policy" ? (
                  <>LeWM encoder runs only in Base WM / HWM modes.</>
                ) : (
                  <>
                    Per-step latent from the encoder.{" "}
                    With <code className="text-gray-600">CHECKPOINTS_INFERENCE_SOURCE=s3</code>, weights
                    stay in RAM after the first bucket load.
                  </>
                )}
              </p>
            </Panel>
          </div>

          {/* ── Status strip ───────────────── */}
          <div className="flex justify-center">
            {phase === "connecting" && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <div className="w-4 h-4 rounded-full border-2 border-yellow-700 border-t-yellow-400 animate-spin" />
                Connecting to backend…
              </div>
            )}
            {phase === "playing" && (
              <p className="text-gray-500 text-xs text-center max-w-xl">
                {wmMode === "random_policy" ? (
                  <>
                    Streaming — step{" "}
                    <span className="text-gray-300 font-mono">{frame?.step ?? "…"}</span> · random
                    actions at ~{config.fps} FPS.
                  </>
                ) : (
                  <>
                    Streaming — step{" "}
                    <span className="text-gray-300 font-mono">{frame?.step ?? "…"}</span> · latent
                    updated after each plan step on the backend.
                  </>
                )}
              </p>
            )}
            {phase === "error" && error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 max-w-md text-center">
                <span aria-hidden>⚠</span> {error}
              </div>
            )}
            {phase === "done" && (
              <p className="text-emerald-400 text-sm font-medium">
                Episode complete — press Save above to download your rollout.
              </p>
            )}
          </div>
        </div>

        {/* ── Right sidebar ───────────────────────────────────────────── */}
        <div className="w-full xl:w-72 shrink-0 space-y-4">
          <PlanningInfo
            modelType={frame?.model_type ?? null}
            step={frame?.step ?? null}
            planningMs={frame?.planning_ms ?? null}
            zGoalDist={frame?.z_goal_dist ?? null}
            achievement={achievement}
            actionName={frame?.action_name ?? null}
            checkpointSource={goalsData?.checkpoint_source ?? null}
          />

          {/* Achievements */}
          {frame && frame.achievements_unlocked_this_step.length > 0 && (
            <Panel className="overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-700/40">
                <SectionLabel>Achievements</SectionLabel>
              </div>
              <ul className="divide-y divide-gray-700/30">
                {frame.achievements_unlocked_this_step.map((a) => (
                  <li key={a} className="flex items-center gap-2 px-4 py-2 text-xs text-emerald-300">
                    <span aria-hidden className="text-emerald-500">★</span>
                    {a.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
