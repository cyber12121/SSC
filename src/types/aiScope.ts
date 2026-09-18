export interface AiFocusedQuestion {
  id?: string;
  qNum?: number;
  question: string;
  options?: Record<string, string>;
  answer?: string;
  correctAnswer?: string;
  userAnswer?: string;
  status?: string;
  solution?: string;
  subject?: string;
  topic?: string;
  rca?: { tag: string; tagName?: string };
  rcaTag?: string;
  rcaTagName?: string;
  sillyMistakeNote?: string;
  rcaReason?: any;
  userTime?: string | number;
  avgTime?: string | number;
  sourceType?: 'full_mock' | 'sectional' | 'subject_wise';
  sourceLabel?: string;
  testName?: string;
}

export interface AiFocusedScope {
  type: 'subject' | 'topic' | 'mock';
  title: string;
  subject?: string;
  sourceScope?: 'full_mock' | 'sectional' | 'subject_wise' | 'mixed';
  sourceScopeLabel?: string;
  testName?: string;
  rcaTag?: string;
  rcaMode?: string;
  weakTopics?: any[];
  stats?: {
    score?: number;
    maxMarks?: number;
    accuracy?: number;
    total?: number;
    totalQuestions?: number;
    totalScore?: number;
    chaptersCount?: number;
    correct?: number;
    wrong?: number;
    slow?: number;
    unattempted?: number;
  };
  questions?: AiFocusedQuestion[];
  summaryText?: string;
}
