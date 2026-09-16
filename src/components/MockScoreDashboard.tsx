import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  Trash2,
  Upload,
  ChevronLeft,
  Layers,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Play,
  Loader2,
  X,
  Check,
  AlertTriangle,
  Brain,
  Calculator,
  Compass,
  BookOpen,
  HelpCircle,
  Eye
} from 'lucide-react';
import { MockScoreReport, SectionScore } from '../types/mockScore';
import { Chapter, Question, SubjectData, QuizResult, QuestionProgress } from '../types';
import { normalizeTopicTitle } from '../utils/topicDetector';
import initialMockReports from '../data/mock_reports.json';
import { safeStorage } from '../utils/safeStorage';
import { syncMockReports, LEGACY_MOCK_ID_MAP, normalizeTestTitle } from '../utils/syncMockReports';
import { openAiWithScope } from '../utils/aiScopeHelper';
import { AiFocusedQuestion } from '../types/aiScope';

const LOCAL_STORAGE_KEY = 'cgl_mock_score_reports';
const mockQuestionModules = import.meta.glob('../data/{mock_questions,mock_tests}/*.json');

const normalizeSubName = (raw: string = '') => {
  if (/reason|intel/i.test(raw)) return 'Reasoning';
  if (/aware|gk|gs|ga|knowledge/i.test(raw)) return 'General Awareness';
  if (/quant|math|aptitude/i.test(raw)) return 'Mathematics';
  if (/eng/i.test(raw)) return 'English';
  return 'Other';
};

export const getSectionalSubject = (report: MockScoreReport): 'Reasoning' | 'General Awareness' | 'Mathematics' | 'English' => {
  if (report.subject) {
    const norm = normalizeSubName(report.subject);
    if (['Reasoning', 'General Awareness', 'Mathematics', 'English'].includes(norm)) {
      return norm as 'Reasoning' | 'General Awareness' | 'Mathematics' | 'English';
    }
  }
  if (report.sections) {
    if (report.sections.mathematics && (report.sections.mathematics.total > 0 || report.sections.mathematics.score > 0)) return 'Mathematics';
    if (report.sections.english && (report.sections.english.total > 0 || report.sections.english.score > 0)) return 'English';
    if (report.sections.reasoning && (report.sections.reasoning.total > 0 || report.sections.reasoning.score > 0)) return 'Reasoning';
    if (report.sections.generalAwareness && (report.sections.generalAwareness.total > 0 || report.sections.generalAwareness.score > 0)) return 'General Awareness';
  }
  if (report.title) {
    const norm = normalizeSubName(report.title);
    if (['Reasoning', 'General Awareness', 'Mathematics', 'English'].includes(norm)) {
      return norm as 'Reasoning' | 'General Awareness' | 'Mathematics' | 'English';
    }
  }
  return 'Mathematics';
};

export function parseMockDetails(report: MockScoreReport) {
  const title = (report.title || '').trim();

  // 1. Platform Detection
  // In CGL prep, all "[Sectional Timing]" tests come from Oliveboard
  let platform = report.platform;
  if (!platform) {
    if (/oliveboard|sectional\s*timing/i.test(title)) {
      platform = 'Oliveboard';
    } else {
      platform = 'Testbook';
    }
  }

  // 2. Parse clean short title & subtitle
  let shortTitle = title;
  let subtitle = 'SSC CGL 2026';

  // Check Oliveboard tests:
  // e.g. "SSC CGL 2026 [Sectional Timing] - Tier I 2026 Live Test" -> "Live Test"
  // e.g. "SSC CGL 2026 [Sectional Timing] - Tier I- 3" -> "Mock 3"
  const isOliveboard = platform === 'Oliveboard' || /oliveboard|sectional\s*timing/i.test(title);
  const obLiveMatch = isOliveboard && /Live\s*Test/i.test(title);
  const obNumberedMatch = isOliveboard && !obLiveMatch && (
    title.match(/\[Sectional\s*Timing\]\s*[-–]?\s*(?:Tier\s*I\s*[-–]?\s*)?(\d+)(?!\s*Live)/i) ||
    title.match(/(?:Mock|Tier\s*I)\s*[-–]?\s*(\d+)(?!\s*Live)/i) ||
    title.match(/Sectional\s*Timing.*?(\d+)$/i)
  );

  // Check Testbook full tests:
  // e.g. "SSC CGL Tier I: Full Test - 5" -> "Full Test 5"
  const tbFullMatch = title.match(/Full\s*Test\s*[-–]?\s*(\d+)/i);

  // Check Testbook live tests:
  // e.g. "SSC CGL 2026: Officer’s Friday - Mega Live Test" -> "Mega Live Test"
  const tbLiveMatch = /Officer’s\s*Friday/i.test(title) || /Mega\s*Live/i.test(title);

  // Check Sectional subject tests:
  // e.g. "SSC CGL 2026 [Sectional - Quantitative Aptitude]" -> "Quant Sectional"
  const sectionalSubjectMatch = title.match(/\[Sectional\s*[-–]\s*([^\]]+)\]/i);

  if (obLiveMatch) {
    shortTitle = 'Live Test';
    subtitle = 'Sectional Timing';
  } else if (obNumberedMatch) {
    shortTitle = `Mock ${obNumberedMatch[1]}`;
    subtitle = 'Sectional Timing';
  } else if (tbFullMatch) {
    shortTitle = `Full Test ${tbFullMatch[1]}`;
    subtitle = 'SSC CGL Tier I';
  } else if (tbLiveMatch) {
    shortTitle = 'Mega Live Test';
    subtitle = 'Officer’s Friday';
  } else if (sectionalSubjectMatch) {
    const rawSub = sectionalSubjectMatch[1].trim();
    const shortSub = /quant/i.test(rawSub) ? 'Quant' :
                     /reason/i.test(rawSub) ? 'Reasoning' :
                     /english/i.test(rawSub) ? 'English' :
                     /aware|gk|ga/i.test(rawSub) ? 'GA/GK' : rawSub;
    shortTitle = `${shortSub} Sectional`;
    subtitle = 'SSC CGL 2026';
  } else if (report.type === 'sectional' && report.subject) {
    shortTitle = `${report.subject} Sectional`;
    subtitle = 'SSC CGL 2026';
  } else {
    shortTitle = title.replace(/^SSC\s*CGL\s*(2026|Tier\s*I)?\s*[:-]?\s*/i, '').trim() || title;
    if (shortTitle.length > 18) {
      shortTitle = shortTitle.slice(0, 18).trim();
    }
  }

  return { shortTitle, platform, subtitle };
}

export function computeMockScoreClientSide(rawList: any[], mockTitle?: string): MockScoreReport {
  // Use module-level normalizeSubName — same logic, no duplicate needed
  const subjectGroups: Record<string, any[]> = {
    Reasoning: [],
    'General Awareness': [],
    Mathematics: [],
    English: []
  };

  rawList.forEach(q => {
    const rawSubject = q.subject || q.section || 'Quantitative Aptitude';
    const name = normalizeSubName(rawSubject);
    if (subjectGroups[name]) {
      subjectGroups[name].push(q);
    }
  });

  const activeSubjects = Object.keys(subjectGroups).filter(k => subjectGroups[k].length > 0);
  const isFullMock = activeSubjects.length >= 2 || rawList.length >= 70;
  const mockType: 'full' | 'sectional' = isFullMock ? 'full' : 'sectional';

  const sections: {
    reasoning?: SectionScore;
    mathematics?: SectionScore;
    english?: SectionScore;
    generalAwareness?: SectionScore;
  } = {};

  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnattempted = 0;
  let totalScore = 0;

  const subjectsToProcess = isFullMock
    ? ['Reasoning', 'General Awareness', 'Mathematics', 'English']
    : activeSubjects;

  for (const sub of subjectsToProcess) {
    const qList = subjectGroups[sub] || [];
    let wrong = 0;
    let unattempted = 0;
    let correct = 0;
    let hasExplicitCorrect = false;

    qList.forEach(q => {
      const status = (q.status || '').toLowerCase();
      if (status.includes('correct') && !status.includes('incorrect')) {
        correct++;
        hasExplicitCorrect = true;
      } else if (status.includes('wrong') || status.includes('incorrect')) {
        wrong++;
      } else if (status.includes('unattempted') || status.includes('skipped')) {
        unattempted++;
      } else {
        wrong++;
      }
    });

    const standardTotal = 25;
    // Only infer missing correct questions for a full 100-question mock attempt
    if (isFullMock && (!hasExplicitCorrect || qList.length < standardTotal)) {
      correct = Math.max(0, standardTotal - wrong - unattempted);
    }

    const sectionTotal = isFullMock ? standardTotal : qList.length;
    const sectionScore = Math.round(((correct * 2) - (wrong * 0.5)) * 10) / 10;
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;

    totalCorrect += correct;
    totalWrong += wrong;
    totalUnattempted += unattempted;
    totalScore += sectionScore;

    const key = sub === 'General Awareness' ? 'generalAwareness' : sub === 'Mathematics' ? 'mathematics' : (sub.toLowerCase() as 'reasoning' | 'english');
    sections[key] = {
      total: sectionTotal,
      correct,
      wrong,
      unattempted,
      score: sectionScore,
      accuracy
    };
  }

  const totalQuestions = isFullMock ? 100 : rawList.length;
  const maxMarks = totalQuestions * 2;
  const totalAttempted = totalCorrect + totalWrong;
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 1000) / 10 : 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const title = mockTitle || (isFullMock ? `Full Mock - ${dateStr}` : `${activeSubjects[0] || 'Sectional'} Mock - ${dateStr}`);

  return {
    id: 'mock_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title,
    type: mockType,
    subject: isFullMock ? undefined : (activeSubjects[0] || 'General'),
    date: now.toISOString(),
    totalQuestions,
    maxMarks,
    totalScore: Math.round(totalScore * 10) / 10,
    overallAccuracy,
    totalCorrect,
    totalWrong,
    totalUnattempted,
    sections
  };
}

