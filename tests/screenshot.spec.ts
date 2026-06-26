import { expect, test } from '@playwright/test';

test('captures title and gameplay artifacts', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GRIDLINE_APEX__?.ready));
  await expect(page.getByRole('heading', { name: 'Gridline Apex' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('title-menu.png'), fullPage: true });
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.metrics?.previewTrack !== (window as any).__GRIDLINE_APEX__?.metrics?.track, null, {
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Azure' }).click();
  await page.getByRole('button', { name: 'Gold' }).click();
  await page.getByRole('button', { name: 'Tutorial' }).click();
  await expect(page.getByRole('heading', { name: 'Tutorial' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.metrics?.assetStatus?.generatedReady, null, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#performanceMode').selectOption('highDetail');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Time Attack' }).click();
  await page.getByRole('button', { name: 'Race' }).click();
  await expect(page.locator('#startLights')).toBeVisible();
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.metrics?.lightsOn >= 3);
  await page.screenshot({ path: testInfo.outputPath('start-lights.png'), fullPage: true });
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'race');
  await expect(page.locator('#startLights')).toBeHidden();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('race-start.png'), fullPage: true });

  const metrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(metrics.triangles).toBeGreaterThan(30_000);
  expect(metrics.triangles).toBeLessThan(900_000);
  expect(metrics.calls).toBeLessThan(320);
  expect(metrics.geometries).toBeLessThan(220);
  expect(metrics.textures).toBeLessThan(20);
  expect(metrics.estimatedFps).toBeGreaterThan(0);
  expect(metrics.p95FrameMs).toBeGreaterThan(0);
  expect(metrics.audio.musicCue).toBe('Silent');
  expect(metrics.sceneDetails.barrierPanels).toBe(320);
  expect(metrics.sceneDetails.sponsorBoards).toBe(72);
  expect(metrics.sceneDetails.tireStacks).toBeGreaterThan(40);
  expect(metrics.sceneDetails.pitWallSegments).toBe(26);
  expect(metrics.sceneDetails.startGridMarks).toBe(16);
  expect(metrics.sceneDetails.gantryLights).toBe(5);
  expect(metrics.sceneDetails.instancedBatches).toBe(5);
  expect(metrics.sceneDetails.totalInstances).toBeGreaterThan(470);
  expect(metrics.assetKit.referenceImages.chassis).toContain('formula-chassis-reference.png');
  expect(metrics.assetStatus.generatedReady).toBe(true);
  expect(metrics.assetStatus.runtimeMode).toBe('mixed');
  expect(metrics.assetStatus.generatedCarsCreated).toBeGreaterThan(0);
  expect(metrics.assetStatus.proceduralCarsCreated).toBeGreaterThan(0);
  expect(metrics.assetStatus.loadedAssetIds.sort()).toEqual(['chassis', 'driver', 'wheel']);
  const settings = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.settings);
  expect(settings.bodyPaint).toBe('azure');
  expect(settings.helmetPaint).toBe('gold');
});
