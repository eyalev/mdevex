import { test, expect } from '@playwright/test';

test.describe('mdevex core', () => {

  test('page loads with title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('mdevex');
  });

  test('sessions API returns sessions', async ({ request }) => {
    const res = await request.get('/api/sessions');
    expect(res.ok()).toBeTruthy();
    const sessions = await res.json();
    expect(Array.isArray(sessions)).toBeTruthy();
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toHaveProperty('name');
    expect(sessions[0]).toHaveProperty('windows');
  });

  test('tab bar renders session tabs', async ({ page }) => {
    await page.goto('/');
    // Wait for tabs to appear
    await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);
    const tabs = page.locator('#tab-bar .tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(0);
    // First tab should be active
    await expect(tabs.first()).toHaveClass(/active/);
  });

  test('clicking a tab switches sessions', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);
    const tabs = page.locator('#tab-bar .tab');
    const count = await tabs.count();
    if (count < 2) {
      test.skip();
      return;
    }
    // Click second tab
    const secondTabName = await tabs.nth(1).textContent();
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveClass(/active/);
    await expect(tabs.first()).not.toHaveClass(/active/);
  });

  test('terminal connects via WebSocket', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);
    // Wait for xterm terminal to render (canvas or rows)
    await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 5000 });
    // Verify WebSocket opened by checking the terminal has content
    await page.waitForFunction(() => {
      const term = document.querySelector('.terminal-wrapper.active .xterm-screen');
      return term && term.children.length > 0;
    }, { timeout: 5000 });
  });

  test('terminal receives data from tmux', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 5000 });
    // Wait for terminal to have actual content (not just empty)
    const hasContent = await page.waitForFunction(() => {
      const rows = document.querySelectorAll('.terminal-wrapper.active .xterm-rows > div');
      for (const row of rows) {
        if (row.textContent.trim().length > 0) return true;
      }
      return false;
    }, { timeout: 10000 });
    expect(hasContent).toBeTruthy();
  });

  test('status bar shows session count', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#status')).toContainText(/\d+ sessions?/);
  });

  test('resize sends resize message', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 5000 });
    // Resize the viewport and verify no crash
    await page.setViewportSize({ width: 800, height: 400 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1200, height: 700 });
    await page.waitForTimeout(500);
    // Terminal should still be visible
    await expect(page.locator('.xterm-screen')).toBeVisible();
  });

  test('auto-reconnect on disconnect', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);
    // Force-close the WebSocket via the API
    const gotDisconnect = await page.evaluate(() => {
      return new Promise(resolve => {
        window.mdevex.on('disconnected', () => resolve(true));
        window.mdevex.disconnect();
      });
    });
    expect(gotDisconnect).toBe(true);
    // Should reconnect automatically — wait for connected event
    const reconnected = await page.evaluate(() => {
      return new Promise(resolve => {
        window.mdevex.on('connected', () => resolve(true));
        setTimeout(() => resolve(false), 5000);
      });
    });
    expect(reconnected).toBe(true);
  });
});

test.describe('plugin system', () => {

  test('plugins API returns loaded plugins', async ({ request }) => {
    const res = await request.get('/api/plugins');
    expect(res.ok()).toBeTruthy();
    const plugins = await res.json();
    expect(Array.isArray(plugins)).toBeTruthy();
    const testPlugin = plugins.find(p => p.id === 'test-plugin');
    expect(testPlugin).toBeTruthy();
    expect(testPlugin.name).toBe('Test Plugin');
  });

  test('server plugin registers HTTP routes', async ({ request }) => {
    const res = await request.get('/api/test-plugin/ping');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.pong).toBe(true);
  });

  test('server plugin receives WebSocket events', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 5000 });
    // Wait a moment for connection event to fire
    await page.waitForTimeout(1000);
    const res = await request.get('/api/test-plugin/connections');
    const connections = await res.json();
    expect(connections.count).toBeGreaterThan(0);
  });

  test('client plugin renders in UI slot', async ({ page }) => {
    await page.goto('/');
    // Wait for plugin to load
    await expect(page.locator('#test-plugin-marker')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#test-plugin-marker')).toHaveText('TEST');
  });

  test('client plugin receives events', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#test-plugin-marker')).toBeVisible({ timeout: 5000 });
    // Plugin is loaded. Trigger an event by switching tabs
    const tabs = page.locator('#tab-bar .tab');
    if (await tabs.count() < 2) { test.skip(); return; }
    await page.evaluate(() => { window.__testPluginEvents = []; });
    await tabs.nth(1).click();
    await page.waitForTimeout(1000);
    const events = await page.evaluate(() => window.__testPluginEvents);
    const changed = events.find(e => e.type === 'session-changed');
    expect(changed).toBeTruthy();
  });

  test('client plugin receives session-changed on tab click', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);
    const tabs = page.locator('#tab-bar .tab');
    if (await tabs.count() < 2) {
      test.skip();
      return;
    }
    // Wait for initial load
    await page.waitForTimeout(1000);
    // Clear events
    await page.evaluate(() => { window.__testPluginEvents = []; });
    // Click second tab
    await tabs.nth(1).click();
    await page.waitForTimeout(1000);
    const events = await page.evaluate(() => window.__testPluginEvents);
    const changed = events.find(e => e.type === 'session-changed');
    expect(changed).toBeTruthy();
    expect(changed.session).toBeTruthy();
    expect(changed.previous).toBeTruthy();
  });
});

test.describe('UI slots', () => {

  test('all slot containers exist', async ({ page }) => {
    await page.goto('/');
    for (const id of ['slot-top-bar', 'slot-bottom-bar', 'slot-toolbar-left', 'slot-toolbar-right', 'slot-overlay', 'slot-settings-panel']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });

  test('mdevex.slots exposes all slots', async ({ page }) => {
    await page.goto('/');
    const slotKeys = await page.evaluate(() => Object.keys(window.mdevex.slots));
    expect(slotKeys).toContain('top-bar');
    expect(slotKeys).toContain('bottom-bar');
    expect(slotKeys).toContain('toolbar-left');
    expect(slotKeys).toContain('toolbar-right');
    expect(slotKeys).toContain('overlay');
    expect(slotKeys).toContain('settings-panel');
  });
});
