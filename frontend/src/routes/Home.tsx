// Cursor (AI-assisted).

import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-4 overflow-hidden relative">
      {/* Ambient glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(139,92,246,0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/4 w-[400px] h-[300px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(99,102,241,0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-14 text-center">
        {/* Logo mark */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-xl"
            style={{
              background:
                "linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)",
              boxShadow: "0 0 40px rgba(109,40,217,0.5)",
            }}
          >
            🌍
          </div>
          <div>
            <h1
              className="text-5xl font-extrabold tracking-tight"
              style={{
                background: "linear-gradient(90deg, #c4b5fd 0%, #818cf8 50%, #38bdf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Crafter
            </h1>
            <p className="mt-1 text-gray-500 text-base font-medium tracking-widest uppercase text-sm">
              Rollout Collector
            </p>
          </div>
        </div>

        <p className="text-gray-400 text-lg max-w-sm leading-relaxed">
          Play the Crafter environment or watch world models plan in real-time.
        </p>

        {/* Cards */}
        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-md">
          <button
            onClick={() => navigate("/play")}
            className="group flex-1 relative overflow-hidden rounded-2xl border border-indigo-700/50 bg-indigo-950/40 px-8 py-8 text-left transition-all duration-200 hover:border-indigo-500 hover:bg-indigo-950/60 hover:shadow-[0_0_30px_rgba(99,102,241,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div className="text-3xl mb-3">🎮</div>
            <div className="text-white font-bold text-xl mb-1 group-hover:text-indigo-200 transition-colors">
              Play
            </div>
            <div className="text-gray-500 text-sm leading-snug">
              Control the agent yourself, collect rollouts.
            </div>
            <div className="absolute bottom-4 right-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg">
              →
            </div>
          </button>

          <button
            onClick={() => navigate("/wm-demo")}
            className="group flex-1 relative overflow-hidden rounded-2xl border border-violet-700/50 bg-violet-950/40 px-8 py-8 text-left transition-all duration-200 hover:border-violet-500 hover:bg-violet-950/60 hover:shadow-[0_0_30px_rgba(139,92,246,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <div className="text-3xl mb-3">🧠</div>
            <div className="text-white font-bold text-xl mb-1 group-hover:text-violet-200 transition-colors">
              World Models
            </div>
            <div className="text-gray-500 text-sm leading-snug">
              Watch LeWM and HWM plan live via S3 inference.
            </div>
            <div className="absolute bottom-4 right-4 text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg">
              →
            </div>
          </button>
        </div>

        <p className="text-gray-700 text-xs">
          Powered by FastAPI + Railway · Frontend on Vercel
        </p>
      </div>
    </div>
  );
}
