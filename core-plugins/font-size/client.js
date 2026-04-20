(function() {
  function applyFontSize(size) {
    for (const name of (mdevex.getSessions?.() || [])) {
      const td = mdevex.getTerminalData?.(name);
      if (td?.terminal) {
        td.terminal.options.fontSize = size;
        if (td.fitAddon) td.fitAddon.fit();
      }
    }
  }

  mdevex.settings.registerSection({
    id: 'font-size',
    title: 'Font Size',
    order: 10,
    render(el) {
      const current = mdevex.settings.get('fontSize') || 14;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;';

      const minus = document.createElement('button');
      minus.textContent = '\u2212';
      minus.style.cssText = 'width:36px;height:36px;font-size:18px;background:#333;color:#ccc;border:1px solid #555;border-radius:4px;cursor:pointer;';

      const label = document.createElement('span');
      label.textContent = current;
      label.style.cssText = 'font-size:16px;color:#ccc;min-width:24px;text-align:center;';

      const plus = document.createElement('button');
      plus.textContent = '+';
      plus.style.cssText = 'width:36px;height:36px;font-size:18px;background:#333;color:#ccc;border:1px solid #555;border-radius:4px;cursor:pointer;';

      minus.addEventListener('click', () => {
        const size = Math.max(8, (mdevex.settings.get('fontSize') || 14) - 1);
        mdevex.settings.set('fontSize', size);
        label.textContent = size;
      });

      plus.addEventListener('click', () => {
        const size = Math.min(32, (mdevex.settings.get('fontSize') || 14) + 1);
        mdevex.settings.set('fontSize', size);
        label.textContent = size;
      });

      row.appendChild(minus);
      row.appendChild(label);
      row.appendChild(plus);
      el.appendChild(row);
    },
  });

  mdevex.on('settings-changed', ({ key, value }) => {
    if (key === 'fontSize') applyFontSize(value);
  });

  mdevex.on('connected', ({ session }) => {
    const size = mdevex.settings.get('fontSize');
    if (size) {
      const td = mdevex.getTerminalData?.(session);
      if (td?.terminal) {
        td.terminal.options.fontSize = size;
        if (td.fitAddon) td.fitAddon.fit();
      }
    }
  });
})();
