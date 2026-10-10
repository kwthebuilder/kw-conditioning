/**
 * Release 2 on a phone-sized screen (ui_spec_v1_3.md §14), in the
 * date-free layout of release 1.1. Starts from the initial state with a
 * fixed clock. Synthetic numbers only.
 */
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, at: string): Promise<void> {
  await page.clock.install({ time: new Date(at) });
  await page.addInitScript(() => {
    (window as unknown as { __buzz: number }).__buzz = 0;
    Object.defineProperty(navigator, 'vibrate', { value: () => { (window as unknown as { __buzz: number }).__buzz += 1; return true; }, configurable: true });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Acro S&C' })).toBeVisible();
}

function item(page: Page, name: string) {
  return page.locator('.item', { has: page.getByRole('heading', { name, exact: true }) }).first();
}

async function openBlock(page: Page, name: string): Promise<void> {
  const card = page.locator('.next-card', { hasText: name });
  if (await card.count()) await card.first().click();
}

async function stored(page: Page): Promise<{ log: { kind: string; date: string; log: Record<string, unknown> }[]; lifts: Record<string, { tm: number }> }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('acro-base-sc/state') ?? '{}'));
}

test('one block open at a time; logging moves on', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  // Day 1 opens on the jump test; the blocks wait as "Up next".
  await expect(page.locator('.card.focus')).toHaveCount(0);
  await expect(page.locator('.next-card').first()).toContainText('Up next');
  const cmj = item(page, 'Jump test');
  await cmj.getByLabel('Jump height, average of 3', { exact: true }).fill('48');
  await cmj.getByRole('button', { name: 'Log', exact: true }).click();
  // The first block with work in it opens next.
  await expect(page.locator('.card.focus')).toHaveCount(1);
  await expect(page.locator('.card.focus')).toContainText('Drop jump');
  await expect(page.locator('.card.focus')).not.toContainText('ladder');
});

test('unticked earlier sets ask; the live preview shows the change first', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  await openBlock(page, 'Front squat');
  const fs = item(page, 'Front squat');
  await fs.getByRole('button', { name: /^Set 1/ }).click();
  // The rest timer starts on a tick.
  await expect(page.locator('.restbar')).toContainText('Rest 0:0');
  for (let i = 0; i < 6; i++) await fs.getByRole('button', { name: 'Reps, last set: more' }).click(); // 3 to 8
  await fs.getByRole('radio', { name: '2' }).click();
  await expect(fs.locator('.preview')).toContainText('If you log this: Max 92.0 → 93.0 kg (+1.0).');
  await fs.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(fs.getByText("Set 2 isn't ticked.")).toBeVisible();
  await fs.getByRole('button', { name: 'One fell short' }).click();
  const s = await stored(page);
  const last = s.log[s.log.length - 1]!;
  expect(last.kind).toBe('barbell');
  expect(last.log.missed).toBe(true);
  // "Fell short" is a failure signal: 92.0 less 2.5%.
  expect(s.lifts.front_squat!.tm).toBeCloseTo(89.7, 1);
});

test('rest target set by the athlete buzzes once when reached', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  await openBlock(page, 'Front squat');
  await item(page, 'Front squat').getByRole('button', { name: /^Set 1/ }).click();
  await page.locator('.restbar').getByRole('button', { name: /Rest target/ }).click();
  await expect(page.locator('.restbar')).toContainText('Target 1:30');
  await page.clock.runFor(92_000);
  await expect(page.locator('.restbar')).toHaveClass(/due/);
  expect(await page.evaluate(() => (window as unknown as { __buzz: number }).__buzz)).toBe(1);
});

test('finish lists what is not logged; skipping the rest finishes with a summary', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  const cmj = item(page, 'Jump test');
  await cmj.getByLabel('Jump height, average of 3', { exact: true }).fill('48');
  await cmj.getByRole('button', { name: 'Log', exact: true }).click();
  await page.getByRole('button', { name: 'Finish session' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish' });
  await expect(sheet).toContainText('Romanian deadlift');
  await expect(sheet).toContainText('items not recorded');
  await sheet.getByRole('button', { name: 'Skip the rest' }).click();
  await expect(sheet).toContainText('Session finished');
  await expect(sheet).toContainText('Jump test readings 0 → 1');
  await expect(sheet).toContainText("What's next");
  await expect(sheet.getByRole('button', { name: 'Save a copy' })).toBeVisible();
  const s = await stored(page);
  expect(s.log.filter((e) => e.kind === 'skip').length).toBeGreaterThan(5);
  expect(s.log.filter((e) => e.kind === 'session_end').length).toBe(1);
});

test('Block 2 contrast: a grid of rounds; the heavy lift logs the rounds ticked', async ({ page }) => {
  await open(page, '2026-11-12T18:00:00+08:00');
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  const card = page.locator('.card.focus');
  await expect(card).toContainText('Contrast: heavy set, then jump · 3–4 rounds');
  // The boundary test single sits above the rounds.
  await expect(card.locator('.callout').first()).toContainText('Test single suggested');
  await card.getByRole('button', { name: 'Skip single' }).click();
  const grid = page.locator('.card.focus .grid-row');
  for (let r = 0; r < 4; r++) await grid.nth(r).locator('button.tick').first().click();
  const dl = item(page, 'Deadlift');
  await dl.getByRole('radio', { name: '3' }).click();
  await dl.getByRole('button', { name: 'Log', exact: true }).click();
  const s = await stored(page);
  const last = s.log.filter((e) => e.kind === 'barbell').pop()!;
  expect((last.log.prescribed as { sets: number }).sets).toBe(4);
});

test('morning-after check-in: one tap when clear, the flare protocol above 3', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  const cmj = item(page, 'Jump test');
  await cmj.getByLabel('Jump height, average of 3', { exact: true }).fill('48');
  await cmj.getByRole('button', { name: 'Log', exact: true }).click();
  await page.clock.setSystemTime(new Date('2026-09-22T08:00:00+08:00'));
  await page.reload();
  const card = page.locator('.checkin');
  await expect(card).toContainText("After Mon 21 Sep's session");
  await card.getByRole('button', { name: "Something's sore" }).click();
  for (let i = 0; i < 4; i++) await card.getByRole('button', { name: 'Gluteal tendon: more' }).click();
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.protocol')).toContainText('Pain above 3/10 persisting beyond 24 h: drop plyometrics');
  await expect(page.locator('.checkin')).toHaveCount(0);
  const s = await stored(page);
  const tc = s.log.find((e) => e.kind === 'tissue_check')!;
  expect(tc.log).toMatchObject({ for_date: '2026-09-21', scores: { patellar: 0, gluteal: 4, shoulder: 0 } });
});
