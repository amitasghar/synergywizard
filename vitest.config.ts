import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/search/**/*.test.ts", "datagen/**/*.test.ts"],
    environment: "node",
    setupFiles: [],
  },
});
