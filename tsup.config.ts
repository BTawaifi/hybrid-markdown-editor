import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/lite.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ['react', 'react-dom', 'react-textarea-autosize'],
  treeshake: true,
  // Components use hooks; keep them usable from React Server Components (Next.js App Router).
  banner: { js: '"use client";' },
});


