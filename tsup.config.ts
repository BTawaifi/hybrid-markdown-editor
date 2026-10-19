import { readdir, readFile, writeFile } from 'node:fs/promises';
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
  // Components use hooks, so mark every output as a client module (React Server Components /
  // Next.js App Router). Tree-shaking strips a `banner` directive, so add it after the build and
  // shift each source map down one line to match.
  async onSuccess() {
    for (const file of await readdir('dist')) {
      if (!/\.m?js$/.test(file)) continue;
      const code = await readFile(`dist/${file}`, 'utf8');
      if (code.startsWith('"use client";')) continue;
      await writeFile(`dist/${file}`, '"use client";\n' + code);
      const mapPath = `dist/${file}.map`;
      const map = JSON.parse(await readFile(mapPath, 'utf8'));
      map.mappings = ';' + map.mappings;
      await writeFile(mapPath, JSON.stringify(map));
    }
  },
});


