/**
 * A.27: the plan as displayed, frozen when a session's first item is
 * logged. Pure: built from a prescribe() result.
 */
import type { PlanItem, PlanSnapshot, Session } from './types';

export function planSnapshot(session: Session): PlanSnapshot {
  const items: PlanItem[] = [];
  session.blocks.forEach((b, bi) => {
    for (const it of b.items) {
      if (it.kind !== 'slot') continue;
      const t = it.template;
      const p = it.prescription;
      const item: PlanItem = { slot: it.slot, name: it.name, block: bi + 1 };
      if (b.superset) item.superset = true;
      if (t.per_side) item.per_side = true;
      if (t.secs !== undefined) item.secs = t.secs;
      switch (p.kind) {
        case 'lift':
          item.load = p.load;
          item.sets = p.sets;
          if (p.sets_max !== undefined) item.sets_max = p.sets_max;
          item.reps = p.reps;
          item.pct = p.pct;
          if (p.position !== undefined) item.position = p.position;
          item.amrap = p.amrap;
          if (p.single_suggested && !p.single_suggested.taken) item.single_suggested = true;
          break;
        case 'refer':
          item.load = null;
          break;
        case 'rdl':
          item.load = p.load;
          item.sets = t.sets ?? 3;
          item.rep_range = [p.rep_range[0], p.rep_range[1]];
          item.amrap = true;
          break;
        case 'slot':
          item.load = p.load;
          item.sets = t.sets ?? 3;
          item.reps = p.reps;
          item.amrap = true;
          break;
        case 'fixed':
          if (p.load_kg !== undefined) item.load = p.load_kg;
          if (t.sets !== undefined) item.sets = t.sets;
          if (t.sets_max !== undefined) item.sets_max = t.sets_max;
          if (t.reps !== undefined) item.reps = t.reps;
          if (p.contacts !== undefined) item.contacts = p.contacts;
          break;
        case 'explosive':
          item.load = p.load;
          item.sets = t.sets ?? 3;
          if (t.sets_max !== undefined) item.sets_max = t.sets_max;
          if (t.reps !== undefined) item.reps = t.reps;
          break;
      }
      items.push(item);
    }
  });
  return {
    mesocycle: session.mesocycle,
    programme_week: session.programme_week,
    day: session.day,
    target_min: session.target_min,
    pre: [...session.pre],
    items,
  };
}
