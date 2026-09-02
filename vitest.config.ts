import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgres://overwatch:overwatch@127.0.0.1:5432/overwatch",
    },
  },
})
