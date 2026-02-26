import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 프론트에서 /api/... 호출하면 서버(10000)로 전달
      "/api": {
        target: "http://localhost:10000",
        changeOrigin: true
      },
      // (선택) health도 프록시하고 싶으면
      "/health": {
        target: "http://localhost:10000",
        changeOrigin: true
      }
    }
  }
});