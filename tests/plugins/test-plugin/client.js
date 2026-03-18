(function(api) {
  const el = document.createElement('div');
  el.id = 'test-plugin-marker';
  el.textContent = 'TEST';
  el.style.cssText = 'padding: 8px 12px; color: #4ec9b0; font-size: 12px;';
  api.slots['toolbar-right'].appendChild(el);

  window.__testPluginEvents = [];
  api.on('session-changed', (data) => {
    window.__testPluginEvents.push({ type: 'session-changed', ...data });
  });
  api.on('connected', (data) => {
    window.__testPluginEvents.push({ type: 'connected', ...data });
  });
})(window.webAgent);
