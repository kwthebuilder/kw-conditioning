/**
 * Release 3.1 (ui_spec_v1_5.md §23 to §26, config v1.7), on a phone-sized
 * screen. Synthetic data only: the initial state or the athlete-shaped
 * fixture with invented numbers.
 */
import { expect, test } from '@playwright/test';
import { ATHLETE_SHAPED, entries, item, open } from './helpers';

test('§24 the finish sheet asks the session length and saves it as a record', async ({ page }) => {
  await open(page, '2026-11-09T18:00:00+08:00', ATHLETE_SHAPED);
  const cmj = item(page, 'Jump test');
  await cmj.getByLabel('Jump height, average of 3', { exact: true }).fill('50');
  await cmj.getByRole('button', { name: 'Log', exact: true }).click();
  await page.getByRole('button', { name: 'Finish session' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish' });
  await sheet.getByRole('button', { name: 'Skip the rest' }).click();
  await expect(sheet).toContainText('Session finished');
  const input = sheet.getByLabel('How long was the session, door to door?', { exact: true });
  // A 0-minute logging clock is no guess: the field starts empty.
  await expect(input).toHaveValue('');
  await input.fill('74');
  await sheet.getByRole('button', { name: 'Save length' }).click();
  await expect(sheet).toContainText('Session length 74 min, saved.');
  const l = (await entries(page, 'session_length')).at(-1)!;
  expect(l.log).toMatchObject({ kind: 'session_length', date: '2026-11-09', day: 1, minutes: 74 });
});

test('§23 the Plan card reads Block 2 in its own terms', async ({ page }) => {
  await open(page, '2026-11-09T18:00:00+08:00', ATHLETE_SHAPED);
  await page.locator('details.plan summary').click();
  const line = page.locator('.plan-now');
  await expect(line).toContainText('Next front squat: test single, then 3 to 4 × 2 at');
  await expect(line).not.toContainText('heavy week');
});

test('§26 the jump shrug card loads by speed; the seated abduction offers its swap', async ({ page }) => {
  await open(page, '2026-11-12T18:00:00+08:00', ATHLETE_SHAPED);
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  const shrug = item(page, 'Jump shrug');
  await expect(shrug).toContainText('Load by speed, not by a percentage');
  await expect(shrug).not.toContainText('70%');
  const body = await page.locator('body').innerText();
  expect(body).toContain('Seated hip abduction');
});
