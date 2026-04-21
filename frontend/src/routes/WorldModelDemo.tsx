// Cursor (AI-assisted).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionMode, WMGoalsResponse } from "../types";
import { API_URL, isProductionBuildPointingAtLocalhost, listWMGoals } from "../lib/api";
import { useGameSession } from "../hooks/useGameSession";
import GameCanvas from "../components/GameCanvas";
import FrameStatusOverlay from "../components/FrameStatusOverlay";
import LatentHeatmap from "../components/LatentHeatmap";
import SessionControls from "../components/SessionControls";
import PlanningInfo from "../components/PlanningInfo";
import EpisodeTimeline, { type AchievementEvent } from "../components/EpisodeTimeline";
import HwmSubgoalBanner from "../components/HwmSubgoalBanner";

type WMMode = "wm_base" | "hwm" | "random_policy";

const MODE_META: Record<
  WMMode,
  { label: string; description: string; icon: string; contextLine: string }
> = {
  wm_base: {
    label: "Base WM",
    description: "Flat CEM planning using the base LeWM predictor.",
    icon: "🧠",
    contextLine:
      "Compare against HWM: flat CEM rolls primitive sequences with the LeWM rollout model only — no macro subgoals.",
  },
  hwm: {
    label: "Hierarchical WM",
    description: "Two-level CEM: ActionEncoder + HighLevelPredictor.",
    icon: "🏗️",
    contextLine:
      "High-level planner proposes latent subgoals via cem_high (macro rollouts); low-level CEM reaches each subgoal. Session goal is encoded from the achievement you pick — subgoals are latent targets, not separate named achievements.",
  },
  random_policy: {
    label: "Random",
    description: "Uniform random actions — no neural network.",
    icon: "🎲",
    contextLine:
      "Uniform random baseline for rollout collection — use to compare against learned planners.",
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
      {children}
    </span>
  );
}

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

