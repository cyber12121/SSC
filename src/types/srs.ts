import { Question } from '../types';

export type SRSContentType = 'vocab' | 'gk' | 'math' | 'reasoning' | 'mixed' | 'general';
export type SRSCardStatus = 'due' | 'learning' | 'review' | 'mastered' | 'suspended';
export type SRSGrade = 'again' | 'hard' | 'good' | 'easy'; // 0 | 1 | 2 | 3

export interface ReviewHistoryItem {
  date: string; // ISO string
  grade: SRSGrade;
  intervalBefore: number;
  intervalAfter: number;
  timeSpentSec: number;
}

export interface SRSCard {
  id: string; // Unique hash or id
  type: SRSContentType;
  subject: string; // 'English' | 'General Awareness' | 'Mathematics' | 'Reasoning'
  topic: string; // e.g. 'Synonyms', 'Classical Dance', 'Trigonometry', 'Coding-Decoding'
  subtopic?: string; // e.g. 'ayush_vocab', 'static_gk'
  
  // Card Content
  front: string; // Target Word, Question prompt, or Problem statement
  back: string; // Answer, Definition, Explanation, or Step-by-step
  mnemonic?: string; // Memory trick (golden callout for English Vocab / GK)
  shortcutFormula?: string; // Speed trick / shortcut formula (for Math / Reasoning)
  conceptTested?: string; // Core concept tested
  trapAlert?: string; // Why options were deceptive / error trap
  contextHint?: string; // Exam year, Part of speech, chapter origin
  
  // Question representation if converted from an MCQ
  questionRef?: Question;
  options?: { a: string; b: string; c: string; d: string };
  answer?: 'a' | 'b' | 'c' | 'd';
  userPreviousAnswer?: string;

  // Metadata & Ingestion origin
  source: 'quiz_wrong' | 'quiz_unattempted' | 'mock_error' | 'bookmark' | 'vocab_bank' | 'gk_bank' | 'manual' | 'ai_generated';
  sourceTitle?: string; // Test or Chapter title
  addedAt: string; // ISO string

  // SM-2 Spaced Repetition Engine metrics
  stage: number; // 0: New, 1: Learning, 2-4: Review, 5: Mastered
  intervalDays: number; // 1, 3, 7, 16, 35, 60...
  easeFactor: number; // Default 2.5 (min 1.3)
  repetitions: number; // Consecutive successful recalls
  lapses: number; // Times forgotten (Again clicked)
  dueDate: string; // 'YYYY-MM-DD' comparison string
  lastReviewedAt?: string; // ISO string
  status: SRSCardStatus;

  // Review history log
  history?: ReviewHistoryItem[];
}

export interface SRSSettings {
  autoAddWrongVocab: boolean; // Default: true
  autoAddWrongGK: boolean; // Default: true
  autoAddWrongMath: boolean; // Default: true
  autoAddWrongReasoning: boolean; // Default: true
  autoAddUnattempted: boolean; // Default: true
  autoAddSpeedIssues: boolean; // Default: false
  showConfirmationBeforeAutoEnroll: boolean; // Default: true
  maxNewCardsPerDay: number; // Default: 30
  maxReviewCardsPerDay: number; // Default: 100
  defaultReviewMode: 'flashcard' | 'quiz'; // Default: 'flashcard'
}

export interface DeckStatistics {
  totalCards: number;
  dueToday: number;
  learning: number;
  review: number;
  mastered: number;
  streakDays: number;
  retentionRateToday: number;
  bySubject: {
    english: { total: number; due: number; mastered: number };
    gk: { total: number; due: number; mastered: number };
    mathematics: { total: number; due: number; mastered: number };
    reasoning: { total: number; due: number; mastered: number };
  };
}
