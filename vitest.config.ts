import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use Vitest's global APIs (describe, it, expect, vi) without importing them
    globals: true,
    // Load the chrome API mocks before every test file
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    // Allow imports like "@/lib/download" to resolve from project root
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
