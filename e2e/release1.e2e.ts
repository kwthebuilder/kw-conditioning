/**
 * Release 1 on a phone-sized screen (ui_spec_v1_3.md §13, kept for
 * regression in the date-free layout). Starts from the initial state
 * (week 2 is the first logged week) with a fixed clock. Synthetic
 * numbers only; no training data in this repo.
 */
import { expect, test } from '@playwright/test';
import { entries, item, more, open, openBlock, reopenAt, stored } from './helpers';

test('live session: reps left required, 0 reps asks, skip, undo, finish once', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  await expect(page.locator('.next-head')).toContainText('Day 1 · about 72 min');

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
  await expect(page.locator('.status-line')).toContainText("Today's session · Day 1 · Medium week · started");
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

  // Finish asks about what is not recorded, then logs one finish.
  await page.getByRole('button', { name: 'Finish session' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish' });
  await sheet.getByRole('button', { name: 'Skip the rest' }).click();
  await expect(sheet).toContainText('Session finished');
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByRole('button', { name: 'Finish session' })).toHaveCount(0);
  expect(await entries(page, 'session_end')).toHaveLength(1);
});

test('a past session is a record; a correction is previewed and kept', async ({ page }) => {
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

  // Three days later the 21st opens from History as a record: the plan as shown on the day, never inputs.
  await reopenAt(page, '2026-09-24T18:00:00+08:00');
  await page.getByRole('button', { name: /Mon 21 Sep/ }).click();
  await expect(page.locator('.status-line')).toContainText('Record · Day 1 · Medium week');
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
  expect((await stored(page)).rdl.load_kg).toBe(100);
});

test('an unchanged training max saves nothing', async ({ page }) => {
  await open(page, '2026-09-21T18:00:00+08:00');
  await page.getByRole('button', { name: /Front squat max/ }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText("That's the current max. Nothing to save.")).toBeVisible();
  expect(await entries(page, 'tm_override')).toHaveLength(0);
});
