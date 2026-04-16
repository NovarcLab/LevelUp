import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/onboarding', name: 'onboarding' },
  { path: '/scenes/empty', name: 'empty' },
  { path: '/scenes/milestone', name: 'milestone' },
  { path: '/scenes/lost', name: 'lost' },
  { path: '/scenes/cmd', name: 'cmd' },
  { path: '/scenes/drawer', name: 'drawer' },
  { path: '/scenes/settings', name: 'settings' },
  { path: '/scenes/roadmap', name: 'roadmap' },
  { path: '/scenes/support-tree', name: 'support-tree' },
];

for (const route of ROUTES) {
  test(`screenshot: ${route.name}`, async ({ page }) => {
    await page.goto(route.path);
    // Wait for animations to settle
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  });
}
