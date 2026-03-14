import { spawn } from 'node:child_process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const child = spawn(
  npmCmd,
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4174'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://example.supabase.co',
      VITE_SUPABASE_KEY: process.env.VITE_SUPABASE_KEY || 'test-anon-key'
    }
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const eventName of ['SIGINT', 'SIGTERM']) {
  process.on(eventName, () => {
    child.kill(eventName);
  });
}
