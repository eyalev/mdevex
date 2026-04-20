(function() {
  const overlay = mdevex.slots['overlay'];
  const toolbarRight = mdevex.slots['toolbar-right'];

  // Gear button
  const btn = document.createElement('div');
  btn.className = 'tab';
  btn.textContent = '\u2699';
  btn.style.cssText = 'font-size:18px;padding:6px 12px;cursor:pointer;';
  btn.addEventListener('click', togglePanel);
  toolbarRight.appendChild(btn);

  // Overlay backdrop + panel
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;';
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePanel(); });
  overlay.appendChild(backdrop);

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:min(320px,85vw);background:#1e1e1e;border-left:1px solid #333;overflow-y:auto;padding:16px;z-index:201;';
  backdrop.appendChild(panel);

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
  header.innerHTML = '<span style="font-size:16px;font-weight:600;color:#ccc;">Settings</span>';
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText = 'font-size:18px;cursor:pointer;color:#888;padding:4px 8px;';
  closeBtn.addEventListener('click', closePanel);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const sectionsContainer = document.createElement('div');
  panel.appendChild(sectionsContainer);

  let isOpen = false;

  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    sectionsContainer.innerHTML = '';
    const sections = mdevex.settings.getSections();
    for (const section of sections) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'margin-bottom:16px;padding:12px;background:#252526;border-radius:6px;';
      const title = document.createElement('div');
      title.textContent = section.title || section.id;
      title.style.cssText = 'font-size:13px;font-weight:600;color:#4ec9b0;margin-bottom:8px;';
      wrapper.appendChild(title);
      const content = document.createElement('div');
      wrapper.appendChild(content);
      try { section.render(content); } catch (e) { console.error(`Settings section ${section.id} render error:`, e); }
      sectionsContainer.appendChild(wrapper);
    }
    backdrop.style.display = 'block';
    isOpen = true;
  }

  function closePanel() {
    backdrop.style.display = 'none';
    isOpen = false;
  }
})();
