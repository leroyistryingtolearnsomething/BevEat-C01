import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api calls go to the Express backend while developing
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // stop with an error if it's already running, instead of moving to 5174
    proxy: { "/api": "http://localhost:4000" },
  },
});
