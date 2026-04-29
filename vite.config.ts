import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: true },
  optimizeDeps: {
    // @xenova/transformers bundles ONNX WASM files that esbuild can't pre-bundle.
    // Exclude it so Vite serves the package directly from node_modules.
    exclude: ["@xenova/transformers"],
  },
});
