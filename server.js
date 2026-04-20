import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
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

// --- Settings endpoints ---
const SETTINGS_DIR = join(process.env.HOME, '.config', 'mdevex');
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json');

app.get('/api/settings', (req, res) => {
  try {
    res.json(JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')));
  } catch {
    res.json({});
  }
});

app.put('/api/settings', (req, res) => {
  try {
    mkdirSync(SETTINGS_DIR, { recursive: true });
    writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Plugin loader ---

async function loadPlugins() {
  const pluginDirs = [
    join(__dirname, 'core-plugins'),
    join(__dirname, 'plugins'),
    join(process.env.HOME, '.mdevex', 'plugins'),
    ...(process.env.MDEVEX_EXTRA_PLUGIN_DIR ? [process.env.MDEVEX_EXTRA_PLUGIN_DIR] : []),
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

// --- WebSocket upgrade ---

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, req);
  });
});

// --- Startup ---

await loadPlugins();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`mdevex listening on http://0.0.0.0:${PORT}`);
});
