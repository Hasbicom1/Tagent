import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// SAFE VITE CONFIG - Overrides problematic server/vite.ts settings
// This eliminates the process.exit(1) restart loop issue
export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // CRITICAL: Safe mode - no process.exit on errors
    middlewareMode: false,
    hmr: {
      port: 5173
    },
    host: "0.0.0.0",
    port: 5173
  },
  // Override logger to prevent crashes
  customLogger: {
    info: (msg: string) => console.log(`ℹ️ [vite] ${msg}`),
    warn: (msg: string) => console.log(`⚠️ [vite] ${msg}`),
    error: (msg: string) => console.log(`❌ [vite] ${msg}`),
    clearScreen: () => {},
    hasErrorLogged: () => false,
    hasWarned: false
  }
});