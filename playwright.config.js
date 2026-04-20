import { defineConfig, devices } from '@playwright/test';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:7683',
    headless: true,
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'node server.js',
    cwd: __dirname,
    port: 7683,
    reuseExistingServer: true,
    timeout: 10000,
    env: { ...process.env, PORT: '7683', MDEVEX_EXTRA_PLUGIN_DIR: join(__dirname, 'tests', 'plugins') },
  },
  globalSetup: './tests/global-setup.js',
  globalTeardown: './tests/global-teardown.js',
});
