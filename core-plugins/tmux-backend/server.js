import { execSync } from 'child_process';
import pty from 'node-pty';
import { existsSync, readFileSync } from 'fs';

const SESSION_FILTER_FILE = '/tmp/wa-test-session-filter.json';

export default function({ app, wss, eventBus }) {
  app.get('/api/sessions', (req, res) => {
    try {
      const output = execSync(
        'tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_attached}"',
        { encoding: 'utf-8', timeout: 5000 }
      );
      let sessions = output.trim().split('\n').filter(Boolean).map(line => {
        const [name, windows, attached] = line.split(':');
        return { name, windows: parseInt(windows), attached: parseInt(attached) };
      });
      // If a test filter file exists, restrict to those sessions only
      if (existsSync(SESSION_FILTER_FILE)) {
        const allowed = new Set(JSON.parse(readFileSync(SESSION_FILTER_FILE, 'utf-8')));
        sessions = sessions.filter(s => allowed.has(s.name));
      }
      res.json(sessions);
    } catch {
      res.json([]);
    }
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const session = url.searchParams.get('session');
    if (!session || !/^[\w.-]+$/.test(session)) {
      ws.close(1008, 'Missing or invalid session');
      return;
    }
    const cols = parseInt(url.searchParams.get('cols')) || 80;
    const rows = parseInt(url.searchParams.get('rows')) || 24;

    eventBus.emit('ws-connect', { ws, session, cols, rows });

    const ptyProcess = pty.spawn('bash', [
      '-c', `tmux set-option -t "${session}" mouse on 2>/dev/null; exec tmux attach-session -t "${session}"`
    ], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    ptyProcess.onData(data => {
      eventBus.emit('ws-data-out', { ws, session, data });
      if (ws.readyState === ws.OPEN) ws.send(data);
    });

    ptyProcess.onExit(() => {
      if (ws.readyState === ws.OPEN) ws.close();
    });

    ws.on('message', msg => {
      const data = msg.toString();
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch {}
      eventBus.emit('ws-data-in', { ws, session, data });
      ptyProcess.write(data);
    });

    ws.on('close', () => {
      eventBus.emit('ws-disconnect', { session });
      ptyProcess.kill();
    });
  });
}
