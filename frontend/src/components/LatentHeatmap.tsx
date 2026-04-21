// Cursor (AI-assisted).

import { useEffect, useRef } from "react";

interface Props {
  latent: number[] | null | undefined;
  /** Canvas display size (square). */
  size?: number;
}

/** Visualize encoder latent as a square grayscale heatmap (min–max normalized per frame). */
export default function LatentHeatmap({ latent, size = 256 }: Props) {
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
      ctx.font = "12px system-ui";
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

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-lg border border-gray-700 bg-black"
      aria-label="Encoder latent heatmap"
    />
  );
}
