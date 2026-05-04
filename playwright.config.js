const { defineConfig, devices } = require('@playwright/test');

const TARGET = process.env.TARGET || 'local';
const PROD_URL = process.env.PROD_URL || 'https://typingnotion.vercel.app';
const BETA_URL = process.env.BETA_URL || 'https://typingnotion-git-beta-cronos-projects-6b573ea0.vercel.app';

function baseUrlFor(target) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (target === 'prod') return PROD_URL;
  if (target === 'beta') return BETA_URL;
  return `file://${__dirname.replace(/\\/g, '/')}/`;
}

const targetList = TARGET === 'both' ? ['prod', 'beta'] : [TARGET];

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  retries: process.env.CI ? 1 : 0,
  projects: targetList.map(target => ({
    name: `chromium-${target}`,
    use: {
      ...devices['Desktop Chrome'],
      baseURL: baseUrlFor(target)
    },
    metadata: { target }
  }))
});
