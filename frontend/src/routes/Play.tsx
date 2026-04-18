import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameSession } from "../hooks/useGameSession";
import GameCanvas from "../components/GameCanvas";
import ActionBar from "../components/ActionBar";
import InventoryDisplay from "../components/InventoryDisplay";
import AchievementPanel from "../components/AchievementPanel";
import SessionControls from "../components/SessionControls";

// Maps keyboard key to Crafter action index
const KEY_TO_ACTION: Record<string, number> = {
  w: 3,           // move_up
  s: 4,           // move_down
  a: 1,           // move_left
  d: 2,           // move_right
  e: 5,           // do
  " ": 5,         // do (space)
  "0": 6,         // sleep
  "1": 7,         // place_stone
  "2": 8,         // place_table
  "3": 9,         // place_furnace
  "4": 10,        // place_plant
  "5": 11,        // make_wood_pickaxe
  "6": 12,        // make_stone_pickaxe
  "7": 13,        // make_iron_pickaxe
  "8": 14,        // make_wood_sword
  "9": 15,        // make_stone_sword
};

export default function Play() {
  const navigate = useNavigate();
  const { phase, frame, start, sendAction, stop, download } =
    useGameSession("human");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      // Prevent page scroll on space/arrows
      if ([" ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      const action = KEY_TO_ACTION[e.key.toLowerCase()] ?? KEY_TO_ACTION[e.key];
      if (action !== undefined) {
        sendAction(action);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, sendAction]);

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
        <h2 className="text-base font-semibold">Human Play</h2>
        <SessionControls
          phase={phase}
          onStart={() => start()}
          onStop={stop}
          onDownload={download}
        />
      </div>

      {/* Main layout */}
      <div className="flex flex-1 gap-6 p-6 overflow-auto">
        {/* Canvas area */}
        <div className="flex flex-col items-center gap-3">
          <GameCanvas obs={frame?.obs ?? null} />
          <ActionBar
            actionName={frame?.action_name ?? null}
            step={frame?.step ?? 0}
          />
          {phase === "idle" && (
            <p className="text-gray-500 text-sm">Press Start, then use WASD + E to play.</p>
          )}
          {phase === "done" && (
            <p className="text-emerald-400 text-sm font-medium">
              Session complete — download your rollout above.
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 w-64 shrink-0">
          <InventoryDisplay inventory={frame?.inventory ?? null} />
          <AchievementPanel
            unlocked={frame?.achievements_unlocked_this_step ?? []}
          />
        </div>
      </div>

      {/* Key reference */}
      <div className="px-6 pb-4 text-xs text-gray-600">
        WASD — move &nbsp;|&nbsp; E / Space — do &nbsp;|&nbsp; 0 — sleep &nbsp;|&nbsp; 1–9 — place / make
      </div>
    </div>
  );
}
