import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts"
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**"
    ]
  }
});
