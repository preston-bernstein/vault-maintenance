import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/run-pipeline.ts',
        'src/types.ts',
        '**/*.test.ts',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 80,
      },
    },
  },
});
