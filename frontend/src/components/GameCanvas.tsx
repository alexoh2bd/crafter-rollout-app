// Cursor (AI-assisted).

import { useEffect, useRef } from "react";

interface Props {
  obs: string | null;
}

export default function GameCanvas({ obs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!obs) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = `data:image/png;base64,${obs}`;
  }, [obs]);

  return (
    <canvas
      ref={canvasRef}
      width={512}
      height={512}
      className="rounded-lg border border-gray-700 bg-black"
      aria-label="Crafter game canvas"
    />
  );
}
