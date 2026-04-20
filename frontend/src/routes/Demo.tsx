import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameSession } from "../hooks/useGameSession";
import GameCanvas from "../components/GameCanvas";
import AgentOverlay from "../components/AgentOverlay";
import CheckpointSelector from "../components/CheckpointSelector";
import SessionControls from "../components/SessionControls";
import SpeedControl from "../components/SpeedControl";

const ACTION_NAMES = [
  "noop", "move_left", "move_right", "move_up", "move_down",
  "do", "sleep", "place_stone", "place_table", "place_furnace",
  "place_plant", "make_wood_pickaxe", "make_stone_pickaxe",
  "make_iron_pickaxe", "make_wood_sword", "make_stone_sword", "make_iron_sword",
];

export default function Demo() {
  const navigate = useNavigate();
  const [checkpointId, setCheckpointId] = useState<string>("");
  const [fps, setFps] = useState<number>(4);

  const { phase, frame, error, start, stop, download } =
    useGameSession("agent");

  const handleStart = () => {
    start({ checkpointId: checkpointId || "random", fps });
  };

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
        <h2 className="text-base font-semibold">Agent Demo</h2>
        <SessionControls
          phase={phase}
          onStart={handleStart}
          onStop={stop}
          onDownload={download}
        />
      </div>

      {/* Config panel — shown before session starts */}
      {(phase === "idle" || phase === "done") && (
        <div className="flex items-center gap-8 px-6 py-4 bg-gray-900 border-b border-gray-800">
          <CheckpointSelector value={checkpointId} onChange={setCheckpointId} />
          <SpeedControl value={fps} onChange={setFps} />
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 gap-6 p-6 overflow-auto">
        {/* Canvas */}
        <div className="flex flex-col items-center gap-3">
          <GameCanvas obs={frame?.obs ?? null} />
          {phase === "idle" && (
            <p className="text-gray-500 text-sm">
              Select a checkpoint and press Start.
            </p>
          )}
          {phase === "error" && error && (
            <p className="text-red-400 text-sm font-medium max-w-md text-center">
              {error}
            </p>
          )}
          {phase === "done" && (
            <p className="text-emerald-400 text-sm font-medium">
              Session complete — download your rollout above.
            </p>
          )}
        </div>

        {/* Action prob overlay */}
        <div className="w-72 shrink-0">
          <AgentOverlay
            actionProbs={frame?.action_probs ?? null}
            actionNames={ACTION_NAMES}
          />
        </div>
      </div>
    </div>
  );
}
