import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// Ladle bundles Vite 6; use SWC here so it does not load `@vitejs/plugin-react` (Vite 8 / Rolldown).
const FULL_URL = "https://server.yeongh-kim17.workers.dev/";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? FULL_URL : undefined,
}));
