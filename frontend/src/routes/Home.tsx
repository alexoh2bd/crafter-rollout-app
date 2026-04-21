// Cursor (AI-assisted).

import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center px-4 py-12 overflow-hidden relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(139,92,246,0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-4xl">
        <div className="text-center">
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{
              background: "linear-gradient(90deg, #c4b5fd 0%, #818cf8 50%, #38bdf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Crafter Rollout Collector
          </h1>
          <p className="mt-2 text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
            Research hub: compare world-model modes (recorded rollouts below), run live inference from
            your API, or collect human baselines.
          </p>
        </div>

        {/* Compare — flat CEM vs HWM (bundled GIFs) */}
        <section className="w-full space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest text-center">
            1 · Compare Base WM vs HWM
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <figure className="rounded-xl border border-gray-700/80 bg-black/40 overflow-hidden flex flex-col">
              <figcaption className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 border-b border-gray-800">
                Base WM · flat CEM
              </figcaption>
              <div className="flex items-center justify-center p-2 bg-[#0c0c0e]">
                <img
                  src="/recordings/flat1.gif"
                  alt="Recorded Crafter rollout: Base world model, flat CEM planning"
                  className="w-full max-h-[min(50vh,420px)] object-contain rounded-md [image-rendering:pixelated]"
                  loading="eager"
                  decoding="async"
                />
              </div>
              <p className="text-gray-600 text-[11px] px-3 py-2 leading-snug">
                Same seed and goal as HWM — LeWM rollout only, no macro subgoals.
              </p>
            </figure>
            <figure className="rounded-xl border border-violet-800/50 bg-black/40 overflow-hidden flex flex-col">
              <figcaption className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 border-b border-violet-900/40">
                Hierarchical WM
              </figcaption>
              <div className="flex items-center justify-center p-2 bg-[#0c0c0e]">
                <img
                  src="/recordings/hwm1.gif"
                  alt="Recorded Crafter rollout: hierarchical world model with macro planning"
                  className="w-full max-h-[min(50vh,420px)] object-contain rounded-md [image-rendering:pixelated]"
                  loading="eager"
                  decoding="async"
                />
              </div>
              <p className="text-gray-600 text-[11px] px-3 py-2 leading-snug">
                Two-level CEM — high-level latent subgoals plus low-level LeWM rollout.
              </p>
            </figure>
          </div>
        </section>

        <p className="text-gray-600 text-xs text-center max-w-md">
          Default landing emphasizes the scientific comparison. Use live inference when your Railway
          API is configured.
        </p>

        {/* Live · Human · Random */}
        <section className="w-full space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest text-center">
            Run sessions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => navigate("/wm-demo")}
              className="rounded-xl border border-violet-700/50 bg-violet-950/30 px-5 py-5 text-left hover:border-violet-500 hover:bg-violet-950/50 transition-colors"
            >
              <div className="text-xl mb-2">⚡</div>
              <div className="text-white font-semibold text-sm">Live inference</div>
              <p className="text-gray-500 text-xs mt-1 leading-snug">
                Base WM, HWM, or random policy via WebSocket.
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/play")}
              className="rounded-xl border border-indigo-700/50 bg-indigo-950/30 px-5 py-5 text-left hover:border-indigo-500 hover:bg-indigo-950/50 transition-colors"
            >
              <div className="text-xl mb-2">🎮</div>
              <div className="text-white font-semibold text-sm">Human play</div>
              <p className="text-gray-500 text-xs mt-1 leading-snug">
                Manual control and rollout collection.
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/wm-demo")}
              className="rounded-xl border border-gray-700 bg-gray-900/50 px-5 py-5 text-left hover:border-gray-500 transition-colors"
            >
              <div className="text-xl mb-2">🎲</div>
              <div className="text-white font-semibold text-sm">Random baseline</div>
              <p className="text-gray-500 text-xs mt-1 leading-snug">
                Open World Models → Random tab for uniform actions.
              </p>
            </button>
          </div>
        </section>

        <p className="text-gray-700 text-xs">FastAPI + Railway · Vercel</p>
      </div>
    </div>
  );
}
