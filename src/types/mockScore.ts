import { Question } from '../types';

export interface SectionScore {
  total: number;
  correct: number;
  wrong: number;
  unattempted: number;
  score: number;
  accuracy: number;
}

export interface MockScoreReport {
  id: string;
  title: string;
  platform?: string;
  type: 'full' | 'sectional';
  tier?: 'tier1' | 'tier2';
  subject?: string; // for sectional mocks
  date: string;
  totalQuestions: number;
  maxMarks: number;
  totalScore: number;
  meritScore?: number;
  computerScore?: number;
  overallAccuracy: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  sections: {
    reasoning?: SectionScore;
    mathematics?: SectionScore;
    english?: SectionScore;
    generalAwareness?: SectionScore;
    computer?: SectionScore;
  };
  questions?: Question[];
}
