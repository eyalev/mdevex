# mdevex plugins

Plugins extend mdevex with new features. Each plugin is a directory with a `plugin.json` manifest and optional `server.js` and `client.js` files.

## Plugin locations

- `./plugins/` — bundled with the project
- `~/.mdevex/plugins/` — user plugins

## Structure

```
plugins/my-plugin/
  plugin.json     ← required: manifest
  server.js       ← optional: server-side code (ES module)
  client.js       ← optional: client-side code (IIFE)
```

## plugin.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "What it does",
  "version": "0.1.0"
}
```

## Server-side plugin (server.js)

Default export receives the server API:

```javascript
export default function(api) {
  const { app, wss, eventBus, pluginDir, manifest } = api;

  // Register HTTP routes
  app.get('/api/my-plugin/data', (req, res) => {
    res.json({ hello: 'world' });
  });

  // Listen to events
  eventBus.on('ws-connect', ({ ws, session }) => {
    console.log(`Connection to ${session}`);
  });
}
```

### Server events

| Event | Payload | Description |
|-------|---------|-------------|
| `ws-connect` | `{ ws, session, cols, rows }` | WebSocket connected |
| `ws-data-in` | `{ ws, session, data }` | Browser → PTY |
| `ws-data-out` | `{ ws, session, data }` | PTY → Browser |
| `ws-disconnect` | `{ session }` | WebSocket closed |

## Client-side plugin (client.js)

IIFE that receives `window.mdevex`:

```javascript
(function(api) {
  // Add UI to a slot
  const el = document.createElement('div');
  el.textContent = 'Hello';
  api.slots['toolbar-right'].appendChild(el);

  // Listen to events
  api.on('session-changed', ({ session, previous }) => {
    console.log('Switched to:', session);
  });

  // Decorate a tab
  api.decorateTab('my-session', '<span style="color:green">●</span>');
})(window.mdevex);
```

### Client API

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `session-changed` | `{ session, previous }` | Tab switched |
| `connected` | `{ session }` | WebSocket opened |
| `disconnected` | `{ session }` | WebSocket closed |
| `data-received` | `{ session, data }` | PTY data arrived |
| `terminal-write` | `{ session, data }` | User typed |
| `resize` | `{ session, cols, rows }` | Terminal resized |
| `sessions-loaded` | `{ sessions: string[] }` | Session list refreshed |

**Methods:**

| Method | Description |
|--------|-------------|
| `on(event, handler)` | Subscribe to event |
| `off(event, handler)` | Unsubscribe |
| `emit(event, data)` | Emit custom event |
| `getActiveSession()` | Current session name |
| `getSessions()` | All session names |
| `getTerminal(name)` | xterm.js Terminal instance |
| `activateSession(name)` | Switch to session |
| `sendToTerminal(session, data)` | Send data to PTY |
| `decorateTab(session, html)` | Add badge/indicator to tab |

**UI Slots:**

| Slot | Location |
|------|----------|
| `top-bar` | Above toolbar |
| `toolbar-left` | Left of tab bar |
| `toolbar-right` | Right of tab bar |
| `bottom-bar` | Below terminal |
| `overlay` | Fixed over page |
| `settings-panel` | Hidden panel |
