/**
 * Release 3.5 (config v1.11, design rationale v3.8), on a phone-sized screen.
 * Block 2 Day 2 rebuilt to fit the 80-minute cap. Synthetic data only: the
 * athlete-shaped fixture with invented numbers.
 */
import { expect, test } from '@playwright/test';
import { ATHLETE_SHAPED, item, open, openBlock } from './helpers';

const THU_19_NOV = '2026-11-19T18:00:00+08:00';

test('Block 2 Day 2 reads about 71 minutes and the new running-long line', async ({ page }) => {
  await open(page, THU_19_NOV, ATHLETE_SHAPED);
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await expect(page.locator('.next-head h2')).toContainText('Day 2 · about 71 min, 80 max');
  await expect(page.locator('.session-note')).toContainText('Running long? First drop the carry and row. Then swap the split squat for the hack squat.');
});

test('Block 2 Day 2: split squat and abduction at 2 sets, the jump shrug still its own item before the deadlift', async ({ page }) => {
  await open(page, THU_19_NOV, ATHLETE_SHAPED);
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await expect(item(page, 'Jump shrug')).toBeVisible();
  await openBlock(page, 'Bulgarian split squat');
  const bss = item(page, 'Bulgarian split squat, 3 s lowering');
  await expect(bss).toContainText('2 × 8 each side');
  await expect(bss).toContainText('Set 2, the last');
  const abd = item(page, 'Seated hip abduction');
  await expect(abd).toContainText('Set 2, the last');
  await expect(abd).not.toContainText('Set 3');
});
