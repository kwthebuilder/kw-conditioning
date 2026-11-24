/**
 * Release 3.6 (config v1.12, engine A.46, ui_spec_v1_9.md §35), on a
 * phone-sized screen. B weeks in Block 2 (programme weeks 12 and 14).
 * Synthetic data only: the initial state.
 */
import { expect, test } from '@playwright/test';
import { item, open, openBlock, stored } from './helpers';

const TUE_1_DEC = '2026-12-01T18:00:00+08:00'; // week 12, a B week
const THU_3_DEC = '2026-12-03T18:00:00+08:00'; // week 12, a B week
const TUE_8_DEC = '2026-12-08T18:00:00+08:00'; // week 13, an A week

test('§35 B-week Day 1: front squat triples with the triples line, pull-up with a neutral grip', async ({ page }) => {
  await open(page, TUE_1_DEC);
  await page.getByRole('button', { name: 'Day 1', exact: true }).click();
  await openBlock(page, 'Front squat');
  const fs = item(page, 'Front squat');
  await expect(fs).toContainText('× 3');
  await expect(fs).toContainText('B week: triples instead of doubles');
  await expect(fs).toContainText('B week, triples: earlier sets stop with 2 to 3 left; the last stops with 1 to 2 left, no rep-out this week.');
  await expect(fs).not.toContainText('Earlier doubles');
  await openBlock(page, 'Weighted pull-up');
  const pu = item(page, 'Weighted pull-up');
  await expect(pu).toContainText('neutral grip');
  await expect(pu).toContainText('B week: neutral grip, palms facing each other.');
});

test('§35 B-week Day 2: the row points to the split-stance cable row, which the swap list offers; the carry to the front-rack carry', async ({ page }) => {
  await open(page, THU_3_DEC);
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await openBlock(page, 'Deadlift');
  await expect(item(page, 'Deadlift')).toContainText('B week: triples instead of doubles');
  await openBlock(page, 'Chest-supported row');
  const row = item(page, 'Chest-supported row');
  await expect(row).toContainText('B week: split-stance one-arm cable row instead');
  await expect(item(page, 'One-arm overhead carry')).toContainText('B week: front-rack carry instead');
  await row.getByRole('button', { name: 'Swapped to…' }).click();
  await row.getByRole('radio', { name: 'Split-stance one-arm cable row' }).click();
  await row.getByRole('button', { name: 'Log swap' }).click();
  await expect(page.locator('.toast')).toContainText('Chest-supported row swapped');
  const swap = (await stored(page)).log.at(-1)!;
  expect(swap.log).toMatchObject({ kind: 'swap', slot: 'cs_row', to: 'Split-stance one-arm cable row' });
});

test('§35 A week: doubles and the usual words, no B-week notes', async ({ page }) => {
  await open(page, TUE_8_DEC);
  await page.getByRole('button', { name: 'Day 1', exact: true }).click();
  await openBlock(page, 'Front squat');
  const fs = item(page, 'Front squat');
  await expect(fs).toContainText('× 2');
  await expect(fs).not.toContainText('B week');
  await openBlock(page, 'Weighted pull-up');
  await expect(item(page, 'Weighted pull-up')).not.toContainText('B week');
});
