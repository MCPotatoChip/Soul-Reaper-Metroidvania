import { defineConfig } from "vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT || "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const getBasePath = (): string => {
  if (process.env.IS_VERCEL === "true") {
    return "/";
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    return "/soul-reaper-metroidvania/"; 
  }
  return process.env.BASE_PATH || "/";
};

// 1. Synchronously set up base plugins
const plugins = [runtimeErrorOverlay()];

// 2. Safely add development environment plugins without breaking production top-level await
if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
  try {
    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    const { devBanner } = await import("@replit/vite-plugin-dev-banner");
    
    plugins.push(
      cartographer({
        root: path.resolve(import.meta.dirname, ".."),
      }),
      devBanner()
    );
  } catch (e) {
    console.warn("Replit development plugins failed to load dynamically:", e);
  }
}

export default defineConfig({
  base: getBasePath(),
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});