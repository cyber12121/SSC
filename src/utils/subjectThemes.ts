import React from 'react';
import { Calculator, Compass, Languages, Globe2, BookOpen } from 'lucide-react';
import { Chapter, Question } from '../types';

export interface SubjectTheme {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  textCol: string;
  bgLight: string;
  borderCol: string;
  badge: string;
  bar: string;
}

export const getQuestionId = (chapter: Chapter, question: Question): string => {
  if (question.id) return question.id;
  return `${chapter.subject}|${chapter.chapter_title}|${question.question}`.replace(/\s+/g, '_');
};

export const getSubjectTheme = (subject: string): SubjectTheme => {
  const sub = (subject || '').toLowerCase();
  if (sub.includes('math') || sub.includes('quant') || sub.includes('aptitude')) {
    return {
      name: 'Mathematics',
      icon: Calculator,
      gradient: 'from-violet-600 to-indigo-600',
      textCol: 'text-violet-600',
      bgLight: 'bg-violet-50',
      borderCol: 'border-violet-200',
      badge: 'bg-violet-100 text-violet-800 border-violet-200',
      bar: 'bg-violet-600',
    };
  }
  if (sub.includes('reason') || sub.includes('logic')) {
    return {
      name: 'Reasoning',
      icon: Compass,
      gradient: 'from-purple-600 to-fuchsia-600',
      textCol: 'text-purple-600',
      bgLight: 'bg-purple-50',
      borderCol: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      bar: 'bg-purple-600',
    };
  }
  if (sub.includes('english') || sub.includes('verbal')) {
    return {
      name: 'English',
      icon: Languages,
      gradient: 'from-emerald-500 to-teal-600',
      textCol: 'text-emerald-600',
      bgLight: 'bg-emerald-50',
      borderCol: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      bar: 'bg-emerald-600',
    };
  }
  if (sub.includes('aware') || sub.includes('gk') || sub.includes('gs') || sub.includes('science')) {
    return {
      name: 'General Awareness',
      icon: Globe2,
      gradient: 'from-amber-500 to-orange-500',
      textCol: 'text-amber-600',
      bgLight: 'bg-amber-50',
      borderCol: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      bar: 'bg-amber-500',
    };
  }
  return {
    name: subject || 'General',
    icon: BookOpen,
    gradient: 'from-slate-600 to-slate-700',
    textCol: 'text-slate-600',
    bgLight: 'bg-slate-50',
    borderCol: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    bar: 'bg-slate-600',
  };
};

export const formatAttemptDate = (isoStr?: string): string => {
  if (!isoStr) return 'Recently';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Recently';
  }
};

export interface DashboardStats {
  totalQuizzes: number;
  totalQuestions: number;
  totalCorrect: number;
  overallAccuracy: number;
  totalTimeSeconds: number;
  avgTimePerQ: number;
  mockCount: number;
  practiceCount: number;
  subjectStats: Record<string, { totalQ: number; correct: number; quizzes: number; totalTime: number; accuracy: number; avgTime: number }>;
}

export const computeDashboardStats = (userResults: any[]): DashboardStats => {
  if (!userResults || userResults.length === 0) {
    return {
      totalQuizzes: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      overallAccuracy: 0,
      totalTimeSeconds: 0,
      avgTimePerQ: 0,
      mockCount: 0,
      practiceCount: 0,
      subjectStats: {
        'Mathematics': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
        'Reasoning': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
        'English': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
        'General Awareness': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 }
      }
    };
  }

  let totalQ = 0;
  let totalCorrect = 0;
  let totalTime = 0;
  let mockCount = 0;
  let practiceCount = 0;

  const subjectStats: Record<string, { totalQ: number; correct: number; quizzes: number; totalTime: number; accuracy: number; avgTime: number }> = {
    'Mathematics': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
    'Reasoning': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
    'English': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
    'General Awareness': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 }
  };

  userResults.forEach(r => {
    const qCount = Number(r.totalQuestions) || 0;
    const score = Number(r.score) || 0;
    const time = Number(r.totalTime) || 0;

    totalQ += qCount;
    totalCorrect += score;
    totalTime += time;

    if (r.mode === 'mock') mockCount++;
    else practiceCount++;

    const theme = getSubjectTheme(r.subject);
    const subKey = theme.name;

    if (!subjectStats[subKey]) {
      subjectStats[subKey] = { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 };
    }
    subjectStats[subKey].quizzes += 1;
    subjectStats[subKey].totalQ += qCount;
    subjectStats[subKey].correct += score;
    subjectStats[subKey].totalTime += time;
  });

  Object.keys(subjectStats).forEach(sub => {
    const s = subjectStats[sub];
    s.accuracy = s.totalQ > 0 ? Math.round((s.correct / s.totalQ) * 100) : 0;
    s.avgTime = s.totalQ > 0 ? Math.round(s.totalTime / s.totalQ) : 0;
  });

  const overallAccuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
  const avgTimePerQ = totalQ > 0 ? Math.round(totalTime / totalQ) : 0;

  return {
    totalQuizzes: userResults.length,
    totalQuestions: totalQ,
    totalCorrect,
    overallAccuracy,
    totalTimeSeconds: totalTime,
    avgTimePerQ,
    mockCount,
    practiceCount,
    subjectStats
  };
};
