interface Props {
  value: number;
  onChange: (fps: number) => void;
}

export default function SpeedControl({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Speed — {value} FPS
      </label>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-400"
        aria-label="Agent speed (FPS)"
      />
    </div>
  );
}
