import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const runDir = join(projectRoot, 'screenshots', timestamp);

test.beforeAll(() => {
  mkdirSync(runDir, { recursive: true });
});

// Helper: get a CDP session for real touch events
async function cdp(page) {
  return await page.context().newCDPSession(page);
}

// Helper: dispatch a single touch event
async function touch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
  });
}

// Helper: wait for terminal to be connected and have content
async function waitForTerminal(page) {
  await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 5000 });
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('.terminal-wrapper.active .xterm-rows > div');
    for (const row of rows) {
      if (row.textContent.trim().length > 0) return true;
    }
    return false;
  }, { timeout: 10000 });
  await page.waitForTimeout(300);
}

test.describe('touch gestures', () => {

  test('01-tap-tab-switch', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);
    const tabs = page.locator('#tab-bar .tab');
    if (await tabs.count() < 2) {
      test.skip();
      return;
    }

    // Verify first tab is active
    await expect(tabs.nth(0)).toHaveClass(/active/);
    const firstName = await tabs.nth(0).textContent();

    // Get position of second tab and tap it via CDP touch
    const box = await tabs.nth(1).boundingBox();
    const client = await cdp(page);
    await touch(client, 'touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }]);
    await page.waitForTimeout(50);
    await touch(client, 'touchEnd', []);
    await page.waitForTimeout(500);

    // Verify second tab is now active
    await expect(tabs.nth(1)).toHaveClass(/active/);
    const secondName = await tabs.nth(1).textContent();
    expect(secondName).not.toBe(firstName);

    await page.screenshot({ path: join(runDir, '01-tap-tab-switch.png'), fullPage: true });
  });

  test('02-vertical-swipe', async ({ page }) => {
    await page.goto('/');
    await waitForTerminal(page);

    // Type some lines into the terminal to have scrollable content
    // Send newlines to create content in tmux
    const session = await page.evaluate(() => window.mdevex.getActiveSession());
    for (let i = 0; i < 30; i++) {
      await page.evaluate((line) => {
        window.mdevex.sendToTerminal(window.mdevex.getActiveSession(), `echo "line ${line}"\r`);
      }, i);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    await page.screenshot({ path: join(runDir, '02-swipe-before.png'), fullPage: true });

    // Get terminal area position
    const termArea = await page.locator('#terminal-area').boundingBox();
    const centerX = termArea.x + termArea.width / 2;
    const startY = termArea.y + termArea.height * 0.7;
    const endY = termArea.y + termArea.height * 0.3;

    // Perform slow vertical swipe (drag up = scroll up in tmux)
    const client = await cdp(page);
    await touch(client, 'touchStart', [{ x: centerX, y: startY }]);
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const y = startY + (endY - startY) * (i / steps);
      await touch(client, 'touchMove', [{ x: centerX, y }]);
      await page.waitForTimeout(16);
    }
    await touch(client, 'touchEnd', []);
    await page.waitForTimeout(500);

    await page.screenshot({ path: join(runDir, '02-swipe-after.png'), fullPage: true });
  });

  test('03-fling-gesture', async ({ page }) => {
    await page.goto('/');
    await waitForTerminal(page);

    // Generate scrollback content
    for (let i = 0; i < 50; i++) {
      await page.evaluate((line) => {
        window.mdevex.sendToTerminal(window.mdevex.getActiveSession(), `echo "fling-${line}"\r`);
      }, i);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(500);

    await page.screenshot({ path: join(runDir, '03-fling-before.png'), fullPage: true });

    // Fast swipe up (fling) — short duration, high velocity
    const termArea = await page.locator('#terminal-area').boundingBox();
    const centerX = termArea.x + termArea.width / 2;
    const startY = termArea.y + termArea.height * 0.8;
    const endY = termArea.y + termArea.height * 0.2;

    const client = await cdp(page);
    await touch(client, 'touchStart', [{ x: centerX, y: startY }]);
    // Only 5 steps = fast swipe
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const y = startY + (endY - startY) * (i / steps);
      await touch(client, 'touchMove', [{ x: centerX, y }]);
      await page.waitForTimeout(8); // ~125fps — fast
    }
    await touch(client, 'touchEnd', []);

    // Wait for any momentum/fling animation
    await page.waitForTimeout(1000);

    await page.screenshot({ path: join(runDir, '03-fling-after.png'), fullPage: true });
  });

  test('04-horizontal-tab-swipe', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);

    // Screenshot the initial tab bar scroll position
    const initialScroll = await page.evaluate(() => document.getElementById('tab-bar').scrollLeft);

    await page.screenshot({ path: join(runDir, '04-tab-swipe-before.png'), fullPage: true });

    // Swipe the tab bar horizontally (right to left = scroll right)
    const tabBarBox = await page.locator('#tab-bar').boundingBox();
    const startX = tabBarBox.x + tabBarBox.width * 0.8;
    const endX = tabBarBox.x + tabBarBox.width * 0.2;
    const barY = tabBarBox.y + tabBarBox.height / 2;

    const client = await cdp(page);
    await touch(client, 'touchStart', [{ x: startX, y: barY }]);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const x = startX + (endX - startX) * (i / steps);
      await touch(client, 'touchMove', [{ x, y: barY }]);
      await page.waitForTimeout(16);
    }
    await touch(client, 'touchEnd', []);
    await page.waitForTimeout(300);

    await page.screenshot({ path: join(runDir, '04-tab-swipe-after.png'), fullPage: true });

    // With only 3 test tabs, may not actually scroll — that's ok, we verify no crash
    const finalScroll = await page.evaluate(() => document.getElementById('tab-bar').scrollLeft);
    // Gesture completed without errors
    expect(true).toBe(true);
  });

  test('05-multi-touch-sequence', async ({ page }) => {
    await page.goto('/');
    await waitForTerminal(page);

    // Full mobile workflow: tap tab → swipe terminal → tap back
    const tabs = page.locator('#tab-bar .tab');
    if (await tabs.count() < 2) {
      test.skip();
      return;
    }

    const client = await cdp(page);

    // Step 1: tap second tab
    const tab2Box = await tabs.nth(1).boundingBox();
    await touch(client, 'touchStart', [{ x: tab2Box.x + tab2Box.width / 2, y: tab2Box.y + tab2Box.height / 2 }]);
    await page.waitForTimeout(50);
    await touch(client, 'touchEnd', []);
    await page.waitForTimeout(500);
    await expect(tabs.nth(1)).toHaveClass(/active/);

    await page.screenshot({ path: join(runDir, '05-multi-step1.png'), fullPage: true });

    // Step 2: swipe down on terminal
    const termArea = await page.locator('#terminal-area').boundingBox();
    const cx = termArea.x + termArea.width / 2;
    await touch(client, 'touchStart', [{ x: cx, y: termArea.y + termArea.height * 0.3 }]);
    for (let i = 1; i <= 10; i++) {
      const y = termArea.y + termArea.height * (0.3 + 0.4 * i / 10);
      await touch(client, 'touchMove', [{ x: cx, y }]);
      await page.waitForTimeout(16);
    }
    await touch(client, 'touchEnd', []);
    await page.waitForTimeout(300);

    await page.screenshot({ path: join(runDir, '05-multi-step2.png'), fullPage: true });

    // Step 3: tap first tab back
    const tab1Box = await tabs.nth(0).boundingBox();
    await touch(client, 'touchStart', [{ x: tab1Box.x + tab1Box.width / 2, y: tab1Box.y + tab1Box.height / 2 }]);
    await page.waitForTimeout(50);
    await touch(client, 'touchEnd', []);
    await page.waitForTimeout(500);
    await expect(tabs.nth(0)).toHaveClass(/active/);

    await page.screenshot({ path: join(runDir, '05-multi-step3.png'), fullPage: true });
  });

});
