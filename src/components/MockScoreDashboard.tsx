import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  Trash2,
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
  Eye,
  CheckCircle2,
  Table,
  Activity,
  Edit3,
  Percent,
  Award
} from 'lucide-react';
import { MockScoreReport, SectionScore } from '../types/mockScore';
import { Chapter, Question, SubjectData, QuizResult, QuestionProgress } from '../types';
import { normalizeTopicTitle } from '../utils/topicDetector';
import initialMockReports from '../data/mock_reports.json';
import { safeStorage } from '../utils/safeStorage';
import { syncMockReports, LEGACY_MOCK_ID_MAP, normalizeTestTitle, getDeletedMockIds, addDeletedMockId } from '../utils/syncMockReports';
import { clearCachedData } from '../utils/cache';
import { openAiWithScope } from '../utils/aiScopeHelper';
import { AiFocusedQuestion } from '../types/aiScope';

const LOCAL_STORAGE_KEY = 'cgl_mock_score_reports';
const mockQuestionModules = import.meta.glob('../data/mock_questions/*.json');

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
  const [selectedSectionalSubject, setSelectedSectionalSubject] = useState<'Mathematics' | 'Reasoning' | 'English' | 'General Awareness'>('Mathematics');
  const [reports, setReports] = useState<MockScoreReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'score_flow'>('table');
  const [flowSubject, setFlowSubject] = useState<'overall' | 'reasoning' | 'mathematics' | 'english' | 'generalAwareness'>('overall');
  const [flowMetric, setFlowMetric] = useState<'score' | 'accuracy'>('score');
  const [activeNodeIndex, setActiveNodeIndex] = useState<number | null>(null);

  // Dynamic Targets for Marks and Accuracy (persisted in safeStorage)
  const [targetScoreFull, setTargetScoreFull] = useState<number>(() => {
    const saved = safeStorage.getItem('cgl_target_score_full');
    return saved ? Number(saved) || 135 : 135;
  });
  const [targetScoreSectionalMap, setTargetScoreSectionalMap] = useState<Record<string, number>>(() => {
    const defaultSec = Number(safeStorage.getItem('cgl_target_score_sectional')) || 38;
    return {
      mathematics: Number(safeStorage.getItem('cgl_target_score_sectional_mathematics')) || defaultSec,
      reasoning: Number(safeStorage.getItem('cgl_target_score_sectional_reasoning')) || defaultSec,
      english: Number(safeStorage.getItem('cgl_target_score_sectional_english')) || defaultSec,
      generalAwareness: Number(safeStorage.getItem('cgl_target_score_sectional_generalAwareness')) || defaultSec,
      overall: defaultSec
    };
  });

  const [targetAccuracyFull, setTargetAccuracyFull] = useState<number>(() => {
    const saved = safeStorage.getItem('cgl_target_accuracy_full');
    return saved ? Number(saved) || 85 : 85;
  });
  const [targetAccuracySectionalMap, setTargetAccuracySectionalMap] = useState<Record<string, number>>(() => {
    const defaultAcc = Number(safeStorage.getItem('cgl_target_accuracy_sectional')) || 85;
    return {
      mathematics: Number(safeStorage.getItem('cgl_target_accuracy_sectional_mathematics')) || defaultAcc,
      reasoning: Number(safeStorage.getItem('cgl_target_accuracy_sectional_reasoning')) || defaultAcc,
      english: Number(safeStorage.getItem('cgl_target_accuracy_sectional_english')) || defaultAcc,
      generalAwareness: Number(safeStorage.getItem('cgl_target_accuracy_sectional_generalAwareness')) || defaultAcc,
      overall: defaultAcc
    };
  });
  const [editingTargetType, setEditingTargetType] = useState<'score' | 'accuracy' | null>(null);
  const [targetInputVal, setTargetInputVal] = useState<string>('');

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
    const deletedIds = getDeletedMockIds();
    const clean = newReports.filter(r => r && r.id && !deletedIds.has(r.id));
    setReports(clean);
    try {
      safeStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clean));
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
    return reports.filter(r => r.type === 'sectional' && getSectionalSubject(r) === selectedSectionalSubject);
  }, [reports, activeTab, selectedSectionalSubject]);



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

  // ─── SCORE FLOW & ANALYTICS COMPUTATIONS ───
  const chronologicalReports = useMemo(() => {
    return [...filteredReports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredReports]);

  const flowAnalytics = useMemo(() => {
    if (chronologicalReports.length === 0) {
      return {
        initialScore: 0,
        latestScore: 0,
        scoreDelta: 0,
        initialAccuracy: 0,
        projectedAccuracy: 0,
        accuracyDelta: 0,
        peakReport: null as MockScoreReport | null,
        strongestSubject: 'English',
        strongestAcc: 0,
        volatileSubject: 'Quantitative',
        volatileAcc: 0,
        subjectStats: {
          reasoning: { avgScore: 0, avgAcc: 0, delta: 0, status: 'Strong & Consistent', sparkline: '' },
          mathematics: { avgScore: 0, avgAcc: 0, delta: 0, status: 'Needs Speed', sparkline: '' },
          english: { avgScore: 0, avgAcc: 0, delta: 0, status: 'Mastered Benchmark', sparkline: '' },
          generalAwareness: { avgScore: 0, avgAcc: 0, delta: 0, status: 'Revise Core', sparkline: '' }
        }
      };
    }

    const first = chronologicalReports[0];
    const latest = chronologicalReports[chronologicalReports.length - 1];
    const scoreDelta = Math.round((latest.totalScore - first.totalScore) * 10) / 10;
    const accuracyDelta = Math.round((latest.overallAccuracy - first.overallAccuracy) * 10) / 10;

    let peakReport: MockScoreReport = chronologicalReports[0];
    chronologicalReports.forEach(r => {
      if (r.totalScore > peakReport.totalScore) {
        peakReport = r;
      }
    });

    const subKeys: Array<{ key: 'reasoning' | 'mathematics' | 'english' | 'generalAwareness'; label: string; subjectName: string }> = [
      { key: 'reasoning', label: 'Reasoning', subjectName: 'Reasoning' },
      { key: 'mathematics', label: 'Quantitative', subjectName: 'Mathematics' },
      { key: 'english', label: 'English', subjectName: 'English' },
      { key: 'generalAwareness', label: 'GA / GK', subjectName: 'General Awareness' }
    ];

    const subjectStats: Record<string, { avgScore: number; avgAcc: number; delta: number; status: string; sparkline: string }> = {};

    let highestAcc = -1;
    let strongestSub = 'English';
    let lowestAcc = 999;
    let volatileSub = 'Quantitative';

    subKeys.forEach(({ key, label, subjectName }) => {
      const scores: number[] = [];
      const accs: number[] = [];

      chronologicalReports.forEach(r => {
        const sec = r.sections?.[key];
        if (sec && (sec.score !== undefined || sec.total > 0)) {
          scores.push(sec.score);
          accs.push(sec.accuracy ?? 0);
        } else if (r.type === 'sectional' && getSectionalSubject(r) === subjectName) {
          scores.push(r.totalScore);
          accs.push(r.overallAccuracy ?? 0);
        }
      });

      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
      const avgAcc = accs.length > 0 ? Math.round((accs.reduce((a, b) => a + b, 0) / accs.length) * 10) / 10 : 0;

      if (avgAcc > highestAcc && scores.length > 0) {
        highestAcc = avgAcc;
        strongestSub = label;
      }
      if (avgAcc < lowestAcc && avgAcc > 0) {
        lowestAcc = avgAcc;
        volatileSub = label;
      }

      let delta = 0;
      if (scores.length >= 2) {
        const mid = Math.floor(scores.length / 2);
        const firstHalf = scores.slice(0, mid);
        const secondHalf = scores.slice(mid);
        const avg1 = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
        const avg2 = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
        delta = Math.round((avg2 - avg1) * 10) / 10;
      }

      let status = 'Strong & Consistent';
      if (avgScore >= 35) {
        status = key === 'english' ? 'Mastered Benchmark (80%+)' : 'Strong & Consistent';
      } else if (avgScore >= 25) {
        status = 'High Potential • Needs Speed';
      } else {
        status = key === 'generalAwareness' ? 'Revise Current Affairs' : 'Revise Core Concepts';
      }

      // Generate 160x36 sparkline path
      const sparklinePoints: Array<{ x: number; y: number }> = [];
      if (scores.length > 0) {
        const minS = 0;
        const maxS = 50;
        scores.forEach((s, idx) => {
          const x = Math.round((scores.length === 1 ? 0.5 : idx / (scores.length - 1)) * 160);
          const y = Math.round(30 - ((s - minS) / (maxS - minS || 1)) * 24);
          sparklinePoints.push({ x, y: Math.max(4, Math.min(32, y)) });
        });
      }

      const sparkline = sparklinePoints.reduce((accStr, p, idx) => {
        return idx === 0 ? `M ${p.x} ${p.y}` : `${accStr} L ${p.x} ${p.y}`;
      }, '');

      subjectStats[key] = {
        avgScore,
        avgAcc,
        delta,
        status,
        sparkline
      };
    });

    return {
      initialScore: first.totalScore,
      latestScore: latest.totalScore,
      scoreDelta,
      initialAccuracy: first.overallAccuracy,
      projectedAccuracy: latest.overallAccuracy,
      accuracyDelta,
      peakReport,
      strongestSubject: strongestSub,
      strongestAcc: highestAcc,
      volatileSubject: volatileSub,
      volatileAcc: lowestAcc,
      subjectStats: subjectStats as {
        reasoning: { avgScore: number; avgAcc: number; delta: number; status: string; sparkline: string };
        mathematics: { avgScore: number; avgAcc: number; delta: number; status: string; sparkline: string };
        english: { avgScore: number; avgAcc: number; delta: number; status: string; sparkline: string };
        generalAwareness: { avgScore: number; avgAcc: number; delta: number; status: string; sparkline: string };
      }
    };
  }, [chronologicalReports]);

  // Sectional vs Full scaling helpers & Dynamic Target
  const isSectionalScale = activeTab === 'sectional' || flowSubject !== 'overall' || aggregateStats.maxMarks <= 50;

  const activeSubjectKey = useMemo(() => {
    if (activeTab === 'sectional') {
      const map: Record<string, string> = {
        Mathematics: 'mathematics',
        Reasoning: 'reasoning',
        English: 'english',
        'General Awareness': 'generalAwareness'
      };
      return map[selectedSectionalSubject] || 'mathematics';
    }
    return flowSubject;
  }, [activeTab, selectedSectionalSubject, flowSubject]);

  const currentScoreTarget = useMemo(() => {
    if (!isSectionalScale && flowSubject === 'overall') {
      return targetScoreFull;
    }
    return targetScoreSectionalMap[activeSubjectKey] ?? 38;
  }, [isSectionalScale, flowSubject, targetScoreFull, targetScoreSectionalMap, activeSubjectKey]);

  const currentAccTarget = useMemo(() => {
    if (!isSectionalScale && flowSubject === 'overall') {
      return targetAccuracyFull;
    }
    return targetAccuracySectionalMap[activeSubjectKey] ?? 85;
  }, [isSectionalScale, flowSubject, targetAccuracyFull, targetAccuracySectionalMap, activeSubjectKey]);

  const currentTarget = flowMetric === 'accuracy' ? currentAccTarget : currentScoreTarget;
  const currentTargetMax = flowMetric === 'accuracy' ? 100 : (isSectionalScale ? 50 : 200);
  const currentTargetMin = 1;

  const commitTargetScore = (inputNum?: number) => {
    const val = inputNum !== undefined ? inputNum : parseInt(targetInputVal, 10);
    const maxScore = isSectionalScale ? 50 : 200;
    if (!isNaN(val) && val > 0) {
      const clamped = Math.max(1, Math.min(maxScore, val));
      if (!isSectionalScale && flowSubject === 'overall') {
        setTargetScoreFull(clamped);
        safeStorage.setItem('cgl_target_score_full', String(clamped));
      } else {
        setTargetScoreSectionalMap(prev => ({ ...prev, [activeSubjectKey]: clamped }));
        safeStorage.setItem(`cgl_target_score_sectional_${activeSubjectKey}`, String(clamped));
        safeStorage.setItem('cgl_target_score_sectional', String(clamped));
      }
    }
    setEditingTargetType(null);
  };

  const commitTargetAccuracy = (inputNum?: number) => {
    const val = inputNum !== undefined ? inputNum : parseInt(targetInputVal, 10);
    if (!isNaN(val) && val > 0) {
      const clamped = Math.max(1, Math.min(100, val));
      if (!isSectionalScale && flowSubject === 'overall') {
        setTargetAccuracyFull(clamped);
        safeStorage.setItem('cgl_target_accuracy_full', String(clamped));
      } else {
        setTargetAccuracySectionalMap(prev => ({ ...prev, [activeSubjectKey]: clamped }));
        safeStorage.setItem(`cgl_target_accuracy_sectional_${activeSubjectKey}`, String(clamped));
        safeStorage.setItem('cgl_target_accuracy_sectional', String(clamped));
      }
    }
    setEditingTargetType(null);
  };

  const peakReportId = flowAnalytics.peakReport?.id;

  // Dynamic coordinates for SVG Score Flow Progression Curve
  const chartPoints = useMemo(() => {
    if (chronologicalReports.length === 0) return [];

    const minX = 100;
    const maxX = 865;
    const minY = 50;
    const maxY = 250;

    const subMap: Record<string, string> = {
      reasoning: 'Reasoning',
      mathematics: 'Mathematics',
      english: 'English',
      generalAwareness: 'General Awareness'
    };

    return chronologicalReports.map((r, i) => {
      const x = Math.round(minX + (chronologicalReports.length === 1 ? 0.5 : i / (chronologicalReports.length - 1)) * (maxX - minX));
      let val = 0;
      if (flowSubject === 'overall') {
        val = flowMetric === 'score' ? r.totalScore : r.overallAccuracy;
      } else {
        const sec = r.sections?.[flowSubject as keyof typeof r.sections];
        if (sec && (sec.score !== undefined || sec.total > 0)) {
          val = flowMetric === 'score' ? sec.score : sec.accuracy;
        } else if (r.type === 'sectional') {
          if (getSectionalSubject(r) === subMap[flowSubject]) {
            val = flowMetric === 'score' ? r.totalScore : r.overallAccuracy;
          } else {
            val = 0;
          }
        }
      }

      const minVal = flowMetric === 'accuracy' ? 0 : (isSectionalScale ? 0 : 30);
      const maxVal = flowMetric === 'accuracy' ? 100 : (isSectionalScale ? 50 : 200);
      const normalized = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
      const y = Math.round(maxY - normalized * (maxY - minY));

      const { shortTitle } = parseMockDetails(r);

      return {
        x,
        y,
        val,
        report: r,
        shortTitle,
        isPeak: peakReportId === r.id
      };
    });
  }, [chronologicalReports, flowSubject, flowMetric, peakReportId, isSectionalScale]);

  const chartCurvePath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    return chartPoints.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = arr[i - 1];
      const cp1x = prev.x + (p.x - prev.x) / 2;
      const cp1y = prev.y;
      const cp2x = prev.x + (p.x - prev.x) / 2;
      const cp2y = p.y;
      return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
    }, '');
  }, [chartPoints]);

  const chartAreaPath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    const lastX = chartPoints[chartPoints.length - 1].x;
    const firstX = chartPoints[0].x;
    return `${chartCurvePath} L ${lastX} 260 L ${firstX} 260 Z`;
  }, [chartPoints, chartCurvePath]);


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

    // 1. Direct Vite dynamic module lookup for all candidate IDs in mock_questions
    for (const cid of candidateIds) {
      const qData = await tryModulePath(`../data/mock_questions/${cid}.json`);
      if (qData) { list = qData; break; }
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

    // Filter out deleted questions
    try {
      const deletedRaw = safeStorage.getItem('cgl_deleted_question_ids');
      if (deletedRaw) {
        const deletedArr: string[] = JSON.parse(deletedRaw);
        if (Array.isArray(deletedArr) && deletedArr.length > 0) {
          const deletedSet = new Set(deletedArr.map(s => String(s).trim().toLowerCase()));
          list = list.filter(item => {
            const t = (item.question || item.questionText || item.qText || '').trim().toLowerCase();
            const id = item.id ? String(item.id).trim().toLowerCase() : '';
            return !deletedSet.has(t) && (!id || !deletedSet.has(id));
          });
        }
      }
    } catch {}

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
          rcaReason: item.rca?.reason || item.rcaReason || undefined,
          sourceType: report.type === 'sectional' ? 'sectional' : 'full_mock',
          sourceLabel: report.type === 'sectional' ? `Sectional Test: ${report.title}` : `Full Mock Test: ${report.title}`,
          testName: report.title
        };
      });

      const sectionTitle = targetSection && targetSection !== 'all' ? ` (${targetSection})` : '';

      openAiWithScope({
        type: 'mock',
        title: `${report.title}${sectionTitle}`,
        subject: report.type === 'sectional' ? getSectionalSubject(report) : undefined,
        sourceScope: report.type === 'sectional' ? 'sectional' : 'full_mock',
        sourceScopeLabel: report.type === 'sectional' ? `Sectional Test: ${report.title}` : `Full Mock Test: ${report.title}`,
        testName: report.title,
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
    addDeletedMockId(id);
    try {
      await fetch(`/api/mock-reports/${id}`, { method: 'DELETE' });
    } catch {}
    try {
      safeStorage.removeItem(`cgl_mock_questions_${id}`);
    } catch {}
    try {
      await clearCachedData();
    } catch {}
    const updated = reports.filter(r => r.id !== id);
    saveReports(updated);
  };

  const handleClearAll = async () => {
    if (filteredReports.length === 0) return;
    const label = activeTab === 'full' ? 'Full' : `${selectedSectionalSubject} Sectional`;
    if (!window.confirm(`Are you sure you want to clear all ${filteredReports.length} ${label} Mock records?`)) return;
    const idsToRemove = new Set<string>(filteredReports.map(r => String(r.id)));
    for (const id of idsToRemove) {
      addDeletedMockId(String(id));
      try {
        await fetch(`/api/mock-reports/${id}`, { method: 'DELETE' });
      } catch {}
      try {
        safeStorage.removeItem(`cgl_mock_questions_${id}`);
      } catch {}
    }
    try {
      await clearCachedData();
    } catch {}
    const updated = reports.filter(r => !idsToRemove.has(r.id));
    saveReports(updated);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">

      {/* ─── Minimalist Subheader & Mode Toggle ─── */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 shadow-xs">
        {/* Left Title & Context */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer shrink-0"
              type="button"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0 shadow-xs">
            {viewMode === 'score_flow' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <Trophy className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
                {viewMode === 'score_flow' ? 'Score Flow & Analytics' : 'Mock Score Dashboard'}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono uppercase tracking-wider font-semibold shrink-0">
                CAT / SSC
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate max-w-xl">
              {viewMode === 'score_flow'
                ? 'Historical score trajectories, progression momentum, and subject-wise accuracy distribution across mock attempts.'
                : 'Real exam score calculation, negative marking & subject accuracy'}
            </p>
          </div>
        </div>

        {/* Right Toggles: Full vs Sectional AND Table View vs Score Flow (Always in one line) */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap self-stretch sm:self-auto overflow-x-auto pb-0.5 sm:pb-0">
          {/* Scope Toggle: Full Mock vs Sectional */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs font-medium shrink-0">
            <button
              onClick={() => {
                setActiveTab('full');
                setFlowSubject('overall');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'full'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              type="button"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Full Mock</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('sectional');
                if (flowSubject === 'overall') {
                  setFlowSubject('mathematics');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'sectional'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              type="button"
            >
              <Target className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Sectional</span>
            </button>
          </div>

          {/* View Switcher: Table View vs Score Flow */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs font-medium shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              type="button"
            >
              <Table className="w-3.5 h-3.5 shrink-0" />
              <span>Table View</span>
            </button>
            <button
              onClick={() => setViewMode('score_flow')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'score_flow'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              type="button"
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Score Flow</span>
            </button>
          </div>
        </div>
      </section>

      {/* Subject Filter Toolbar for Sectional Mocks */}
      {activeTab === 'sectional' && (
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Subject View:
            </span>
            {[
              { id: 'Mathematics', label: 'Quantitative (Math)', icon: Calculator, flowKey: 'mathematics', count: sectionalSubjectCounts.Mathematics, color: 'text-blue-600', activeClass: 'bg-blue-600 text-white shadow-xs' },
              { id: 'Reasoning', label: 'Reasoning', icon: Brain, flowKey: 'reasoning', count: sectionalSubjectCounts.Reasoning, color: 'text-indigo-600', activeClass: 'bg-indigo-600 text-white shadow-xs' },
              { id: 'English', label: 'English', icon: BookOpen, flowKey: 'english', count: sectionalSubjectCounts.English, color: 'text-emerald-600', activeClass: 'bg-emerald-600 text-white shadow-xs' },
              { id: 'General Awareness', label: 'GA / GK', icon: Compass, flowKey: 'generalAwareness', count: sectionalSubjectCounts['General Awareness'], color: 'text-amber-600', activeClass: 'bg-amber-600 text-white shadow-xs' },
            ].map((tab) => {
              const isSelected = selectedSectionalSubject === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedSectionalSubject(tab.id as any);
                    setFlowSubject(tab.flowKey as any);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? tab.activeClass
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-slate-50 border border-slate-200/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : tab.color}`} />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filteredReports.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl p-8 text-center border border-slate-200 shadow-xs max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto border border-blue-100">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              No {activeTab === 'full' ? 'Full Mock' : `${selectedSectionalSubject} Sectional`} Scores Yet
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeTab === 'sectional'
                ? `No ${selectedSectionalSubject} sectional mock tests recorded.`
                : 'No mock tests found for this view.'}
            </p>
          </div>
        </div>
      ) : viewMode === 'score_flow' ? (
        <div className="space-y-5">
          {/* ─── Top KPI / Momentum Metrics Row (Compact ~80px Standard) ─── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3" data-purpose="stat-metrics">
            {/* Card 1: Overall Trajectory */}
            <article className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    Trajectory
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
                      {latestReport ? latestReport.totalScore : 0}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 font-mono">/ {aggregateStats.maxMarks}</span>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                  Goal: {currentTarget}{flowMetric === 'accuracy' ? '%' : ''}+ benchmark
                </p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1 text-emerald-600 font-bold font-mono">
                  <TrendingUp className="w-3 h-3" />
                  <span>{flowAnalytics.scoreDelta >= 0 ? `+${flowAnalytics.scoreDelta}` : flowAnalytics.scoreDelta} pts</span>
                </div>
                <span className="text-slate-400 font-mono">{chronologicalReports.length} verified mocks</span>
              </div>
            </article>

            {/* Card 2: Projected Accuracy */}
            <article className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Projected Accuracy
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black tracking-tight text-emerald-600 leading-none">
                      {flowAnalytics.projectedAccuracy}%
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 font-mono">
                      {flowAnalytics.accuracyDelta >= 0 ? `+${flowAnalytics.accuracyDelta}%` : `${flowAnalytics.accuracyDelta}%`}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                  Strongest: <strong className="text-slate-700 font-medium">{flowAnalytics.strongestSubject} ({flowAnalytics.strongestAcc}%)</strong>
                </p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">Volatile: {flowAnalytics.volatileSubject}</span>
                <span className="text-amber-700 font-bold font-mono">{flowAnalytics.volatileAcc}%</span>
              </div>
            </article>

            {/* Card 3: Peak Momentum */}
            <article className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                    Peak Momentum
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black tracking-tight text-purple-700 leading-none">
                      {flowAnalytics.peakReport ? flowAnalytics.peakReport.totalScore : 0}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 font-mono">/ {aggregateStats.maxMarks}</span>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                  {flowAnalytics.peakReport ? parseMockDetails(flowAnalytics.peakReport).shortTitle : 'No peak test logged'}
                </p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">High-water mark</span>
                <span className="text-purple-700 font-bold font-mono">TOP TIER</span>
              </div>
            </article>
          </section>

          {/* ─── Interactive Score Progression Curve Section ─── */}
          <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs relative">
            {/* Section Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 gap-3 border-b border-slate-100">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Score Progression Curve
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracking aggregate score fluctuations and benchmark cutoffs across last {chronologicalReports.length} verified tests.
                </p>
              </div>

              {/* Subject Filters, Metric Switcher & Targets Toolbar (Strictly in ONE line) */}
              <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 max-w-full flex-nowrap">
                <div className="flex items-center gap-2 flex-nowrap shrink-0">
                  {/* Metric Switch Chips: Marks vs Accuracy % */}
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 gap-1 shrink-0">
                    <button
                      onClick={() => setFlowMetric('score')}
                      type="button"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        flowMetric === 'score'
                          ? 'bg-white text-blue-700 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{flowSubject === 'overall' ? (activeTab === 'full' ? 'Marks /200' : 'Marks /50') : 'Marks /50'}</span>
                    </button>
                    <button
                      onClick={() => setFlowMetric('accuracy')}
                      type="button"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        flowMetric === 'accuracy'
                          ? 'bg-blue-600 text-white shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5 shrink-0" />
                      <span>Accuracy %</span>
                    </button>
                  </div>

                  <div className="h-5 w-px bg-slate-200 hidden sm:block mx-0.5 shrink-0"></div>

                  {/* Subject Filters Chips */}
                  <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                    {(activeTab === 'full'
                      ? [
                          { id: 'overall', label: 'Overall', dot: '' },
                          { id: 'reasoning', label: 'Reasoning', dot: 'bg-indigo-600' },
                          { id: 'mathematics', label: 'Quantitative', dot: 'bg-blue-600' },
                          { id: 'english', label: 'English', dot: 'bg-emerald-600' },
                          { id: 'generalAwareness', label: 'GA / GK', dot: 'bg-amber-600' },
                        ]
                      : [
                          { id: 'mathematics', label: 'Quantitative (Math)', dot: 'bg-blue-600', sub: 'Mathematics' as const },
                          { id: 'reasoning', label: 'Reasoning', dot: 'bg-indigo-600', sub: 'Reasoning' as const },
                          { id: 'english', label: 'English', dot: 'bg-emerald-600', sub: 'English' as const },
                          { id: 'generalAwareness', label: 'GA / GK', dot: 'bg-amber-600', sub: 'General Awareness' as const },
                        ]
                    ).map((chip) => {
                      const isSelected = activeTab === 'sectional'
                        ? selectedSectionalSubject === (chip as any).sub
                        : flowSubject === chip.id;
                      return (
                        <button
                          key={chip.id}
                          onClick={() => {
                            setFlowSubject(chip.id as any);
                            if (activeTab === 'sectional' && (chip as any).sub) {
                              setSelectedSectionalSubject((chip as any).sub);
                            }
                          }}
                          type="button"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200'
                          }`}
                        >
                          {chip.dot && <span className={`w-2 h-2 rounded-full ${chip.dot}`}></span>}
                          <span>{chip.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Dynamic Targets Widget (Both Score & Accuracy in ONE line) */}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50/90 border border-rose-200 text-xs font-mono font-semibold text-rose-700 shadow-xs shrink-0 whitespace-nowrap">
                    {/* Score Target Segment */}
                    <div className="flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="text-[11px] text-slate-500 font-sans font-medium">Score:</span>
                      {editingTargetType === 'score' ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            commitTargetScore();
                          }}
                          className="flex items-center gap-1"
                        >
                          <input
                            type="number"
                            min={1}
                            max={isSectionalScale ? 50 : 200}
                            value={targetInputVal}
                            onChange={(e) => setTargetInputVal(e.target.value)}
                            onBlur={() => commitTargetScore()}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingTargetType(null);
                            }}
                            autoFocus
                            className="w-12 px-1 py-0.5 bg-white text-rose-900 border border-rose-300 rounded text-center text-xs font-bold outline-none focus:ring-1 focus:ring-rose-500"
                          />
                          <span className="text-slate-400 font-bold">/{isSectionalScale ? 50 : 200}</span>
                          <button
                            type="submit"
                            className="p-0.5 rounded text-rose-600 hover:text-rose-900 hover:bg-rose-100 cursor-pointer"
                            title="Save target score"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTargetType('score');
                            setTargetInputVal(String(currentScoreTarget));
                          }}
                          className="hover:underline flex items-center gap-0.5 text-rose-700 font-bold cursor-pointer"
                          title={`Click to edit target score (out of ${isSectionalScale ? 50 : 200})`}
                        >
                          <span>{currentScoreTarget}/{isSectionalScale ? 50 : 200}</span>
                          <Edit3 className="w-2.5 h-2.5 text-rose-500 opacity-70 hover:opacity-100 ml-0.5" />
                        </button>
                      )}
                    </div>

                    <div className="h-3.5 w-px bg-rose-200"></div>

                    {/* Accuracy Target Segment */}
                    <div className="flex items-center gap-1">
                      <Percent className="w-3 h-3 text-rose-500 shrink-0" />
                      <span className="text-[11px] text-slate-500 font-sans font-medium">Acc:</span>
                      {editingTargetType === 'accuracy' ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            commitTargetAccuracy();
                          }}
                          className="flex items-center gap-1"
                        >
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={targetInputVal}
                            onChange={(e) => setTargetInputVal(e.target.value)}
                            onBlur={() => commitTargetAccuracy()}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingTargetType(null);
                            }}
                            autoFocus
                            className="w-12 px-1 py-0.5 bg-white text-rose-900 border border-rose-300 rounded text-center text-xs font-bold outline-none focus:ring-1 focus:ring-rose-500"
                          />
                          <span className="text-slate-400 font-bold">%</span>
                          <button
                            type="submit"
                            className="p-0.5 rounded text-rose-600 hover:text-rose-900 hover:bg-rose-100 cursor-pointer"
                            title="Save target accuracy %"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTargetType('accuracy');
                            setTargetInputVal(String(currentAccTarget));
                          }}
                          className="hover:underline flex items-center gap-0.5 text-rose-700 font-bold cursor-pointer"
                          title="Click to edit target accuracy % (out of 100%)"
                        >
                          <span>{currentAccTarget}%</span>
                          <Edit3 className="w-2.5 h-2.5 text-rose-500 opacity-70 hover:opacity-100 ml-0.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SVG Chart Canvas */}
            <div className="relative w-full overflow-x-auto select-none pt-4 pb-2">
              <div className="min-w-[760px] relative">
                {(() => {
                  const targetScaleMin = flowMetric === 'accuracy' ? 0 : (isSectionalScale ? 0 : 30);
                  const targetScaleMax = flowMetric === 'accuracy' ? 100 : (isSectionalScale ? 50 : 200);
                  const targetNorm = Math.max(0, Math.min(1, (currentTarget - targetScaleMin) / (targetScaleMax - targetScaleMin || 1)));
                  const targetY = Math.round(250 - targetNorm * (250 - 50));

                  return (
                    <svg
                      className="w-full h-72 overflow-visible cursor-crosshair"
                      fill="none"
                      viewBox="0 0 920 320"
                      xmlns="http://www.w3.org/2000/svg"
                      onClick={(e) => {
                        if (chartPoints.length === 0) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickSvgX = ((e.clientX - rect.left) / rect.width) * 920;
                        let closestIdx = 0;
                        let minDiff = Infinity;
                        chartPoints.forEach((p, idx) => {
                          const diff = Math.abs(p.x - clickSvgX);
                          if (diff < minDiff) {
                            minDiff = diff;
                            closestIdx = idx;
                          }
                        });
                        setActiveNodeIndex(closestIdx);
                      }}
                    >
                      <defs>
                        <linearGradient id="scoreAreaGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18"></stop>
                          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0"></stop>
                        </linearGradient>
                      </defs>

                      {/* Top Benchmark Gridline */}
                      <line stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" x1="60" x2="900" y1="30" y2="30"></line>
                      <text fill="#94a3b8" fontFamily="monospace" fontSize="11" textAnchor="end" x="50" y="34">
                        {flowMetric === 'accuracy' ? '100%' : (isSectionalScale ? '50' : '200')}
                      </text>

                      {/* Dynamic Target Cutoff Line (Marks or Accuracy) */}
                      <g className="transition-all duration-300">
                        <line opacity="0.75" stroke="#e11d48" strokeDasharray="6 4" strokeWidth="1.2" x1="60" x2="900" y1={targetY} y2={targetY}></line>
                        <text fill="#e11d48" fontFamily="monospace" fontSize="11" fontWeight="600" textAnchor="end" x="50" y={targetY + 4}>
                          {currentTarget}{flowMetric === 'accuracy' ? '%' : ''}
                        </text>
                        <rect fill="#ffe4e6" height="20" opacity="0.95" rx="4" width={flowMetric === 'accuracy' ? 140 : 130} x={flowMetric === 'accuracy' ? 755 : 765} y={Math.max(10, targetY - 10)}></rect>
                        <text fill="#be123c" fontSize="11" fontWeight="600" textAnchor="middle" x={flowMetric === 'accuracy' ? 825 : 830} y={Math.max(24, targetY + 4)}>
                          Target Cutoff ({currentTarget}{flowMetric === 'accuracy' ? '%' : ''})
                        </text>
                      </g>

                      {/* Safe Zone: for full mock score only */}
                      {!isSectionalScale && flowMetric === 'score' && (
                        <>
                          <line opacity="0.6" stroke="#059669" strokeDasharray="4 4" strokeWidth="1" x1="60" x2="900" y1="144" y2="144"></line>
                          <text fill="#059669" fontFamily="monospace" fontSize="11" fontWeight="600" textAnchor="end" x="50" y="148">120</text>
                          <rect fill="#ecfdf5" height="20" opacity="0.9" rx="4" width="94" x="70" y="134"></rect>
                          <text fill="#047857" fontSize="11" fontWeight="600" textAnchor="middle" x="117" y="148">Safe Zone (120)</text>
                        </>
                      )}

                      {/* Baseline Cutoff */}
                      <line opacity="0.5" stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" x1="60" x2="900" y1="185" y2="185"></line>
                      <text fill="#94a3b8" fontFamily="monospace" fontSize="11" textAnchor="end" x="50" y="189">
                        {flowMetric === 'accuracy' ? '60%' : (isSectionalScale ? '25' : '95')}
                      </text>
                      <text fill="#94a3b8" fontSize="11" textAnchor="end" x="900" y="181">
                        {flowMetric === 'accuracy' ? 'Average Accuracy (~70%)' : (isSectionalScale ? 'Subject Benchmark (25)' : 'Category Baseline (~95)')}
                      </text>

                      {/* Bottom Scale Line */}
                      <line stroke="#e2e8f0" strokeWidth="1" x1="60" x2="900" y1="260" y2="260"></line>
                      <text fill="#94a3b8" fontFamily="monospace" fontSize="11" textAnchor="end" x="50" y="264">
                        {flowMetric === 'accuracy' ? '0%' : (isSectionalScale ? '0' : '30')}
                      </text>

                      {/* Area Path Under Curve */}
                      {chartAreaPath && (
                        <path d={chartAreaPath} fill="url(#scoreAreaGradient)"></path>
                      )}

                      {/* Main Curve - Fast CSS drop-shadow instead of SVG filter for 0 lag */}
                      {chartCurvePath && (
                        <path
                          d={chartCurvePath}
                          stroke="#2563eb"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3.5"
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(37, 99, 235, 0.25))' }}
                        ></path>
                      )}

                      {/* Vertical Guides and Node Points */}
                      {chartPoints.map((p, idx) => {
                        const isSelected = activeNodeIndex === idx;
                        return (
                          <g
                            key={p.report.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveNodeIndex(idx);
                            }}
                            className="cursor-pointer group"
                          >
                            {/* Guide line */}
                            <line
                              stroke={isSelected ? '#2563eb' : '#e2e8f0'}
                              strokeDasharray={isSelected ? '3 3' : '2 2'}
                              strokeWidth={isSelected ? '1.5' : '1'}
                              x1={p.x}
                              x2={p.x}
                              y1={p.y}
                              y2="260"
                              className="pointer-events-none"
                            ></line>

                            {/* Halo ring on active selection - completely stable, no jitter */}
                            {isSelected && (
                              <circle
                                cx={p.x}
                                cy={p.y}
                                fill="#3b82f6"
                                fillOpacity="0.18"
                                r="10"
                                className="pointer-events-none"
                              ></circle>
                            )}

                            {/* Solid Data Node Point - NO CSS transforms, no hover shake */}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              fill={p.isPeak ? '#2563eb' : isSelected ? '#1d4ed8' : '#ffffff'}
                              r={isSelected ? 6 : p.isPeak ? 5.5 : 4.5}
                              stroke={isSelected || p.isPeak ? '#ffffff' : '#2563eb'}
                              strokeWidth={isSelected ? 2.5 : 2}
                              className="pointer-events-none transition-colors duration-150 group-hover:stroke-blue-600"
                            ></circle>

                            {/* X-Axis Attempt Number (Clean 1, 2, 3...) */}
                            <text
                              fill={isSelected ? '#1d4ed8' : '#475569'}
                              fontSize="11"
                              fontWeight={isSelected || p.isPeak ? '700' : '600'}
                              textAnchor="middle"
                              x={p.x}
                              y="285"
                              className="pointer-events-none font-mono select-none"
                            >
                              {idx + 1}{p.isPeak ? '★' : ''}
                            </text>

                            {/* X-Axis Score Value */}
                            <text
                              fill={p.isPeak ? '#2563eb' : isSelected ? '#1d4ed8' : '#64748b'}
                              fontFamily="monospace"
                              fontSize="10"
                              fontWeight={isSelected || p.isPeak ? '700' : '500'}
                              textAnchor="middle"
                              x={p.x}
                              y="302"
                              className="pointer-events-none select-none"
                            >
                              {p.val}
                            </text>

                            {/* Invisible wide hit circle positioned LAST to cleanly capture pointer events without shaking */}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="20"
                              fill="transparent"
                              className="cursor-pointer"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}

                {/* Interactive Tooltip Card for Selected / Active Node with Dismiss Cross (X) */}
                {activeNodeIndex !== null && chartPoints[activeNodeIndex] && (() => {
                  const selectedPoint = chartPoints[activeNodeIndex];
                  const dateClean = new Date(selectedPoint.report.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                  const leftPercent = Math.max(16, Math.min(84, (selectedPoint.x / 920) * 100));

                  return (
                    <div
                      style={{ left: `${leftPercent}%` }}
                      className="absolute -top-3 -translate-x-1/2 w-76 p-4 rounded-xl bg-white shadow-xl border border-slate-200 pointer-events-auto z-20 transition-all animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="flex items-start justify-between pb-2 border-b border-slate-100 gap-2">
                        <div>
                          <span className="font-mono text-[11px] text-slate-400">{dateClean}</span>
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="truncate max-w-[140px]">{selectedPoint.shortTitle}</span>
                            {selectedPoint.isPeak && <span className="text-emerald-600 text-xs font-semibold shrink-0">● Peak</span>}
                          </h4>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="text-right">
                            <span className="text-base font-extrabold text-blue-600">{selectedPoint.report.totalScore}</span>
                            <span className="font-mono text-[11px] text-slate-400">/{selectedPoint.report.maxMarks}</span>
                            <div className="text-[10px] font-mono text-emerald-600 font-semibold">{selectedPoint.report.overallAccuracy}% Acc</div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveNodeIndex(null);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
                            title="Close mock details"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Subject breakdown in tooltip: handles both sectional and full mock */}
                      {selectedPoint.report.type === 'sectional' ? (
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1.5 font-mono text-xs my-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium font-sans">Section:</span>
                            <span className="font-bold text-slate-900">{getSectionalSubject(selectedPoint.report)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/70">
                            <span className="text-emerald-600 font-semibold">{selectedPoint.report.totalCorrect} Correct</span>
                            <span className="text-rose-500 font-semibold">{selectedPoint.report.totalWrong} Wrong</span>
                            <span className="text-slate-400 font-medium">{selectedPoint.report.totalUnattempted} Skipped</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5 pt-2 text-xs font-mono">
                          <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            <span className="text-slate-500 text-[11px]">Reasoning</span>
                            <span className="font-bold text-slate-900 text-[11px]">
                              {selectedPoint.report.sections?.reasoning?.score ?? 0} <span className="text-emerald-600 text-[10px] font-semibold">{selectedPoint.report.sections?.reasoning?.accuracy ?? 0}%</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            <span className="text-slate-500 text-[11px]">Quant</span>
                            <span className="font-bold text-slate-900 text-[11px]">
                              {selectedPoint.report.sections?.mathematics?.score ?? 0} <span className="text-blue-600 text-[10px] font-semibold">{selectedPoint.report.sections?.mathematics?.accuracy ?? 0}%</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            <span className="text-slate-500 text-[11px]">English</span>
                            <span className="font-bold text-slate-900 text-[11px]">
                              {selectedPoint.report.sections?.english?.score ?? 0} <span className="text-emerald-600 text-[10px] font-semibold">{selectedPoint.report.sections?.english?.accuracy ?? 0}%</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            <span className="text-slate-500 text-[11px]">GA / GK</span>
                            <span className="font-bold text-slate-900 text-[11px]">
                              {selectedPoint.report.sections?.generalAwareness?.score ?? 0} <span className="text-amber-600 text-[10px] font-semibold">{selectedPoint.report.sections?.generalAwareness?.accuracy ?? 0}%</span>
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                        <button
                          onClick={() => handleReviewMock(selectedPoint.report)}
                          type="button"
                          className="flex-1 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-center transition-colors cursor-pointer"
                        >
                          Review Attempt
                        </button>
                        <button
                          onClick={() => openPracticeModal(selectedPoint.report, selectedPoint.report.type === 'sectional' ? getSectionalSubject(selectedPoint.report) : 'all')}
                          type="button"
                          className="flex-1 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-center transition-colors cursor-pointer"
                        >
                          Practice Errors
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </section>

          {/* ─── Subject-Wise Velocity & Health (4 Cards) ─── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Subject-Wise Velocity &amp; Health</h3>
                <p className="text-xs text-slate-500">Granular sectional trend lines isolating growth levers from persistent drags.</p>
              </div>
              <span className="text-xs font-mono text-slate-500 font-medium">
                Target Avg: ≥{targetScoreSectionalMap[activeSubjectKey] ?? targetScoreSectionalMap.overall ?? 38}.0 / 50
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {/* 1. Reasoning */}
              <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">Reasoning</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono border ${
                      flowAnalytics.subjectStats.reasoning.delta >= 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {flowAnalytics.subjectStats.reasoning.delta >= 0 ? `+${flowAnalytics.subjectStats.reasoning.delta}%` : `${flowAnalytics.subjectStats.reasoning.delta}%`}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-extrabold text-slate-900 leading-none">
                      {flowAnalytics.subjectStats.reasoning.avgScore}
                    </span>
                    <span className="text-xs font-mono text-slate-400">/ 50</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{flowAnalytics.subjectStats.reasoning.status}</span>
                  </p>
                </div>
                {/* Micro Sparkline */}
                <div className="py-1 mt-1">
                  <svg className="w-full h-7 overflow-visible" fill="none" viewBox="0 0 160 28">
                    <path d={flowAnalytics.subjectStats.reasoning.sparkline} stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Acc: {flowAnalytics.subjectStats.reasoning.avgAcc}%</span>
                  <span>Avg: {flowAnalytics.subjectStats.reasoning.avgScore}/50</span>
                </div>
              </div>

              {/* 2. Quantitative */}
              <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">Quantitative</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono border ${
                      flowAnalytics.subjectStats.mathematics.delta >= 0
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {flowAnalytics.subjectStats.mathematics.delta >= 0 ? `+${flowAnalytics.subjectStats.mathematics.delta}%` : `${flowAnalytics.subjectStats.mathematics.delta}%`}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-extrabold text-slate-900 leading-none">
                      {flowAnalytics.subjectStats.mathematics.avgScore}
                    </span>
                    <span className="text-xs font-mono text-slate-400">/ 50</span>
                  </div>
                  <p className="text-[11px] text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>{flowAnalytics.subjectStats.mathematics.status}</span>
                  </p>
                </div>
                {/* Micro Sparkline */}
                <div className="py-1 mt-1">
                  <svg className="w-full h-7 overflow-visible" fill="none" viewBox="0 0 160 28">
                    <path d={flowAnalytics.subjectStats.mathematics.sparkline} stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Acc: {flowAnalytics.subjectStats.mathematics.avgAcc}%</span>
                  <span>Avg: {flowAnalytics.subjectStats.mathematics.avgScore}/50</span>
                </div>
              </div>

              {/* 3. English */}
              <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">English</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono border ${
                      flowAnalytics.subjectStats.english.delta >= 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {flowAnalytics.subjectStats.english.delta >= 0 ? `+${flowAnalytics.subjectStats.english.delta}%` : `${flowAnalytics.subjectStats.english.delta}%`}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-extrabold text-slate-900 leading-none">
                      {flowAnalytics.subjectStats.english.avgScore}
                    </span>
                    <span className="text-xs font-mono text-slate-400">/ 50</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{flowAnalytics.subjectStats.english.status}</span>
                  </p>
                </div>
                {/* Micro Sparkline */}
                <div className="py-1 mt-1">
                  <svg className="w-full h-7 overflow-visible" fill="none" viewBox="0 0 160 28">
                    <path d={flowAnalytics.subjectStats.english.sparkline} stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Acc: {flowAnalytics.subjectStats.english.avgAcc}%</span>
                  <span>Avg: {flowAnalytics.subjectStats.english.avgScore}/50</span>
                </div>
              </div>

              {/* 4. GA / GK */}
              <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">GA / GK</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono border ${
                      flowAnalytics.subjectStats.generalAwareness.delta >= 0
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {flowAnalytics.subjectStats.generalAwareness.delta >= 0 ? `+${flowAnalytics.subjectStats.generalAwareness.delta}%` : `${flowAnalytics.subjectStats.generalAwareness.delta}%`}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-extrabold text-slate-900 leading-none">
                      {flowAnalytics.subjectStats.generalAwareness.avgScore}
                    </span>
                    <span className="text-xs font-mono text-slate-400">/ 50</span>
                  </div>
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{flowAnalytics.subjectStats.generalAwareness.status}</span>
                  </p>
                </div>
                {/* Micro Sparkline */}
                <div className="py-1 mt-1">
                  <svg className="w-full h-7 overflow-visible" fill="none" viewBox="0 0 160 28">
                    <path d={flowAnalytics.subjectStats.generalAwareness.sparkline} stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Acc: {flowAnalytics.subjectStats.generalAwareness.avgAcc}%</span>
                  <span>Avg: {flowAnalytics.subjectStats.generalAwareness.avgScore}/50</span>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Bottom Navigation Strip ─── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs text-slate-500">
            <button
              onClick={() => setViewMode('table')}
              type="button"
              className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Switch to Raw Attempts Table ({filteredReports.length} recorded mocks)</span>
            </button>
            <div className="flex items-center gap-3">
              <span>
                Last test synced: {latestReport ? new Date(latestReport.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'None'}
              </span>
              <span>•</span>
              <span className="font-semibold text-slate-700">Minimalist Analytics Engine</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ─── TOP STAT CARDS (Compact ~80px Standard) ─── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3" data-purpose="stat-metrics">
            {/* 1. Latest Score Card */}
            <article className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    {activeTab === 'sectional' ? `${selectedSectionalSubject} Latest` : 'Latest Score'}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
                      {latestReport ? latestReport.totalScore : 0}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 font-mono">/ {aggregateStats.maxMarks}</span>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight font-mono">
                  {latestReport ? `${latestReport.totalCorrect} Correct • ${latestReport.totalWrong} Wrong • ${latestReport.totalUnattempted} Skipped` : 'No mock recorded yet'}
                </p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">Status: {latestReport ? 'Recorded' : 'Awaiting'}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                  LATEST TEST
                </span>
              </div>
            </article>

            {/* 2. Overall Accuracy Card */}
            <article className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    (latestReport?.overallAccuracy || 0) >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    (latestReport?.overallAccuracy || 0) >= 65 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                  }`}>
                    {activeTab === 'sectional' ? `${selectedSectionalSubject} Accuracy` : 'Overall Accuracy'}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-base sm:text-lg font-black tracking-tight leading-none ${
                      (latestReport?.overallAccuracy || 0) >= 80 ? 'text-emerald-600' :
                      (latestReport?.overallAccuracy || 0) >= 65 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {latestReport ? latestReport.overallAccuracy : 0}%
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 font-mono">(Avg: {aggregateStats.avgAccuracy}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (latestReport?.overallAccuracy || 0) >= 80 ? 'bg-emerald-500' :
                      (latestReport?.overallAccuracy || 0) >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, latestReport?.overallAccuracy || aggregateStats.avgAccuracy))}%` }}
                  />
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">Target: ≥85%</span>
                <span className={`font-bold ${
                  (latestReport?.overallAccuracy || 0) >= 80 ? 'text-emerald-600' :
                  (latestReport?.overallAccuracy || 0) >= 65 ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {(latestReport?.overallAccuracy || 0) >= 80 ? 'Elite Accuracy' : (latestReport?.overallAccuracy || 0) >= 65 ? 'Good Progress' : 'Needs Review'}
                </span>
              </div>
            </article>

            {/* 3. Best Score Card */}
            <article className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                    {activeTab === 'sectional' ? `${selectedSectionalSubject} Best` : 'Best Score'}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black tracking-tight text-purple-700 leading-none">
                      {aggregateStats.bestScore}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 font-mono">/ {aggregateStats.maxMarks}</span>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                  Across {aggregateStats.totalMocks} {activeTab === 'full' ? 'Full Mocks' : `${selectedSectionalSubject} Sectionals`}
                </p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">All-time record</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700">
                  RECORD
                </span>
              </div>
            </article>
          </section>

          {/* ─── SECTIONAL MOCKS LIST (BY SELECTED SUBJECT) ─── */}
          {activeTab === 'sectional' ? (
            /* ─── SINGLE SUBJECT SECTIONAL TABLE ─── */
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" data-purpose="sectional-scores-table">
              {/* Section Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    {selectedSectionalSubject} Sectional Attempts
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {filteredReports.length}
                  </span>
                </div>

                {filteredReports.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
                    type="button"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear {selectedSectionalSubject} Mocks
                  </button>
                )}
              </div>

              {/* Responsive Aligned Sectional Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[880px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                      <th className="py-3.5 px-4 font-semibold align-middle w-[34%]" scope="col">Sectional Attempt</th>
                      <th className="py-3.5 px-4 font-semibold text-center align-middle w-[22%]" scope="col">Questions Breakdown</th>
                      <th className="py-3.5 px-4 font-semibold text-center align-middle w-[12%]" scope="col">Score</th>
                      <th className="py-3.5 px-4 font-semibold text-center align-middle w-[12%]" scope="col">Accuracy</th>
                      <th className="py-3.5 px-4 font-semibold text-center align-middle w-[20%]" scope="col">Practice &amp; Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredReports.map((report) => {
                      const dateClean = new Date(report.date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });
                      const { shortTitle, platform, subtitle } = parseMockDetails(report);
                      const isOlive = platform.toLowerCase() === 'oliveboard';
                      const sub = getSectionalSubject(report);
                      const subMeta = {
                        Mathematics: { label: 'Quantitative (Math)', icon: Calculator, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                        Reasoning: { label: 'Reasoning', icon: Brain, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
                        English: { label: 'English', icon: BookOpen, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                        'General Awareness': { label: 'GA / GK', icon: Compass, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
                      }[sub] || { label: sub, icon: Target, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' };
                      const SubIcon = subMeta.icon;

                      return (
                        <tr key={report.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* 1. Sectional Attempt details */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${subMeta.bg}`}>
                                <SubIcon className={`w-4 h-4 ${subMeta.color}`} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">{shortTitle}</span>
                                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded tracking-wide uppercase border shrink-0 ${
                                    isOlive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>
                                    {platform}
                                  </span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${subMeta.bg} ${subMeta.color}`}>
                                    {subMeta.label}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">{subtitle} • {dateClean}</div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Questions Breakdown */}
                          <td className="py-3.5 px-4 text-center align-middle">
                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                {report.totalCorrect} Correct
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                                {report.totalWrong} Wrong
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 whitespace-nowrap">
                                {report.totalUnattempted} Skipped
                              </span>
                            </div>
                          </td>

                          {/* 3. Score */}
                          <td className="py-3.5 px-4 text-center align-middle">
                            <div className="font-extrabold text-slate-900 text-base">
                              {report.totalScore} <span className="text-xs font-normal text-slate-400">/{report.maxMarks || 50}</span>
                            </div>
                          </td>

                          {/* 4. Accuracy */}
                          <td className="py-3.5 px-4 text-center align-middle">
                            <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${
                              report.overallAccuracy >= 80
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : report.overallAccuracy >= 65
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {report.overallAccuracy}%
                            </span>
                          </td>

                          {/* 5. Practice & Review Actions */}
                          <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <button
                                onClick={() => handleReviewMock(report)}
                                disabled={reviewingId === report.id}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                                title="Review all questions, solutions & root causes"
                                type="button"
                              >
                                {reviewingId === report.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                <span>Review</span>
                              </button>

                              <button
                                onClick={() => openPracticeModal(report, sub)}
                                disabled={practicingId === report.id}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                                title="Practice mistakes from this sectional mock"
                                type="button"
                              >
                                {practicingId === report.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3 h-3 fill-current" />
                                )}
                                <span>Practice</span>
                              </button>

                              <button
                                onClick={() => handleAskAiMock(report, sub)}
                                disabled={askingAiId === report.id}
                                className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                                title="Ask Tommy AI about this sectional mock's mistakes"
                                type="button"
                              >
                                {askingAiId === report.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                )}
                                <span>Ask AI</span>
                              </button>

                              <button
                                onClick={() => handleDeleteMock(report.id)}
                                className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors cursor-pointer shrink-0"
                                title="Delete this record"
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="px-5 py-3 border-t border-slate-100 text-center bg-slate-50/50">
                <span className="text-xs font-medium text-slate-500">
                  Showing {filteredReports.length} recorded {selectedSectionalSubject} sectional {filteredReports.length === 1 ? 'attempt' : 'attempts'}
                </span>
              </div>
            </div>
          ) : (
            /* ─── FULL MOCK ATTEMPTS (Minimalist Mock Score Dashboard Stitch Design) ─── */
            <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" data-purpose="mock-scores-table">
              {/* Section Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">Full Mock Attempts</h2>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {filteredReports.length}
                  </span>
                </div>
                {filteredReports.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
                    type="button"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                )}
              </div>

              {/* Responsive Minimalist Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[960px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                      <th className="py-3.5 px-4 font-semibold align-middle w-[26%]" scope="col">Mock Attempt</th>
                      <th className="py-3.5 px-3 font-semibold text-center text-blue-700 align-middle w-[11%]" scope="col">Reasoning</th>
                      <th className="py-3.5 px-3 font-semibold text-center text-amber-700 align-middle w-[11%]" scope="col">GA / GK</th>
                      <th className="py-3.5 px-3 font-semibold text-center text-indigo-700 align-middle w-[11%]" scope="col">Quantitative</th>
                      <th className="py-3.5 px-3 font-semibold text-center text-teal-700 align-middle w-[11%]" scope="col">English</th>
                      <th className="py-3.5 px-4 font-semibold text-center align-middle w-[12%]" scope="col">Score</th>
                      <th className="py-3.5 px-4 font-semibold text-center align-middle w-[18%]" scope="col">Practice &amp; Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredReports.map((report) => {
                      const dateClean = new Date(report.date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });
                      const { shortTitle, platform, subtitle } = parseMockDetails(report);
                      const isOlive = platform.toLowerCase() === 'oliveboard';

                      const reasoningData = report.sections?.reasoning;
                      const gaData = report.sections?.generalAwareness;
                      const quantData = report.sections?.mathematics;
                      const englishData = report.sections?.english;

                      return (
                        <tr key={report.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* 1. Mock Attempt details */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{shortTitle}</span>
                              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded tracking-wide uppercase border shrink-0 ${
                                isOlive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {platform}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{subtitle} • {dateClean}</div>
                            <div className="text-[11px] font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                              <span className="text-emerald-600 font-semibold">{report.totalCorrect}c</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-rose-500 font-semibold">{report.totalWrong}w</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-400">{report.totalUnattempted}s</span>
                            </div>
                          </td>

                          {/* 2. Reasoning */}
                          <td className="py-3.5 px-3 text-center align-middle">
                            <button
                              onClick={() => openPracticeModal(report, 'Reasoning')}
                              className="w-full text-center group cursor-pointer p-1.5 rounded-lg hover:bg-slate-100/70 transition-colors"
                              title={`Click to practice Reasoning mistakes (${(reasoningData?.wrong || 0) + (reasoningData?.unattempted || 0)} total)`}
                              type="button"
                            >
                              <div className="font-bold text-slate-900 text-sm">
                                {reasoningData?.score ?? 0} <span className="text-xs font-normal text-slate-400">/50</span>
                              </div>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                                (reasoningData?.accuracy ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                (reasoningData?.accuracy ?? 0) >= 65 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {reasoningData?.accuracy ?? 0}%
                              </span>
                            </button>
                          </td>

                          {/* 3. GA / GK */}
                          <td className="py-3.5 px-3 text-center align-middle">
                            <button
                              onClick={() => openPracticeModal(report, 'General Awareness')}
                              className="w-full text-center group cursor-pointer p-1.5 rounded-lg hover:bg-slate-100/70 transition-colors"
                              title={`Click to practice GA/GK mistakes (${(gaData?.wrong || 0) + (gaData?.unattempted || 0)} total)`}
                              type="button"
                            >
                              <div className="font-bold text-slate-900 text-sm">
                                {gaData?.score ?? 0} <span className="text-xs font-normal text-slate-400">/50</span>
                              </div>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                                (gaData?.accuracy ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                (gaData?.accuracy ?? 0) >= 65 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {gaData?.accuracy ?? 0}%
                              </span>
                            </button>
                          </td>

                          {/* 4. Quantitative */}
                          <td className="py-3.5 px-3 text-center align-middle">
                            <button
                              onClick={() => openPracticeModal(report, 'Mathematics')}
                              className="w-full text-center group cursor-pointer p-1.5 rounded-lg hover:bg-slate-100/70 transition-colors"
                              title={`Click to practice Quantitative mistakes (${(quantData?.wrong || 0) + (quantData?.unattempted || 0)} total)`}
                              type="button"
                            >
                              <div className="font-bold text-slate-900 text-sm">
                                {quantData?.score ?? 0} <span className="text-xs font-normal text-slate-400">/50</span>
                              </div>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                                (quantData?.accuracy ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                (quantData?.accuracy ?? 0) >= 65 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {quantData?.accuracy ?? 0}%
                              </span>
                            </button>
                          </td>

                          {/* 5. English */}
                          <td className="py-3.5 px-3 text-center align-middle">
                            <button
                              onClick={() => openPracticeModal(report, 'English')}
                              className="w-full text-center group cursor-pointer p-1.5 rounded-lg hover:bg-slate-100/70 transition-colors"
                              title={`Click to practice English mistakes (${(englishData?.wrong || 0) + (englishData?.unattempted || 0)} total)`}
                              type="button"
                            >
                              <div className="font-bold text-slate-900 text-sm">
                                {englishData?.score ?? 0} <span className="text-xs font-normal text-slate-400">/50</span>
                              </div>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                                (englishData?.accuracy ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                (englishData?.accuracy ?? 0) >= 65 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {englishData?.accuracy ?? 0}%
                              </span>
                            </button>
                          </td>

                          {/* 6. Score */}
                          <td className="py-3.5 px-4 text-center align-middle">
                            <div className="font-extrabold text-slate-900 text-base">
                              {report.totalScore} <span className="text-xs font-normal text-slate-400">/{report.maxMarks}</span>
                            </div>
                            <div className={`text-[11px] font-semibold mt-0.5 ${
                              report.overallAccuracy >= 80 ? 'text-emerald-600' :
                              report.overallAccuracy >= 65 ? 'text-amber-600' : 'text-rose-600'
                            }`}>
                              {report.overallAccuracy}% Acc
                            </div>
                          </td>

                          {/* 7. Actions (Review, Practice, Ask AI, Delete) */}
                          <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <button
                                onClick={() => handleReviewMock(report)}
                                disabled={reviewingId === report.id}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                                title="Review all questions, view solutions & root cause analysis"
                                type="button"
                              >
                                {reviewingId === report.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                <span>Review</span>
                              </button>

                              <button
                                onClick={() => openPracticeModal(report, 'all')}
                                disabled={practicingId === report.id}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                                title="Practice mistakes from this mock test"
                                type="button"
                              >
                                {practicingId === report.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3 h-3 fill-current" />
                                )}
                                <span>Practice</span>
                              </button>

                              <button
                                onClick={() => handleAskAiMock(report)}
                                disabled={askingAiId === report.id}
                                className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                                title="Ask Tommy AI to analyze this mock's mistakes and score"
                                type="button"
                              >
                                {askingAiId === report.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                )}
                                <span>Ask AI</span>
                              </button>

                              <button
                                onClick={() => handleDeleteMock(report.id)}
                                className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors cursor-pointer shrink-0"
                                title="Delete this record"
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="px-5 py-3 border-t border-slate-100 text-center bg-slate-50/50">
                <span className="text-xs font-medium text-slate-500">
                  Showing {filteredReports.length} recorded mock {filteredReports.length === 1 ? 'attempt' : 'attempts'}
                </span>
              </div>
            </section>
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
                      <span>Start {modalQuizMode === 'mock' ? 'Mock Test' : 'Practice'}</span>
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

