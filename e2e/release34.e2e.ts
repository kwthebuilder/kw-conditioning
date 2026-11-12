/**
 * Release 3.4 (ui_spec_v1_8.md §32 to §34, config v1.10, engine A.43 and
 * A.44), on a phone-sized screen. Synthetic data only: the initial state.
 */
import { expect, test } from '@playwright/test';
import { item, more, open, openBlock, reopenAt, stored } from './helpers';

const singleGroup = 'Reps left after the single';

test('§32 the test single asks for reps left, and a logged single can be changed', async ({ page }) => {
  await open(page, '2026-11-12T18:00:00+08:00');
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await openBlock(page, 'Deadlift');
  const dl = item(page, 'Deadlift');
  await expect(dl.locator('.callout').first()).toContainText('Work up to one clean rep with 1 to 2 left');
  await more(dl, 'Single', 1);
  await dl.getByRole('button', { name: 'Log single' }).click();
  await expect(dl.getByText('Choose how many reps you had left.')).toBeVisible();
  await dl.getByLabel(singleGroup).getByRole('radio', { name: '1' }).click();
  await dl.getByRole('button', { name: 'Log single' }).click();

  let s = await stored(page);
  const single = s.log.filter((e) => e.kind === 'single').pop()!.log as { load: number; rir: number };
  expect(single.rir).toBe(1);
  expect(s.lifts.deadlift!.tm).toBeCloseTo(single.load * (0.9 / 0.955), 6);

  // The single stays on the lift with a Change control, and the doubles follow it.
  await openBlock(page, 'Deadlift');
  const rec = item(page, 'Deadlift').locator('.single-record');
  await expect(rec).toContainText(`Test single logged: ${single.load} kg with 1 left.`);
  await expect(rec).toContainText('Estimated max');
  await rec.getByRole('button', { name: 'Change single' }).click();
  await item(page, 'Deadlift').getByLabel(singleGroup).getByRole('radio', { name: '2' }).click();
  await item(page, 'Deadlift').getByRole('button', { name: 'Check the change' }).click();
  await page.getByRole('dialog', { name: 'Check the change' }).getByRole('button', { name: 'Save correction' }).click();
  s = await stored(page);
  expect(s.log.some((e) => e.kind === 'correction')).toBe(true);
  expect(s.lifts.deadlift!.tm).toBeCloseTo(single.load * (0.9 / 0.93), 6);
  await openBlock(page, 'Deadlift');
  await expect(item(page, 'Deadlift').locator('.single-record')).toContainText(`${single.load} kg with 2 left`);
});

test('§32 a skipped single is gone for the day', async ({ page }) => {
  await open(page, '2026-11-12T18:00:00+08:00');
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await openBlock(page, 'Deadlift');
  await item(page, 'Deadlift').getByRole('button', { name: 'Skip single' }).click();
  await openBlock(page, 'Deadlift');
  await expect(item(page, 'Deadlift')).not.toContainText('Test single suggested');
  await expect(item(page, 'Deadlift').getByLabel(singleGroup)).toHaveCount(0);
});

test('§34 Block 2 heavy doubles: 3 doubles at 87% of max, the effort rule, and 1 left is not a failure', async ({ page }) => {
  await open(page, '2026-11-16T18:00:00+08:00');
  await openBlock(page, 'Front squat');
  const fs = item(page, 'Front squat');
  await expect(fs).toContainText('87% of max');
  await expect(fs).toContainText('Earlier doubles: stop with 2 to 3 left. The last double may go to 1 left, never to 0.');
  await expect(fs.getByRole('button', { name: /^Set 3/ })).toHaveCount(0);
  await fs.getByRole('button', { name: /^Set 1/ }).click();
  await fs.getByRole('button', { name: /^Set 2/ }).click();
  await fs.getByLabel('Reps left in the tank, last set').getByRole('radio', { name: '1' }).click();
  await expect(fs.locator('.preview')).toContainText('Estimated max');
  await expect(fs.locator('.preview')).not.toContainText('No reps left');
  await fs.getByLabel('Reps left in the tank, last set').getByRole('radio', { name: '0' }).click();
  await expect(fs.locator('.preview')).toContainText('No reps left, or a double short');
  // Accessories: the last set may go to the last rep with good form.
  await openBlock(page, 'Romanian deadlift');
  await expect(page.locator('body')).toContainText('Earlier sets with 1 to 2 left. Last set: as many clean reps as you can, up to the last one with good form.');
});

test('§33 the estimated max is the headline; setting it by hand stores 90% as the training max', async ({ page }) => {
  await open(page, '2026-11-16T18:00:00+08:00');
  const chip = page.getByRole('button', { name: /Front squat estimated max/ });
  await expect(chip).toContainText('102.2 kg');
  await chip.click();
  const sheet = page.getByRole('dialog', { name: 'Front squat estimated max' });
  await expect(sheet.locator('.big')).toHaveText('102.2');
  await expect(sheet).toContainText('Training max 92.0 kg: 90% of the estimated max');
  await expect(sheet).toContainText('At this max: doubles 90 kg (87% of it)');
  await more(sheet, 'Estimated max', 1);
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  const s = await stored(page);
  const o = s.log.filter((e) => e.kind === 'tm_override').pop()!.log as { tm: number };
  expect(o.tm).toBeCloseTo(102.7 * 0.9, 6);
  expect(s.lifts.front_squat!.tm).toBeCloseTo(102.7 * 0.9, 6);
});

test('§32 a past session: the test single can be changed in Edit', async ({ page }) => {
  await open(page, '2026-11-12T18:00:00+08:00');
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await openBlock(page, 'Deadlift');
  const dl = item(page, 'Deadlift');
  await more(dl, 'Single', 1);
  await dl.getByLabel(singleGroup).getByRole('radio', { name: '2' }).click();
  await dl.getByRole('button', { name: 'Log single' }).click();
  const single = (await stored(page)).log.filter((e) => e.kind === 'single').pop()!.log as { load: number };
  await openBlock(page, 'Deadlift');
  await item(page, 'Deadlift').getByLabel('Reps left in the tank, last set').getByRole('radio', { name: '2' }).click();
  await item(page, 'Deadlift').getByRole('button', { name: 'Log', exact: true }).click();
  const answer = page.getByRole('button', { name: 'All done' });
  if (await answer.count()) await answer.first().click();

  await reopenAt(page, '2026-11-16T18:00:00+08:00');
  await page.getByRole('button', { name: /Thu 12 Nov/ }).first().click();
  await page.getByRole('button', { name: 'Edit session' }).click();
  const row = item(page, 'Deadlift');
  await row.getByRole('button', { name: 'Change single' }).click();
  await row.getByLabel(singleGroup).getByRole('radio', { name: '0' }).click();
  await row.getByRole('button', { name: 'Check the change' }).click();
  await expect(row).toContainText(`The test single will read: Test single ${single.load} kg, 0 left`);
  await page.getByRole('button', { name: /Review changes/ }).click();
  await page.getByRole('dialog', { name: 'Check the change' }).getByRole('button', { name: 'Save correction' }).click();
  const after = await stored(page);
  const fixed = after.log.filter((e) => e.kind === 'correction').pop()!.log as { actions: { op: string; entry?: { rir: number } }[] };
  expect(fixed.actions.some((a) => a.op === 'replace' && a.entry?.rir === 0)).toBe(true);
});
