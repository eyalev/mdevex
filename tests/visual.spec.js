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

// Default viewport is Pixel 7 (from config) — all screenshots are mobile

test.describe('visual snapshots', () => {

  test('01-page-load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);
    await page.screenshot({ path: join(runDir, '01-page-load.png'), fullPage: true });
  });

  test('02-terminal-connected', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 5000 });
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('.terminal-wrapper.active .xterm-rows > div');
      for (const row of rows) {
        if (row.textContent.trim().length > 0) return true;
      }
      return false;
    }, { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(runDir, '02-terminal-connected.png'), fullPage: true });
  });

  test('03-tab-switch', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);
    const tabs = page.locator('#tab-bar .tab');
    if (await tabs.count() >= 2) {
      await tabs.nth(1).click();
      await expect(tabs.nth(1)).toHaveClass(/active/);
      await expect(page.locator('.terminal-wrapper.active .xterm-screen')).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: join(runDir, '03-tab-switch.png'), fullPage: true });
  });

  test('04-plugin-ui', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#test-plugin-marker')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: join(runDir, '04-plugin-ui.png'), fullPage: true });
  });

  test('05-landscape', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    // Rotate to landscape
    await page.setViewportSize({ width: 915, height: 412 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(runDir, '05-landscape.png'), fullPage: true });
  });

  test('06-tab-overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);
    // On mobile, tabs overflow — show the scrollable tab bar
    await page.evaluate(() => {
      document.getElementById('tab-bar').scrollLeft = 0;
    });
    await page.screenshot({ path: join(runDir, '06-tab-overflow.png'), fullPage: true });
  });

});
