// Create isolated tmux sessions for testing
import { execSync, execFileSync } from 'child_process';
import { writeFileSync } from 'fs';

const TEST_SESSIONS = ['wa-test-1', 'wa-test-2', 'wa-test-3'];
export const SESSION_FILTER_FILE = '/tmp/wa-test-session-filter.json';

export default function globalSetup() {
  for (const name of TEST_SESSIONS) {
    try {
      execSync(`tmux kill-session -t ${name} 2>/dev/null`, { stdio: 'ignore' });
    } catch {}
    execSync(`tmux new-session -d -s ${name} -x 80 -y 24`);
  }
  // Write filter file — server reads this per-request to restrict visible sessions
  writeFileSync(SESSION_FILTER_FILE, JSON.stringify(TEST_SESSIONS));
  console.log(`Created test tmux sessions: ${TEST_SESSIONS.join(', ')}`);
}
