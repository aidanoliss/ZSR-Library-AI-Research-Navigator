import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    // Forward API calls to the Node server during development.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
