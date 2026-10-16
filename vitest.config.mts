import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // tests/smoke ต้องรันกับ server จริง จึงไม่รวมในชุด unit
    exclude: ['node_modules', '.next', 'tests/smoke/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
