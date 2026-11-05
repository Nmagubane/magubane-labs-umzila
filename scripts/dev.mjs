// Development: rebuild the client on change and run the server with Node's watch mode.
// Refresh the browser after a client change.
import * as esbuild from 'esbuild';
import { spawn } from 'node:child_process';
import { clientOptions, prepareOut } from './client-build.mjs';

prepareOut();
const ctx = await esbuild.context(clientOptions({ dev: true }));
await ctx.watch();

const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--watch-path=src/server', '--watch-path=src/shared', '--import', 'tsx', 'src/server/main.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
});

const stop = () => {
  server.kill();
  void ctx.dispose().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => {
  if (code && code !== 0) console.error(`Server exited with code ${code}. Fix the error and save to restart.`);
});
