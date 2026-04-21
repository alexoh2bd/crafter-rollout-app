// Cursor (AI-assisted).

import { useEffect, useRef } from "react";

interface Props {
  latent: number[] | null | undefined;
  /** Canvas display size (square). */
  size?: number;
  /** LeWM latent dimension (for caption). */
  latentDim?: number | null;
  /** random_policy: encoder off; otherwise show full caption */
  randomPolicyMode?: boolean;
}

/** Visualize encoder latent as a square grayscale heatmap (min–max normalized per frame). */
export default function LatentHeatmap({
  latent,
  size = 384,
  latentDim,
  randomPolicyMode = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!latent?.length) {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#4b5563";
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText("No latent (waiting…)", 12, size / 2);
      return;
    }

    const n = latent.length;
    const side = Math.ceil(Math.sqrt(n));
    const cells = side * side;
    const vals = latent.slice(0, cells);
    while (vals.length < cells) vals.push(0);

    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (max - min < 1e-8) {
      min = 0;
      max = 1;
    }

    const img = ctx.createImageData(side, side);
    const data = img.data;
    for (let i = 0; i < cells; i++) {
      const t = (vals[i]! - min) / (max - min);
      const g = Math.round(Math.max(0, Math.min(255, t * 255)));
      const o = i * 4;
      data[o] = g;
      data[o + 1] = g;
      data[o + 2] = g;
      data[o + 3] = 255;
    }
    const tmp = document.createElement("canvas");
    tmp.width = side;
    tmp.height = side;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.putImageData(img, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(tmp, 0, 0, side, side, 0, 0, size, size);
  }, [latent, size]);

  const d = latentDim ?? latent?.length ?? 0;
  const gridNote =
    d <= 0
      ? "—"
      : Number.isInteger(Math.sqrt(d)) && Math.sqrt(d) ** 2 === d
        ? `${Math.sqrt(d)}×${Math.sqrt(d)} grid`
        : `${Math.ceil(Math.sqrt(d))}×${Math.ceil(Math.sqrt(d))} grid (padded from ${d} dims)`;

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-[28rem]">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-lg border border-gray-700 bg-black [image-rendering:pixelated]"
        aria-label="Encoder latent heatmap"
      />
      {randomPolicyMode ? (
        <p className="text-gray-600 text-[10px] text-center leading-snug">
          LeWM encoder runs only in Base WM / HWM modes.
        </p>
      ) : (
        <div className="text-[10px] text-gray-600 text-center leading-snug space-y-1">
          <p>
            <strong className="text-gray-500 font-medium">LeWM encoder vector</strong>{" "}
            reshaped row-major into a square grid ({gridNote}).{" "}
            <strong className="text-gray-500 font-medium">Per-frame min–max</strong> grayscale — not
            PCA/UMAP; colormap is activation intensity after normalization.
          </p>
          {d > 0 && (
            <p className="font-mono text-gray-700">dims 0…{d - 1}</p>
          )}
        </div>
      )}
    </div>
  );
}
