import { defineConfig } from "vite";
import path from "path";

export default defineConfig(async () => {
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

  // 1. Initialize an empty plugins array
  const plugins = [];

  // 2. Dynamic Import Block: Only load Replit-specific plugins when in a local Replit dev environment
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    try {
      // Safely import the error overlay inside the conditional check
      const runtimeErrorOverlay = await import("@replit/vite-plugin-runtime-error-modal").then(m => m.default || m);
      const { cartographer } = await import("@replit/vite-plugin-cartographer");
      const { devBanner } = await import("@replit/vite-plugin-dev-banner");
      
      plugins.push(
        runtimeErrorOverlay(),
        cartographer({
          root: path.resolve(import.meta.dirname, ".."),
        }),
        devBanner()
      );
    } catch (e) {
      console.warn("Replit development plugins failed to load dynamically:", e);
    }
  }

  // 3. Return the fully configured Vite options object
  return {
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
  };
});