export function normalizeMockQuestions(rawList: any[]): Question[] {
  const normalizeSubject = (raw: string) => {
    if (/reason|intel/i.test(raw)) return 'Reasoning';
    if (/aware|gk|gs|ga|knowledge/i.test(raw)) return 'General Awareness';
    if (/quant|math|aptitude/i.test(raw)) return 'Mathematics';
    if (/eng/i.test(raw)) return 'English';
    return 'Other';
  };

  const subjectOrder: Record<string, number> = {
    'Reasoning': 1,
    'General Awareness': 2,
    'Mathematics': 3,
    'English': 4,
    'Other': 5
  };

  const mapped = rawList.map((item, originalIdx) => {
    const rawSub = item.subject || item.section || item.subjectName || '';
    const subjectName = normalizeSubject(rawSub);

    const questionText = (
      item.question ||
      item.questionText ||
      item.qText ||
      item.title ||
      item.body ||
      `Question ${originalIdx + 1}`
    ).trim();

    let options: { a: string; b: string; c: string; d: string } = { a: '', b: '', c: '', d: '' };

    if (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
      options = {
        a: String(item.options.a || item.options['1'] || item.options.A || '').trim(),
        b: String(item.options.b || item.options['2'] || item.options.B || '').trim(),
        c: String(item.options.c || item.options['3'] || item.options.C || '').trim(),
        d: String(item.options.d || item.options['4'] || item.options.D || '').trim()
      };
    } else if (Array.isArray(item.options)) {
      options = {
        a: typeof item.options[0] === 'object' ? String(item.options[0]?.text || item.options[0]?.value || item.options[0]?.val || '') : String(item.options[0] || ''),
        b: typeof item.options[1] === 'object' ? String(item.options[1]?.text || item.options[1]?.value || item.options[1]?.val || '') : String(item.options[1] || ''),
        c: typeof item.options[2] === 'object' ? String(item.options[2]?.text || item.options[2]?.value || item.options[2]?.val || '') : String(item.options[2] || ''),
        d: typeof item.options[3] === 'object' ? String(item.options[3]?.text || item.options[3]?.value || item.options[3]?.val || '') : String(item.options[3] || '')
      };
    }

    let ans: 'a' | 'b' | 'c' | 'd' = 'a';
    const rawAns = item.answer || item.correctOption || item.correct_option || item.correctAnswer || item.right_answer || item.ans || '';
    const strAns = String(rawAns).trim().toLowerCase();

    if (strAns === 'a' || strAns === '1' || strAns === 'option a' || strAns === 'opt a' || strAns === 'option 1') {
      ans = 'a';
    } else if (strAns === 'b' || strAns === '2' || strAns === 'option b' || strAns === 'opt b' || strAns === 'option 2') {
      ans = 'b';
    } else if (strAns === 'c' || strAns === '3' || strAns === 'option c' || strAns === 'opt c' || strAns === 'option 3') {
      ans = 'c';
    } else if (strAns === 'd' || strAns === '4' || strAns === 'option d' || strAns === 'opt d' || strAns === 'option 4') {
      ans = 'd';
    } else {
      if (options.a && strAns === options.a.trim().toLowerCase()) ans = 'a';
      else if (options.b && strAns === options.b.trim().toLowerCase()) ans = 'b';
      else if (options.c && strAns === options.c.trim().toLowerCase()) ans = 'c';
      else if (options.d && strAns === options.d.trim().toLowerCase()) ans = 'd';
    }

    const solution = (item.solution || item.explanation || item.sol || '').trim();

    let imgObj = null;
    if (item.image) {
      imgObj = typeof item.image === 'string' ? { src: item.image } : item.image;
    } else if (item.question_image) {
      imgObj = { src: item.question_image };
    } else if (item.img) {
      imgObj = { src: item.img };
    }

    const rawTopic = item.topic || item.tags?.topic;
    const topicName = rawTopic ? normalizeTopicTitle(rawTopic) : 'General';

    return {
      id: item.id || `mock_q_${originalIdx + 1}_${Math.random().toString(36).slice(2, 7)}`,
      subjectName,
      originalIdx,
      question: questionText,
      options,
      answer: ans,
      solution: solution || undefined,
      image: imgObj,
      tags: {
        topic: topicName !== 'General' ? `${subjectName} • ${topicName}` : subjectName,
        difficulty: (item.difficulty || item.tags?.difficulty || 'medium') as 'easy' | 'medium' | 'hard'
      },
      avgTime: item.avgTime || item.avg_time || item.avgTimeSeconds
    };
  });

  // Sort subject-wise: Reasoning -> General Awareness -> Mathematics -> English
  mapped.sort((a, b) => {
    const orderA = subjectOrder[a.subjectName] || 99;
    const orderB = subjectOrder[b.subjectName] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.originalIdx - b.originalIdx;
  });

  // Re-index sequentially 1..N
  return mapped.map((q, idx) => {
    const secKey = q.subjectName === 'Reasoning' ? 'part_a' : q.subjectName === 'General Awareness' ? 'part_b' : q.subjectName === 'Mathematics' ? 'part_c' : 'part_d';
    return {
      id: q.id,
      q_num: idx + 1,
      question: q.question,
      options: q.options,
      answer: q.answer,
      solution: q.solution,
      image: q.image,
      subject: q.subjectName,
      section: secKey,
      tags: q.tags
    };
  });
}


export type MockQuestionErrorStatus = 'wrong' | 'unattempted' | 'slow' | 'correct';

export function getMockQuestionStatus(q: any): MockQuestionErrorStatus {
  const rawStatus = String(q.errorType || q.status || q.your_status || q.result || '').toLowerCase();
  const rawUser = String(
    q.chosenOption ??
    q.chosen_option ??
    q.userAnswer ??
    q.user_answer ??
    q.selected ??
    q.selectedAnswer ??
    q.yourOption ??
    q.your_option ??
    q.markedOption ??
    q.marked_option ??
    q.userAttempt ??
    q.givenAnswer ??
    q.given_answer ??
    q.candidateAnswer ??
    q.myAnswer ??
    ''
  ).trim().toLowerCase();

  // 1. Explicit Unattempted / Skipped (MUST BE CHECKED FIRST)
  if (
    rawStatus.includes('unattempt') ||
    rawStatus.includes('skip') ||
    rawStatus.includes('left') ||
    rawStatus === 'not attempted' ||
    rawUser === 'unattempted' ||
    rawUser === 'skipped' ||
    rawUser === 'not attempted'
  ) {
    return 'unattempted';
  }

  // 2. Slow / Speed Issue (Correct, but took too long)
  if (
    rawStatus.includes('slow') ||
    rawStatus.includes('speed') ||
    q.isSlow === true
  ) {
    return 'slow';
  }

  // 3. Correct (and not incorrect)
  if (
    ((rawStatus.includes('correct') && !rawStatus.includes('incorrect'))) ||
    rawStatus === 'right' ||
    q.isCorrect === true ||
    q.is_correct === true
  ) {
    return 'correct';
  }

  // 4. Incorrect / Wrong
  if (
    rawStatus.includes('wrong') ||
    rawStatus.includes('incorrect') ||
    (q.isCorrect === false && rawUser && rawUser !== 'unattempted') ||
    (q.is_correct === false && rawUser && rawUser !== 'unattempted')
  ) {
    return 'wrong';
  }

  // 5. If no user answer provided or answer is blank, treat as unattempted
  if (!rawUser || rawUser === 'unattempted' || rawUser === 'skipped') {
    return 'unattempted';
  }

  // Final fallback: no user answer + no explicit status → treat as unattempted (not wrong)
  return 'unattempted';
}

interface MockScoreDashboardProps {
  onBack?: () => void;
  mockData?: SubjectData;
  onStartPracticeMock?: (chapter: Chapter, mode?: 'practice' | 'mock') => void;
  onReviewMock?: (result: QuizResult) => void;
}

