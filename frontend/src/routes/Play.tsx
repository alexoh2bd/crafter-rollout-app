// Cursor (AI-assisted).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameSession } from "../hooks/useGameSession";
import GameCanvas from "../components/GameCanvas";
import FrameStatusOverlay from "../components/FrameStatusOverlay";
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
      if ([" ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      const action = KEY_TO_ACTION[e.key.toLowerCase()] ?? KEY_TO_ACTION[e.key];
      if (action !== undefined) {
        sendAction(action);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, sendAction]);

  const [uniqueUnlocked, setUniqueUnlocked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!frame?.achievements_unlocked_this_step?.length) return;
    setUniqueUnlocked((prev) => {
      const n = new Set(prev);
      for (const a of frame.achievements_unlocked_this_step) n.add(a);
      return n;
    });
  }, [frame]);
  useEffect(() => {
    if (phase === "connecting") setUniqueUnlocked(new Set());
  }, [phase]);

  const achCount = uniqueUnlocked.size;

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/80 bg-[#0e0e14]/90">
        <button
          onClick={() => navigate("/")}
          className="text-gray-500 hover:text-white text-sm transition-colors"
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

      <div className="flex flex-1 flex-col lg:flex-row gap-4 p-5 items-start justify-center overflow-auto">
        <div className="flex flex-col items-center gap-3 shrink-0">
          {frame?.obs ? (
            <GameCanvas obs={frame.obs} size={384}>
              <FrameStatusOverlay
                step={frame.step}
                reward={frame.reward}
                achievementTotal={achCount}
                health={frame.inventory.health}
                show={phase === "playing" || phase === "done"}
              />
            </GameCanvas>
          ) : (
            <div className="relative">
              <GameCanvas obs={null} size={384} />
            </div>
          )}
          <ActionBar
            actionName={frame?.action_name ?? null}
            step={frame?.step ?? 0}
          />
          {phase === "idle" && (
            <p className="text-gray-500 text-sm text-center max-w-md">
              Press Start, then use keyboard controls (open below if needed).
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

          <details className="w-full max-w-md rounded-lg border border-gray-800 bg-gray-900/50">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
              <span aria-hidden>⌨</span>
              Keyboard controls
            </summary>
            <div className="border-t border-gray-800 px-2 pb-3 pt-1">
              <KeybindingsHelp groups={HUMAN_PLAY_KEYBINDING_GROUPS} />
            </div>
          </details>
        </div>

        <div className="flex flex-col gap-4 w-full lg:w-72 lg:max-w-sm shrink-0 lg:min-h-[min(70vh,28rem)]">
          <InventoryDisplay inventory={frame?.inventory ?? null} />
          <AchievementPanel
            unlockedThisStep={frame?.achievements_unlocked_this_step ?? []}
            sessionPhase={phase}
          />
        </div>
      </div>
    </div>
  );
}
