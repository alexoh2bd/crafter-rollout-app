import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-10 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Crafter Rollout Collector
        </h1>
        <p className="mt-3 text-gray-400 text-lg">
          Play Crafter in the browser or watch a trained policy run.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <button
          onClick={() => navigate("/play")}
          className="px-10 py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-xl font-semibold shadow-lg"
        >
          Play
        </button>
        <button
          onClick={() => navigate("/demo")}
          className="px-10 py-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 transition-colors text-white text-xl font-semibold shadow-lg"
        >
          Watch AI
        </button>
      </div>
    </div>
  );
}
