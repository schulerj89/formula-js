import { expect, test } from '@playwright/test';

test.setTimeout(110_000);

test('clicks through campaign podiums into the finale', async ({ page }, testInfo) => {
  const viewport = page.viewportSize();
  test.skip(Boolean(viewport && viewport.width <= 640), 'Campaign path smoke runs once on desktop to keep artifact time bounded.');

  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GRIDLINE_APEX__?.ready));
  await page.getByRole('button', { name: 'Campaign' }).click();
  await page.getByRole('button', { name: 'Race' }).click();

  for (let index = 0; index < 4; index += 1) {
    await expect(page.locator('#startLights')).toBeVisible();
    await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'race');
    await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.debug?.forceRaceFinish?.());
    await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'podium');
    await expect(page.getByRole('heading', { name: /Podium/ })).toBeVisible();

    const podiumMetrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
    expect(podiumMetrics.campaign.mode).toBe('campaign');
    expect(podiumMetrics.campaign.trackIndex).toBe(index);
    expect(podiumMetrics.campaign.scores[0].racerId).toBe('player');
    expect(podiumMetrics.campaign.scores[0].points).toBe((index + 1) * 25);
    expect(podiumMetrics.podium.topThreeRacerIds[0]).toBe('player');
    expect(podiumMetrics.podium.stats.finaleMode).toBe(false);
    await expect(page.getByRole('button', { name: index < 3 ? 'Next Race' : 'Finale' })).toBeVisible();

    if (index === 0) {
      await page.screenshot({ path: testInfo.outputPath('campaign-first-podium.png'), fullPage: true });
    }

    if (index < 3) {
      expect(podiumMetrics.campaign.nextAction).toBe('next-race');
      await page.getByRole('button', { name: 'Next Race' }).click();
    } else {
      expect(podiumMetrics.campaign.nextAction).toBe('finale');
      await page.getByRole('button', { name: 'Finale' }).click();
    }
  }

  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'finale');
  await expect(page.getByRole('heading', { name: 'Campaign Champions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('campaign-finale-real-path.png'), fullPage: true });
  const finaleMetrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(finaleMetrics.podium.stats.finaleMode).toBe(true);
  expect(finaleMetrics.podium.focusRacerId).toBe('player');
  expect(finaleMetrics.campaign.scores[0].points).toBe(100);
  expect(finaleMetrics.podiumCommentary.eventCount).toBeGreaterThanOrEqual(2);
  expect(finaleMetrics.caption.text).toContain('Rookie is champion after 4 races');
});
