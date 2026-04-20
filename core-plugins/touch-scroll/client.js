(function() {
  const FLING_FRICTION = 0.95;
  const FLING_MIN_VELOCITY = 0.5;
  const mainSlot = mdevex.slots['main'];

  let pointerId = null;
  let lastY = 0, lastTime = 0, accumulated = 0, scrollVelocity = 0;
  let flingAnim = null, flingAccum = 0;
  let isScrolling = false, startX = 0, startY = 0;
  let touchCol = 1, touchRow = 1;

  function getLineHeight() {
    const name = mdevex.getActiveSession?.();
    const td = name && mdevex.getTerminalData?.(name);
    if (td?.terminal?._core?._renderService) {
      try {
        const h = td.terminal._core._renderService.dimensions.css.cell.height;
        if (h > 0) return h;
      } catch {}
    }
    return 14 * 1.2;
  }

  function getCellCoords(clientX, clientY) {
    const name = mdevex.getActiveSession?.();
    const td = name && mdevex.getTerminalData?.(name);
    if (td?.terminal?._core?._renderService) {
      try {
        const dims = td.terminal._core._renderService.dimensions;
        const cw = dims.css.cell.width, ch = dims.css.cell.height;
        if (cw > 0 && ch > 0) {
          const screen = mainSlot.querySelector('.terminal-wrapper.active .xterm-screen');
          if (screen) {
            const rect = screen.getBoundingClientRect();
            return [Math.max(1, Math.floor((clientX - rect.left) / cw) + 1),
                    Math.max(1, Math.floor((clientY - rect.top) / ch) + 1)];
          }
        }
      } catch {}
    }
    return [1, 1];
  }

  function doScroll(rows) {
    const name = mdevex.getActiveSession?.();
    if (!name || rows === 0) return;
    const btn = rows < 0 ? 64 : 65;
    const seq = '\x1b[<' + btn + ';' + touchCol + ';' + touchRow + 'M';
    const count = Math.abs(rows);
    for (let i = 0; i < count; i++) mdevex.sendToTerminal(name, seq);
  }

  function stopFling() {
    if (flingAnim) { cancelAnimationFrame(flingAnim); flingAnim = null; }
    flingAccum = 0; scrollVelocity = 0;
  }

  function startFling() {
    if (Math.abs(scrollVelocity) < FLING_MIN_VELOCITY) { scrollVelocity = 0; return; }
    const lineH = getLineHeight();
    flingAccum = 0;
    function frame() {
      scrollVelocity *= FLING_FRICTION;
      if (Math.abs(scrollVelocity) < FLING_MIN_VELOCITY) { flingAnim = null; return; }
      flingAccum += scrollVelocity * 0.5;
      const lines = Math.trunc(flingAccum / lineH);
      if (lines !== 0) { flingAccum -= lines * lineH; doScroll(lines); }
      flingAnim = requestAnimationFrame(frame);
    }
    flingAnim = requestAnimationFrame(frame);
  }

  mainSlot.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    if (pointerId !== null) return;
    stopFling();
    pointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    lastY = e.clientY; lastTime = performance.now();
    accumulated = 0; scrollVelocity = 0; isScrolling = false;
    const coords = getCellCoords(e.clientX, e.clientY);
    touchCol = coords[0]; touchRow = coords[1];
    try { mainSlot.setPointerCapture(e.pointerId); } catch {}
  });

  mainSlot.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const now = performance.now();
    const dt = now - lastTime;
    const deltaY = lastY - e.clientY;

    if (!isScrolling) {
      const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
      if (dy > 10 && dy > dx) { isScrolling = true; }
      else if (dx > 10 && dx > dy) {
        try { mainSlot.releasePointerCapture(pointerId); } catch {}
        pointerId = null; return;
      }
      if (!isScrolling) return;
    }

    if (dt > 0) {
      const instantVel = deltaY / dt * 16;
      scrollVelocity = scrollVelocity * 0.3 + instantVel * 0.7;
    }

    accumulated += deltaY;
    lastY = e.clientY; lastTime = now;

    const lineH = getLineHeight();
    const threshold = lineH * 0.5;
    let rows = 0;
    if (accumulated >= threshold) {
      rows = Math.max(1, Math.round(accumulated / lineH));
      accumulated -= rows * lineH;
    } else if (accumulated <= -threshold) {
      rows = Math.min(-1, Math.round(accumulated / lineH));
      accumulated -= rows * lineH;
    }
    if (rows !== 0) doScroll(rows);
    e.preventDefault();
  });

  mainSlot.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointerId) return;
    try { mainSlot.releasePointerCapture(pointerId); } catch {}
    pointerId = null; accumulated = 0;
    if (isScrolling) startFling();
    isScrolling = false;
  });

  mainSlot.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null; accumulated = 0; isScrolling = false; stopFling();
  });
})();
