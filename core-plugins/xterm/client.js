(function() {
  const terminals = {};
  let libsLoaded = false;
  let libsLoading = false;
  let pendingActivation = null;
  const mainSlot = mdevex.slots['main'];

  // Add terminal styles
  const style = document.createElement('style');
  style.textContent = `
    .terminal-wrapper { display: none; width: 100%; height: 100%; }
    .terminal-wrapper.active { display: block; }
  `;
  document.head.appendChild(style);

  Object.assign(mdevex, {
    getTerminal(name) { return terminals[name]?.terminal; },
    getTerminalData(name) { return terminals[name]; },
  });

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function loadLibs() {
    if (libsLoaded || libsLoading) return;
    libsLoading = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.css';
    document.head.appendChild(link);
    await loadScript('https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/lib/addon-web-links.js');
    libsLoaded = true;
    libsLoading = false;
    if (pendingActivation) {
      const data = pendingActivation;
      pendingActivation = null;
      handleActivation(data);
    }
  }

  mdevex.on('session-changed', (data) => {
    if (!libsLoaded) {
      // Hide previous terminal if exists
      if (data.previous && terminals[data.previous]) {
        terminals[data.previous].wrapper.classList.remove('active');
      }
      pendingActivation = data;
      loadLibs();
      return;
    }
    handleActivation(data);
  });

  function handleActivation({ session, previous }) {
    // Hide previous
    if (previous && terminals[previous]) {
      terminals[previous].wrapper.classList.remove('active');
    }

    if (!terminals[session]) {
      createTerminal(session);
    } else {
      terminals[session].wrapper.classList.add('active');
      terminals[session].fitAddon.fit();
      terminals[session].terminal.focus();
      // Emit terminal-ready so backend can reconnect if needed
      const t = terminals[session];
      mdevex.emit('terminal-ready', { session, cols: t.terminal.cols, rows: t.terminal.rows });
    }
  }

  function createTerminal(session) {
    const wrapper = document.createElement('div');
    wrapper.className = 'terminal-wrapper active';
    mainSlot.appendChild(wrapper);

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: mdevex.settings.get('fontSize') || 14,
      fontFamily: '"Cascadia Code", "Fira Code", "Menlo", monospace',
      theme: { background: '#1e1e1e', foreground: '#cccccc', cursor: '#ffffff' },
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon.WebLinksAddon());

    terminal.open(wrapper);
    fitAddon.fit();

    terminal.onData(data => {
      mdevex.emit('terminal-data', { session, data });
    });

    terminal.onResize(({ cols, rows }) => {
      mdevex.emit('resize', { session, cols, rows });
    });

    terminals[session] = { terminal, fitAddon, wrapper };
    mdevex.emit('terminal-ready', { session, cols: terminal.cols, rows: terminal.rows });
  }

  mdevex.on('backend-data', ({ session, data }) => {
    if (terminals[session]) terminals[session].terminal.write(data);
  });

  mdevex.on('connected', ({ session }) => {
    if (terminals[session]) {
      terminals[session].fitAddon.fit();
      terminals[session].terminal.focus();
    }
  });

  mdevex.on('disconnected', ({ session, delay }) => {
    if (terminals[session]) {
      terminals[session].terminal.write(
        `\r\n\x1b[33m[Disconnected. Reconnecting in ${Math.round((delay || 1000) / 1000)}s...]\x1b[0m\r\n`
      );
    }
  });

  mdevex.on('session-removed', ({ session }) => {
    if (terminals[session]) {
      terminals[session].terminal.dispose();
      terminals[session].wrapper.remove();
      delete terminals[session];
    }
  });

  // Resize on window resize
  window.addEventListener('resize', () => {
    const active = mdevex.getActiveSession?.();
    if (active && terminals[active]) {
      terminals[active].fitAddon.fit();
    }
  });

  // Apply touch-action to xterm canvases as they're created
  const touchObserver = new MutationObserver(() => {
    mainSlot.querySelectorAll('.xterm-screen').forEach(screen => {
      screen.style.touchAction = 'none';
      screen.querySelectorAll('canvas').forEach(c => { c.style.touchAction = 'none'; });
    });
  });
  touchObserver.observe(mainSlot, { childList: true, subtree: true });
})();
