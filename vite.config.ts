import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 47321, strictPort: true },
  preview: { host: "0.0.0.0", port: 47321, strictPort: true },
  build: { target: "es2022", chunkSizeWarningLimit: 2500 },
  optimizeDeps: { exclude: ["@dimforge/rapier3d-compat"] },
});
