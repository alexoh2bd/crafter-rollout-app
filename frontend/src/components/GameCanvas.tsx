// Cursor (AI-assisted).

import { useEffect, useRef } from "react";

interface Props {
  obs: string | null;
  /** Display size in CSS pixels (native Crafter frame is 64×64, scaled with nearest-neighbor). Default 384. */
  size?: number;
  children?: React.ReactNode;
}

export default function GameCanvas({ obs, size = 384, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    const c2 = ctx as CanvasRenderingContext2D & {
      webkitImageSmoothingEnabled?: boolean;
    };
    if (c2.webkitImageSmoothingEnabled !== undefined) {
      c2.webkitImageSmoothingEnabled = false;
    }

    if (!obs) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      const c2 = ctx as CanvasRenderingContext2D & {
        webkitImageSmoothingEnabled?: boolean;
      };
      if (c2.webkitImageSmoothingEnabled !== undefined) {
        c2.webkitImageSmoothingEnabled = false;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = `data:image/png;base64,${obs}`;
  }, [obs, size]);

  return (
    <div className="relative inline-block rounded-lg border border-gray-700 bg-black">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="block rounded-lg [image-rendering:pixelated] [image-rendering:crisp-edges]"
        style={{ imageRendering: "pixelated" }}
        aria-label="Crafter game canvas"
      />
      {children}
    </div>
  );
}
