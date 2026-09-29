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
  subject?: string; // for sectional mocks
  date: string;
  totalQuestions: number;
  maxMarks: number;
  totalScore: number;
  overallAccuracy: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  sections: {
    reasoning?: SectionScore;
    mathematics?: SectionScore;
    english?: SectionScore;
    generalAwareness?: SectionScore;
  };
  questions?: Question[];
}
