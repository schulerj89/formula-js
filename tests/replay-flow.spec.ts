import { expect, test } from '@playwright/test';

test.setTimeout(95_000);

test('plays a completed race replay with highlight commentary', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(Boolean(viewport && viewport.width <= 640), 'Replay flow smoke runs once on desktop to keep browser time bounded.');

  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GRIDLINE_APEX__?.ready));
  await page.getByRole('button', { name: 'Time Attack' }).click();
  await page.getByRole('button', { name: 'Race' }).click();
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'race');
  await page.keyboard.down('Space');
  await page.waitForTimeout(3500);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => ((window as any).__GRIDLINE_APEX__?.metrics?.liveReplayFrames ?? 0) > 20);
  await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.debug?.forceRaceFinish?.());
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'podium');

  const podiumMetrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(podiumMetrics.replayFrames).toBeGreaterThan(20);
  expect(podiumMetrics.replayEvents).toBeGreaterThanOrEqual(3);
  expect(podiumMetrics.replayBytes).toBeLessThan(4 * 1024 * 1024);

  await page.getByRole('button', { name: 'Replay' }).click();
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'replay');
  await page.waitForFunction(() => ((window as any).__GRIDLINE_APEX__?.metrics?.replayPlayback?.eventIndex ?? 0) > 0);
  await page.waitForTimeout(1800);

  const replayMetrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(replayMetrics.replayPlayback.active).toBe(true);
  expect(replayMetrics.replayPlayback.duration).toBeGreaterThan(0);
  expect(replayMetrics.replayPlayback.frameCount).toBe(podiumMetrics.replayFrames);
  expect(replayMetrics.replayPlayback.eventCount).toBe(podiumMetrics.replayEvents);
  expect(replayMetrics.replayPlayback.eventIndex).toBeGreaterThan(0);
  expect(replayMetrics.replayPlayback.focusRacerId).toBeTruthy();
  expect(replayMetrics.replayPlayback.lastEvent).toBeTruthy();
  expect(replayMetrics.replayPlayback.lastEvent.speaker).toBe(replayMetrics.caption.speaker);
  expect(replayMetrics.replayPlayback.lastEvent.focusRacerId ?? replayMetrics.replayPlayback.focusRacerId).toBe(replayMetrics.replayPlayback.focusRacerId);
  expect(replayMetrics.caption.active).toBe(true);
  expect(['Arthur Bell', 'Mags Whitlow', 'Radio']).toContain(replayMetrics.caption.speaker);
  expect(replayMetrics.driverRig.activeCars).toBe(8);
  expect(replayMetrics.sceneLifecycle.hasScene).toBe(true);
});
