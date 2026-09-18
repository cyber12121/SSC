export type RCATagType = 'C' | 'S' | 'T' | 'G';

export interface RCAClassification {
  tag: RCATagType;
  tagName: 'Conceptual Gap' | 'Silly Mistake' | 'Time / Ego Trap' | 'Guesswork Failed';
  sillyMistakeNote?: string;
  subTag?: string;
  classifiedAt: string;
}

export interface Question {
  id?: string;
  subTag?: string;
  q_num: number;
  question: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  answer: 'a' | 'b' | 'c' | 'd';
  solution?: string;
  image?: {
    src: string;
    caption?: string;
  } | null;
  subject?: string;
  section?: string;
  // Legacy / data-layer fields present in JSON but not always typed
  topic?: string;
  subtopic?: string;
  conceptTested?: string;
  sectionKey?: string;
  subjectName?: string;
  correct_answer?: string;
  correctOption?: string;
  correct_option?: string;
  tags?: {
    topic?: string;
    subtopic?: string;
    conceptTested?: string;
    exam_years?: string[];
    high_yield?: boolean;
    difficulty?: 'easy' | 'medium' | 'hard';
  };
  avgTime?: string | number;
  avg_time?: string | number;
  avgTimeSeconds?: number;
  userTime?: number;
  user_time?: number;
  // Mock error tracking fields
  status?: string;
  isSlow?: boolean;
  errorType?: 'speed_issue' | 'unattempted' | 'wrong';
  rca?: RCAClassification;
}

export interface SubjectData {
  [subjectName: string]: Chapter[];
}

export interface Chapter {
  chapter_num: number;
  chapter_title: string;
  subject: string;
  subject_id: string;
  questions: Question[];
  id?: string;
  section?: 'spartan' | 'pinnacle' | 'qrb' | 'top500' | 'ayush_vocab' | 'black_book' | 'general' | string;
  topic_name?: string;
  set_name?: string;
  gk_subject?: string;
  is_test?: boolean;
}

export interface QuestionProgress {
  q_num: number;
  timeSpent: number;
  isCorrect: boolean;
  selectedAnswer: string;
  question?: Question;
  marked?: boolean;
  avgTime?: string | number;
  avgTimeSeconds?: number;
  rca?: RCAClassification;
}

export interface QuizResult {
  id?: string;
  userId: string;
  chapter_title: string;
  subject: string;
  category: 'mockErrors' | 'chapterBank';
  mode?: 'practice' | 'mock';
  score: number;
  totalQuestions: number;
  totalTime: number;
  completedAt: string;
  questionDetails: QuestionProgress[];
}

export interface Bookmark {
  id?: string;
  userId: string;
  question: Question;
  subject: string;
  chapter_title: string;
  category: 'mockErrors' | 'chapterBank';
  bookmarkedAt: string;
}
