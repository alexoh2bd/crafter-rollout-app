// Cursor (AI-assisted).

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameSession } from "../hooks/useGameSession";
import GameCanvas from "../components/GameCanvas";
import ActionBar from "../components/ActionBar";
import InventoryDisplay from "../components/InventoryDisplay";
import AchievementPanel from "../components/AchievementPanel";
import SessionControls from "../components/SessionControls";
import KeybindingsHelp from "../components/KeybindingsHelp";
import {
  HUMAN_PLAY_KEYBINDING_GROUPS,
  KEY_TO_ACTION,
} from "../lib/keybindings";

export default function Play() {
  const navigate = useNavigate();
  const { phase, frame, error, start, sendAction, stop, download } =
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
            <p className="text-gray-500 text-sm text-center max-w-md">
              Press Start, then use the keybindings below while playing.
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

        {/* Sidebar */}
        <div className="flex flex-col gap-4 w-64 shrink-0">
          <InventoryDisplay inventory={frame?.inventory ?? null} />
          <AchievementPanel
            unlocked={frame?.achievements_unlocked_this_step ?? []}
          />
        </div>
      </div>

      <div className="px-6 pb-6">
        <KeybindingsHelp groups={HUMAN_PLAY_KEYBINDING_GROUPS} />
      </div>
    </div>
  );
}
