import { Question } from '../types';
import { normalizeAnswerKey } from './mathSanitizer';

export type OptionKey = 'a' | 'b' | 'c' | 'd';

export interface NormalizedOption {
  key: OptionKey;
  text: string;
}

export const OPTION_KEYS: OptionKey[] = ['a', 'b', 'c', 'd'];

/**
 * Returns a normalized array of options with lowercase keys ('a', 'b', 'c', 'd')
 * handling any uppercase or legacy key variations in questions data.
 */
export const getNormalizedOptions = (q?: Question | null): NormalizedOption[] => {
  if (!q || !q.options) return [];
  const opts = q.options as Record<string, string>;
  return OPTION_KEYS.map(key => {
    const text = opts[key] || opts[key.toUpperCase()] || '';
    return { key, text };
  }).filter(o => Boolean(o.text));
};

/**
 * Normalizes the correct option key across various schema properties:
 * answer, correct_answer, correctOption, correct_option.
 */
export const getCorrectOptionKey = (q?: Question | null): OptionKey | '' => {
  if (!q) return '';
  const rawKey = q.answer || (q as any).correct_answer || (q as any).correctOption || (q as any).correct_option;
  return (normalizeAnswerKey(rawKey) as OptionKey) || '';
};

/**
 * Strips historical / imported mock attempt artifacts from a question object
 * so that fresh quiz/drill sessions, review screens, and palettes are not corrupted
 * by stale answers, wrong statuses, or prior mock attempt data.
 */
export const cleanQuestionForSession = (q: any, idx?: number): Question => {
  if (!q) return q;
  const {
    userAnswer: _u,
    chosenOption: _c,
    selectedAnswer: _s,
    status: _st,
    errorType: _e,
    isCorrect: _ic,
    isSlow: _is,
    is_correct: _isc,
    timeSpent: _ts,
    userTime: _ut,
    ...rest
  } = q;

  return {
    ...rest,
    q_num: idx !== undefined ? idx + 1 : (q.q_num || 1),
    options: q.options || {},
    answer: q.answer || (q as any).correct_answer || (q as any).correctOption || (q as any).correct_option || 'a',
    solution: q.solution || (q as any).explanation || (q as any).sol || (q as any).detailedSolution || ''
  };
};

