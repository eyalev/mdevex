(function() {
  const el = document.createElement('div');
  el.id = 'status';
  el.style.cssText = 'padding:4px 10px;font-size:12px;color:#666;background:#111;border-top:1px solid #222;';
  el.textContent = 'Connecting...';
  mdevex.slots['bottom-bar'].appendChild(el);

  mdevex.on('sessions-loaded', ({ sessions }) => {
    el.textContent = `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`;
  });
})();
