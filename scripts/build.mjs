// Production build: client bundle (hashed, minified) + server bundle.
import * as esbuild from 'esbuild';
import { clientOptions, prepareOut } from './client-build.mjs';

prepareOut();
const client = await esbuild.build(clientOptions({ dev: false }));
await esbuild.build({
  entryPoints: ['src/server/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  outfile: 'dist/server/main.js',
  sourcemap: true,
  logLevel: 'info',
});
const size = Object.entries(client.metafile.outputs)
  .filter(([f]) => f.endsWith('.js') || f.endsWith('.css'))
  .map(([f, o]) => `  ${f}  ${(o.bytes / 1024).toFixed(0)} KB`)
  .join('\n');
console.log(`\nBuilt.\n${size}\n\nRun it with: npm start`);
