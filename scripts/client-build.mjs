// Shared esbuild config for the client. Used by build.mjs and dev.mjs.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export const OUT = 'dist/client';

export function clientOptions({ dev }) {
  return {
    entryPoints: { main: 'src/client/main.tsx' },
    bundle: true,
    outdir: join(OUT, 'assets'),
    entryNames: '[name]-[hash]',
    assetNames: '[name]-[hash]',
    format: 'esm',
    target: ['es2022', 'chrome111', 'safari16', 'firefox115'],
    jsx: 'automatic',
    loader: { '.woff': 'file', '.woff2': 'file', '.ttf': 'file' },
    minify: !dev,
    sourcemap: dev ? 'inline' : true,
    metafile: true,
    define: { 'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production') },
    logLevel: 'info',
    external: ['/fonts/*'],
    plugins: [writeHtmlPlugin()],
  };
}

export function prepareOut() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'assets'), { recursive: true });
  cpSync('public', OUT, { recursive: true });
}

/** Rewrite index.html to point at the hashed bundle names after every build. */
function writeHtmlPlugin() {
  return {
    name: 'write-html',
    setup(build) {
      build.onEnd((result) => {
        if (!result.metafile) return;
        const outputs = Object.keys(result.metafile.outputs);
        const js = outputs.find((o) => /main-[^/]+\.js$/.test(o));
        const css = outputs.find((o) => /main-[^/]+\.css$/.test(o));
        let html = readFileSync('public/index.html', 'utf8');
        if (js) html = html.replace('/assets/main.js', `/assets/${basename(js)}`);
        if (css) html = html.replace('/assets/main.css', `/assets/${basename(css)}`);
        writeFileSync(join(OUT, 'index.html'), html);
      });
    },
  };
}
