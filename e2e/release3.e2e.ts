/**
 * The programme 1.6 release (ui_spec_v1_4.md §18 to §21, config v1.6), on a
 * phone-sized screen. Synthetic data only: the initial state, or the
 * athlete-shaped fixture with invented numbers. Today's date is set by
 * each test.
 */
import { expect, test } from '@playwright/test';
import { ATHLETE_SHAPED, entries, item, logJumpTest, open, openBlock, stored } from './helpers';

const MON_19_OCT = '2026-10-19T18:00:00+08:00';
const NOTE = 'Running long? First drop the upper pair to 2 rounds, then swap the split squat for the hack squat. Never cut the explosive work or the abduction.';

test('the session-start tendon question: one tap for No, never blocks logging', async ({ page }) => {
  await open(page, MON_19_OCT, ATHLETE_SHAPED);
  const card = page.locator('.session-check');
  await expect(card).toContainText('Any tendon pain above 3/10 in the last 48 hours?');
  // It does not block: the jump test logs with the question still open.
  await logJumpTest(page);
  await expect(page.locator('.session-check')).toBeVisible();
  await card.getByRole('button', { name: 'No', exact: true }).click();
  await expect(page.locator('.session-check')).toHaveCount(0);
  const tc = (await entries(page, 'tissue_check')).at(-1)!;
  expect(tc.log).toMatchObject({ kind: 'tissue_check', date: '2026-10-19', for_date: '2026-10-19', above_3: false, scores: {} });
  // The morning-after card is gone: the next day shows no check-in card.
  await page.clock.setSystemTime(new Date('2026-10-20T08:00:00+08:00'));
  await page.reload();
  await expect(page.locator('.checkin')).toHaveCount(0);
});

