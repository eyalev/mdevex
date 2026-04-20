(function() {
  let sessionNames = [];
  let activeSession = null;
  const sessionData = {};

  Object.assign(mdevex, {
    getSessions() { return sessionNames.slice(); },
    getActiveSession() { return activeSession; },
    activateSession,
    sendToTerminal(session, data) {
      const s = sessionData[session];
      if (s?.ws?.readyState === WebSocket.OPEN) s.ws.send(data);
    },
    disconnect(name) {
      const s = sessionData[name || activeSession];
      if (s?.ws) s.ws.close(); // no intentionalClose → triggers reconnect
    },
  });

  async function loadSessions() {
    try {
      const res = await fetch('/api/sessions');
      const list = await res.json();
      const names = list.map(s => s.name);

      // Remove dead sessions
      for (const name of sessionNames) {
        if (!names.includes(name)) {
          if (sessionData[name]?.ws) {
            sessionData[name].intentionalClose = true;
            sessionData[name].ws.close();
          }
          if (sessionData[name]?.reconnectTimer) clearTimeout(sessionData[name].reconnectTimer);
          delete sessionData[name];
          mdevex.emit('session-removed', { session: name });
        }
      }

      sessionNames = names;
      mdevex.emit('sessions-loaded', { sessions: names });

      // Auto-activate first if none active or active is gone
      if ((!activeSession || !names.includes(activeSession)) && names.length > 0) {
        activateSession(names[0]);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }

  function activateSession(name) {
    if (!sessionNames.includes(name)) return;
    if (name === activeSession) return;

    const previous = activeSession;

    // Disconnect previous to free resources
    if (previous && sessionData[previous]) {
      sessionData[previous].intentionalClose = true;
      if (sessionData[previous].ws) sessionData[previous].ws.close();
    }

    activeSession = name;
    if (!sessionData[name]) {
      sessionData[name] = { ws: null, reconnectDelay: 1000 };
    }

    mdevex.emit('session-changed', { session: name, previous });
  }

  function connectWebSocket(name, cols, rows) {
    const s = sessionData[name];
    if (!s) return;
    if (s.reconnectTimer) { clearTimeout(s.reconnectTimer); s.reconnectTimer = null; }

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws?session=${encodeURIComponent(name)}&cols=${cols}&rows=${rows}`;
    const ws = new WebSocket(url);
    s.ws = ws;
    s.intentionalClose = false;

    ws.onopen = () => {
      s.reconnectDelay = 1000;
      mdevex.emit('connected', { session: name });
    };

    ws.onmessage = (event) => {
      if (s.ws !== ws) return; // stale guard
      mdevex.emit('backend-data', { session: name, data: event.data });
    };

    ws.onclose = () => {
      if (s.ws === ws) s.ws = null;
      if (s.intentionalClose) { s.intentionalClose = false; return; }

      const delay = s.reconnectDelay;
      mdevex.emit('disconnected', { session: name, delay });
      s.reconnectDelay = Math.min(delay * 1.5, 15000);
      s.reconnectTimer = setTimeout(() => {
        if (activeSession === name) {
          const td = mdevex.getTerminalData?.(name);
          const c = td?.terminal?.cols || 80;
          const r = td?.terminal?.rows || 24;
          connectWebSocket(name, c, r);
        }
      }, delay);
    };

    ws.onerror = () => {}; // onclose will fire
  }

  // When terminal is ready, connect WS
  mdevex.on('terminal-ready', ({ session, cols, rows }) => {
    if (activeSession === session) {
      const s = sessionData[session];
      if (!s?.ws || s.ws.readyState !== WebSocket.OPEN) {
        connectWebSocket(session, cols, rows);
      }
    }
  });

  // When terminal sends data, forward to WS
  mdevex.on('terminal-data', ({ session, data }) => {
    const s = sessionData[session];
    if (s?.ws?.readyState === WebSocket.OPEN) s.ws.send(data);
  });

  // When terminal resizes, send resize to WS
  mdevex.on('resize', ({ session, cols, rows }) => {
    const s = sessionData[session];
    if (s?.ws?.readyState === WebSocket.OPEN) {
      s.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  });

  mdevex.on('init', () => {
    loadSessions();
    setInterval(loadSessions, 10000);
  });
})();
