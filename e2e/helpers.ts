/**
 * Shared steps for the phone-screen smoke tests. Synthetic data only:
 * either the initial state, or e2e/fixtures/athlete-shaped.json (a log
 * shaped like the athlete's, with invented numbers).
 */
import { expect, type Locator, type Page } from '@playwright/test';
import athleteShaped from './fixtures/athlete-shaped.json' with { type: 'json' };

export const ATHLETE_SHAPED = JSON.stringify(athleteShaped);

/** Open the app at a fixed time, optionally with a stored state (set once, so reloads keep what the test logged). */
export async function open(page: Page, at: string, state?: string): Promise<void> {
  await page.clock.install({ time: new Date(at) });
  if (state) {
    await page.addInitScript((s) => {
      if (!localStorage.getItem('acro-base-sc/state')) localStorage.setItem('acro-base-sc/state', s);
    }, state);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Acro S&C' })).toBeVisible();
}

/** Move the clock and open the app again, as the athlete would the next day. */
export async function reopenAt(page: Page, at: string): Promise<void> {
  await page.clock.setSystemTime(new Date(at));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Acro S&C' })).toBeVisible();
}

export function item(page: Page, name: string): Locator {
  return page.locator('.item', { has: page.getByRole('heading', { name, exact: true }) }).first();
}

/** Release 2: later blocks are "Up next" cards until opened. */
export async function openBlock(page: Page, name: string): Promise<void> {
  const card = page.locator('.next-card', { hasText: name });
  if (await card.count()) await card.first().click();
}

export async function more(scope: Locator, label: string, times: number): Promise<void> {
  for (let i = 0; i < times; i++) await scope.getByRole('button', { name: `${label}: more` }).click();
}

export type Stored = {
  log: { kind: string; date: string; log: Record<string, unknown> }[];
  lifts: Record<string, { tm: number; next_position: number; neg_streak: number; last_logged?: string }>;
  rdl: { load_kg: number };
  accessories: Record<string, unknown>;
  explosive?: Record<string, unknown>;
  depth_jump: { height_cm: number | null };
};

export async function stored(page: Page): Promise<Stored> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('acro-base-sc/state') ?? '{"log":[]}'));
}

/** Entries of a kind in the raw log. */
export async function entries(page: Page, kind: string): Promise<Stored['log']> {
  return (await stored(page)).log.filter((e) => e.kind === kind);
}

/** Log the jump test on Today's session (Day 1). */
export async function logJumpTest(page: Page, cm = '45'): Promise<void> {
  const cmj = item(page, 'Jump test');
  await cmj.getByLabel('Jump height, average of 3', { exact: true }).fill(cm);
  await cmj.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Logged: Jump test');
}

/** Skip the first unlogged item in the open block, with no reason. */
export async function skipNext(page: Page): Promise<void> {
  const it = page.locator('.card.focus .item:not(.done-item)').first();
  await it.getByRole('button', { name: 'Skip', exact: true }).click();
  await it.getByRole('button', { name: 'No reason' }).click();
}

/** The History card for a programme week. */
export function week(page: Page, n: number): Locator {
  return page.locator('.hist-week', { has: page.locator('.week-head', { hasText: new RegExp(`^Week ${n} ·`) }) });
}

/** No numeric date anywhere in the visible text (ui_spec_v1_3.md §2, §13A test 1). */
export async function expectNoNumericDate(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
  expect(text).not.toMatch(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/);
  expect(text).not.toMatch(/\b\d{1,2}-\d{1,2}-\d{2,4}\b/);
}
