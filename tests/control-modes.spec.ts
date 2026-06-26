import { expect, test, type Page } from '@playwright/test';

test.setTimeout(95_000);

test('shows distinct mobile pedal layouts for hold and split controls', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(Boolean(viewport && viewport.width > 640), 'Control layout smoke runs on mobile only.');

  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GRIDLINE_APEX__?.ready));
  await startRaceWithControlMode(page, 'holdToGo');
  await expect(page.getByRole('button', { name: 'Hold go, release to brake' })).toBeVisible();
  await expect(page.locator('[data-control="brake"]')).toBeHidden();
  const hold = await readControlLayout(page);
  let metrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(hold.mode).toBe('holdToGo');
  expect(hold.visiblePedals).toEqual(['go']);
  expect(hold.go.text).toBe('Hold Go');
  expect(hold.go.aria).toBe('Hold go, release to brake');
  expect(hold.brake.hidden).toBe(true);
  expect(hold.go.box.width).toBeGreaterThanOrEqual(44);
  expect(hold.go.box.height).toBeCloseTo(74, 0);
  expect(hold.go.box.x).toBeGreaterThanOrEqual(0);
  expect(hold.go.box.right).toBeLessThanOrEqual(hold.viewport.width);
  expect(hold.go.box.bottom).toBeLessThanOrEqual(hold.viewport.height);
  expect(hold.cluster.box.right).toBeLessThan(hold.go.box.x);
  expect(metrics.controlLayout.mode).toBe('holdToGo');
  expect(metrics.controlLayout.brakeVisible).toBe(false);
  expect(metrics.controlLayout.visiblePedals).toBe(1);
  expect(metrics.controlLayout.goLabel).toBe('Hold Go');
  expect(metrics.controlLayout.goAriaLabel).toBe('Hold go, release to brake');

  await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.debug?.forceRaceFinish?.());
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'podium');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('heading', { name: 'Gridline Apex' })).toBeVisible();

  await startRaceWithControlMode(page, 'splitPedals');
  await expect(page.getByRole('button', { name: 'Go' })).toBeVisible();
  await expect(page.locator('[data-control="brake"]')).toBeVisible();
  const split = await readControlLayout(page);
  metrics = await page.evaluate(() => (window as any).__GRIDLINE_APEX__?.metrics);
  expect(split.mode).toBe('splitPedals');
  expect(split.visiblePedals.sort()).toEqual(['brake', 'go']);
  expect(split.go.text).toBe('Go');
  expect(split.go.aria).toBe('Go');
  expect(split.brake.text).toBe('Brake');
  expect(split.brake.hidden).toBe(false);
  expect(split.go.color).toBe('rgb(69, 212, 131)');
  expect(split.brake.color).toBe('rgb(255, 107, 107)');
  expect(Math.abs(split.go.box.width - split.brake.box.width)).toBeLessThanOrEqual(1);
  expect(split.go.box.height).toBeCloseTo(74, 0);
  expect(split.brake.box.height).toBeCloseTo(74, 0);
  expect(split.brake.box.right).toBeLessThan(split.go.box.x);
  expect(split.cluster.box.right).toBeLessThan(split.brake.box.x);
  for (const pedal of [split.brake.box, split.go.box]) {
    expect(pedal.width).toBeGreaterThanOrEqual(44);
    expect(pedal.height).toBeGreaterThanOrEqual(44);
    expect(pedal.x).toBeGreaterThanOrEqual(0);
    expect(pedal.right).toBeLessThanOrEqual(split.viewport.width);
    expect(pedal.bottom).toBeLessThanOrEqual(split.viewport.height);
  }
  expect(hold.go.box.width).toBeGreaterThanOrEqual(split.go.box.width * 1.2);
  expect(metrics.controlLayout.mode).toBe('splitPedals');
  expect(metrics.controlLayout.brakeVisible).toBe(true);
  expect(metrics.controlLayout.visiblePedals).toBe(2);
  expect(metrics.controlLayout.goLabel).toBe('Go');
  expect(metrics.controlLayout.goAriaLabel).toBe('Go');
});

async function startRaceWithControlMode(page: Page, mode: 'holdToGo' | 'splitPedals') {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#controlMode').selectOption(mode);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Time Attack' }).click();
  await page.getByRole('button', { name: 'Race' }).click();
  await page.waitForFunction(() => (window as any).__GRIDLINE_APEX__?.state === 'race');
}

async function readControlLayout(page: Page) {
  return page.evaluate(() => {
    const controls = document.querySelector<HTMLElement>('#controls')!;
    const cluster = controls.querySelector<HTMLElement>('.control-cluster')!;
    const pedals = [...controls.querySelectorAll<HTMLButtonElement>('.pedal')];
    const go = controls.querySelector<HTMLButtonElement>('[data-control="go"]')!;
    const brake = controls.querySelector<HTMLButtonElement>('[data-control="brake"]')!;

    const box = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };

    return {
      mode: controls.dataset.mode,
      viewport: { width: innerWidth, height: innerHeight },
      visiblePedals: pedals.filter((pedal) => !pedal.hidden).map((pedal) => pedal.dataset.control),
      cluster: { box: box(cluster) },
      go: {
        text: go.textContent,
        aria: go.getAttribute('aria-label'),
        color: getComputedStyle(go).backgroundColor,
        box: box(go),
      },
      brake: {
        hidden: brake.hidden,
        text: brake.textContent,
        color: getComputedStyle(brake).backgroundColor,
        box: box(brake),
      },
    };
  });
}
