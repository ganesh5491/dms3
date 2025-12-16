
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { viteStaticCopy } from "vite-plugin-static-copy";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: "../shared/departmentData.json",
          dest: "shared"
        },
        {
          src: "server/data/approvers.json",
          dest: "server/data"
        },
        {
          src: "server/data/creators.json",
          dest: "server/data"
        },
        {
          src: "server/data/data.json",
          dest: "server/data"
        },
        {
          src: "server/data/departments.json",
          dest: "server/data"
        },
        {
          src: "server/data/documents.json",
          dest: "server/data"
        },
        {
          src: "server/data/issuers.json",
          dest: "server/data"
        },
        {
          src: "server/data/notifications.json",
          dest: "server/data"
        },
        {
          src: "server/data/users.json",
          dest: "server/data"
        }
      ]
    }),
    // Disable runtime error overlay to prevent "unknown runtime error" issues
    // runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
      ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer(),
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner(),
        ),
      ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client/public"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "client", "index.html"),
    },
  },
  server: {
    hmr: {
      overlay: false  // Disable HMR overlay to prevent runtime error messages
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
