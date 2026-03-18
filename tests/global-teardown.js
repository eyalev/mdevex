// Clean up test tmux sessions
import { execSync } from 'child_process';
import { unlinkSync, existsSync } from 'fs';
import { SESSION_FILTER_FILE } from './global-setup.js';

const TEST_SESSIONS = ['wa-test-1', 'wa-test-2', 'wa-test-3'];

export default function globalTeardown() {
  for (const name of TEST_SESSIONS) {
    try {
      execSync(`tmux kill-session -t ${name} 2>/dev/null`, { stdio: 'ignore' });
    } catch {}
  }
  // Remove filter file so the server returns all sessions after tests
  if (existsSync(SESSION_FILTER_FILE)) unlinkSync(SESSION_FILTER_FILE);
  console.log(`Cleaned up test tmux sessions`);
}
