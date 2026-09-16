export interface AiFocusedScope {
  type: 'subject' | 'topic' | 'mock';
  title: string;
  subject?: string;
  stats?: {
    score?: number;
    maxMarks?: number;
    accuracy?: number;
    total?: number;
    wrong?: number;
    slow?: number;
    unattempted?: number;
  };
  questions?: Array<{
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
  }>;
  summaryText?: string;
}
