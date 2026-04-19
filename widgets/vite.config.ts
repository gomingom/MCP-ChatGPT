import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const FULL_URL = "https://ecommerce-server.yeongh-kim17.workers.dev/";
// https://vite.dev/config/ — Ladle: `vite.config.ladle.ts` (see `.ladle/config.mjs`)
export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss()],
    base: mode === "production" ? FULL_URL : undefined,
    build: {
      outDir: "../server/dist",
      emptyOutDir: true,
    },
  };
});
