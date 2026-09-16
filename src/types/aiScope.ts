export interface AiFocusedQuestion {
  qNum?: number;
  question: string;
  options?: Record<string, string>;
  answer: string;
  userAnswer?: string;
  status?: string;
  solution?: string;
  topic?: string;
  rca?: { tag: string; tagName?: string };
  userTime?: string | number;
  avgTime?: string | number;
}

export interface AiFocusedScope {
  type: 'subject' | 'topic' | 'mock';
  title: string;
  subject?: string;
  weakTopics?: string[];
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
