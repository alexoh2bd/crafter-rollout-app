/** Slider to adjust agent FPS (1–10). Implemented in PR 10. */
export default function SpeedControl() {
  return (
    <input
      type="range"
      min={1}
      max={10}
      aria-label="Agent speed (FPS)"
    />
  );
}
