import { expect, test } from '@playwright/test';

test('captures title and gameplay artifacts', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GRIDLINE_APEX__?.ready));
  await expect(page.getByRole('heading', { name: 'Gridline Apex' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('title-menu.png'), fullPage: true });

  await page.getByRole('button', { name: 'Time Attack' }).click();
  await page.getByRole('button', { name: 'Race' }).click();
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'race');
  await page.screenshot({ path: testInfo.outputPath('race-start.png'), fullPage: true });

  const metrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(metrics.triangles).toBeGreaterThan(10_000);
  expect(metrics.calls).toBeLessThan(180);
});
