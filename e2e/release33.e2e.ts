/**
 * Release 3.3 (ui_spec_v1_7.md §29 to §31, config v1.9), on a phone-sized
 * screen. Synthetic data only: the athlete-shaped fixture with invented numbers.
 */
import { expect, test } from '@playwright/test';
import { ATHLETE_SHAPED, item, logJumpTest, open } from './helpers';

test('§30 the jump test card sits straight after the warm-up and says so', async ({ page }) => {
  await open(page, '2026-11-16T18:00:00+08:00', ATHLETE_SHAPED);
  const texts = await page.locator('.card').allInnerTexts();
  const warm = texts.findIndex((t) => t.includes('Your glute warm-up'));
  const jump = texts.findIndex((t) => t.startsWith('Jump test'));
  expect(warm).toBeGreaterThanOrEqual(0);
  expect(jump).toBe(warm + 1);
  await expect(item(page, 'Jump test')).toContainText('end of the warm-up');
  await expect(item(page, 'Jump test')).toContainText('Straight after the 2 building jumps that end your warm-up.');
});

test('§31 the phase-start test says what reactive strength is and works it out from frames', async ({ page }) => {
  await open(page, '2026-11-09T18:00:00+08:00', ATHLETE_SHAPED);
  await logJumpTest(page);
  await page.locator('.session-check').getByRole('button', { name: 'No', exact: true }).click();
  const pt = item(page, 'Phase-start test');
  await expect(pt).toContainText('Reactive strength index is time in the air divided by time on the floor');
  await expect(pt.getByRole('button', { name: 'Calculate from video' })).toHaveCount(2);
  // The drop jump card uses the same words.
  await expect(page.locator('body')).not.toContainText('jump height divided by ground contact');
});

test('§29 Block 3 Day 1 keeps a heavy press: 2 × 6 dumbbell push press alternating with the pull-up', async ({ page }) => {
  await open(page, '2026-12-28T18:00:00+08:00', ATHLETE_SHAPED);
  await expect(page.locator('body')).toContainText('Dumbbell push press');
  await expect(page.locator('body')).toContainText('about 68 min');
});
