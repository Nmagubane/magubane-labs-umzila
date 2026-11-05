import { config } from './config.ts';
import { openDb } from './db.ts';
import { createApp } from './app.ts';

const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Umzila needs Node.js 22.13 or newer (you have ${process.versions.node}). Install the current LTS from nodejs.org.`);
  process.exit(1);
}

const db = openDb(config.databasePath);
const server = createApp(db);

server.listen(config.port, () => {
  console.log(`\n  Umzila running at http://localhost:${config.port}`);
  console.log(`  Database: ${config.databasePath}`);
  console.log(`  Sign-up: ${config.signupMode}${config.signupMode === 'invite' ? ' (learners need a class code or an INVITE_CODES code)' : ''}`);
  console.log(`  Email: ${config.email.provider === 'log' ? 'not connected: codes are printed in this log. Set EMAIL_PROVIDER and EMAIL_API_KEY to send real email.' : `${config.email.provider}, from ${config.email.from}`}`);
  console.log(`  Teacher sign-up: ${config.educatorCodes.length ? 'open with an educator code' : 'closed (set EDUCATOR_CODES to open it)'}\n`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
