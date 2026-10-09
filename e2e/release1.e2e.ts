/**
 * Release 1 on a phone-sized screen (ui_spec_v1_1.md §13). Starts from the
 * initial state (week 2 is the first logged week) with a fixed clock.
 * Synthetic numbers only; no training data in this repo.
 */
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, at: string): Promise<void> {
  await page.clock.install({ time: new Date(at) });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Acro S&C' })).toBeVisible();
}

async function goToDate(page: Page, date: string): Promise<void> {
  const input = page.getByLabel('Session date');
  await input.fill(date);
  await input.dispatchEvent('change');
}

function item(page: Page, name: string) {
  return page.locator('.item', { has: page.getByRole('heading', { name, exact: true }) }).first();
}

/** Release 2: later blocks are "Up next" cards until opened. */
async function openBlock(page: Page, name: string): Promise<void> {
  const card = page.locator('.next-card', { hasText: name });
  if (await card.count()) await card.first().click();
}

async function more(scope: ReturnType<typeof item>, label: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) await scope.getByRole('button', { name: `${label}: more` }).click();
}

test('live session: reps left required, 0 reps asks, skip, undo, finish once', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  await expect(page.getByText('Mon 21 Sep · Day 1 · Medium week')).toBeVisible();

  await openBlock(page, 'Front squat');
  const fs = item(page, 'Front squat');
  await expect(fs.getByText('77.5', { exact: true })).toBeVisible();
  await more(fs, 'Reps, last set', 5); // 3, 4, 5, 6, 7
  await fs.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(fs.getByText('Choose reps left.')).toBeVisible();
  await fs.getByRole('radio', { name: '2' }).click();
  await fs.getByRole('button', { name: 'Log', exact: true }).click();
  await fs.getByRole('button', { name: 'All done' }).click();
  await expect(page.locator('.toast')).toContainText('Logged: Front squat');
  // A fully logged block folds into a one-line summary.
  await expect(page.locator('.done-card', { hasText: 'Front squat' })).toContainText('77.5 kg · last set 7, 2 left');

  // Undo restores the form.
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await openBlock(page, 'Front squat');
  await expect(item(page, 'Front squat').getByRole('button', { name: 'Log', exact: true })).toBeVisible();

  // 0 reps on the Romanian deadlift asks first; skip instead records a reason and moves nothing.
  await openBlock(page, 'Romanian deadlift');
  const rdl = item(page, 'Romanian deadlift');
  await rdl.getByLabel('Reps, last set', { exact: true }).fill('0');
  await rdl.getByRole('radio', { name: '2' }).click();
  await rdl.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(rdl.getByText('0 reps logs a failed set and lowers the load.')).toBeVisible();
  await rdl.getByRole('button', { name: 'Skip instead' }).click();
  await rdl.getByRole('button', { name: 'Time' }).click();
  await expect(page.locator('.done-card', { hasText: 'Romanian deadlift' })).toContainText('Skipped · Time');
  await expect(page.locator('.done-card', { hasText: 'Romanian deadlift' })).toContainText('Nothing moves.');

  // Finish twice logs one finish.
  await page.getByRole('button', { name: 'Finish session' }).click();
  await page.getByRole('button', { name: 'Finish without them' }).click();
  await expect(page.getByRole('dialog', { name: 'Finish' })).toContainText('Session finished');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: /Session finished/ }).click();
  await expect(page.getByRole('dialog', { name: 'Finish' })).toContainText('Session finished');
  const ends = await page.evaluate(() => (JSON.parse(localStorage.getItem('acro-base-sc/state') ?? '{}').log as { kind: string }[]).filter((e) => e.kind === 'session_end').length);
  expect(ends).toBe(1);
});

test('a past date is a record; a correction is previewed and kept', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  await openBlock(page, 'Front squat');
  const fs = item(page, 'Front squat');
  await more(fs, 'Reps, last set', 5);
  await fs.getByRole('radio', { name: '2' }).click();
  await fs.getByRole('button', { name: 'Log', exact: true }).click();
  await fs.getByRole('button', { name: 'All done' }).click();
  await openBlock(page, 'Romanian deadlift');
  const rdl = item(page, 'Romanian deadlift');
  await rdl.getByLabel('Reps, last set', { exact: true }).fill('0');
  await rdl.getByRole('radio', { name: '2' }).click();
  await rdl.getByRole('button', { name: 'Log', exact: true }).click();
  await rdl.getByRole('button', { name: 'Log 0 reps' }).click();

  // Three days later the 21st is a record: the plan as shown on the day, never inputs.
  await page.clock.setSystemTime(new Date('2026-09-24T18:00:00+08:00'));
  await page.reload();
  await goToDate(page, '2026-09-21');
  await expect(page.getByText('Record of what you logged.')).toBeVisible();
  await expect(page.getByText('Plan as shown on the day')).toBeVisible();
  await expect(item(page, 'Front squat').getByText('Medium week · 77.5 kg · 3 × 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log', exact: true })).toHaveCount(0);

  // Correct the 0-rep set to a skip: the preview shows the load coming back.
  await page.getByRole('button', { name: 'Edit session' }).click();
  const r = item(page, 'Romanian deadlift');
  await r.getByRole('button', { name: 'Change' }).click();
  await r.getByRole('button', { name: 'Skip', exact: true }).click();
  await r.getByRole('button', { name: 'Other' }).click();
  await page.getByRole('button', { name: /Review changes/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Check the change' });
  await expect(sheet).toContainText('Romanian deadlift next load 95 → 100 kg');
  await sheet.getByRole('button', { name: 'Save correction' }).click();
  await expect(item(page, 'Romanian deadlift').getByText(/Corrected/)).toBeVisible();
  const load = await page.evaluate(() => JSON.parse(localStorage.getItem('acro-base-sc/state') ?? '{}').rdl.load_kg);
  expect(load).toBe(100);
});

test('a future date is a labelled preview; Block 2 items show their dose', async ({ page }) => {
  await open(page, '2026-10-09T10:00:00+08:00');
  await goToDate(page, '2026-11-16');
  await page.getByRole('button', { name: 'Day 1' }).click();
  await expect(page.getByText(/^Preview\./)).toBeVisible();
  await expect(item(page, 'Skater bound').getByText('6 reps each side · stuck landing')).toBeVisible();
  await expect(item(page, 'Drop landing').getByText('4–6 landings')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log', exact: true })).toHaveCount(0);
});

test('an unchanged training max saves nothing', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  await page.getByRole('button', { name: /Front squat max/ }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText("That's the current max. Nothing to save.")).toBeVisible();
  const n = await page.evaluate(() => (JSON.parse(localStorage.getItem('acro-base-sc/state') ?? '{"log":[]}').log ?? []).length);
  expect(n).toBe(0);
});
