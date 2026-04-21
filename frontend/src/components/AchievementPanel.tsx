// Cursor (AI-assisted).

import { useEffect, useRef, useState } from "react";

interface Props {
  unlocked: string[];
}

export default function AchievementPanel({ unlocked }: Props) {
  const [allUnlocked, setAllUnlocked] = useState<Set<string>>(new Set());
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (unlocked.length === 0) return;

    const newOnes = unlocked.filter((a) => !allUnlocked.has(a));
    if (newOnes.length === 0) return;

    setAllUnlocked((prev) => new Set([...prev, ...newOnes]));
    setRecentlyUnlocked((prev) => new Set([...prev, ...newOnes]));

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setRecentlyUnlocked(new Set());
    }, 2000);
  }, [unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (allUnlocked.size === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Achievements
        </h3>
        <p className="text-gray-600 text-sm">None yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Achievements ({allUnlocked.size})
      </h3>
      <ul className="space-y-1">
        {[...allUnlocked].map((name) => {
          const isNew = recentlyUnlocked.has(name);
          return (
            <li
              key={name}
              className={`text-sm px-2 py-1 rounded transition-colors duration-500 ${
                isNew
                  ? "bg-yellow-500 text-gray-900 font-semibold"
                  : "text-gray-300"
              }`}
            >
              {name.replace(/_/g, " ")}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
