import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom has no real canvas; GameCanvas / LatentHeatmap use 2d context in effects.
function createMock2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    canvas,
    fillStyle: "",
    font: "",
    imageSmoothingEnabled: true,
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    putImageData: vi.fn(),
    createImageData: vi.fn((w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    })),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    })),
  } as unknown as CanvasRenderingContext2D;
}

HTMLCanvasElement.prototype.getContext = vi.fn(function (
  this: HTMLCanvasElement,
  type: string,
) {
  if (type === "2d") return createMock2dContext(this);
  return null;
}) as typeof HTMLCanvasElement.prototype.getContext;
