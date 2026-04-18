import { useEffect, useState } from "react";
import type { CheckpointMeta } from "../types";
import { listCheckpoints } from "../lib/api";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export default function CheckpointSelector({ value, onChange }: Props) {
  const [checkpoints, setCheckpoints] = useState<CheckpointMeta[]>([]);

  useEffect(() => {
    listCheckpoints()
      .then((data) => {
        setCheckpoints(data);
        if (data.length > 0 && !value) {
          onChange(data[0].checkpoint_id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checkpoints.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Checkpoint
        </label>
        <p className="text-sm text-amber-400/90">
          No checkpoints available. Add weight files under CHECKPOINTS_DIR (e.g.
          ppo_teacher.pt) or upload via the API.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Checkpoint
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-indigo-400"
        aria-label="Select checkpoint"
      >
        {checkpoints.map((c) => (
          <option key={c.checkpoint_id} value={c.checkpoint_id}>
            {c.display_name}
          </option>
        ))}
      </select>
    </div>
  );
}