test('the session-start question on Day 2 asks site and score only after Yes', async ({ page }) => {
  await open(page, '2026-10-22T18:00:00+08:00', ATHLETE_SHAPED);
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  const card = page.locator('.session-check');
  await expect(card.getByLabel('Patellar tendon', { exact: true })).toHaveCount(0);
  await card.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(card.getByLabel('Patellar tendon', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Patellar tendon: more' }).click();
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  const tc = (await entries(page, 'tissue_check')).at(-1)!;
  expect(tc.log).toMatchObject({ above_3: true, scores: { patellar: 1, gluteal: 0, shoulder: 0 } });
});

test('the running-long note and the minutes line show on every session', async ({ page }) => {
  await open(page, MON_19_OCT, ATHLETE_SHAPED);
  await expect(page.locator('.next-head h2')).toContainText('Day 1 · about 70 min, 80 max');
  await expect(page.locator('.session-note')).toHaveText(NOTE);
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await expect(page.locator('.next-head h2')).toContainText('Day 2 · about 63 min, 80 max');
  await expect(page.locator('.session-note')).toHaveText(NOTE);
});

test('the warm-up and the jump test carry the new words', async ({ page }) => {
  await open(page, MON_19_OCT, ATHLETE_SHAPED);
  await expect(page.locator('.warm-text').first()).toHaveText('Your glute warm-up. Finish with 3 to 5 small bounces on the spot and 2 jumps building from easy to near-max, then start the first explosive exercise within 1 to 3 minutes.');
  await expect(item(page, 'Jump test')).toContainText('Leave the same gap between the three jumps every time.');
});

test('the light-week card reads the new line', async ({ page }) => {
  await open(page, MON_19_OCT, ATHLETE_SHAPED);
  // The athlete-shaped log ends with the front squat due a medium week; a light week is two Day 1s on.
  const s = JSON.parse(ATHLETE_SHAPED) as { lifts: { front_squat: { next_position: number } } };
  s.lifts.front_squat.next_position = 1;
  await page.evaluate((x) => localStorage.setItem('acro-base-sc/state', x), JSON.stringify(s));
  await page.reload();
  await openBlock(page, 'Front squat');
  await expect(item(page, 'Front squat')).toContainText('Light week: 3 sets of 4 at this load. Stop at 4, even if you have more.');
});

test('Swapped to…: one tap picks the swap, the numbers are optional, nothing moves', async ({ page }) => {
  await open(page, MON_19_OCT, ATHLETE_SHAPED);
  await openBlock(page, 'Weighted pull-up');
  const pu = item(page, 'Weighted pull-up');
  const before = await stored(page);
  await pu.getByRole('button', { name: 'Swapped to…' }).click();
  await pu.getByRole('radio', { name: 'Chest-supported row' }).click();
  await pu.getByLabel('Load, optional', { exact: true }).fill('30');
  await pu.getByRole('button', { name: 'Log swap' }).click();
  await expect(page.locator('.toast')).toContainText('Weighted pull-up swapped');
  const after = await stored(page);
  const swap = after.log.at(-1)!;
  expect(swap.log).toMatchObject({ kind: 'swap', slot: 'pull_up', date: '2026-10-19', to: 'Chest-supported row', load: 30 });
  for (const k of ['lifts', 'rdl', 'accessories', 'explosive', 'depth_jump'] as const) expect(after[k]).toEqual(before[k]);
  // The upper pair is still open (the push press is not logged): the pull-up reads as swapped.
  await openBlock(page, 'Weighted pull-up');
  const done = page.locator('.done-item', { hasText: 'Weighted pull-up' });
  await expect(done).toContainText('Swapped to Chest-supported row · 30 kg');
  await expect(done.locator('.status')).toHaveText('Swapped');
  await expect(done).toContainText('Nothing moves.');
});

test('a swapped front squat moves nothing, and Day 2 comes next', async ({ page }) => {
  await open(page, MON_19_OCT, ATHLETE_SHAPED);
  await openBlock(page, 'Front squat');
  const fs = item(page, 'Front squat');
  const tm = (await stored(page)).lifts.front_squat!.tm;
  await fs.getByRole('button', { name: 'Swapped to…' }).click();
  await fs.getByRole('radio', { name: 'Belt squat' }).click();
  await fs.getByRole('button', { name: 'Log swap' }).click();
  await expect(page.locator('.done-card', { hasText: 'Front squat' })).toContainText("It counts as today's main lift, so the other day comes next.");
  const s = await stored(page);
  expect(s.lifts.front_squat!.tm).toBe(tm);
  expect(s.lifts.front_squat!.next_position).toBe(2);
  await page.getByRole('button', { name: 'Finish session' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish' });
  await sheet.getByRole('button', { name: 'Skip the rest' }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.locator('.next-head h2')).toContainText('Day 2');
});

test('the phase-start test sits at the start of the explosive work on the first Day 1 of Block 2, record only', async ({ page }) => {
  await open(page, '2026-11-09T18:00:00+08:00', ATHLETE_SHAPED);
  const line = page.locator('.next-card .line').first();
  await expect(line.locator('.nm')).toHaveText('Phase-start test');
  await logJumpTest(page);
  await page.locator('.session-check').getByRole('button', { name: 'No', exact: true }).click();
  const pt = item(page, 'Phase-start test');
  await expect(pt).toContainText('Phase-start test: film 3 depth jumps and 1 trap-bar jump set in My Jump Lab. Enter your best reactive strength index and best trap-bar jump height.');
  const before = await stored(page);
  await pt.getByLabel('Best reactive strength index', { exact: true }).fill('2.137');
  await pt.getByLabel('Best trap-bar jump height', { exact: true }).fill('41.5');
  await pt.getByRole('button', { name: 'Log', exact: true }).click();
  const after = await stored(page);
  expect(after.log.at(-1)!.log).toMatchObject({ kind: 'phase_test', date: '2026-11-09', rsi: 2.14, trap_bar_cm: 41.5 });
  for (const k of ['lifts', 'rdl', 'accessories', 'explosive', 'depth_jump'] as const) expect(after[k]).toEqual(before[k]);
  // Once the front squat is logged in Block 2, a later Day 1 does not offer the test again.
  await openBlock(page, 'Front squat');
  const fs = item(page, 'Front squat');
  await fs.getByRole('button', { name: 'Skip single' }).click();
  await openBlock(page, 'Front squat');
  await item(page, 'Front squat').getByRole('radio', { name: '3' }).click();
  await item(page, 'Front squat').getByRole('button', { name: 'Log', exact: true }).click();
  await item(page, 'Front squat').getByRole('button', { name: 'All done' }).click();
  expect((await stored(page)).lifts.front_squat!.last_logged).toBe('2026-11-09');
  await page.clock.setSystemTime(new Date('2026-11-16T18:00:00+08:00'));
  await page.reload();
  await expect(page.locator('.next-card .line .nm', { hasText: 'Phase-start test' })).toHaveCount(0);
});

test('the export lists a swap and a phase-start test in plain words', async ({ page }) => {
  await open(page, '2026-11-09T18:00:00+08:00', ATHLETE_SHAPED);
  await logJumpTest(page);
  const pt = item(page, 'Phase-start test');
  await pt.getByLabel('Best reactive strength index', { exact: true }).fill('2.1');
  await pt.getByRole('button', { name: 'Log', exact: true }).click();
  const dj = item(page, 'Drop jump');
  await dj.getByRole('button', { name: 'Swapped to…' }).click();
  await dj.getByRole('radio', { name: 'Skater bound' }).click();
  await dj.getByRole('button', { name: 'Log swap' }).click();
  await page.getByRole('button', { name: 'Backup', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export log' }).click()]);
  const text = await (await import('node:fs/promises' as string)).readFile(await download.path(), 'utf8') as string;
  expect(text).toContain('- 2026-11-09 Phase-start test: best reactive strength index 2.10');
  expect(text).toContain('- 2026-11-09 Depth jump: swapped to Skater bound');
});
