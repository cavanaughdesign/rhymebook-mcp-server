import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/ui/**',
        'src/**/*.d.ts',
        'src/**/*.js',
        'src/**/*.js.map',
      ],
    },
  },
  esbuild: {
    target: 'node18',
  },
  // Use test-specific TypeScript config
  // Vitest will automatically detect and use tsconfig.test.json
});