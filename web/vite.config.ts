import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Entwicklung: /api wird ans Backend (Port 8787) weitergeleitet.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL ?? "http://localhost:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
