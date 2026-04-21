/// <reference types="vitest/config" />
// Cursor (AI-assisted).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
