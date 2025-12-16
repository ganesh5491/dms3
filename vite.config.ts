import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { viteStaticCopy } from "vite-plugin-static-copy";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),

    // ✅ ONLY copy frontend / shared assets
    viteStaticCopy({
      targets: [
        {
          src: "../shared/departmentData.json",
          dest: "shared",
        },
      ],
    }),

    ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
      ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer()
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner()
        ),
      ]
      : []),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
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
      input: path.resolve(__dirname, "client/index.html"),
    },
  },

  server: {
    hmr: {
      overlay: false,
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
