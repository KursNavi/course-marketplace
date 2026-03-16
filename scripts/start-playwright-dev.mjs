import { spawn } from 'node:child_process';

// Set VITE_* env vars so the Vite dev server picks them up.
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL_TEST || 'https://example.supabase.co';
process.env.VITE_SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY_TEST || 'test-anon-key';

const child = spawn(
  'npm',
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4174'],
  { stdio: 'inherit', shell: true }
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
