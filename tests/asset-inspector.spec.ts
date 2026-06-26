import { expect, test } from '@playwright/test';

test.setTimeout(45_000);

test('inspects generated formula assets away from the main game', async ({ page }, testInfo) => {
  await page.goto('asset-inspector.html');
  await page.waitForFunction(
    () => {
      const metrics = (window as any).__GRIDLINE_ASSET_INSPECTOR__;
      return Boolean(metrics?.ready && metrics.render?.triangles > 0);
    },
    null,
    { timeout: 20_000 },
  );

  await expect(page.getByRole('heading', { name: 'Asset Inspector' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gridline Apex' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('asset-inspector.png'), fullPage: true });

  const metrics = await page.evaluate(() => (window as any).__GRIDLINE_ASSET_INSPECTOR__);
  expect(metrics.isolated).toBe(true);
  expect(metrics.loadedAssetIds.sort()).toEqual(['chassis', 'driver', 'wheel']);
  expect(metrics.failedAssetIds).toHaveLength(0);
  expect(metrics.visibleModelIds.sort()).toEqual(['chassis', 'driver', 'procedural-car', 'wheel']);
  expect(metrics.driverRig.hasHelmet).toBe(true);
  expect(metrics.driverRig.hasVisor).toBe(true);
  expect(metrics.render.calls).toBeGreaterThan(0);
  expect(metrics.render.triangles).toBeGreaterThan(0);
  expect(metrics.render.geometries).toBeGreaterThan(0);

  await page.getByLabel('Wheel').uncheck();
  await page.waitForFunction(() => !(window as any).__GRIDLINE_ASSET_INSPECTOR__?.visibleModelIds?.includes('wheel'));
  const toggledMetrics = await page.evaluate(() => (window as any).__GRIDLINE_ASSET_INSPECTOR__);
  expect(toggledMetrics.visibleModelIds).not.toContain('wheel');
});
