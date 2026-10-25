import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: true },
  define: {
    // Commit SHA shown in the site. Netlify sets COMMIT_REF; Cloudflare Pages sets CF_PAGES_COMMIT_SHA.
    "import.meta.env.VITE_COMMIT_REF": JSON.stringify(process.env.CF_PAGES_COMMIT_SHA ?? process.env.COMMIT_REF ?? ""),
  },
  optimizeDeps: {
    // @xenova/transformers bundles ONNX WASM files that esbuild can't pre-bundle.
    // Exclude it so Vite serves the package directly from node_modules.
    exclude: ["@xenova/transformers"],
  },
});
