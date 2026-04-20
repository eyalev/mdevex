(function() {
  // Create tab bar container (preserves #tab-bar selector for tests/plugins)
  const tabBar = document.createElement('div');
  tabBar.id = 'tab-bar';
  tabBar.style.cssText = 'display:flex;flex:1;overflow-x:auto;min-width:0;scrollbar-width:none;';
  mdevex.slots['toolbar-center'].appendChild(tabBar);

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #tab-bar::-webkit-scrollbar { display: none; }
    .tab {
      padding: 8px 16px; cursor: pointer; white-space: nowrap; font-size: 14px;
      color: #888; border-right: 1px solid #222; user-select: none; flex-shrink: 0; position: relative;
    }
    .tab:hover { background: #222; color: #ccc; }
    .tab.active { background: #1e1e1e; color: #fff; border-bottom: 2px solid #4ec9b0; }
  `;
  document.head.appendChild(style);

  const tabs = {};

  mdevex.on('sessions-loaded', ({ sessions }) => {
    // Remove tabs for dead sessions
    for (const name of Object.keys(tabs)) {
      if (!sessions.includes(name)) {
        tabs[name].remove();
        delete tabs[name];
      }
    }

    // Add tabs for new sessions
    for (const name of sessions) {
      if (!tabs[name]) {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.textContent = name;
        tab.addEventListener('click', () => mdevex.activateSession(name));
        tabBar.appendChild(tab);
        tabs[name] = tab;
      }
    }
  });

  mdevex.on('session-changed', ({ session, previous }) => {
    if (previous && tabs[previous]) tabs[previous].classList.remove('active');
    if (tabs[session]) {
      tabs[session].classList.add('active');
      tabs[session].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  });

  mdevex.decorateTab = (session, html) => {
    const tab = tabs[session];
    if (!tab) return;
    let dec = tab.querySelector('.tab-decoration');
    if (!dec) {
      dec = document.createElement('span');
      dec.className = 'tab-decoration';
      tab.appendChild(dec);
    }
    dec.innerHTML = html;
  };
})();
