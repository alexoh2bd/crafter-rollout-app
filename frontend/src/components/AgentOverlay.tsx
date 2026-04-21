// Cursor (AI-assisted).

interface Props {
  actionProbs: number[] | null;
  actionNames: string[];
}

export default function AgentOverlay({ actionProbs, actionNames }: Props) {
  if (!actionProbs) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Action Probs
        </h3>
        <p className="text-gray-600 text-sm">Waiting…</p>
      </div>
    );
  }

  const maxIdx = actionProbs.indexOf(Math.max(...actionProbs));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Action Probs
      </h3>
      <div className="space-y-1">
        {actionProbs.map((prob, i) => {
          const isMax = i === maxIdx;
          const pct = (prob * 100).toFixed(1);
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className={`w-28 truncate ${isMax ? "text-emerald-400 font-semibold" : "text-gray-400"}`}
              >
                {actionNames[i] ?? `action_${i}`}
              </span>
              <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-100 ${isMax ? "bg-emerald-400" : "bg-indigo-500"}`}
                  style={{ width: `${(prob * 100).toFixed(2)}%` }}
                />
              </div>
              <span className={`w-10 text-right ${isMax ? "text-emerald-400" : "text-gray-500"}`}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
