export interface Question {
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
  tags?: {
    topic?: string;
    exam_years?: string[];
    high_yield?: boolean;
    difficulty?: 'easy' | 'medium' | 'hard';
  };
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
  section?: 'spartan' | 'pinnacle' | 'qrb' | 'top500';
  topic_name?: string;
  set_name?: string;
}

export interface QuestionProgress {
  q_num: number;
  timeSpent: number;
  isCorrect: boolean;
  selectedAnswer: string;
  question?: Question;
}

export interface QuizResult {
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
