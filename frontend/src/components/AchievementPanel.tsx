// Cursor (AI-assisted).

import { useEffect, useRef, useState } from "react";
import { ACHIEVEMENT_ORDER } from "../lib/achievements";

interface Props {
  unlockedThisStep: string[];
  /** When this becomes `connecting`, cumulative unlocks reset for a new session. */
  sessionPhase?: "idle" | "connecting" | "playing" | "done" | "error";
}

export default function AchievementPanel({ unlockedThisStep, sessionPhase }: Props) {
  const [allUnlocked, setAllUnlocked] = useState<Set<string>>(new Set());
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionPhase === "connecting") {
      setAllUnlocked(new Set());
      setRecentlyUnlocked(new Set());
    }
  }, [sessionPhase]);

  useEffect(() => {
    if (unlockedThisStep.length === 0) return;

    setAllUnlocked((prev) => {
      const newOnes = unlockedThisStep.filter((a) => !prev.has(a));
      if (newOnes.length === 0) return prev;
      setRecentlyUnlocked((r) => new Set([...r, ...newOnes]));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setRecentlyUnlocked(new Set());
      }, 2000);
      return new Set([...prev, ...newOnes]);
    });
  }, [unlockedThisStep]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col min-h-0 max-h-[min(70vh,32rem)]">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 shrink-0">
        Achievements
      </h3>
      <ul className="space-y-0.5 overflow-y-auto text-sm pr-1">
        {ACHIEVEMENT_ORDER.map((name) => {
          const got = allUnlocked.has(name);
          const isNew = recentlyUnlocked.has(name);
          return (
            <li
              key={name}
              className={`flex items-center gap-2 px-1.5 py-0.5 rounded font-mono text-xs ${
                isNew
                  ? "bg-yellow-500/20 text-yellow-200"
                  : got
                    ? "text-gray-200"
                    : "text-gray-600"
              }`}
            >
              <span className="w-4 shrink-0 text-center" aria-hidden>
                {got ? "☑" : "☐"}
              </span>
              <span className={got ? "text-gray-200" : "text-gray-500"}>
                {name.replace(/_/g, " ")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
