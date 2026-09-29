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

export const parseAvgTimeToSeconds = (rawTime?: string | number | null): number | null => {
  if (rawTime === undefined || rawTime === null) return null;
  if (typeof rawTime === 'number') {
    return isNaN(rawTime) || rawTime <= 0 ? null : Math.round(rawTime);
  }
  const str = String(rawTime).trim();
  if (!str) return null;

  // Format "MM:SS", "M:SS", or "HH:MM:SS"
  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseInt(p.trim(), 10));
    if (parts.some(p => isNaN(p))) return null;
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  // Raw numeric string e.g. "35" or "35s"
  const parsed = parseInt(str.replace(/[^0-9]/g, ''), 10);
  return isNaN(parsed) || parsed <= 0 ? null : parsed;
};


