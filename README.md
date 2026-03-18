# web-agent

Minimal web-based tmux client with a plugin architecture.

## Features

- xterm.js terminal with WebSocket-to-tmux bridge
- Session tab bar (list, switch, auto-detect new/closed sessions)
- Auto-reconnect with exponential backoff
- Plugin system with client and server extension points

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:7682` in your browser.

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `7682` | HTTP server port |

## Plugins

Plugins live in `./plugins/` (bundled) or `~/.web-agent/plugins/` (user).

Each plugin is a directory with:
- `plugin.json` — manifest (id, name, description)
- `server.js` — server-side code (optional, ES module)
- `client.js` — client-side code (optional, IIFE)

See [plugins/README.md](plugins/README.md) for the full API.

## Requirements

- Node.js 18+
- tmux
- Build tools for node-pty (`build-essential` on Debian/Ubuntu)
