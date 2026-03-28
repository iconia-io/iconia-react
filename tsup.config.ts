import { defineConfig } from 'tsup';

export default defineConfig([
  // CLI — CommonJS для Node
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['cjs'],
    target: 'node18',
    outDir: 'dist',
    clean: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // Library — ESM + CJS з типами
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'dist',
    external: ['react'],
  },
]);
