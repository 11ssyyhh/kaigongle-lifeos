import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  main: {
    build: {
      outDir: "dist-electron",
      rollupOptions: { external: ["better-sqlite3", "tesseract.js"] },
      lib: {
        entry: resolve(__dirname, "electron/main.ts"),
        formats: ["cjs"],
        fileName: () => "main.js",
      },
    },
  },
  preload: {
    build: {
      outDir: "dist-electron",
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, "electron/preload.ts"),
        formats: ["cjs"],
        fileName: () => "preload.js",
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "."),
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, "dist"),
      rollupOptions: { input: resolve(__dirname, "index.html") },
    },
  },
});
