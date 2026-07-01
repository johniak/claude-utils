import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    setupFiles: ["./src/test-setup.ts"],
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": "/Users/johniak/Projects/claude-utils/claude-status/src/web",
      "@/shared": "/Users/johniak/Projects/claude-utils/claude-status/src/shared",
    },
  },
  css: {
    modules: {
      localsConvention: "camelCase",
    },
  },
});





