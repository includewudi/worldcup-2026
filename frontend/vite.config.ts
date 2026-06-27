import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const outDir = process.env.VITE_OUT_DIR || "dist";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    port: 5570,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8570",
        changeOrigin: true,
      },
    },
  },
});
