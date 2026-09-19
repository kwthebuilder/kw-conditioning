/**
 * Shared helpers for plain-language explanations.
 */
import type { ExplanationStep } from './types';

export const f1 = (n: number): string => n.toFixed(1);

export function explainStep(
  rule: string,
  text: string,
  numbers: Record<string, number | boolean | null> = {},
): ExplanationStep {
  return { rule, text, numbers };
}

export function kg(n: number | null): string {
  return n === null ? 'unset' : `${f1(n)} kg`;
}
