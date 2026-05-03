import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Must match `PORT` in backend/.env when using the dev proxy (defaults to backend code default).
  const devApiProxyTarget = env.VITE_DEV_API_TARGET || "http://localhost:3001";
  // Same target for root-level auth routes (Express mounts these outside `/api` — see backend/src/index.js).
  const backendProxy = { target: devApiProxyTarget, changeOrigin: true };

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": backendProxy,
        "/login": backendProxy,
        "/register": backendProxy,
      },
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
