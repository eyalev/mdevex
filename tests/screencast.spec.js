import { test, expect } from '@playwright/test';

// Enable video recording for this file
test.use({ video: 'on' });

test('screencast — mobile interaction', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tab-bar .tab')).not.toHaveCount(0);
  await page.waitForTimeout(1000);

  // Connect to first session
  await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1500);

  // Switch tabs
  const tabs = page.locator('#tab-bar .tab');
  const count = await tabs.count();
  if (count >= 3) {
    await tabs.nth(1).click();
    await page.waitForTimeout(1500);
    await tabs.nth(2).click();
    await page.waitForTimeout(1500);
    await tabs.nth(0).click();
    await page.waitForTimeout(1500);
  }

  // Rotate to landscape
  await page.setViewportSize({ width: 915, height: 412 });
  await page.waitForTimeout(1500);

  // Back to portrait
  await page.setViewportSize({ width: 412, height: 915 });
  await page.waitForTimeout(1000);
});