export const MockScoreDashboard: React.FC<MockScoreDashboardProps> = ({
  onBack,
  mockData,
  onStartPracticeMock,
  onReviewMock
}) => {
  const [activeTab, setActiveTab] = useState<'full' | 'sectional'>('full');
  const [selectedSectionalSubject, setSelectedSectionalSubject] = useState<'all' | 'Mathematics' | 'Reasoning' | 'English' | 'General Awareness'>('all');
  const [reports, setReports] = useState<MockScoreReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [practicingId, setPracticingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [askingAiId, setAskingAiId] = useState<string | null>(null);
  const [modalQuizMode, setModalQuizMode] = useState<'practice' | 'mock'>('practice');

  // Section-Wise Practice Modal State
  const [practiceModalReport, setPracticeModalReport] = useState<MockScoreReport | null>(null);
  const [practiceSection, setPracticeSection] = useState<string>('Reasoning');
  const [practiceErrorFilter, setPracticeErrorFilter] = useState<'all' | 'wrong' | 'unattempted' | 'slow'>('all');
  const [rawQuestionsCache, setRawQuestionsCache] = useState<Record<string, any[]>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch reports on mount
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      let loaded: MockScoreReport[] = [];
      try {
        const res = await fetch('/api/mock-reports');
        if (res.ok) {
          const cType = res.headers.get('content-type') || '';
          if (cType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              loaded = data;
            }
          }
        }
      } catch (err) {
        console.warn('Backend mock reports unavailable, using local store:', err);
      }
 
      if (loaded.length === 0) {
        try {
          const saved = safeStorage.getItem(LOCAL_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loaded = parsed;
            }
          }
        } catch {}
      }

      // Synchronize with canonical bundled reports so renames (e.g. Full Test 7) and new mocks update immediately
      const synced = syncMockReports(loaded, initialMockReports as MockScoreReport[]);

      try {
        safeStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(synced));
      } catch {}

      setReports(synced);
      setLoading(false);
    };

    fetchReports();
  }, []);

  const saveReports = (newReports: MockScoreReport[]) => {
    const synced = syncMockReports(newReports, initialMockReports as MockScoreReport[]);
    setReports(synced);
    try {
      safeStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(synced));
      window.dispatchEvent(new Event('cgl_mock_reports_updated'));
    } catch {}
  };

  // Sectional attempt counts per subject
  const sectionalSubjectCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      Mathematics: 0,
      Reasoning: 0,
      English: 0,
      'General Awareness': 0
    };
    reports.filter(r => r.type === 'sectional').forEach(r => {
      counts.all++;
      const sub = getSectionalSubject(r);
      if (counts[sub] !== undefined) {
        counts[sub]++;
      }
    });
    return counts;
  }, [reports]);

  // Filtered reports according to activeTab and selectedSectionalSubject
  const filteredReports = useMemo(() => {
    if (activeTab === 'full') {
      return reports.filter(r => r.type === 'full');
    }
    const sectionals = reports.filter(r => r.type === 'sectional');
    if (selectedSectionalSubject === 'all') {
      return sectionals;
    }
    return sectionals.filter(r => getSectionalSubject(r) === selectedSectionalSubject);
  }, [reports, activeTab, selectedSectionalSubject]);

  // Grouped reports when viewing all sectional subjects together
  const groupedSectionalReports = useMemo(() => {
    if (activeTab !== 'sectional') return null;
    const sectionals = reports.filter(r => r.type === 'sectional');
    const subjects: Array<{
      key: 'Mathematics' | 'English' | 'Reasoning' | 'General Awareness';
      label: string;
      subLabel: string;
      icon: any;
      textColor: string;
      bgColor: string;
      borderColor: string;
      badgeColor: string;
      reports: MockScoreReport[];
      avgScore: number;
      bestScore: number;
      avgAccuracy: number;
    }> = [
      {
        key: 'Mathematics',
        label: 'Quantitative Aptitude',
        subLabel: 'Math',
        icon: Calculator,
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50/40',
        borderColor: 'border-blue-200/90',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        reports: [],
        avgScore: 0,
        bestScore: 0,
        avgAccuracy: 0
      },
      {
        key: 'English',
        label: 'English Comprehension',
        subLabel: 'English',
        icon: BookOpen,
        textColor: 'text-emerald-700',
        bgColor: 'bg-emerald-50/40',
        borderColor: 'border-emerald-200/90',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        reports: [],
        avgScore: 0,
        bestScore: 0,
        avgAccuracy: 0
      },
      {
        key: 'Reasoning',
        label: 'General Intelligence & Reasoning',
        subLabel: 'Reasoning',
        icon: Brain,
        textColor: 'text-indigo-700',
        bgColor: 'bg-indigo-50/40',
        borderColor: 'border-indigo-200/90',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        reports: [],
        avgScore: 0,
        bestScore: 0,
        avgAccuracy: 0
      },
      {
        key: 'General Awareness',
        label: 'General Awareness & GK',
        subLabel: 'GA / GK',
        icon: Compass,
        textColor: 'text-amber-700',
        bgColor: 'bg-amber-50/40',
        borderColor: 'border-amber-200/90',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        reports: [],
        avgScore: 0,
        bestScore: 0,
        avgAccuracy: 0
      }
    ];

    sectionals.forEach(r => {
      const sub = getSectionalSubject(r);
      const item = subjects.find(s => s.key === sub);
      if (item) {
        item.reports.push(r);
      }
    });

    subjects.forEach(item => {
      if (item.reports.length > 0) {
        const scores = item.reports.map(r => r.totalScore);
        item.bestScore = Math.max(...scores);
        item.avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        item.avgAccuracy = Math.round((item.reports.reduce((a, b) => a + b.overallAccuracy, 0) / item.reports.length) * 10) / 10;
      }
    });

    return subjects.filter(s => s.reports.length > 0);
  }, [reports, activeTab]);

  const latestReport = filteredReports[0] || null;

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    if (filteredReports.length === 0) {
      return {
        bestScore: 0,
        avgScore: 0,
        avgAccuracy: 0,
        totalMocks: 0,
        maxMarks: activeTab === 'full' ? 200 : 50
      };
    }

    const scores = filteredReports.map(r => r.totalScore);
    const bestScore = Math.max(...scores);
    const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const avgAccuracy = Math.round((filteredReports.reduce((a, b) => a + b.overallAccuracy, 0) / filteredReports.length) * 10) / 10;

    return {
      bestScore,
      avgScore,
      avgAccuracy,
      totalMocks: filteredReports.length,
      maxMarks: filteredReports[0]?.maxMarks || (activeTab === 'full' ? 200 : 50)
    };
  }, [filteredReports, activeTab]);

  // Handle JSON file upload
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let rawQuestions: any[] = [];

      if (Array.isArray(parsed)) {
        rawQuestions = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.data)) rawQuestions = parsed.data;
        else if (Array.isArray(parsed.questions)) rawQuestions = parsed.questions;
        else {
          const values = Object.values(parsed);
          if (values.length > 0 && values.every(v => Array.isArray(v))) {
            rawQuestions = values.flat();
          }
        }
      }

      if (rawQuestions.length === 0) {
        alert('No valid questions found in this JSON file.');
        return;
      }

      const fileNameClean = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      const report = computeMockScoreClientSide(rawQuestions, fileNameClean);

      // Save question dataset to backend
      try {
        await fetch(`/api/mock-questions/${report.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rawQuestions)
        });
      } catch {}

      // Save question dataset to localStorage as fallback
      try {
        safeStorage.setItem(`cgl_mock_questions_${report.id}`, JSON.stringify(rawQuestions));
      } catch {}

      // Try persisting to backend API
      try {
        await fetch('/api/mock-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
      } catch {}

      // Trigger background AI enrichment & error extraction (matrix questions sent to AI)
      try {
        fetch('/api/mock-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: report.title,
            questions: rawQuestions
          })
        }).catch(e => console.warn('AI mock import note:', e));
      } catch {}

      const updated = [report, ...reports];
      saveReports(updated);
      setActiveTab(report.type);
    } catch (err: any) {
      console.error('Failed to parse mock JSON:', err);
      alert('Failed to parse mock JSON file: ' + (err.message || 'Invalid format'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── SECTION-WISE MOCK ERROR QUESTION LOADER ───
  const loadRawMockQuestions = async (report: MockScoreReport): Promise<any[]> => {
    const rawId = report.id;
    const effectiveId = LEGACY_MOCK_ID_MAP[rawId] || rawId;

    if (rawQuestionsCache[effectiveId] && rawQuestionsCache[effectiveId].length > 0) {
      return rawQuestionsCache[effectiveId];
    }
    if (rawQuestionsCache[rawId] && rawQuestionsCache[rawId].length > 0) {
      return rawQuestionsCache[rawId];
    }

    let list: any[] = [];

    const tryExtractQuestions = (mod: any): any[] | null => {
      const raw = mod?.default || mod;
      if (Array.isArray(raw) && raw.length > 0) return raw;
      if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.data) && raw.data.length > 0) return raw.data;
        if (Array.isArray(raw.questions) && raw.questions.length > 0) return raw.questions;
      }
      return null;
    };

    const tryModulePath = async (p: string): Promise<any[] | null> => {
      if (mockQuestionModules[p]) {
        try {
          const mod = await (mockQuestionModules[p] as () => Promise<any>)();
          return tryExtractQuestions(mod);
        } catch {}
      }
      return null;
    };

    // Find canonical bundled report if any
    const canonicalReport = (initialMockReports as MockScoreReport[]).find(
      r => r.id === effectiveId || r.id === rawId ||
           (r.title && report.title && normalizeTestTitle(r.title) === normalizeTestTitle(report.title))
    );

    const candidateIds = Array.from(new Set([
      canonicalReport?.id,
      effectiveId,
      rawId
    ].filter(Boolean) as string[]));

    // 1. Direct Vite dynamic module lookup for all candidate IDs (checks mock_questions and mock_tests)
    for (const cid of candidateIds) {
      const qData = await tryModulePath(`../data/mock_questions/${cid}.json`);
      if (qData) { list = qData; break; }

      const tData = await tryModulePath(`../data/mock_tests/${cid}.json`);
      if (tData) { list = tData; break; }
    }

    // 2. Search mockQuestionModules by matching test title in question data
    if (list.length === 0 && report.title) {
      const targetNorm = normalizeTestTitle(report.title).replace(/[^a-z0-9]/g, '');
      for (const [, loader] of Object.entries(mockQuestionModules)) {
        try {
          const mod = await (loader as () => Promise<any>)();
          const items = tryExtractQuestions(mod);
          if (items && items.length > 0) {
            const firstTestName = normalizeTestTitle(items[0]?.testName || '').replace(/[^a-z0-9]/g, '');
            if (firstTestName && (firstTestName === targetNorm || firstTestName.includes(targetNorm) || targetNorm.includes(firstTestName))) {
              list = items;
              break;
            }
          }
        } catch {}
      }
    }

    // 3. LocalStorage cache lookup
    if (list.length === 0) {
      for (const cid of candidateIds) {
        try {
          const saved = safeStorage.getItem(`cgl_mock_questions_${cid}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            const extracted = tryExtractQuestions(parsed);
            if (extracted) { list = extracted; break; }
          }
        } catch {}
      }
    }

    // 4. Server API lookup
    if (list.length === 0) {
      for (const cid of candidateIds) {
        try {
          const res = await fetch(`/api/mock-questions/${cid}`);
          const cType = res.headers.get('content-type') || '';
          if (res.ok && cType.includes('application/json')) {
            const data = await res.json();
            const extracted = tryExtractQuestions(data);
            if (extracted) { list = extracted; break; }
          }
        } catch {}
      }
    }

    // 5. Fallback: gather questions from mock_errors if subject matches
    if (list.length === 0 && mockData) {
      const subjectsInOrder = ['Reasoning', 'General Awareness', 'Mathematics', 'English'];
      subjectsInOrder.forEach(sub => {
        const chapters = mockData[sub] || [];
        chapters.forEach(ch => {
          let status = 'wrong';
          if (ch.chapter_title === 'Speed Issue') status = 'slow';
          else if (ch.chapter_title === 'Unattempted') status = 'unattempted';
          else if (ch.chapter_title === 'Wrong' || ch.chapter_title === 'Mock Errors') status = 'wrong';

          (ch.questions || []).forEach(q => {
            list.push({
              ...q,
              subject: sub,
              status,
              errorType: status
            });
          });
        });
      });
    }

    if (list.length > 0) {
      setRawQuestionsCache(prev => ({
        ...prev,
        [rawId]: list,
        [effectiveId]: list,
        ...(canonicalReport?.id ? { [canonicalReport.id]: list } : {})
      }));
    }

    return list;
  };

  const openPracticeModal = async (report: MockScoreReport, targetSection: string = 'all') => {
    let normalizedTarget = targetSection;
    if (/quant|math/i.test(targetSection)) normalizedTarget = 'Mathematics';
    else if (/reason/i.test(targetSection)) normalizedTarget = 'Reasoning';
    else if (/aware|gk|gs/i.test(targetSection)) normalizedTarget = 'General Awareness';
    else if (/eng/i.test(targetSection)) normalizedTarget = 'English';
    else if (targetSection === 'all') normalizedTarget = 'all';

    setPracticeModalReport(report);
    setPracticeSection(normalizedTarget);
    setPracticeErrorFilter('all');

    // Preload raw questions in background
    if (!rawQuestionsCache[report.id]) {
      setLoadingQuestions(true);
      await loadRawMockQuestions(report);
      setLoadingQuestions(false);
    }
  };

  // Live stats in practice modal
  const modalStats = useMemo(() => {
    if (!practiceModalReport) return null;
    const rawList = rawQuestionsCache[practiceModalReport.id] || [];

    const normalizeSub = (raw: string) => {
      if (/reason|intel/i.test(raw)) return 'Reasoning';
      if (/aware|gk|gs|ga|knowledge/i.test(raw)) return 'General Awareness';
      if (/quant|math|aptitude/i.test(raw)) return 'Mathematics';
      if (/eng/i.test(raw)) return 'English';
      return 'Other';
    };

    const getCounts = (subjectKey: string) => {
      let wrong = 0;
      let unattempted = 0;
      let slow = 0;

      if (rawList.length > 0) {
        const items = rawList.filter(q => {
          if (subjectKey === 'all') return true;
          return normalizeSub(q.subject || q.section || q.subjectName || '') === subjectKey;
        });

        items.forEach(q => {
          const st = getMockQuestionStatus(q);
          if (st === 'wrong') wrong++;
          else if (st === 'unattempted') unattempted++;
          else if (st === 'slow') slow++;
        });
      } else {
        // Instant preview from report.sections before rawList finishes loading
        const secMap: Record<string, keyof typeof practiceModalReport.sections> = {
          'Reasoning': 'reasoning',
          'General Awareness': 'generalAwareness',
          'Mathematics': 'mathematics',
          'English': 'english'
        };

        if (subjectKey === 'all') {
          wrong = practiceModalReport.totalWrong || 0;
          unattempted = practiceModalReport.totalUnattempted || 0;
        } else {
          const sData = practiceModalReport.sections?.[secMap[subjectKey]];
          if (sData) {
            wrong = sData.wrong || 0;
            unattempted = sData.unattempted || 0;
          }
        }
      }

      return {
        total: wrong + unattempted + slow,
        wrong,
        unattempted,
        slow
      };
    };

    return {
      reasoning: getCounts('Reasoning'),
      generalAwareness: getCounts('General Awareness'),
      mathematics: getCounts('Mathematics'),
      english: getCounts('English'),
      all: getCounts('all')
    };
  }, [practiceModalReport, rawQuestionsCache]);

  const activeSectionStats = useMemo(() => {
    if (!modalStats) return null;
    return modalStats[
      practiceSection === 'Reasoning' ? 'reasoning' :
      practiceSection === 'General Awareness' ? 'generalAwareness' :
      practiceSection === 'Mathematics' ? 'mathematics' :
      practiceSection === 'English' ? 'english' : 'all'
    ] || null;
  }, [modalStats, practiceSection]);

  const activeSectionCount = useMemo(() => {
    if (!activeSectionStats) return 0;
    if (practiceErrorFilter === 'all') return activeSectionStats.total;
    if (practiceErrorFilter === 'wrong') return activeSectionStats.wrong;
    if (practiceErrorFilter === 'unattempted') return activeSectionStats.unattempted;
    if (practiceErrorFilter === 'slow') return activeSectionStats.slow;
    return activeSectionStats.total;
  }, [activeSectionStats, practiceErrorFilter]);

  const handleStartFilteredPractice = async () => {
    if (!practiceModalReport) return;
    setPracticingId(practiceModalReport.id);

    try {
      const rawList = await loadRawMockQuestions(practiceModalReport);

      const normalizeSub = (raw: string) => {
        if (/reason|intel/i.test(raw)) return 'Reasoning';
        if (/aware|gk|gs|ga|knowledge/i.test(raw)) return 'General Awareness';
        if (/quant|math|aptitude/i.test(raw)) return 'Mathematics';
        if (/eng/i.test(raw)) return 'English';
        return 'Other';
      };

      // 1. Filter by section
      let filtered = rawList.filter(q => {
        if (practiceSection === 'all') return true;
        const qSub = normalizeSub(q.subject || q.section || q.subjectName || '');
        return qSub === practiceSection;
      });

      // 2. Filter by error status (slow, incorrect, unattempted - EXCLUDING correct on-time!)
      filtered = filtered.filter(q => {
        const status = getMockQuestionStatus(q);
        if (practiceErrorFilter === 'all') {
          return status === 'wrong' || status === 'unattempted' || status === 'slow';
        }
        return status === practiceErrorFilter;
      });

      if (filtered.length === 0) {
        alert(`No matching mistake questions found in ${practiceSection === 'all' ? 'All Sections' : practiceSection}. You had 100% accuracy here! 🎉`);
        return;
      }

      // Sort questions in canonical SSC order: Reasoning (Part A) -> GA (Part B) -> Quant (Part C) -> English (Part D)
      const subjectOrder: Record<string, number> = {
        'Reasoning': 1,
        'General Awareness': 2,
        'Mathematics': 3,
        'English': 4,
        'Other': 5
      };

      filtered.sort((a, b) => {
        const subA = normalizeSub(a.subject || a.section || a.subjectName || '');
        const subB = normalizeSub(b.subject || b.section || b.subjectName || '');
        const ordA = subjectOrder[subA] || 99;
        const ordB = subjectOrder[subB] || 99;
        if (ordA !== ordB) return ordA - ordB;
        const numA = Number(a.q_num || a.qNum || a.questionNumber || a.originalIdx || 0);
        const numB = Number(b.q_num || b.qNum || b.questionNumber || b.originalIdx || 0);
        return numA - numB;
      });

      // 3. Format questions for quiz
      const formattedQuestions: Question[] = filtered.map((item, idx) => {
        const rawSub = item.subject || item.section || item.subjectName || practiceSection;
        const subjectName = normalizeSub(rawSub);
        const status = getMockQuestionStatus(item);
        const statusLabel = status === 'wrong' ? '❌ Wrong' : status === 'unattempted' ? '⏸ Skipped' : '⏱ Slow';

        let options: { a: string; b: string; c: string; d: string } = { a: '', b: '', c: '', d: '' };
        if (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
          options = {
            a: String(item.options.a || item.options['1'] || item.options.A || '').trim(),
            b: String(item.options.b || item.options['2'] || item.options.B || '').trim(),
            c: String(item.options.c || item.options['3'] || item.options.C || '').trim(),
            d: String(item.options.d || item.options['4'] || item.options.D || '').trim()
          };
        } else if (Array.isArray(item.options)) {
          options = {
            a: typeof item.options[0] === 'object' ? String(item.options[0]?.text || item.options[0]?.value || item.options[0]?.val || '') : String(item.options[0] || ''),
            b: typeof item.options[1] === 'object' ? String(item.options[1]?.text || item.options[1]?.value || item.options[1]?.val || '') : String(item.options[1] || ''),
            c: typeof item.options[2] === 'object' ? String(item.options[2]?.text || item.options[2]?.value || item.options[2]?.val || '') : String(item.options[2] || ''),
            d: typeof item.options[3] === 'object' ? String(item.options[3]?.text || item.options[3]?.value || item.options[3]?.val || '') : String(item.options[3] || '')
          };
        }

        let ans: 'a' | 'b' | 'c' | 'd' = 'a';
        const rawAns = item.answer || item.correctOption || item.correct_option || item.correctAnswer || item.right_answer || item.ans || '';
        const strAns = String(rawAns).trim().toLowerCase();
        if (strAns === 'a' || strAns === '1' || strAns === 'option a' || strAns === 'opt a') ans = 'a';
        else if (strAns === 'b' || strAns === '2' || strAns === 'option b' || strAns === 'opt b') ans = 'b';
        else if (strAns === 'c' || strAns === '3' || strAns === 'option c' || strAns === 'opt c') ans = 'c';
        else if (strAns === 'd' || strAns === '4' || strAns === 'option d' || strAns === 'opt d') ans = 'd';
        else {
          if (options.a && strAns === options.a.trim().toLowerCase()) ans = 'a';
          else if (options.b && strAns === options.b.trim().toLowerCase()) ans = 'b';
          else if (options.c && strAns === options.c.trim().toLowerCase()) ans = 'c';
          else if (options.d && strAns === options.d.trim().toLowerCase()) ans = 'd';
        }

        const solution = (item.solution || item.explanation || item.sol || '').trim();
        const rawT = item.topic || item.tags?.topic;
        const topicText = rawT ? normalizeTopicTitle(rawT) : 'General';

        const secKey = subjectName === 'Reasoning'
          ? 'part_a'
          : subjectName === 'General Awareness'
          ? 'part_b'
          : subjectName === 'Mathematics'
          ? 'part_c'
          : 'part_d';

        return {
          id: item.id || `mock_err_${idx + 1}_${Math.random().toString(36).slice(2, 7)}`,
          q_num: idx + 1,
          question: (item.question || item.questionText || item.qText || `Question ${idx + 1}`).trim(),
          options,
          answer: ans,
          solution: solution || undefined,
          image: item.image || null,
          subject: subjectName,
          section: secKey,
          tags: {
            topic: `${subjectName} • ${statusLabel} • ${topicText}`,
            difficulty: (item.difficulty || item.tags?.difficulty || 'medium') as 'easy' | 'medium' | 'hard'
          },
          avgTime: item.avgTime || item.avg_time || item.avgTimeSeconds
        };
      });

      const sectionTitle = practiceSection === 'all' ? 'All 4 Sections Mistakes' : `${practiceSection} Mistakes`;
      const filterLabel = practiceErrorFilter === 'all' ? '' : ` (${practiceErrorFilter.toUpperCase()})`;

      const virtualChapter: Chapter = {
        chapter_num: 0,
        chapter_title: `${practiceModalReport.title} - ${sectionTitle}${filterLabel}`,
        subject: practiceSection === 'all' ? 'All 4 Sections Mock' : practiceSection,
        subject_id: practiceSection === 'all' ? 'all_sections_mock' : practiceSection.toLowerCase().replace(/\s+/g, '_'),
        questions: formattedQuestions
      };

      setPracticeModalReport(null);

      if (onStartPracticeMock) {
        onStartPracticeMock(virtualChapter, modalQuizMode);
      }
    } catch (err: any) {
      console.error('Failed to launch practice:', err);
      alert('Error launching practice: ' + (err.message || 'Unknown'));
    } finally {
      setPracticingId(null);
    }
  };

  const handlePracticeMock = (report: MockScoreReport) => {
    openPracticeModal(report, 'all');
  };

  const handleAskAiMock = async (report: MockScoreReport, targetSection?: string) => {
    setAskingAiId(report.id);
    try {
      const rawList = await loadRawMockQuestions(report);

      const normalizeSub = (raw: string) => {
        if (/reason|intel/i.test(raw)) return 'Reasoning';
        if (/aware|gk|gs|ga|knowledge/i.test(raw)) return 'General Awareness';
        if (/quant|math|aptitude/i.test(raw)) return 'Quantitative Aptitude';
        if (/eng/i.test(raw)) return 'English';
        return raw || 'General';
      };

      const filteredRaw = targetSection && targetSection !== 'all'
        ? rawList.filter(item => {
            const sub = normalizeSub(item.subject || item.section || item.subjectName || '');
            return sub.toLowerCase().includes(targetSection.toLowerCase());
          })
        : rawList;

      // Extract mistake / relevant questions for Tommy's focus
      const scopedQuestions: AiFocusedQuestion[] = filteredRaw.map((item, idx) => {
        const status = getMockQuestionStatus(item);
        let userAns = item.userAnswer || item.user_answer || item.myAnswer;
        if (!userAns && status === 'unattempted') userAns = 'Unattempted / Skipped';

        let optionsMap: Record<string, string> | undefined = undefined;
        if (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
          optionsMap = {
            A: String(item.options.a || item.options['1'] || item.options.A || '').trim(),
            B: String(item.options.b || item.options['2'] || item.options.B || '').trim(),
            C: String(item.options.c || item.options['3'] || item.options.C || '').trim(),
            D: String(item.options.d || item.options['4'] || item.options.D || '').trim(),
          };
        } else if (Array.isArray(item.options)) {
          optionsMap = {
            A: String(item.options[0]?.text || item.options[0] || '').trim(),
            B: String(item.options[1]?.text || item.options[1] || '').trim(),
            C: String(item.options[2]?.text || item.options[2] || '').trim(),
            D: String(item.options[3]?.text || item.options[3] || '').trim(),
          };
        }

        return {
          id: item.id || `mock_q_${idx + 1}`,
          qNum: idx + 1,
          question: (item.question || item.questionText || item.qText || `Question ${idx + 1}`).trim(),
          options: optionsMap,
          correctAnswer: item.answer || item.correctOption || item.correctAnswer || '',
          userAnswer: userAns,
          solution: (item.solution || item.explanation || item.sol || '').trim(),
          status: status as any,
          subject: normalizeSub(item.subject || item.section || item.subjectName || ''),
          topic: item.topic || item.tags?.topic,
          rcaReason: item.rca?.reason || item.rcaReason || undefined
        };
      });

      const sectionTitle = targetSection && targetSection !== 'all' ? ` (${targetSection})` : '';

      openAiWithScope({
        type: 'mock',
        title: `${report.title}${sectionTitle}`,
        subject: report.type === 'sectional' ? getSectionalSubject(report) : undefined,
        stats: {
          totalScore: report.totalScore,
          maxMarks: report.maxMarks,
          accuracy: report.overallAccuracy,
          totalQuestions: report.totalQuestions,
          correct: report.totalCorrect,
          wrong: report.totalWrong,
          unattempted: report.totalUnattempted ?? (report as any).unattempted ?? 0,
          slow: (report as any).totalSlow
        },
        questions: scopedQuestions
      });
    } catch (err) {
      console.error('Failed to prepare AI scope for mock:', err);
    } finally {
      setAskingAiId(null);
    }
  };

  const handleReviewMock = async (report: MockScoreReport) => {
    if (!onReviewMock) return;
    setReviewingId(report.id);
    try {
      const rawList = await loadRawMockQuestions(report);
      if (!rawList || rawList.length === 0) {
        alert('Could not find question data for this mock test. Please re-import or re-take the mock.');
        return;
      }

      const effectiveId = LEGACY_MOCK_ID_MAP[report.id] || report.id;
      // Load existing RCA classifications from localStorage if any
      let rcaMap: Record<string, any> = {};
      let globalRcaMap: Record<string, any> = {};
      try {
        const savedRca = safeStorage.getItem(`cgl_rca_${report.id}`) || safeStorage.getItem(`cgl_rca_${effectiveId}`) || safeStorage.getItem(`cgl_rca_${report.title}`);
        if (savedRca) rcaMap = JSON.parse(savedRca);
        const globalRaw = safeStorage.getItem('cgl_rca_global_store');
        if (globalRaw) globalRcaMap = JSON.parse(globalRaw);
      } catch {}

      const formattedQuestions: Question[] = rawList.map((item, idx) => {
        const rawSub = item.subject || item.section || item.subjectName || (report.type === 'sectional' && report.subject ? report.subject : 'Quantitative Aptitude');
        const subjectName = normalizeSubName(rawSub);

        let options: { a: string; b: string; c: string; d: string } = { a: '', b: '', c: '', d: '' };
        if (item.options && typeof item.options === 'object' && !Array.isArray(item.options)) {
          options = {
            a: String(item.options.a || item.options['1'] || item.options.A || '').trim(),
            b: String(item.options.b || item.options['2'] || item.options.B || '').trim(),
            c: String(item.options.c || item.options['3'] || item.options.C || '').trim(),
            d: String(item.options.d || item.options['4'] || item.options.D || '').trim()
          };
        } else if (Array.isArray(item.options)) {
          options = {
            a: typeof item.options[0] === 'object' ? String(item.options[0]?.text || item.options[0]?.value || item.options[0]?.val || '') : String(item.options[0] || ''),
            b: typeof item.options[1] === 'object' ? String(item.options[1]?.text || item.options[1]?.value || item.options[1]?.val || '') : String(item.options[1] || ''),
            c: typeof item.options[2] === 'object' ? String(item.options[2]?.text || item.options[2]?.value || item.options[2]?.val || '') : String(item.options[2] || ''),
            d: typeof item.options[3] === 'object' ? String(item.options[3]?.text || item.options[3]?.value || item.options[3]?.val || '') : String(item.options[3] || '')
          };
        }

        let ans: 'a' | 'b' | 'c' | 'd' = 'a';
        const rawAns = item.answer || item.correctOption || item.correct_option || item.correctAnswer || item.right_answer || item.ans || '';
        const strAns = String(rawAns).trim().toLowerCase();
        if (strAns === 'a' || strAns === '1' || strAns === 'option a' || strAns === 'opt a') ans = 'a';
        else if (strAns === 'b' || strAns === '2' || strAns === 'option b' || strAns === 'opt b') ans = 'b';
        else if (strAns === 'c' || strAns === '3' || strAns === 'option c' || strAns === 'opt c') ans = 'c';
        else if (strAns === 'd' || strAns === '4' || strAns === 'option d' || strAns === 'opt d') ans = 'd';
        else {
          if (options.a && strAns === options.a.trim().toLowerCase()) ans = 'a';
          else if (options.b && strAns === options.b.trim().toLowerCase()) ans = 'b';
          else if (options.c && strAns === options.c.trim().toLowerCase()) ans = 'c';
          else if (options.d && strAns === options.d.trim().toLowerCase()) ans = 'd';
        }

        // Fallback for "N/A" correctOption: extract from solution
        if (strAns === 'n/a' || !strAns || (!options[ans] && strAns !== 'a')) {
          const sol = String(item.solution || item.explanation || item.sol || '').toLowerCase();
          const m = sol.match(/correct\s*(?:answer|option)\s*(?:is|=|:)?\s*["']?(?:option\s*)?([1-4a-d])/i);
          if (m) {
            const v = m[1].toLowerCase();
            if (v === '1' || v === 'a') ans = 'a';
            else if (v === '2' || v === 'b') ans = 'b';
            else if (v === '3' || v === 'c') ans = 'c';
            else if (v === '4' || v === 'd') ans = 'd';
          } else {
            (['a', 'b', 'c', 'd'] as const).forEach(k => {
              const optVal = options[k]?.toLowerCase().trim();
              if (optVal && optVal.length > 0 && (sol.includes(`"${optVal}"`) || sol.includes(`'${optVal}'`))) {
                ans = k;
              }
            });
          }
        }

        const solution = (item.solution || item.explanation || item.sol || '').trim();
        const rawT = item.topic || item.tags?.topic;
        const topicText = rawT ? normalizeTopicTitle(rawT) : 'General';

        const qId = item.id || `mock_q_${idx + 1}_${report.id}`;
        const cleanText = (item.question || item.questionText || item.qText || '').trim().toLowerCase();
        const existingRca = item.rca || rcaMap[idx] || rcaMap[qId] || rcaMap[String(idx + 1)] || globalRcaMap[qId] || (cleanText ? globalRcaMap[cleanText] : undefined);

        const rawAvg = item.avgTime || item.avg_time || item.avgTimeSeconds;
        let parsedAvg = 45;
        if (typeof rawAvg === 'number' && rawAvg > 0) {
          parsedAvg = rawAvg;
        } else if (rawAvg) {
          const str = String(rawAvg).trim();
          if (str.includes(':')) {
            const p = str.split(':').map(x => parseInt(x, 10));
            if (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) parsedAvg = p[0] * 60 + p[1];
            else if (p.length === 3 && !isNaN(p[0]) && !isNaN(p[1]) && !isNaN(p[2])) parsedAvg = p[0] * 3600 + p[1] * 60 + p[2];
          } else {
            const n = parseInt(str.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(n) && n > 0) parsedAvg = n;
          }
        }

        return {
          id: qId,
          q_num: idx + 1,
          question: (item.question || item.questionText || item.qText || `Question ${idx + 1}`).trim(),
          options,
          answer: ans,
          solution: solution || undefined,
          image: item.image || null,
          subject: subjectName,
          tags: {
            topic: topicText,
            difficulty: (item.difficulty || item.tags?.difficulty || 'medium') as 'easy' | 'medium' | 'hard'
          },
          avgTime: parsedAvg,
          avgTimeSeconds: parsedAvg,
          rca: existingRca
        };
      });

      // Check if dataset lost explicit status/answers (e.g. from previously stripped JSON)
      const allUnattempted = rawList.every(item => getMockQuestionStatus(item) === 'unattempted');
      const hasReportStats = Boolean((report.totalCorrect || 0) > 0 || (report.totalWrong || 0) > 0);

      // Map of inferred statuses if dataset had lost statuses
      const inferredStatusMap: Record<number, MockQuestionErrorStatus> = {};
      if (allUnattempted && hasReportStats) {
        if (report.sections && rawList.length === 100) {
          const secList: { key: keyof typeof report.sections; start: number; end: number }[] = [
            { key: 'reasoning', start: 0, end: 25 },
            { key: 'generalAwareness', start: 25, end: 50 },
            { key: 'mathematics', start: 50, end: 75 },
            { key: 'english', start: 75, end: 100 }
          ];

          secList.forEach(({ key, start, end }) => {
            const secData = report.sections?.[key];
            const targetWrong = secData ? secData.wrong : 0;
            const targetCorrect = secData ? secData.correct : 0;
            let wrongAssigned = 0;
            let correctAssigned = 0;

            // 1. Assign wrong/slow to questions with RCA tags first
            for (let i = start; i < end; i++) {
              const qRca = formattedQuestions[i]?.rca;
              if (qRca) {
                inferredStatusMap[i] = qRca.tag === 'T' ? 'slow' : 'wrong';
                wrongAssigned++;
              }
            }

            // 2. Assign remaining wrong count
            for (let i = start; i < end && wrongAssigned < targetWrong; i++) {
              if (!inferredStatusMap[i]) {
                inferredStatusMap[i] = 'wrong';
                wrongAssigned++;
              }
            }

            // 3. Assign correct count
            for (let i = start; i < end && correctAssigned < targetCorrect; i++) {
              if (!inferredStatusMap[i]) {
                inferredStatusMap[i] = 'correct';
                correctAssigned++;
              }
            }

            // 4. Remainder are unattempted
            for (let i = start; i < end; i++) {
              if (!inferredStatusMap[i]) {
                inferredStatusMap[i] = 'unattempted';
              }
            }
          });
        }
      }

      const questionDetails: QuestionProgress[] = rawList.map((item, idx) => {
        const q = formattedQuestions[idx];
        const status = inferredStatusMap[idx] || getMockQuestionStatus(item);
        const isSlow = status === 'slow';
        const isCorrect = status === 'correct' || isSlow;
        const isUnattempted = status === 'unattempted';
        const isWrong = status === 'wrong';

        let selected = '';
        const rawUser = String(
          item.chosenOption ??
          item.chosen_option ??
          item.userAnswer ??
          item.user_answer ??
          item.selected ??
          item.selectedAnswer ??
          item.yourOption ??
          item.your_option ??
          item.markedOption ??
          item.marked_option ??
          item.userAttempt ??
          item.givenAnswer ??
          item.given_answer ??
          item.candidateAnswer ??
          item.myAnswer ??
          ''
        ).trim().toLowerCase();

        if (isUnattempted || rawUser === 'unattempted' || rawUser === 'skipped' || rawUser === 'not attempted') {
          selected = '';
        } else if (rawUser === 'a' || rawUser === '1' || rawUser === 'option a' || rawUser === 'opt a') selected = 'a';
        else if (rawUser === 'b' || rawUser === '2' || rawUser === 'option b' || rawUser === 'opt b') selected = 'b';
        else if (rawUser === 'c' || rawUser === '3' || rawUser === 'option c' || rawUser === 'opt c') selected = 'c';
        else if (rawUser === 'd' || rawUser === '4' || rawUser === 'option d' || rawUser === 'opt d') selected = 'd';
        else if (q.options) {
          if (q.options.a && rawUser === q.options.a.trim().toLowerCase()) selected = 'a';
          else if (q.options.b && rawUser === q.options.b.trim().toLowerCase()) selected = 'b';
          else if (q.options.c && rawUser === q.options.c.trim().toLowerCase()) selected = 'c';
          else if (q.options.d && rawUser === q.options.d.trim().toLowerCase()) selected = 'd';
        }

        if (!selected && !isUnattempted) {
          if (isCorrect) {
            selected = q.answer;
          } else if (isWrong) {
            // Student made a wrong choice; select alternate option so Review shows incorrect attempt
            const altOptions: ('a' | 'b' | 'c' | 'd')[] = (['a', 'b', 'c', 'd'] as const).filter(k => k !== q.answer);
            selected = altOptions[0] || 'b';
          }
        }

        // Parse user time from "01:01" or seconds
        const rawUserTime = item.userTime || item.user_time || item.timeSpent || item.timeTaken || item.time_spent || item.time;
        let timeSpent = isSlow ? 65 : 35;
        if (typeof rawUserTime === 'number' && rawUserTime > 0) {
          timeSpent = rawUserTime;
        } else if (rawUserTime) {
          const str = String(rawUserTime).trim();
          if (str.includes(':')) {
            const p = str.split(':').map(x => parseInt(x, 10));
            if (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) timeSpent = p[0] * 60 + p[1];
            else if (p.length === 3 && !isNaN(p[0]) && !isNaN(p[1]) && !isNaN(p[2])) timeSpent = p[0] * 3600 + p[1] * 60 + p[2];
          } else {
            const n = parseInt(str.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(n) && n > 0) timeSpent = n;
          }
        }

        return {
          q_num: idx + 1,
          timeSpent,
          isCorrect,
          selectedAnswer: isUnattempted ? '' : selected,
          status: isSlow ? 'slow' : (isCorrect ? 'correct' : (isUnattempted ? 'unattempted' : 'wrong')),
          errorType: isSlow ? 'slow' : (isCorrect ? 'correct' : (isUnattempted ? 'unattempted' : 'wrong')),
          isSlow,
          avgTime: q.avgTime,
          avgTimeSeconds: typeof q.avgTime === 'number' ? q.avgTime : undefined,
          question: q,
          rca: q.rca
        };
      });

      const totalTime = questionDetails.reduce((sum, q) => sum + (q.timeSpent || 0), 0) || 3600;

      const reviewQuizResult: QuizResult = {
        id: effectiveId || report.id,
        userId: 'mock_candidate',
        chapter_title: report.title,
        subject: report.type === 'sectional' && report.subject ? report.subject : 'All 4 Sections Mock',
        category: 'mockErrors',
        mode: 'mock',
        score: report.totalScore,
        totalQuestions: formattedQuestions.length,
        totalTime,
        completedAt: report.date || new Date().toISOString(),
        questionDetails
      };

      onReviewMock(reviewQuizResult);
    } catch (err: any) {
      console.error('Failed to open mock review:', err);
      alert('Error opening review: ' + (err.message || 'Unknown error'));
    } finally {
      setReviewingId(null);
    }
  };

  const handleDeleteMock = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this mock score record?')) return;
    try {
      await fetch(`/api/mock-reports/${id}`, { method: 'DELETE' });
    } catch {}
    try {
      safeStorage.removeItem(`cgl_mock_questions_${id}`);
    } catch {}
    const updated = reports.filter(r => r.id !== id);
    saveReports(updated);
  };

  const renderSectionalRow = (report: MockScoreReport, showSubjectTag: boolean = true) => {
    const sub = getSectionalSubject(report);
    const subMeta = {
      Mathematics: { label: 'Quantitative (Math)', icon: Calculator, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
      Reasoning: { label: 'Reasoning', icon: Brain, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
      English: { label: 'English', icon: BookOpen, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
      'General Awareness': { label: 'GA / GK', icon: Compass, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
    }[sub] || { label: sub, icon: Target, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' };

    const SubIcon = subMeta.icon;
    const dateClean = new Date(report.date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const mistakeCount = (report.totalWrong || 0) + (report.totalUnattempted || 0);

    return (
      <div
        key={report.id}
        className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between px-3 py-2 gap-2 hover:bg-slate-50/70 transition-colors"
      >
        {/* 1. Left: Attempt details & subject badge */}
        <div className="flex items-center gap-2.5 min-w-[240px]">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${subMeta.bg}`}>
            <SubIcon className={`w-4 h-4 ${subMeta.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-900" title={report.title}>
                {report.title}
              </span>
              {showSubjectTag && (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${subMeta.bg} ${subMeta.color}`}>
                  {subMeta.label}
                </span>
              )}
              <span className="text-[9px] font-medium px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-400">
                {dateClean}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
              <span className="text-emerald-600 font-semibold">{report.totalCorrect} Correct</span>
              <span className="text-slate-300">•</span>
              <span className="text-rose-500 font-semibold">{report.totalWrong} Wrong</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400 font-semibold">{report.totalUnattempted} Skipped</span>
              {mistakeCount > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200">
                    {mistakeCount} mistakes
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Middle: Score & Accuracy Badges */}
        <div className="flex items-center gap-4 self-start xl:self-center">
          <div className="text-left">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Score</div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-sm font-extrabold text-slate-900 leading-none">
                {report.totalScore}
              </span>
              <span className="text-[10px] font-semibold text-slate-400">/{report.maxMarks || 50}</span>
            </div>
          </div>

          <div className="text-left">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Accuracy</div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block ${
              report.overallAccuracy >= 85 ? 'bg-emerald-100 text-emerald-800' :
              report.overallAccuracy >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {report.overallAccuracy}%
            </span>
          </div>
        </div>

        {/* 3. Right: Action Buttons */}
        <div className="flex items-center gap-1.5 self-end xl:self-center">
          <button
            onClick={() => handleReviewMock(report)}
            disabled={reviewingId === report.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200/90 rounded-lg shadow-2xs transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-95"
            title="Review all questions, solutions & root causes"
          >
            {reviewingId === report.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
            <span>Review</span>
          </button>

          <button
            onClick={() => openPracticeModal(report, sub)}
            disabled={practicingId === report.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200/90 rounded-lg shadow-2xs transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-95"
            title="Practice mistakes from this sectional mock"
          >
            {practicingId === report.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-2.5 h-2.5 fill-current" />
            )}
            <span>Practice Mock</span>
          </button>

          <button
            onClick={() => handleAskAiMock(report, sub)}
            disabled={askingAiId === report.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-600 hover:text-white border border-violet-200/90 rounded-lg shadow-2xs transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-95"
            title="Ask Tommy AI about this sectional mock's mistakes"
          >
            {askingAiId === report.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 text-violet-500 fill-violet-500/20" />
            )}
            <span>Ask AI</span>
          </button>

          <button
            onClick={() => handleDeleteMock(report.id)}
            className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
            title="Delete this record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const handleClearAll = async () => {
    if (filteredReports.length === 0) return;
    const label = activeTab === 'full'
      ? 'Full'
      : selectedSectionalSubject === 'all'
      ? 'All Sectional'
      : `${selectedSectionalSubject} Sectional`;
    if (!window.confirm(`Are you sure you want to clear all ${filteredReports.length} ${label} Mock records?`)) return;
    const idsToRemove = new Set(filteredReports.map(r => r.id));
    for (const id of idsToRemove) {
      try {
        await fetch(`/api/mock-reports/${id}`, { method: 'DELETE' });
      } catch {}
      try {
        safeStorage.removeItem(`cgl_mock_questions_${id}`);
      } catch {}
    }
    const updated = reports.filter(r => !idsToRemove.has(r.id));
    saveReports(updated);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-2 sm:px-4 py-2 space-y-2">

      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-1.5 rounded-lg border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Trophy className="w-3.5 h-3.5" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-900 tracking-tight leading-none">Mock Score Dashboard</h1>
              <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Real exam score calculation, negative marking &amp; subject accuracy</p>
            </div>
          </div>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex items-center gap-1.5">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md transition-colors"
            >
              <ChevronLeft className="w-3 h-3 mr-0.5" />
              Back
            </button>
          )}
          {/* Tabs: Full Mock vs Sectional */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-md border border-slate-200/80 text-[11px] font-semibold">
            <button
              onClick={() => setActiveTab('full')}
              className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 ${
                activeTab === 'full'
                  ? 'bg-white text-blue-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Full Mock (100 Qs)</span>
            </button>
            <button
              onClick={() => setActiveTab('sectional')}
              className={`px-2.5 py-0.5 rounded transition-all flex items-center gap-1 ${
                activeTab === 'sectional'
                  ? 'bg-white text-blue-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-3 h-3" />
              <span>Sectional (25 Qs)</span>
            </button>
          </div>

          {/* Upload JSON Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold transition-all shadow-xs disabled:opacity-50"
            title="Import Oliveboard/Testbook JSON to view scores"
          >
            <Upload className="w-3 h-3" />
            <span>{uploading ? 'Processing...' : 'Upload Mock'}</span>
          </button>
        </div>
      </div>

      {/* Subject Filter Toolbar for Sectional Mocks */}
      {activeTab === 'sectional' && (
        <div className="bg-white rounded-xl p-2 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Subject View:
            </span>
            {[
              { id: 'all', label: 'All Subjects', icon: Layers, count: sectionalSubjectCounts.all, color: 'text-slate-700', activeClass: 'bg-slate-900 text-white shadow-xs' },
              { id: 'Mathematics', label: 'Quantitative (Math)', icon: Calculator, count: sectionalSubjectCounts.Mathematics, color: 'text-blue-600', activeClass: 'bg-blue-600 text-white shadow-xs' },
              { id: 'Reasoning', label: 'Reasoning', icon: Brain, count: sectionalSubjectCounts.Reasoning, color: 'text-indigo-600', activeClass: 'bg-indigo-600 text-white shadow-xs' },
              { id: 'English', label: 'English', icon: BookOpen, count: sectionalSubjectCounts.English, color: 'text-emerald-600', activeClass: 'bg-emerald-600 text-white shadow-xs' },
              { id: 'General Awareness', label: 'GA / GK', icon: Compass, count: sectionalSubjectCounts['General Awareness'], color: 'text-amber-600', activeClass: 'bg-amber-600 text-white shadow-xs' },
            ].map((tab) => {
              const isSelected = selectedSectionalSubject === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedSectionalSubject(tab.id as any)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? tab.activeClass
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-slate-50 border border-slate-200/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : tab.color}`} />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedSectionalSubject !== 'all' && (
            <button
              onClick={() => setSelectedSectionalSubject('all')}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer px-1"
            >
              <span>View All Subjects</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {filteredReports.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl p-6 text-center border border-slate-200/80 shadow-xs max-w-md mx-auto space-y-2.5">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mx-auto shadow-inner">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              No {activeTab === 'full' ? 'Full Mock' : selectedSectionalSubject !== 'all' ? `${selectedSectionalSubject} Sectional` : 'Sectional'} Scores Yet
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
              {activeTab === 'sectional' && selectedSectionalSubject !== 'all'
                ? `No ${selectedSectionalSubject} sectional mock tests found. Upload a test or switch subject tabs.`
                : 'Upload your Oliveboard or Testbook JSON mock capture to instantly see your total marks, accuracy, and subject breakdowns.'}
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Select Mock JSON File</span>
          </button>
        </div>
      ) : (
        <>
          {/* ─── 3 HERO METRICS (Refined, Crisp & Compact) ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {/* 1. Latest / Total Score */}
            <div className="bg-white rounded-lg px-3 py-1.5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {activeTab === 'sectional' && selectedSectionalSubject !== 'all' ? `${selectedSectionalSubject} Latest Score` : 'Latest Score'}
                </span>
                <Trophy className="w-3 h-3 text-blue-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-slate-900 leading-none">
                  {latestReport ? latestReport.totalScore : 0}
                </span>
                <span className="text-[10px] font-medium text-slate-400">/ {aggregateStats.maxMarks}</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5 font-medium truncate">
                {latestReport
                  ? `${latestReport.totalCorrect} Correct • ${latestReport.totalWrong} Wrong • ${latestReport.totalUnattempted} Skipped`
                  : 'No attempts'}
              </p>
            </div>

            {/* 2. Overall Accuracy */}
            <div className="bg-white rounded-lg px-3 py-1.5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {activeTab === 'sectional' && selectedSectionalSubject !== 'all' ? `${selectedSectionalSubject} Accuracy` : 'Overall Accuracy'}
                </span>
                <Target className="w-3 h-3 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-base font-bold leading-none ${
                  (latestReport?.overallAccuracy || 0) >= 85 ? 'text-emerald-600' :
                  (latestReport?.overallAccuracy || 0) >= 70 ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {latestReport ? latestReport.overallAccuracy : 0}%
                </span>
                <span className="text-[9px] font-medium text-slate-400">
                  (Avg: {aggregateStats.avgAccuracy}%)
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5 font-medium truncate">
                {(latestReport?.overallAccuracy || 0) >= 85 ? 'Target achieved (≥85% accuracy) ✅' : 'Aim for ≥85% accuracy to maximize rank'}
              </p>
            </div>

            {/* 3. Best Score */}
            <div className="bg-white rounded-lg px-3 py-1.5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {activeTab === 'sectional' && selectedSectionalSubject !== 'all' ? `${selectedSectionalSubject} Best Score` : 'Best Score'}
                </span>
                <TrendingUp className="w-3 h-3 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-slate-900 leading-none">{aggregateStats.bestScore}</span>
                <span className="text-[10px] font-medium text-slate-400">/ {aggregateStats.maxMarks}</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5 font-medium truncate">
                Across {aggregateStats.totalMocks} {activeTab === 'full' ? 'Full Mocks' : selectedSectionalSubject !== 'all' ? `${selectedSectionalSubject} Sectionals` : 'Sectional Mocks'} recorded
              </p>
            </div>
          </div>

          {/* ─── SECTIONAL MOCKS SEPARATED SUBJECT-WISE ─── */}
          {activeTab === 'sectional' && selectedSectionalSubject === 'all' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-800">Sectional Tests (Separated by Subject)</h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                    {filteredReports.length} Total
                  </span>
                </div>
                {filteredReports.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All Sectionals
                  </button>
                )}
              </div>

              {groupedSectionalReports && groupedSectionalReports.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.key} className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                    {/* Subject Section Header */}
                    <div className={`px-3.5 py-2 border-b ${group.borderColor} ${group.bgColor} flex flex-wrap items-center justify-between gap-2`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${group.badgeColor}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className={`text-xs font-bold ${group.textColor}`}>
                              {group.label}
                            </h3>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white border border-slate-200/80 text-slate-600">
                              {group.reports.length} Tests
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-slate-600 font-medium">
                        <span>Avg: <strong className="text-slate-900">{group.avgScore}/50</strong> ({group.avgAccuracy}%)</span>
                        <span className="text-slate-300">•</span>
                        <span>Best: <strong className="text-slate-900">{group.bestScore}/50</strong></span>
                        <button
                          onClick={() => setSelectedSectionalSubject(group.key)}
                          className={`ml-1 text-[11px] font-bold px-2 py-0.5 rounded-md hover:bg-white/80 border border-transparent hover:border-slate-200 transition-all cursor-pointer ${group.textColor}`}
                        >
                          Focus View →
                        </button>
                      </div>
                    </div>

                    {/* Sectional Attempt Rows */}
                    <div className="divide-y divide-slate-100">
                      {group.reports.map(r => renderSectionalRow(r, false))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'sectional' ? (
            /* ─── SINGLE SUBJECT SECTIONAL LIST ─── */
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-800">
                    {selectedSectionalSubject} Sectional Attempts
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                    {filteredReports.length}
                  </span>
                </div>

                {filteredReports.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear {selectedSectionalSubject} Mocks
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {filteredReports.map(r => renderSectionalRow(r, true))}
              </div>
            </div>
          ) : (
            /* ─── FULL MOCKS 4-COLUMN LIST ─── */
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              {/* Header Bar */}
              <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-800">
                    Full Mock Attempts
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                    {filteredReports.length}
                  </span>
                </div>

                {filteredReports.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                )}
              </div>

              {/* Clean Fixed Header Row Above Mocks */}
              <div className="hidden xl:flex items-center border-b border-slate-200/90 bg-slate-50 divide-x divide-slate-200/90 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <div className="w-[245px] 2xl:w-[265px] shrink-0 px-3 py-1.5">
                  Mock Attempt
                </div>
                <div className="flex-1 grid grid-cols-4 divide-x divide-slate-200/90 text-center">
                  <div className="py-1.5 text-indigo-700 font-semibold">Reasoning</div>
                  <div className="py-1.5 text-amber-700 font-semibold">GA / GK</div>
                  <div className="py-1.5 text-blue-700 font-semibold">Quantitative</div>
                  <div className="py-1.5 text-emerald-700 font-semibold">English</div>
                </div>
                <div className="w-[95px] shrink-0 px-2 py-1.5 text-center text-slate-700 font-semibold">
                  Score
                </div>
                <div className="w-[165px] shrink-0 px-2 py-1.5 text-center text-slate-700 font-semibold">
                  Practice
                </div>
              </div>

              {/* List Rows */}
              <div className="divide-y divide-slate-200/80">
                {filteredReports.map((report) => {
                  const dateClean = new Date(report.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                  const { shortTitle, platform, subtitle } = parseMockDetails(report);

                  return (
                    <div
                      key={report.id}
                      className="flex flex-col xl:flex-row items-stretch divide-y xl:divide-y-0 xl:divide-x divide-slate-200/90 hover:bg-slate-50/40 transition-colors"
                    >
                      {/* 1. Left: Mock Details & Stats */}
                      <div className="w-full xl:w-[245px] 2xl:w-[265px] shrink-0 px-3 py-2 bg-slate-50/20 flex flex-col justify-center">
                        {/* Line 1: Short Title + Platform Badge + Score */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-black text-slate-900 truncate" title={report.title}>
                              {shortTitle}
                            </span>
                            <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0 border ${
                              platform.toLowerCase() === 'oliveboard'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {platform}
                            </span>
                          </div>
                          <div className="flex items-baseline shrink-0 ml-1.5">
                            <span className="text-xs font-black text-slate-900">{report.totalScore}</span>
                            <span className="text-[10px] font-semibold text-slate-400">/{report.maxMarks || 200}</span>
                          </div>
                        </div>

                        {/* Line 2: Subtitle • Date */}
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate font-medium">
                          <span>{subtitle}</span>
                          <span>•</span>
                          <span>{dateClean}</span>
                        </div>

                        {/* Line 3: 70c • 16w • 14s */}
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1 flex-wrap">
                          <span className="text-emerald-600 font-bold">{report.totalCorrect}c</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-rose-500 font-bold">{report.totalWrong}w</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 font-bold">{report.totalUnattempted}s</span>
                        </div>
                      </div>

                      {/* 2. Middle: Four Subjects */}
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/90">
                        {[
                          { key: 'reasoning', label: 'Reasoning', color: 'text-indigo-700', bg: 'bg-indigo-50/15 hover:bg-indigo-50/40' },
                          { key: 'generalAwareness', label: 'GA / GK', color: 'text-amber-700', bg: 'bg-amber-50/15 hover:bg-amber-50/40' },
                          { key: 'mathematics', label: 'Quantitative', color: 'text-blue-700', bg: 'bg-blue-50/15 hover:bg-blue-50/40' },
                          { key: 'english', label: 'English', color: 'text-emerald-700', bg: 'bg-emerald-50/15 hover:bg-emerald-50/40' },
                        ].map((sub) => {
                          const sData = report.sections?.[sub.key as keyof typeof report.sections];
                          if (!sData) return null;
                          const score = sData ? sData.score : 0;
                          const acc = sData ? sData.accuracy : 0;
                          const mistakeCount = (sData?.wrong || 0) + (sData?.unattempted || 0);

                          return (
                            <div
                              key={sub.key}
                              onClick={() => openPracticeModal(report, sub.label)}
                              className={`px-2.5 py-1.5 flex items-center justify-between gap-1.5 transition-all cursor-pointer hover:ring-1 hover:ring-indigo-400/60 group ${sub.bg}`}
                              title={`Click to practice ${sub.label} mistakes (${mistakeCount} total: ${sData?.wrong || 0} wrong, ${sData?.unattempted || 0} skipped)`}
                            >
                              <div>
                                <span className={`text-[10px] font-bold ${sub.color} block xl:hidden leading-tight`}>
                                  {sub.label}
                                </span>
                                <div className="flex items-baseline gap-0.5">
                                  <span className="text-xs font-bold text-slate-900 leading-none">{score}</span>
                                  <span className="text-[10px] text-slate-400">/50</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {mistakeCount > 0 && (
                                  <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200">
                                    {mistakeCount}
                                  </span>
                                )}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  acc >= 85 ? 'bg-emerald-100 text-emerald-800' :
                                  acc >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {acc}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 3. Total Score Column */}
                      <div className="w-full xl:w-[95px] shrink-0 px-2.5 py-1.5 bg-slate-50/20 flex xl:flex-col justify-between xl:justify-center items-center xl:items-start">
                        <div className="flex items-baseline gap-0.5 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-900 leading-none">
                            {report.totalScore}
                          </span>
                          <span className="text-[10px] text-slate-400">/{report.maxMarks}</span>
                        </div>
                        <span className={`text-[10px] font-semibold mt-0.5 ${
                          report.overallAccuracy >= 85 ? 'text-emerald-600' :
                          report.overallAccuracy >= 70 ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {report.overallAccuracy}% Acc
                        </span>
                      </div>

                      {/* 4. Action Column */}
                      <div className="w-full xl:w-[305px] shrink-0 px-2.5 py-1.5 bg-slate-50/20 flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleReviewMock(report)}
                          disabled={reviewingId === report.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200/90 rounded-lg shadow-2xs transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-95"
                          title="Review all questions, view solutions & classify root causes (RCA)"
                        >
                          {reviewingId === report.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                          <span>Review</span>
                        </button>

                        <button
                          onClick={() => openPracticeModal(report, 'all')}
                          disabled={practicingId === report.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200/90 rounded-lg shadow-2xs transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-95"
                          title="Practice mistakes section-wise (slow, incorrect, unattempted)"
                        >
                          {practicingId === report.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-2.5 h-2.5 fill-current" />
                          )}
                          <span>Practice Mock</span>
                        </button>

                        <button
                          onClick={() => handleAskAiMock(report)}
                          disabled={askingAiId === report.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-600 hover:text-white border border-violet-200/90 rounded-lg shadow-2xs transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-95"
                          title="Ask Tommy AI to analyze this mock's mistakes and score"
                        >
                          {askingAiId === report.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-violet-500 fill-violet-500/20" />
                          )}
                          <span>Ask AI</span>
                        </button>

                        <button
                          onClick={() => handleDeleteMock(report.id)}
                          className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                          title="Delete this record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── SECTION-WISE PRACTICE MODAL (Compact, Crisp & Sleek) ─── */}
      <AnimatePresence>
        {practiceModalReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight">Practice Mock Mistakes</h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {practiceModalReport.title} • {practiceModalReport.totalWrong + practiceModalReport.totalUnattempted} total errors
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPracticeModalReport(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-3.5 space-y-3">
                {/* 1. Select Section to Practice */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      1. Select Section
                    </label>
                    <span className="text-[10px] text-indigo-600 font-medium">
                      Mistakes &amp; leaks only
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { key: 'Reasoning', label: 'Reasoning', icon: Brain, color: 'text-indigo-600', stats: modalStats?.reasoning },
                      { key: 'General Awareness', label: 'GA / GK', icon: Compass, color: 'text-amber-600', stats: modalStats?.generalAwareness },
                      { key: 'Mathematics', label: 'Quantitative', icon: Calculator, color: 'text-blue-600', stats: modalStats?.mathematics },
                      { key: 'English', label: 'English', icon: BookOpen, color: 'text-emerald-600', stats: modalStats?.english },
                    ].map((sec) => {
                      const isSelected = practiceSection === sec.key;
                      const Icon = sec.icon;
                      const count = sec.stats?.total || 0;

                      return (
                        <button
                          key={sec.key}
                          type="button"
                          onClick={() => setPracticeSection(sec.key)}
                          className={`p-2 rounded-xl border text-left transition-all relative ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-500/30'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Icon className={`w-3.5 h-3.5 ${sec.color}`} />
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              count > 0 ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {count} err
                            </span>
                          </div>
                          <div className="font-bold text-xs text-slate-900 leading-tight truncate">{sec.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                            <span>{sec.stats?.wrong || 0}w</span>
                            <span>•</span>
                            <span>{sec.stats?.unattempted || 0}s</span>
                            {(sec.stats?.slow || 0) > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600">{sec.stats?.slow} slow</span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* All Sections Combined Option */}
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => setPracticeSection('all')}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                        practiceSection === 'all'
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500/30'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>All 4 Sections Combined (Mistakes Only)</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                        {modalStats?.all?.total || 0} Total Mistakes
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. Filter Error Types */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    2. Filter Error Type
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'all', label: 'All Mistakes', count: activeSectionStats?.total ?? 0 },
                      { id: 'wrong', label: '❌ Wrong', count: activeSectionStats?.wrong ?? 0 },
                      { id: 'unattempted', label: '⏸ Skipped', count: activeSectionStats?.unattempted ?? 0 },
                      { id: 'slow', label: '⏱ Slow', count: activeSectionStats?.slow ?? 0 },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPracticeErrorFilter(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                          practiceErrorFilter === f.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                          practiceErrorFilter === f.id
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {f.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Choose Mode (Practice vs Mock Test) */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    3. Choose Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalQuizMode('practice')}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        modalQuizMode === 'practice'
                          ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-500/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                          Practice Mode
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          Instant Ans
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                        Instant answer &amp; solution upon click. No timer pressure.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalQuizMode('mock')}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        modalQuizMode === 'mock'
                          ? 'border-rose-600 bg-rose-50/70 ring-1 ring-rose-500/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-rose-600" />
                          Mock Test Mode
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                          Timed
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                        Countdown timer active (36s/Q). Answers &amp; score revealed only at the end.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Status Notice if 0 matching questions */}
                {activeSectionCount === 0 && (
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>0 mistake questions for this filter in {practiceSection}. 100% accuracy! 🎉</span>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setPracticeModalReport(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleStartFilteredPractice}
                  disabled={activeSectionCount === 0 || practicingId !== null}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white rounded-lg shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    modalQuizMode === 'mock'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {practicingId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Start {modalQuizMode === 'mock' ? 'Mock Test' : 'Practice'} ({activeSectionCount} Qs)</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