function IdlePlaceholder({
  label,
  isConnecting,
}: {
  label: string;
  isConnecting: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-700/80 bg-[repeating-linear-gradient(315deg,_#27272a_0,_#27272a_6px,_#18181b_6px,_#18181b_12px)] text-center p-6 min-h-[240px] w-full max-w-[384px]"
      aria-hidden={isConnecting}
    >
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-3 text-xs text-gray-500">
        {isConnecting ? "Connecting to backend…" : "Press Start for live stream."}
      </p>
    </div>
  );
}

export default function WorldModelDemo() {
  const navigate = useNavigate();
  const [wmMode, setWmMode] = useState<WMMode>("wm_base");
  const [achievement, setAchievement] = useState<string>("");
  const [config, setConfig] = useState<AdvancedConfig>(DEFAULT_CONFIG);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [goalsData, setGoalsData] = useState<WMGoalsResponse | null>(null);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [goalsLoading, setGoalsLoading] = useState(true);

  const [achievementEvents, setAchievementEvents] = useState<AchievementEvent[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [timelineCap, setTimelineCap] = useState(512);

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

  useEffect(() => {
    if (phase === "connecting") {
      setAchievementEvents([]);
      setUnlockedAchievements(new Set());
      setTimelineCap(512);
    }
  }, [phase]);

  useEffect(() => {
    if (!frame?.achievements_unlocked_this_step?.length) return;
    const names = frame.achievements_unlocked_this_step;
    setUnlockedAchievements((prev) => {
      const n = new Set(prev);
      for (const a of names) n.add(a);
      return n;
    });
    setAchievementEvents((prev) => [
      ...prev,
      { step: frame.step, names: [...names] },
    ]);
  }, [frame]);

  useEffect(() => {
    if (frame) {
      setTimelineCap((c) => Math.max(c, frame.step, 64));
    }
  }, [frame]);

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

  const defaultGoalForStart = (): string => {
    const goals = goalsData?.goals ?? [];
    const pick = goals.find((g) => g === "collect_wood") ?? goals[0] ?? "";
    return pick;
  };

  const handleStartWithDefaults = () => {
    if (wmMode === "random_policy") {
      start({ checkpointId: "random", fps: config.fps });
      return;
    }
    const g = defaultGoalForStart();
    setAchievement(g);
    start({
      wmAchievement: g || undefined,
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

  const showTimeline = phase === "playing" || phase === "done";
  const achievementTotal = unlockedAchievements.size;
  const currentStep = frame?.step ?? 0;

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{ background: "#09090b" }}
    >
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

      {prodLocalApi && (
        <div className="px-5 py-2.5 bg-amber-950/80 border-b border-amber-800/60 text-amber-200/90 text-xs leading-relaxed">
          <strong className="font-semibold text-amber-100">API URL misconfigured.</strong>{" "}
          This build uses <code className="text-amber-300">localhost</code> — set{" "}
          <code className="text-amber-300">VITE_API_URL</code> to your Railway URL in Vercel
          → Settings → Environment Variables, then redeploy.
        </div>
      )}

      <div className="flex flex-1 flex-col xl:flex-row gap-5 p-5 overflow-auto">
        <div className="flex flex-col flex-1 min-w-0 gap-5">
          {!isActive && (
            <Panel className="overflow-hidden">
              <div className="flex border-b border-gray-700/40">
                {(["wm_base", "hwm", "random_policy"] as const).map((m) => {
                  const available = isTabAvailable(m);
                  const active = wmMode === m;
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
                <p className="text-xs text-gray-400 leading-relaxed border-l-2 border-violet-600/50 pl-3">
                  {MODE_META[wmMode].contextLine}
                </p>

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
                          <code className="text-amber-50">AWS_ENDPOINT_URL</code>, etc.).
                        </li>
                        <li>
                          <span className="text-amber-100/95">From disk:</span>{" "}
                          <code className="text-amber-50">CHECKPOINTS_DIR</code> →{" "}
                          <code className="text-amber-50">lewm_base.pt</code> → restart.
                        </li>
                      </ul>
                    </div>
                  )}

                <p className="text-xs text-gray-600">{MODE_META[wmMode].description}</p>

                {!configExpanded && wmMode !== "random_policy" && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      onClick={handleStartWithDefaults}
                      disabled={!modeAvailable || goalsLoading}
                      className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                    >
                      Start with defaults
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfigExpanded(true)}
                      className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm transition-colors"
                    >
                      Configure session
                    </button>
                    <span className="text-[10px] text-gray-600">
                      Goal defaults to{" "}
                      <code className="text-gray-500">{defaultGoalForStart() || "exploration"}</code>
                    </span>
                  </div>
                )}

                {(configExpanded || wmMode === "random_policy") && (
                  <>
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
                          {configExpanded && (
                            <button
                              type="button"
                              onClick={() => setConfigExpanded(false)}
                              className="text-xs text-gray-600 hover:text-gray-400 pb-1.5"
                            >
                              Collapse
                            </button>
                          )}
                        </div>

                        {showAdvanced && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg bg-gray-800/40 rounded-lg p-3 border border-gray-700/40">
                            <div className="col-span-full">
                              <SectionLabel>CEM config</SectionLabel>
                            </div>
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
                  </>
                )}

                {phase === "idle" && (
                  <p className="text-xs text-gray-600">
                    {!modeAvailable
                      ? "This model is not available — upload checkpoints or enable S3 inference."
                      : wmMode === "random_policy"
                        ? "Set FPS, then press Start in the header (or expand to adjust)."
                        : configExpanded
                          ? "Choose a goal and press Start in the header."
                          : "Use Start with defaults, open Configure session, or press Start in the header."}
                  </p>
                )}
              </div>
            </Panel>
          )}

          <div className="flex flex-col lg:flex-row gap-5 items-start justify-center">
            <Panel className="flex flex-col items-center gap-3 p-4 flex-1 min-w-0">
              <SectionLabel>Environment · Crafter</SectionLabel>
              {wmMode === "hwm" &&
                frame?.model_type === "hwm" &&
                (phase === "playing" || phase === "done") && (
                  <HwmSubgoalBanner
                    goalLabel={achievement}
                    subgoalDist={frame.hwm_subgoal_dist}
                    replanned={frame.hwm_replanned ?? false}
                    step={frame.step}
                  />
                )}
              {frame?.obs ? (
                <GameCanvas obs={frame.obs} size={384}>
                  <FrameStatusOverlay
                    step={frame.step}
                    reward={frame.reward}
                    achievementTotal={achievementTotal}
                    health={frame.inventory.health}
                    show={phase === "playing" || phase === "done"}
                  />
                </GameCanvas>
              ) : (
                <IdlePlaceholder
                  label="Live frame"
                  isConnecting={phase === "connecting"}
                />
              )}
            </Panel>

            <Panel className="flex flex-col items-center gap-3 p-4 flex-1 min-w-0">
              <SectionLabel>Encoder latent · LeWM</SectionLabel>
              {!isActive || phase === "connecting" ? (
                <IdlePlaceholder
                  label="Encoder output"
                  isConnecting={phase === "connecting"}
                />
              ) : (
                <LatentHeatmap
                  latent={frame?.latent ?? null}
                  size={384}
                  latentDim={latentDim}
                  randomPolicyMode={wmMode === "random_policy"}
                />
              )}
            </Panel>
          </div>

          {showTimeline && (
            <EpisodeTimeline
              currentStep={currentStep}
              maxStep={timelineCap}
              events={achievementEvents}
              visible
            />
          )}

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

          {frame && frame.achievements_unlocked_this_step.length > 0 && (
            <Panel className="overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-700/40">
                <SectionLabel>This step</SectionLabel>
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
