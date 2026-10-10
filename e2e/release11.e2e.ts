/**
 * Release 1.1, the date-free patch (ui_spec_v1_3.md §13A), on a
 * phone-sized screen. The log is e2e/fixtures/athlete-shaped.json:
 * sessions on 21 Sep, 24 Sep, 29 Sep, 2 Oct, 3 Oct, 6 Oct and 8 Oct
 * shaped like the athlete's, with invented numbers. Today's date is set
 * by each test.
 */
import { expect, test, type Page } from '@playwright/test';
import { ATHLETE_SHAPED, entries, expectNoNumericDate, item, logJumpTest, more, open, openBlock, reopenAt, skipNext, stored, week } from './helpers';

const SAT_10_OCT = '2026-10-10T10:00:00+08:00';

/** Thursday 15 Oct, 19:05: start a Day 1 by logging the jump test. */
async function startThursday(page: Page): Promise<void> {
  await open(page, '2026-10-15T19:05:00+08:00', ATHLETE_SHAPED);
  await logJumpTest(page);
  await expect(page.locator('.status-line')).toContainText("Today's session · Day 1");
}

test('1, 2: Today on Sat 10 Oct: no date bar, dates written out, History by programme week', async ({ page }) => {
  await open(page, SAT_10_OCT, ATHLETE_SHAPED);
  await expect(page.locator('.today-date')).toHaveText('Sat 10 Oct 2026');
  await expect(page.locator('.dateline')).toContainText('Week 4 of 25 · Block 1: build tissue and reserve');
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Previous day|Next day/ })).toHaveCount(0);
  await expect(page.locator('.status-line')).toHaveText('No session today. Last session: Day 2 on Thu 8 Oct.');
  await expect(page.locator('.next-head')).toContainText('Next session');
  await expect(page.locator('.next-head h2')).toContainText('Day 1');

  await expect(page.locator('.week-head')).toHaveText([/Week 4 · 5 to 11 Oct\s*2 sessions/, /Week 3 · 28 Sep to 4 Oct\s*3 sessions/, /Week 2 · 21 to 27 Sep\s*2 sessions/]);
  const thu8 = page.getByRole('button', { name: /Thu 8 Oct/ });
  await expect(thu8).toContainText('Day 2 · 2 done · 6 not recorded');
  // Done, skipped and not recorded are separate counts; a zero count is left out.
  for (const label of await page.locator('.session-row .muted').allInnerTexts()) {
    expect(label).toMatch(/^Day [12] · /);
    expect(label).not.toMatch(/\b0 (done|skipped|not recorded)/);
  }
  const box = await thu8.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(56);
  await expectNoNumericDate(page);
});

test('3: a History row opens its record with no max chips; the 6 Oct record passes release 1 test 1', async ({ page }) => {
  await open(page, SAT_10_OCT, ATHLETE_SHAPED);
  await page.getByRole('button', { name: /Tue 6 Oct/ }).click();
  await expect(page.locator('.rec-title')).toHaveText('Tue 6 Oct 2026');
  await expect(page.locator('.status-line')).toHaveText('Record · Day 1 · Light week · about 72 min');
  await expect(page.locator('.tms')).toHaveCount(0);
  const fs = item(page, 'Front squat');
  await expect(fs).toContainText('Light week · 77.5 kg · 3 × 4');
  await expect(fs).toContainText('80 kg · last set 8, 1 left');
  await expect(fs).toContainText('Load raised 2.5 kg');
  await expect(page.getByRole('button', { name: 'Log', exact: true })).toHaveCount(0);
  await expect(page.locator('.not-recorded')).toContainText('Not recorded (5)');
  await expect(page.locator('.not-recorded')).toContainText('Logged before the app could record a skip.');
  await expectNoNumericDate(page);
  await page.getByRole('button', { name: '‹ Today' }).click();
  await expect(page.locator('.today-date')).toHaveText('Sat 10 Oct 2026');
});

test('Q27: the 21 Sep record counts the ladder entry as that day\'s drop jump', async ({ page }) => {
  await open(page, SAT_10_OCT, ATHLETE_SHAPED);
  await page.getByRole('button', { name: /Mon 21 Sep/ }).click();
  await expect(page.locator('.rec-head')).toContainText('9 done · 1 not recorded');
  const dj = item(page, 'Drop jump');
  await expect(dj).toContainText('Done');
  await expect(dj).toContainText('Logged on the ladder item');
});

