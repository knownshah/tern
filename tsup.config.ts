import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  platform: 'node',
  banner: ({ entry }) => {
    if (entry === 'cli') {
      return {
        js: '#!/usr/bin/env node',
      };
    }
    return {};
  },
});
