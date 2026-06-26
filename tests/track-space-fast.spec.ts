import { expect, test } from '@playwright/test';

test.setTimeout(40_000);

test('captures focused Marina track-space and steering artifacts', async ({ page }, testInfo) => {
  const viewport = page.viewportSize();
  const isMobile = Boolean(viewport && viewport.width <= 640);

  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GRIDLINE_APEX__?.ready));
  await expect(page.getByRole('heading', { name: 'Gridline Apex' })).toBeVisible();
  await expect(page.locator('[data-screen="menu"]')).toHaveAttribute('data-menu-stage', 'title');

  const titleMetrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(titleMetrics.caption.active).toBe(false);
  expect(titleMetrics.caption.speaker).toBeNull();
  expect(titleMetrics.audio.speechEvents).toBe(0);
  expect(titleMetrics.audio.lastSpeaker).toBe('');
  await page.screenshot({ path: testInfo.outputPath('title-menu.png'), fullPage: true });

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#controlMode').selectOption('holdToGo');
  await page.locator('#performanceMode').selectOption('balanced');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Time Attack' }).click();
  await page.locator('#trackSelect').selectOption('marina');
  await page.getByRole('button', { name: 'Race' }).click();
  await expect(page.locator('#startLights')).toBeVisible();
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.metrics?.lightsOn >= 3);
  await page.screenshot({ path: testInfo.outputPath('marina-start-lights.png'), fullPage: true });

  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'race');
  await expect(page.locator('#startLights')).toBeHidden();
  await expect(page.locator('#raceReadout')).toBeVisible();

  await page.keyboard.down('Space');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(isMobile ? 1800 : 1500);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('Space');

  const metrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(metrics.state).toBe('race');
  expect(metrics.track).toBe('marina');
  expect(metrics.sceneDetails.validation).toMatchObject({
    trackId: 'marina',
    passed: true,
    roadWidth: 16,
    drivableHalfWidth: 8,
    roadObstructionCount: 0,
    estimatedLaneCount: 3,
    steeringAssistMode: 'reduced',
  });
  expect(metrics.sceneDetails.validation.usablePassingWidth).toBeGreaterThanOrEqual(12);
  expect(metrics.sceneDetails.validation.playerLateralRange.max).toBeGreaterThanOrEqual(6.2);
  expect(metrics.sceneDetails.validation.cpuLateralRange.max).toBeGreaterThanOrEqual(5.8);
  expect(metrics.sceneDetails.validation.autoCenteringStrength).toBeLessThanOrEqual(0.45);
  expect(metrics.playerHandling.assistCentering).toBeLessThanOrEqual(0.45);
  expect(Math.abs(metrics.playerTrackSpace.lateral)).toBeGreaterThan(0.8);
  expect(Math.abs(metrics.playerTrackSpace.visualYawOffset)).toBeGreaterThan(0);
  expect(metrics.audio.musicCue).toBe('Silent');
  if (isMobile) {
    expect(metrics.calls).toBeLessThan(150);
    expect(metrics.triangles).toBeLessThan(180_000);
  }

  await page.screenshot({ path: testInfo.outputPath('marina-track-space.png'), fullPage: true });
});