test('4: the day switch shows Day 2 before anything is logged; the first log fixes the day; Undo brings it back', async ({ page }) => {
  await open(page, SAT_10_OCT, ATHLETE_SHAPED);
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await expect(page.locator('.next-head')).toContainText("You've chosen Day 2. Day 1 is next in your rotation.");
  await expect(page.getByText('Deadlift', { exact: true }).first()).toBeVisible();
  const swing = item(page, 'Kettlebell swing');
  await openBlock(page, 'Kettlebell swing');
  await swing.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.seg')).toHaveCount(0);
  await expect(page.locator('.status-line')).toContainText("Today's session · Day 2");
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.seg')).toHaveCount(1);
  expect(await entries(page, 'session_start')).toHaveLength(0);
});

test('5: Finish with 3 items not recorded asks; Skip the rest logs 3 skips and moves nothing', async ({ page }) => {
  await open(page, '2026-10-12T18:00:00+08:00', ATHLETE_SHAPED);
  await logJumpTest(page);
  for (let i = 0; i < 6; i++) await skipNext(page); // drop jump, trap-bar jump, front squat, push press, pull-up, Romanian deadlift
  const before = await stored(page);
  await page.getByRole('button', { name: 'Finish session' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish' });
  await expect(sheet.locator('h2')).toHaveText('3 items not recorded');
  await expect(sheet).toContainText('Nordic curl');
  await expect(sheet).toContainText('2 × 3');
  await expect(sheet).toContainText('Either way, saving a copy comes next.');
  await expect(sheet.getByRole('button', { name: /Finish without/ })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Skip the rest' }).click();
  await expect(sheet).toContainText('Session finished');
  const after = await stored(page);
  const skips = after.log.slice(before.log.length).filter((e) => e.kind === 'skip');
  expect(skips.map((e) => e.log)).toEqual(['nordic', 'abd_iso', 'y_raise'].map((slot) => ({ kind: 'skip', slot, date: '2026-10-12' })));
  for (const k of ['lifts', 'rdl', 'accessories', 'explosive', 'depth_jump'] as const) expect(after[k]).toEqual(before[k]);
  expect((await entries(page, 'session_end')).filter((e) => e.date === '2026-10-12')).toHaveLength(1);
});

test('Finish with nothing left to record logs the end at once and shows the summary', async ({ page }) => {
  await open(page, '2026-10-12T18:00:00+08:00', ATHLETE_SHAPED);
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  for (let i = 0; i < 8; i++) await skipNext(page);
  await page.getByRole('button', { name: 'Finish session' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish' });
  await expect(sheet).toContainText('Session finished');
  expect((await entries(page, 'session_end')).filter((e) => e.date === '2026-10-12')).toHaveLength(1);
});

test('6, 9: the next day shows the card; the next session waits; Carry on logs into Thursday', async ({ page }) => {
  await startThursday(page);
  await reopenAt(page, '2026-10-16T08:00:00+08:00');
  const card = page.locator('.unfinished');
  await expect(card).toContainText("Thu 15 Oct's Day 1 isn't finished");
  await expect(card).toContainText("1 done · 9 not recorded · started 19:05. Carry on to log the rest into Thursday's session, or close it.");
  await expect(card).toContainText('Carry on is open until the end of today.');
  // 9: the next session cannot start while Thursday's is open.
  await expect(page.locator('.next-head')).toContainText("Ready once Thursday's session is finished or closed.");
  await expect(page.getByRole('button', { name: 'Log', exact: true })).toHaveCount(0);
  await expect(page.locator('.checkin')).toHaveCount(0);

  await card.getByRole('button', { name: 'Carry on' }).click();
  await expect(page.locator('.status-line')).toContainText("Thu 15 Oct's session, carried on · Day 1");
  await item(page, 'Drop jump').getByRole('button', { name: 'Done', exact: true }).click();
  const dj = (await entries(page, 'fixed')).at(-1)!;
  expect(dj.date).toBe('2026-10-15');
  await expect(week(page, 5).locator('.week-head')).toContainText('1 session');
  await expect(week(page, 5).getByRole('button', { name: /Thu 15 Oct/ })).toContainText('2 done · 8 not recorded');
});

test('7: two days later there is no card and nothing is logged; past midnight a live session stays dated D', async ({ page }) => {
  await startThursday(page);
  // Past midnight with the app open: still live, still Thursday's.
  await page.clock.setSystemTime(new Date('2026-10-15T23:59:00+08:00'));
  await page.clock.runFor(120_000);
  await expect(page.locator('.status-line')).toContainText("Thu 15 Oct's session, carried on");
  await expect(page.locator('.unfinished')).toHaveCount(0);
  await item(page, 'Drop jump').getByRole('button', { name: 'Done', exact: true }).click();
  expect((await entries(page, 'fixed')).at(-1)!.date).toBe('2026-10-15');

  const n = (await stored(page)).log.length;
  await reopenAt(page, '2026-10-17T08:00:00+08:00');
  await expect(page.locator('.unfinished')).toHaveCount(0);
  await expect(page.locator('.status-line')).toHaveText('No session today. Last session: Day 1 on Thu 15 Oct.');
  expect((await stored(page)).log.length).toBe(n);
  await page.getByRole('button', { name: /Thu 15 Oct/ }).click();
  await expect(page.locator('.not-recorded')).toContainText('Not recorded (8)');
});

test('8: Close it asks the not-recorded question, then logs one end; pressing it twice logs one', async ({ page }) => {
  await startThursday(page);
  await reopenAt(page, '2026-10-16T08:00:00+08:00');
  await page.getByRole('button', { name: 'Close it' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish' });
  await expect(sheet.locator('h2')).toHaveText('9 items not recorded');
  // Dismissed, then pressed again.
  await page.locator('.sheet-wrap').click({ position: { x: 10, y: 10 } });
  await page.getByRole('button', { name: 'Close it' }).click();
  await sheet.getByRole('button', { name: 'Skip the rest' }).click();
  await expect(sheet).toContainText('Session finished');
  const ends = await entries(page, 'session_end');
  expect(ends.filter((e) => e.date === '2026-10-15')).toHaveLength(1);
  await reopenAt(page, '2026-10-16T09:00:00+08:00');
  await expect(page.locator('.unfinished')).toHaveCount(0);
  expect((await entries(page, 'session_end')).filter((e) => e.date === '2026-10-15')).toHaveLength(1);
});

test('10: Add a missed session: yesterday by default, range refused, Day 1 then the next session is Day 2', async ({ page }) => {
  await open(page, SAT_10_OCT, ATHLETE_SHAPED);
  await page.getByRole('button', { name: 'Add a missed session' }).click();
  await expect(page.locator('.date-face')).toHaveText('Fri 9 Oct 2026');
  await expect(page.getByText('Any day from Mon 14 Sep up to today.')).toBeVisible();
  await expectNoNumericDate(page);
  const picker = page.getByLabel('When did you train?');
  for (const bad of ['2026-10-11', '2026-09-13']) {
    await picker.fill(bad);
    await expect(page.getByText('Choose a day from Mon 14 Sep up to today.')).toBeVisible();
    await expect(page.locator('.date-face')).toHaveText('Fri 9 Oct 2026');
  }
  await picker.fill('2026-10-09');
  await expect(page.getByRole('radio', { name: /Day 1/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /Day 1/ })).toContainText('Next in your rotation on Fri 9 Oct');
  await expect(page.getByRole('radio', { name: /Day 2/ })).toContainText('Your last Day 2 was Thu 8 Oct');
  await page.getByRole('button', { name: 'Next: enter what you did' }).click();

  await expect(page.locator('.mode.edit')).toContainText('Adding Fri 9 Oct · Day 1.');
  const fs = item(page, 'Front squat');
  await expect(fs).toContainText('Medium week · 82.5 kg · 3 × 3');
  await fs.getByRole('button', { name: 'Add', exact: true }).click();
  await more(fs, 'Reps, last set', 4);
  await fs.getByRole('radio', { name: '2' }).click();
  await fs.getByRole('button', { name: 'Apply' }).click();
  await item(page, 'Romanian deadlift').getByRole('button', { name: 'Skip', exact: true }).click();
  await item(page, 'Romanian deadlift').getByRole('button', { name: 'Time' }).click();
  await page.getByRole('button', { name: 'Review changes (2)' }).click();
  const sheet = page.getByRole('dialog', { name: 'Check the change' });
  await expect(sheet).toContainText('Fri 9 Oct · Day 1 added · 1 done, 1 skipped');
  await expect(sheet).toContainText('Your next session: Day 1 → Day 2');
  await sheet.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.locator('.next-head h2')).toContainText('Day 2');
  await expect(page.getByRole('button', { name: /Fri 9 Oct/ })).toContainText('Day 1 · 1 done · 1 skipped · 8 not recorded');
  const added = (await entries(page, 'correction')).at(-1)!;
  expect(added.log.on).toBe('2026-10-09');
});

test('11: a date that already has a session offers Add to that session; no duplicate unless chosen', async ({ page }) => {
  await open(page, SAT_10_OCT, ATHLETE_SHAPED);
  await page.getByRole('button', { name: 'Add a missed session' }).click();
  await page.getByLabel('When did you train?').fill('2026-10-08');
  await expect(page.locator('.attention')).toContainText('Thu 8 Oct already has Day 2');
  await expect(page.getByRole('button', { name: 'Next: enter what you did' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add to that session' }).click();
  await expect(page.locator('.mode.edit')).toContainText('Editing Thu 8 Oct.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: '‹ Today' }).click();
  await expect(week(page, 4).locator('.week-head')).toContainText('2 sessions');

  await page.getByRole('button', { name: 'Add a missed session' }).click();
  await page.getByLabel('When did you train?').fill('2026-10-08');
  await page.getByRole('button', { name: 'Add a separate session' }).click();
  await page.getByRole('radio', { name: /Day 1/ }).click();
  await page.getByRole('button', { name: 'Next: enter what you did' }).click();
  const cmj = item(page, 'Jump test');
  await cmj.getByRole('button', { name: 'Add', exact: true }).click();
  await cmj.getByLabel('Jump height, average of 3', { exact: true }).fill('44');
  await cmj.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Review changes (1)' }).click();
  await page.getByRole('dialog', { name: 'Check the change' }).getByRole('button', { name: 'Save correction' }).click();
  await expect(week(page, 4).locator('.week-head')).toContainText('3 sessions');
  await expect(week(page, 4).getByRole('button', { name: /Thu 8 Oct/ })).toHaveCount(2);
});

test('12: Remove this session previews every knock-on; then it is gone and the next session follows the rotation', async ({ page }) => {
  await open(page, SAT_10_OCT, ATHLETE_SHAPED);
  await page.getByRole('button', { name: /Thu 8 Oct/ }).click();
  await page.getByRole('button', { name: 'Edit session' }).click();
  await page.getByRole('button', { name: 'Remove this session' }).click();
  await expect(page.getByText('This session will be removed')).toBeVisible();
  await page.getByRole('button', { name: 'Review changes (1)' }).click();
  const sheet = page.getByRole('dialog', { name: 'Check the change' });
  await expect(sheet).toContainText('Thu 8 Oct · Day 2 removed');
  await expect(sheet).toContainText('Your next session: Day 1 → Day 2');
  await expect(sheet).toContainText('Deadlift next session: Medium week 122.5 kg → Light week 115 kg');
  await sheet.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.locator('.today-date')).toBeVisible();
  await expect(page.getByRole('button', { name: /Thu 8 Oct/ })).toHaveCount(0);
  await expect(week(page, 4).locator('.week-head')).toContainText('1 session');
  await expect(page.locator('.next-head h2')).toContainText('Day 2');
  await expect(page.locator('.status-line')).toHaveText('No session today. Last session: Day 1 on Tue 6 Oct.');
});

test('13: no session logged before release 1.1 produces the card', async ({ page }) => {
  // The athlete-shaped log has sessions never finished (2 and 3 Oct): no card the day after the last one.
  await open(page, '2026-10-09T08:00:00+08:00', ATHLETE_SHAPED);
  await expect(page.locator('.unfinished')).toHaveCount(0);
  // A session on Sat 10 Oct, left open: still no card on Sun 11 Oct.
  await reopenAt(page, '2026-10-10T09:00:00+08:00');
  await logJumpTest(page);
  await reopenAt(page, '2026-10-11T08:00:00+08:00');
  await expect(page.locator('.unfinished')).toHaveCount(0);
  await expect(page.locator('.next-head')).toContainText('Next session');
  await expect(page.getByRole('button', { name: /Sat 10 Oct/ })).toContainText('1 done · 9 not recorded');
});

test('14: after Finish today: Done today, one line for the session, the next session read-only with Start it today', async ({ page }) => {
  await open(page, '2026-10-12T18:00:00+08:00', ATHLETE_SHAPED);
  await logJumpTest(page);
  await page.getByRole('button', { name: 'Finish session' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish' });
  await sheet.getByRole('button', { name: 'Skip the rest' }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  // Backup is off, so the save-a-copy panel opened by itself.
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.locator('.status-line')).toHaveText(/^Done today · Day 1/);
  const row = page.locator('.screen-today > .hist-week').first().getByRole('button', { name: /Mon 12 Oct/ });
  await expect(row).toContainText('Day 1 · 1 done · 9 skipped');
  // The front squat was skipped, so the rotation still offers Day 1.
  await expect(page.locator('.next-head')).toContainText('Next session · loads assume your training maxes hold');
  await expect(page.locator('.next-head h2')).toContainText('Day 1');
  await expect(page.getByRole('button', { name: 'Log', exact: true })).toHaveCount(0);
  await row.click();
  await expect(page.locator('.rec-title')).toHaveText('Mon 12 Oct 2026');
  await page.getByRole('button', { name: '‹ Today' }).click();
  await page.getByRole('button', { name: 'Start it today' }).click();
  await expect(page.locator('.seg')).toHaveCount(1);
  await expect(item(page, 'Jump test').getByRole('button', { name: 'Log', exact: true })).toBeVisible();
});

test('15: weeks without sessions fold; the current week reads "no sessions yet"; Block 2 doses render', async ({ page }) => {
  await open(page, '2026-11-12T08:00:00+08:00', ATHLETE_SHAPED);
  await expect(page.locator('.hist-empty')).toHaveText(['Week 9 · no sessions yet', 'Weeks 6 to 8 · no sessions']);
  await page.getByRole('button', { name: 'Show earlier weeks' }).click();
  await expect(page.locator('.hist-empty')).toHaveText(['Week 9 · no sessions yet', 'Weeks 5 to 8 · no sessions']);
  await expect(page.locator('.week-head')).toHaveCount(3);
  // A Block 2 Day 1: skater bound and drop landings keep their doses.
  await expect(page.locator('.next-card', { hasText: 'Skater bound' })).toContainText('6 reps each side · stuck landing');
  await expect(page.locator('.next-card', { hasText: 'Drop landing' })).toContainText('4–6 landings');
});

test('16: export, then import, restores exactly, with added and removed sessions listed in plain words', async ({ page }) => {
  await open(page, SAT_10_OCT, ATHLETE_SHAPED);
  // Remove 3 Oct, add 9 Oct.
  await page.getByRole('button', { name: /Sat 3 Oct/ }).click();
  await page.getByRole('button', { name: 'Edit session' }).click();
  await page.getByRole('button', { name: 'Remove this session' }).click();
  await page.getByRole('button', { name: 'Review changes (1)' }).click();
  await page.getByRole('dialog', { name: 'Check the change' }).getByRole('button', { name: 'Save correction' }).click();
  await page.getByRole('button', { name: 'Add a missed session' }).click();
  await page.getByRole('button', { name: 'Next: enter what you did' }).click();
  const cmj = item(page, 'Jump test');
  await cmj.getByRole('button', { name: 'Add', exact: true }).click();
  await cmj.getByLabel('Jump height, average of 3', { exact: true }).fill('44');
  await cmj.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Review changes (1)' }).click();
  await page.getByRole('dialog', { name: 'Check the change' }).getByRole('button', { name: 'Save correction' }).click();
  const before = await page.evaluate(() => localStorage.getItem('acro-base-sc/state'));

  await page.getByRole('button', { name: 'Backup', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export log' }).click()]);
  const path = await download.path();
  const text = await (await import('node:fs/promises' as string)).readFile(path, 'utf8') as string;
  expect(text).toContain('## Corrections');
  expect(text).toMatch(/Correction to 2026-10-03: removed 2026-10-03 [^;]+; removed 2026-10-03 /);
  expect(text).toMatch(/Correction to 2026-10-09: added 2026-10-09 Day 1 started \(\d+ items planned\); added 2026-10-09 CMJ 44 cm; added 2026-10-09 Day 1 ended/);

  // Wipe the phone's copy, then import the file.
  await page.evaluate(() => localStorage.setItem('acro-base-sc/state', '{"bad":true}'));
  page.once('dialog', (d) => void d.accept());
  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.getByRole('button', { name: /Fri 9 Oct/ })).toBeVisible();
  const after = await page.evaluate(() => localStorage.getItem('acro-base-sc/state'));
  expect(JSON.parse(after!)).toEqual(JSON.parse(before!));
  await expect(page.getByRole('button', { name: /Sat 3 Oct/ })).toHaveCount(0);
});

test('18: dumbbell loads stop at 2 and 40 kg; typing 42 or 0 is refused', async ({ page }) => {
  await open(page, SAT_10_OCT, ATHLETE_SHAPED);
  await openBlock(page, 'Dumbbell push press');
  const pp = item(page, 'Dumbbell push press');
  const load = pp.getByLabel('Load', { exact: true });
  await load.fill('40');
  await pp.getByRole('button', { name: 'Load: more' }).click();
  await expect(load).toHaveValue('40');
  await load.fill('2');
  await pp.getByRole('button', { name: 'Load: less' }).click();
  await expect(load).toHaveValue('2');
  await pp.getByLabel('Reps, last set', { exact: true }).fill('7');
  await pp.getByRole('radio', { name: '2' }).click();
  for (const bad of ['42', '0']) {
    await load.fill(bad);
    await pp.getByRole('button', { name: 'Log', exact: true }).click();
    await expect(pp.getByText('Your dumbbells run 2 to 40 kg.')).toBeVisible();
  }
  expect(await entries(page, 'slot')).toHaveLength((JSON.parse(ATHLETE_SHAPED) as { log: { kind: string }[] }).log.filter((e) => e.kind === 'slot').length);
  // The chest-supported row is not held to the dumbbell range.
  await page.getByRole('button', { name: 'Day 2', exact: true }).click();
  await openBlock(page, 'Chest-supported row');
  const row = item(page, 'Chest-supported row');
  await row.getByLabel('Load', { exact: true }).fill('60');
  await row.getByRole('button', { name: 'Load: more' }).click();
  await expect(row.getByLabel('Load', { exact: true })).toHaveValue('62');
});

for (const [date, week, jumps] of [['2026-11-09', 9, 6], ['2026-12-21', 15, 9], ['2027-01-25', 20, 12]] as const) {
  test(`19: week ${week} Day 1 (an old ladder week): "Drop jump · ${jumps} jumps · 51 cm box", no ladder`, async ({ page }) => {
    await open(page, `${date}T08:00:00+08:00`, ATHLETE_SHAPED);
    await expect(page.locator('.next-head h2')).toContainText('Day 1');
    await expect(page.locator('.dateline')).toContainText(`Week ${week} of 25`);
    const line = page.locator('.next-card .line', { hasText: 'Drop jump' }).first();
    await expect(line.locator('.nm')).toHaveText('Drop jump');
    await expect(line.locator('.dt')).toHaveText(`${jumps} jumps · 51 cm box`);
    await expect(page.getByText(/ladder/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(20|30|40) cm$/ })).toHaveCount(0);
    // Opened, the item reads the same and has no height to choose.
    await line.click();
    const dj = item(page, 'Drop jump');
    await expect(dj.locator('.rx')).toContainText(`${jumps} jumps · 51 cm box`);
  });
}

test('the one box: a phone without 51 cm stored logs it once', async ({ page }) => {
  await open(page, '2026-09-21T08:00:00+08:00');
  const heights = await entries(page, 'depth_jump_height');
  expect(heights.map((e) => e.log.height_cm)).toEqual([51]);
  await page.reload();
  expect(await entries(page, 'depth_jump_height')).toHaveLength(1);
  expect((await stored(page)).depth_jump.height_cm).toBe(51);
});

test('the one box with automatic backup on: the app starts and logs the height once', async ({ page }) => {
  await page.route('https://api.github.com/**', (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem('acro-base-sc/sync', JSON.stringify({ owner: 'someone', repo: 'private-logs', token: 'not-a-real-token' })));
  await open(page, '2026-09-21T08:00:00+08:00');
  await expect(page.locator('.next-head')).toBeVisible();
  expect((await entries(page, 'depth_jump_height')).map((e) => e.log.height_cm)).toEqual([51]);
});

test('Start it today offers the rotation\'s next day, not the day just finished', async ({ page }) => {
  await open(page, '2026-10-12T18:00:00+08:00', ATHLETE_SHAPED);
  await openBlock(page, 'Front squat');
  const fs = item(page, 'Front squat');
  await more(fs, 'Reps, last set', 4);
  await fs.getByRole('radio', { name: '2' }).click();
  await fs.getByRole('button', { name: 'Log', exact: true }).click();
  await fs.getByRole('button', { name: 'All done' }).click();
  await page.getByRole('button', { name: 'Finish session' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish' });
  await sheet.getByRole('button', { name: 'Skip the rest' }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.locator('.next-head h2')).toContainText('Day 2');
  await page.getByRole('button', { name: 'Start it today' }).click();
  await expect(page.locator('.next-head h2')).toContainText('Day 2');
  await expect(page.getByRole('button', { name: 'Day 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
