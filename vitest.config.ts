import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'shared/**/*.test.js',
      'shared/**/*.test.ts',
      'server/**/*.test.js',
    ],
  },
});
