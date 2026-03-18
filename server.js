import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import { execSync } from 'child_process';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 7682;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const eventBus = new EventEmitter();

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));
app.use('/screenshots', express.static(join(__dirname, 'screenshots')));

// --- Session listing ---

const SESSION_FILTER_FILE = '/tmp/wa-test-session-filter.json';

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

// --- Plugin loader ---

async function loadPlugins() {
  const pluginDirs = [
    join(__dirname, 'plugins'),
    join(process.env.HOME, '.web-agent', 'plugins'),
    ...(process.env.WA_EXTRA_PLUGIN_DIR ? [process.env.WA_EXTRA_PLUGIN_DIR] : []),
  ];

  const plugins = new Map();

  for (const baseDir of pluginDirs) {
    if (!existsSync(baseDir)) continue;
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pluginDir = join(baseDir, entry.name);
      const manifestPath = join(pluginDir, 'plugin.json');
      if (!existsSync(manifestPath)) continue;

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const id = manifest.id || entry.name;

      // Load server-side plugin
      const serverPath = join(pluginDir, 'server.js');
      if (existsSync(serverPath)) {
        try {
          const mod = await import(serverPath);
          const pluginFn = mod.default;
          if (typeof pluginFn === 'function') {
            pluginFn({ app, wss, eventBus, pluginDir, manifest });
          }
        } catch (err) {
          console.error(`Plugin ${id}: server.js load error:`, err.message);
        }
      }

      // Serve client-side plugin files
      const clientPath = join(pluginDir, 'client.js');
      if (existsSync(clientPath)) {
        app.get(`/plugins/${id}/client.js`, (req, res) => {
          res.type('application/javascript');
          res.sendFile(clientPath);
        });
        manifest._hasClient = true;
      }

      plugins.set(id, manifest);
      console.log(`Plugin loaded: ${id}`);
    }
  }

  app.get('/api/plugins', (req, res) => {
    const list = [];
    for (const [id, manifest] of plugins) {
      list.push({ id, ...manifest });
    }
    res.json(list);
  });

  return plugins;
}

// --- WebSocket handling ---

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, req);
  });
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

// --- Startup ---

await loadPlugins();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`web-agent listening on http://0.0.0.0:${PORT}`);
});
