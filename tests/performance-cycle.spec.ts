import { expect, test, type Page } from '@playwright/test';

test.setTimeout(110_000);

test('keeps renderer and replay budgets stable across repeat race scene rebuilds', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(Boolean(viewport && viewport.width > 640), 'Repeat-race performance smoke runs on mobile balanced only.');

  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GRIDLINE_APEX__?.ready));
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#performanceMode').selectOption('balanced');
  await page.getByRole('button', { name: 'Done' }).click();

  const first = await runMeasuredRace(page);
  await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.debug?.forceRaceFinish?.());
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'podium');
  const podiumMetrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(podiumMetrics.replayFrames).toBeGreaterThan(0);
  expect(podiumMetrics.replayFrames).toBeLessThanOrEqual(1200);
  expect(podiumMetrics.replaySampleRate).toBe(10);
  expect(podiumMetrics.replayBytes).toBeLessThan(4 * 1024 * 1024);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('heading', { name: 'Gridline Apex' })).toBeVisible();

  const second = await runMeasuredRace(page);

  for (const sample of [first.metrics, second.metrics]) {
    expect(sample.state).toBe('race');
    expect(sample.performanceMode).toBe('balanced');
    expect(sample.viewport.width).toBeLessThanOrEqual(640);
    expect(sample.assetStatus.failedAssetIds).toHaveLength(0);
    expect(sample.assetStatus.loaderDeferred).toBe(true);
    expect(sample.performanceWork.generatedAssetWarmup.scheduled).toBe(true);
    expect(sample.performanceWork.generatedAssetWarmup.started || sample.performanceWork.generatedAssetWarmup.pending).toBe(true);
    if (sample.performanceWork.generatedAssetWarmup.pending) {
      expect(['prerace', 'race']).toContain(sample.performanceWork.generatedAssetWarmup.blockedState);
      expect(sample.assetStatus.warmupStarted).toBe(false);
    }
    expect(sample.sceneLifecycle.hasScene).toBe(true);
    expect(sample.sceneLifecycle.cars).toBe(8);
    expect(sample.sceneDetails.brakeBoardPanels).toBe(12);
    expect(sample.sceneDetails.apexPosts).toBe(6);
    expect(sample.sceneDetails.readabilityMarkerInstances).toBe(30);
    expect(sample.sceneDetails.readabilityInstancedBatches).toBe(3);
    expect(sample.driverRig.activeCars).toBe(8);
    expect(sample.calls).toBeGreaterThan(0);
    expect(sample.calls).toBeLessThan(150);
    expect(sample.triangles).toBeGreaterThan(30_000);
    expect(sample.triangles).toBeLessThan(180_000);
    expect(sample.geometries).toBeLessThan(60);
    expect(sample.textures).toBeLessThan(20);
    expect(sample.materials).toBeLessThan(90);
    expect(sample.lines).toBeLessThan(5_000);
    expect(sample.points).toBeLessThan(5_000);
    expect(sample.pixelRatio).toBeLessThanOrEqual(1.6);
    expect(sample.estimatedFps).toBeGreaterThan(0);
    expect(sample.p95FrameMs).toBeGreaterThan(0);
    expect(sample.liveReplayFrames).toBeGreaterThanOrEqual(60);
    expect(sample.liveReplayFrames).toBeLessThanOrEqual(1200);
    expect(sample.replayFrames).toBe(0);
  }

  expect(second.metrics.sceneLifecycle.builds).toBeGreaterThan(first.metrics.sceneLifecycle.builds);
  expect(second.metrics.geometries).toBeLessThanOrEqual(first.metrics.geometries + 2);
  expect(second.metrics.textures).toBeLessThanOrEqual(first.metrics.textures + 1);
  expect(second.metrics.materials).toBeLessThanOrEqual(first.metrics.materials + 2);
  expect(second.metrics.calls).toBeLessThanOrEqual(first.metrics.calls + 10);
  expect(second.metrics.replayBytes).toBeLessThan(4 * 1024 * 1024);
  if (first.heapBytes !== null && second.heapBytes !== null) {
    expect(second.heapBytes - first.heapBytes).toBeLessThan(15 * 1024 * 1024);
  }
});

test('keeps optional generated asset warmup out of fast-start race phases', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(Boolean(viewport && viewport.width > 640), 'Fast-start warmup scheduling smoke runs on mobile only.');
  await page.addInitScript(() => {
    const testWindow = window as any;
    testWindow.__GRIDLINE_IDLE_CALLBACKS__ = [];
    testWindow.requestIdleCallback = (callback: () => void) => {
      const callbacks = testWindow.__GRIDLINE_IDLE_CALLBACKS__ as Array<() => void>;
      callbacks.push(callback);
      return callbacks.length;
    };
  });

  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GRIDLINE_APEX__?.ready));
  await page.getByRole('button', { name: 'Time Attack' }).click();
  await page.getByRole('button', { name: 'Race' }).click();
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'prerace');
  await page.evaluate(() => {
    const callbacks = ((window as any).__GRIDLINE_IDLE_CALLBACKS__ ?? []) as Array<() => void>;
    callbacks.splice(0).forEach((callback) => callback());
  });

  const preraceMetrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(preraceMetrics.assetStatus.warmupStarted).toBe(false);
  expect(preraceMetrics.performanceWork.generatedAssetWarmup.scheduled).toBe(true);
  expect(preraceMetrics.performanceWork.generatedAssetWarmup.started).toBe(false);
  expect(preraceMetrics.performanceWork.generatedAssetWarmup.pending).toBe(true);
  expect(preraceMetrics.performanceWork.generatedAssetWarmup.blockedState).toBe('prerace');
  expect(preraceMetrics.performanceWork.generatedAssetWarmup.deferrals).toBeGreaterThanOrEqual(1);

  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'race');
  await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.debug?.forceRaceFinish?.());
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'podium');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.metrics?.assetStatus?.generatedReady, null, { timeout: 20_000 });

  const menuMetrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(menuMetrics.performanceWork.generatedAssetWarmup.pending).toBe(false);
  expect(menuMetrics.performanceWork.generatedAssetWarmup.started).toBe(true);
  expect(menuMetrics.performanceWork.generatedAssetWarmup.completed).toBe(true);
  expect(menuMetrics.assetStatus.warmupCompleted).toBe(true);
});

async function runMeasuredRace(page: Page) {
  await page.getByRole('button', { name: 'Time Attack' }).click();
  await page.getByRole('button', { name: 'Race' }).click();
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'race');
  await page.keyboard.down('Space');
  await page.waitForTimeout(8000);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => ((window as any).__GRIDLINE_APEX__?.metrics?.liveReplayFrames ?? 0) > 10);
  const metrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  const heapBytes = await page.evaluate(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return memory?.usedJSHeapSize ?? null;
  });
  return { metrics, heapBytes };
}
