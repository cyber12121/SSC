import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Search, 
  ChevronRight, 
  X, 
  BarChart2,
  BookOpen,
  Calculator,
  Languages,
  Compass,
  Globe2,
  TrendingDown,
  Zap,
  Target,
  AlertCircle,
  HelpCircle,
  BrainCircuit,
  Check,
  Play,
  Sparkles
} from 'lucide-react';
import { SubjectData, Chapter, Question, RCAClassification, RCATagType } from '../types';
import { detectTopic, normalizeTopicTitle } from '../utils/topicDetector';
import { FormattedText } from './FormattedText';
import { cleanSolutionText } from '../utils/cleanSolution';
import { normalizeAnswerKey } from '../utils/mathSanitizer';
import { classifyTestType, TestScopeFilter } from '../utils/testClassifier';
import { safeStorage } from '../utils/safeStorage';
import { getDeletedMockIds } from '../utils/syncMockReports';

import { loadAllBundledMockQuestions, aggregateMockErrors } from '../utils/mockErrorAggregator';
import { openAiWithScope } from '../utils/aiScopeHelper';
import { AiFocusedQuestion } from '../types/aiScope';

interface ErrorHeatmapProps {
  mockData: SubjectData;
  onStartQuiz?: (chapter: Chapter) => void;
}

interface QuestionWithError extends Question {
  errorType: 'wrong' | 'unattempted' | 'speed_issue';
  detectedTopic: string;
  parentSubject: string;
  rcaClassification?: RCAClassification;
  sourceType?: 'full_mock' | 'sectional' | 'subject_wise';
  sourceLabel?: string;
  testName?: string;
}

interface ChapterHeatmapItem {
  topic: string;
  subject: string;
  totalErrors: number;
  wrongCount: number;
  unattemptedCount: number;
  speedIssueCount: number;
  negativeMarks: number;
  questions: QuestionWithError[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  marksRecovery?: number; // #4: Potential marks recoverable by fixing 60% of wrong Qs
  rcaCounts: {
    C: number;
    A: number;
    T: number;
    G: number;
    unclassified: number;
  };
}

const SUBJECT_CONFIG: Record<string, { icon: any; gradient: string; accent: string; light: string; pill: string; ring: string }> = {
  'Mathematics': {
    icon: Calculator,
    gradient: 'from-violet-600 to-indigo-600',
    accent: '#6d28d9',
    light: 'bg-violet-50',
    pill: 'bg-violet-100 text-violet-800',
    ring: 'ring-violet-400',
  },
  'Reasoning': {
    icon: Compass,
    gradient: 'from-purple-600 to-fuchsia-600',
    accent: '#9333ea',
    light: 'bg-purple-50',
    pill: 'bg-purple-100 text-purple-800',
    ring: 'ring-purple-400',
  },
  'English': {
    icon: Languages,
    gradient: 'from-emerald-500 to-teal-600',
    accent: '#059669',
    light: 'bg-emerald-50',
    pill: 'bg-emerald-100 text-emerald-800',
    ring: 'ring-emerald-400',
  },
  'General Awareness': {
    icon: Globe2,
    gradient: 'from-amber-500 to-orange-500',
    accent: '#d97706',
    light: 'bg-amber-50',
    pill: 'bg-amber-100 text-amber-800',
    ring: 'ring-amber-400',
  }
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', dot: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-700 border-red-200' },
  high:     { label: 'High',     dot: 'bg-orange-500', bar: 'bg-orange-500', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium:   { label: 'Medium',   dot: 'bg-amber-400',  bar: 'bg-amber-400',  text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  low:      { label: 'Low',      dot: 'bg-slate-300',  bar: 'bg-slate-300',  text: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const ErrorHeatmap: React.FC<ErrorHeatmapProps> = ({ mockData, onStartQuiz }) => {
  const [viewMode, setViewMode] = useState<'error_type' | 'rca'>('error_type');
  const [testScopeFilter, setTestScopeFilter] = useState<TestScopeFilter>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDrillChapter, setActiveDrillChapter] = useState<ChapterHeatmapItem | null>(null);
  const [modalRcaFilter, setModalRcaFilter] = useState<string>('all');
  const [editingNoteForQ, setEditingNoteForQ] = useState<string | null>(null);
  const [modalSillyNoteInput, setModalSillyNoteInput] = useState<string>('');
  const [bundledMockQuestions, setBundledMockQuestions] = useState<any[]>([]);
  const [rcaVersion, setRcaVersion] = useState(0);

  // Dynamic async load of bundled mock tests so errors from Full Tests appear in heatmap
  useEffect(() => {
    let active = true;
    loadAllBundledMockQuestions().then(all => {
      if (active) setBundledMockQuestions(all);
    });
    return () => { active = false; };
  }, [rcaVersion]);

  // Listen to RCA changes and mock updates for instant cross-component reactivity
  useEffect(() => {
    const handleRcaUpdated = () => setRcaVersion(v => v + 1);
    window.addEventListener('cgl_rca_updated', handleRcaUpdated);
    window.addEventListener('cgl_mock_reports_updated', handleRcaUpdated);
    window.addEventListener('storage', handleRcaUpdated);
    return () => {
      window.removeEventListener('cgl_rca_updated', handleRcaUpdated);
      window.removeEventListener('cgl_mock_reports_updated', handleRcaUpdated);
      window.removeEventListener('storage', handleRcaUpdated);
    };
  }, []);

  const { subjectGroups, allSubjects, totalOverallErrors, scopeCounts } = useMemo(() => {
    const aggregated = aggregateMockErrors({
      mockData,
      bundledQuestions: bundledMockQuestions,
      testScopeFilter
    });

    const canonicalSubjects = ['Mathematics', 'Reasoning', 'English', 'General Awareness'];
    const subjects = canonicalSubjects.filter(s => (aggregated.heatmapSubjectGroups[s]?.totalErrors || 0) > 0);
    if (subjects.length === 0) subjects.push(...canonicalSubjects);

    return {
      subjectGroups: aggregated.heatmapSubjectGroups as Record<string, {
        subject: string;
        totalErrors: number;
        totalWrong: number;
        totalUnattempted: number;
        totalSpeed: number;
        negativeMarks: number;
        rcaTotals: { C: number; A: number; T: number; G: number; unclassified: number };
        chapters: ChapterHeatmapItem[];
      }>,
      allSubjects: subjects,
      totalOverallErrors: aggregated.totalOverallErrors,
      scopeCounts: aggregated.overallScopeCounts
    };
  }, [mockData, bundledMockQuestions, rcaVersion, testScopeFilter]);

  const [activeSubject, setActiveSubject] = useState<string>(() => allSubjects[0] || 'Mathematics');

  const currentSubjectName = useMemo(() => {
    if (allSubjects.includes(activeSubject)) return activeSubject;
    return allSubjects[0] || 'Mathematics';
  }, [activeSubject, allSubjects]);

  const currentSubjectData = subjectGroups[currentSubjectName] || {
    subject: currentSubjectName, totalErrors: 0, totalWrong: 0,
    totalUnattempted: 0, totalSpeed: 0, negativeMarks: 0,
    rcaTotals: { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
    chapters: []
  };

  const filteredChapters = useMemo(() => {
    return currentSubjectData.chapters.filter(item => {
      if (viewMode === 'error_type') {
        if (selectedTypeFilter === 'wrong' && item.wrongCount === 0) return false;
        if (selectedTypeFilter === 'unattempted' && item.unattemptedCount === 0) return false;
        if (selectedTypeFilter === 'speed' && item.speedIssueCount === 0) return false;
      } else {
        if (selectedTypeFilter === 'C' && item.rcaCounts.C === 0) return false;
        if (selectedTypeFilter === 'A' && item.rcaCounts.A === 0) return false;
        if (selectedTypeFilter === 'T' && item.rcaCounts.T === 0) return false;
        if (selectedTypeFilter === 'G' && item.rcaCounts.G === 0) return false;
        if (selectedTypeFilter === 'unclassified' && item.rcaCounts.unclassified === 0) return false;
      }
      if (searchQuery.trim()) return item.topic.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    });
  }, [currentSubjectData, selectedTypeFilter, searchQuery, viewMode]);

  const handleClassifyQuestionInModal = (targetQ: QuestionWithError, tag: RCATagType, note?: string) => {
    const tagNames: Record<RCATagType, RCAClassification['tagName']> = {
      C: 'Conceptual Gap',
      A: 'Silly Mistake',
      T: 'Time / Ego Trap',
      G: 'Guesswork Failed'
    };

    const newRca: RCAClassification = {
      tag,
      tagName: tagNames[tag],
      sillyMistakeNote: tag === 'A' ? (note !== undefined ? note : (targetQ.rcaClassification?.sillyMistakeNote || '')) : undefined,
      classifiedAt: new Date().toISOString()
    };

    try {
      const globalRaw = safeStorage.getItem('cgl_rca_global_store');
      const globalStore: Record<string, any> = globalRaw ? JSON.parse(globalRaw) : {};
      const qId = targetQ.id || `${targetQ.parentSubject || 'mock'}_${targetQ.detectedTopic || 'topic'}`;
      const textNorm = targetQ.question ? targetQ.question.trim().toLowerCase() : '';

      const entry = {
        ...newRca,
        id: qId,
        subject: targetQ.parentSubject || targetQ.subject || 'General Awareness',
        topic: targetQ.detectedTopic || targetQ.tags?.topic || 'General',
        questionText: targetQ.question,
        options: targetQ.options,
        answer: targetQ.answer,
        solution: targetQ.solution,
        image: targetQ.image,
        status: targetQ.status || targetQ.errorType || 'wrong',
        errorType: targetQ.errorType || 'wrong',
        isCorrect: false
      };

      globalStore[qId] = entry;
      if (textNorm) globalStore[textNorm] = entry;
      safeStorage.setItem('cgl_rca_global_store', JSON.stringify(globalStore));

      // Dispatch update event for cross-component reactivity
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cgl_rca_updated', { detail: { qId, rca: newRca } }));
      }
    } catch {}

    // Update active drill chapter questions state immediately
    setActiveDrillChapter(prev => {
      if (!prev) return null;
      const updatedQuestions = prev.questions.map(q => {
        const match = q === targetQ || (q.question && q.question.trim().toLowerCase() === targetQ.question.trim().toLowerCase());
        if (match) {
          return {
            ...q,
            rcaClassification: newRca,
            rca: newRca
          };
        }
        return q;
      });
      return { ...prev, questions: updatedQuestions };
    });

    setRcaVersion(v => v + 1);
  };

  const handleStartDrillFromHeatmap = (
    topicName: string,
    questions: Question[],
    subTypeLabel?: string
  ) => {
    if (!onStartQuiz) return;
    if (!questions || questions.length === 0) {
      alert('No questions available to practice.');
      return;
    }
    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `${currentSubjectName} • ${topicName}${subTypeLabel ? ` (${subTypeLabel})` : ''}`,
      subject: currentSubjectName,
      subject_id: currentSubjectName.toLowerCase().replace(/\s+/g, '_'),
      questions: questions.map((q, idx) => ({ ...q, q_num: idx + 1 })),
      section: 'mockErrors',
      is_test: true,
    };
    onStartQuiz(virtualChapter);
  };

  const drillFilteredQuestions = useMemo(() => {
    if (!activeDrillChapter) return [];
    if (modalRcaFilter === 'all') return activeDrillChapter.questions;
    if (modalRcaFilter === 'unclassified') {
      return activeDrillChapter.questions.filter(q => !q.rcaClassification?.tag);
    }
    return activeDrillChapter.questions.filter(q => q.rcaClassification?.tag === modalRcaFilter);
  }, [activeDrillChapter, modalRcaFilter]);

  const maxErrors = filteredChapters.length > 0 ? filteredChapters[0].totalErrors : 1;
  const subjectCfg = SUBJECT_CONFIG[currentSubjectName] || SUBJECT_CONFIG['Mathematics'];
  const SubjectIcon = subjectCfg.icon;

  // Empty state
  if (totalOverallErrors === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-20 text-center">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shadow-lg shadow-indigo-100">
            <BarChart2 className="w-12 h-12 text-indigo-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-sm">
            <span className="text-white text-[10px] font-black">0</span>
          </div>
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">No Errors Recorded Yet</h2>
        <p className="text-slate-500 text-base max-w-md leading-relaxed mb-2">
          Your subject-wise weakness heatmap populates automatically as you take mock tests.
        </p>
        <p className="text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
          Sync results from the Chrome Extension to see your breakdown here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-4">

      {/* ─── Subject Tab Strip (Ultra-Compact Sleek Bar) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
        {allSubjects.map(subj => {
          const cfg = SUBJECT_CONFIG[subj] || SUBJECT_CONFIG['Mathematics'];
          const Icon = cfg.icon;
          const stats = subjectGroups[subj];
          const isActive = subj === currentSubjectName;

          return (
            <button
              key={subj}
              onClick={() => { setActiveSubject(subj); setSelectedTypeFilter('all'); setSearchQuery(''); }}
              className={`relative overflow-hidden rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 border flex items-center justify-between gap-2 ${
                isActive
                  ? 'bg-slate-900 border-slate-900 shadow-xs ring-1 ring-slate-900'
                  : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              {isActive && (
                <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-[0.14]`} />
              )}
              <div className="relative flex items-center gap-2 min-w-0">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  isActive
                    ? `bg-gradient-to-br ${cfg.gradient} shadow-xs`
                    : `${cfg.light}`
                }`}>
                  <Icon className={`w-3 h-3 ${isActive ? 'text-white' : ''}`} style={!isActive ? { color: cfg.accent } : {}} />
                </div>
                <div className="min-w-0">
                  <div className={`font-bold text-xs leading-none truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>{subj}</div>
                  <div className={`text-[9px] font-medium leading-tight mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    {stats?.chapters.length || 0} weak topics
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                isActive ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600 border border-red-100'
              }`}>
                {stats?.totalErrors || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Mode Switcher & Test Scope Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-xl border border-slate-200/80 px-3.5 py-2 shadow-xs gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
            {viewMode === 'rca' ? <Target className="w-3.5 h-3.5" /> : <BarChart2 className="w-3.5 h-3.5" />}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              {viewMode === 'rca' ? 'Root Cause Analysis (4-Bucket RCA)' : 'Mock Error Heatmap'}
            </span>
            <span className="text-[10px] text-slate-500">
              {viewMode === 'rca' 
                ? 'Categorized by: [C] Conceptual Gap, [A] Silly Mistake, [T] Time Trap, [G] Guesswork' 
                : 'Categorized by: Wrong, Skipped, and Slow questions'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Test Scope Filter (Combined / Full Tests / Sectional) */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setTestScopeFilter('all'); setSelectedTypeFilter('all'); }}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                testScopeFilter === 'all'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Combined view: all full and sectional test errors"
            >
              <span>Combined</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${testScopeFilter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                {scopeCounts.all}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setTestScopeFilter('full'); setSelectedTypeFilter('all'); }}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                testScopeFilter === 'full'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="View errors only from Full Mock Tests"
            >
              <span>Full Tests</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${testScopeFilter === 'full' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                {scopeCounts.full}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setTestScopeFilter('sectional'); setSelectedTypeFilter('all'); }}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                testScopeFilter === 'sectional'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="View errors only from Sectional Mock Tests"
            >
              <span>Sectional</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${testScopeFilter === 'sectional' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                {scopeCounts.sectional}
              </span>
            </button>
          </div>

          {/* Segmented Control (Error Type vs RCA) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => { setViewMode('error_type'); setSelectedTypeFilter('all'); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'error_type'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Error Type
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('rca'); setSelectedTypeFilter('all'); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'rca'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                  : 'text-purple-700 hover:text-purple-900'
              }`}
            >
              <Target className="w-3 h-3" />
              <span>RCA Mode (4-Bucket)</span>
            </button>
          </div>
        </div>
      </div>

      {totalOverallErrors === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            No {testScopeFilter === 'full' ? 'Full Test' : 'Sectional Test'} Errors Recorded
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            There are currently no recorded errors for this test category. Try viewing Combined errors to see all questions.
          </p>
          <button
            onClick={() => { setTestScopeFilter('all'); setSelectedTypeFilter('all'); }}
            className="mt-3.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            View Combined Errors ({scopeCounts.all})
          </button>
        </div>
      ) : (
        <>

      {/* ─── KPI Metric Bar (Compact Single-Row Cards) ─── */}
      {viewMode === 'error_type' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {/* Total Errors */}
          <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
              <AlertTriangle className="w-3 h-3 text-red-500" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 leading-none">{currentSubjectData.totalErrors}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Errors</div>
            </div>
          </div>

          {/* Negative Marks */}
          <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
              <TrendingDown className="w-3 h-3 text-rose-500" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-rose-600 leading-none">−{currentSubjectData.negativeMarks.toFixed(1)}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Neg. Marks</div>
            </div>
          </div>

          {/* Speed Issues */}
          <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
              <Clock className="w-3 h-3 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-amber-600 leading-none">{currentSubjectData.totalSpeed}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Speed Issues</div>
            </div>
          </div>

          {/* Skipped */}
          <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-orange-50 flex items-center justify-center shrink-0 border border-orange-100">
              <XCircle className="w-3 h-3 text-orange-500" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-orange-600 leading-none">{currentSubjectData.totalUnattempted}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Skipped</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {/* [C] Conceptual Gap */}
          <div className="bg-white rounded-lg border border-purple-200/80 px-2.5 py-1.5 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100">
                <span className="font-mono text-[11px] font-black text-purple-700">[C]</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-purple-700 leading-none">{currentSubjectData.rcaTotals.C}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">Concept Gap</div>
              </div>
            </div>
            {onStartQuiz && currentSubjectData.rcaTotals.C > 0 && (
              <button
                type="button"
                onClick={() => {
                  const cQs = currentSubjectData.chapters.flatMap(ch => ch.questions.filter(q => q.rcaClassification?.tag === 'C'));
                  handleStartDrillFromHeatmap('All Conceptual Gaps', cQs, '[C] Concept');
                }}
                className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
                title={`Practice all ${currentSubjectData.rcaTotals.C} conceptual gap questions`}
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Drill</span>
              </button>
            )}
          </div>

          {/* [A] Silly Mistake */}
          <div className="bg-white rounded-lg border border-rose-200/80 px-2.5 py-1.5 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                <span className="font-mono text-[11px] font-black text-rose-700">[A]</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-rose-700 leading-none">{currentSubjectData.rcaTotals.A}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">Silly Mistake</div>
              </div>
            </div>
            {onStartQuiz && currentSubjectData.rcaTotals.A > 0 && (
              <button
                type="button"
                onClick={() => {
                  const aQs = currentSubjectData.chapters.flatMap(ch => ch.questions.filter(q => q.rcaClassification?.tag === 'A'));
                  handleStartDrillFromHeatmap('All Silly Mistakes', aQs, '[A] Silly');
                }}
                className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
                title={`Practice all ${currentSubjectData.rcaTotals.A} silly mistake questions`}
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Drill</span>
              </button>
            )}
          </div>

          {/* [T] Time Trap */}
          <div className="bg-white rounded-lg border border-amber-200/80 px-2.5 py-1.5 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                <span className="font-mono text-[11px] font-black text-amber-700">[T]</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-amber-700 leading-none">{currentSubjectData.rcaTotals.T}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">Time Trap</div>
              </div>
            </div>
            {onStartQuiz && currentSubjectData.rcaTotals.T > 0 && (
              <button
                type="button"
                onClick={() => {
                  const tQs = currentSubjectData.chapters.flatMap(ch => ch.questions.filter(q => q.rcaClassification?.tag === 'T'));
                  handleStartDrillFromHeatmap('All Time Traps', tQs, '[T] Trap');
                }}
                className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
                title={`Practice all ${currentSubjectData.rcaTotals.T} time trap questions`}
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Drill</span>
              </button>
            )}
          </div>

          {/* [G] Guesswork */}
          <div className="bg-white rounded-lg border border-blue-200/80 px-2.5 py-1.5 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                <span className="font-mono text-[11px] font-black text-blue-700">[G]</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-blue-700 leading-none">{currentSubjectData.rcaTotals.G}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">Guesswork</div>
              </div>
            </div>
            {onStartQuiz && currentSubjectData.rcaTotals.G > 0 && (
              <button
                type="button"
                onClick={() => {
                  const gQs = currentSubjectData.chapters.flatMap(ch => ch.questions.filter(q => q.rcaClassification?.tag === 'G'));
                  handleStartDrillFromHeatmap('All Guesswork Failures', gQs, '[G] Guess');
                }}
                className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
                title={`Practice all ${currentSubjectData.rcaTotals.G} guesswork failure questions`}
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Drill</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Filters Row ─── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {viewMode === 'error_type' ? (
            [
              { id: 'all',         label: `All (${currentSubjectData.chapters.length})`, cls: 'bg-slate-900 text-white', idle: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { id: 'wrong',       label: 'Wrong',       cls: 'bg-red-600 text-white',    idle: 'bg-red-50 text-red-700 hover:bg-red-100' },
              { id: 'unattempted', label: 'Skipped',     cls: 'bg-orange-500 text-white', idle: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
              { id: 'speed',       label: 'Speed',       cls: 'bg-amber-500 text-white',  idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedTypeFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedTypeFilter === f.id ? f.cls + ' shadow-xs' : f.idle}`}
              >
                {f.label}
              </button>
            ))
          ) : (
            [
              { id: 'all',          label: `All (${currentSubjectData.chapters.length})`, cls: 'bg-slate-900 text-white', idle: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { id: 'C',            label: `[C] Concept (${currentSubjectData.rcaTotals.C})`, cls: 'bg-purple-600 text-white', idle: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200' },
              { id: 'A',            label: `[A] Silly (${currentSubjectData.rcaTotals.A})`, cls: 'bg-rose-600 text-white', idle: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' },
              { id: 'T',            label: `[T] Trap (${currentSubjectData.rcaTotals.T})`, cls: 'bg-amber-600 text-white', idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' },
              { id: 'G',            label: `[G] Guess (${currentSubjectData.rcaTotals.G})`, cls: 'bg-blue-600 text-white', idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' },
              { id: 'unclassified', label: `Unclassified (${currentSubjectData.rcaTotals.unclassified})`, cls: 'bg-slate-700 text-white', idle: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedTypeFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedTypeFilter === f.id ? f.cls + ' shadow-xs' : f.idle}`}
              >
                {f.label}
              </button>
            ))
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${currentSubjectName}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* ─── Heatmap Table ─── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Topic</div>
          <div className="col-span-3">Heat Bar</div>
          {viewMode === 'error_type' ? (
            <>
              <div className="col-span-1 text-center text-amber-600">Slow</div>
              <div className="col-span-1 text-center text-red-600">Wrong</div>
              <div className="col-span-1 text-center text-orange-500">Skip</div>
              <div className="col-span-1 text-right">Total</div>
            </>
          ) : (
            <>
              <div className="col-span-1 text-center text-purple-700 font-mono" title="[C] Conceptual Gap">[C]</div>
              <div className="col-span-1 text-center text-rose-700 font-mono" title="[A] Silly Mistake">[A]</div>
              <div className="col-span-1 text-center text-amber-700 font-mono" title="[T] Time / Ego Trap">[T]</div>
              <div className="col-span-1 text-center text-blue-700 font-mono" title="[G] Guesswork Failed">[G]</div>
            </>
          )}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {filteredChapters.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400 font-medium">
              No topics match the current filter.
            </div>
          )}

          {filteredChapters.map((item, idx) => {
            const sev = SEVERITY_CONFIG[item.severity];
            const barPct = Math.round((item.totalErrors / maxErrors) * 100);
            const isTop = idx < 3;

            return (
              <motion.div
                key={`${item.subject}-${item.topic}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                onClick={() => setActiveDrillChapter(item)}
                className="grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-slate-50/60 cursor-pointer transition-colors group"
              >
                {/* Rank */}
                <div className="col-span-1">
                  <span className={`w-4 h-4 rounded inline-flex items-center justify-center text-[10px] font-bold ${
                    isTop ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {idx + 1}
                  </span>
                </div>

                {/* Topic name + severity badge */}
                <div className="col-span-4 min-w-0 flex items-center gap-1.5">
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors truncate leading-tight">
                      {item.topic}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded border ${sev.badge}`}>
                        <span className={`w-1 h-1 rounded-full ${sev.dot}`} />
                        {sev.label}
                      </span>
                      {item.negativeMarks > 0 && (
                        <span className="text-[9px] font-bold text-rose-500">
                          −{item.negativeMarks.toFixed(1)}m
                        </span>
                      )}
                      {/* #4: Marks Recovery badge */}
                      {item.marksRecovery !== undefined && item.marksRecovery > 0 && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded" title={`Fixing 60% of wrong Qs here recovers ~${item.marksRecovery} marks`}>
                          +{item.marksRecovery}m ↑
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Heat bar */}
                <div className="col-span-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.03 }}
                      className={`h-full rounded-full ${sev.bar}`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 w-6 text-right">{barPct}%</span>
                </div>

                {viewMode === 'error_type' ? (
                  <>
                    {/* Slow */}
                    <div className="col-span-1 flex justify-center">
                      {item.speedIssueCount > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{item.speedIssueCount}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>

                    {/* Wrong */}
                    <div className="col-span-1 flex justify-center">
                      {item.wrongCount > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">{item.wrongCount}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>

                    {/* Skipped */}
                    <div className="col-span-1 flex justify-center">
                      {item.unattemptedCount > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">{item.unattemptedCount}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>

                    {/* Total + arrow */}
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        item.severity === 'critical' ? 'bg-red-600 text-white' :
                        item.severity === 'high'     ? 'bg-orange-500 text-white' :
                        item.severity === 'medium'   ? 'bg-amber-500 text-white' :
                                                       'bg-slate-700 text-white'
                      }`}>
                        {item.totalErrors}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* [C] Concept */}
                    <div className="col-span-1 flex justify-center">
                      {item.rcaCounts.C > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const cQs = item.questions.filter(q => q.rcaClassification?.tag === 'C');
                            handleStartDrillFromHeatmap(item.topic, cQs, '[C] Concept');
                          }}
                          className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-600 hover:text-white transition-colors cursor-pointer"
                          title={`Practice ${item.rcaCounts.C} [C] Concept questions for ${item.topic}`}
                        >
                          {item.rcaCounts.C}
                        </button>
                      ) : (
                        <span className="text-slate-200 text-xs">—</span>
                      )}
                    </div>

                    {/* [A] Silly */}
                    <div className="col-span-1 flex justify-center">
                      {item.rcaCounts.A > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const aQs = item.questions.filter(q => q.rcaClassification?.tag === 'A');
                            handleStartDrillFromHeatmap(item.topic, aQs, '[A] Silly');
                          }}
                          className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                          title={`Practice ${item.rcaCounts.A} [A] Silly mistake questions for ${item.topic}`}
                        >
                          {item.rcaCounts.A}
                        </button>
                      ) : (
                        <span className="text-slate-200 text-xs">—</span>
                      )}
                    </div>

                    {/* [T] Trap */}
                    <div className="col-span-1 flex justify-center">
                      {item.rcaCounts.T > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const tQs = item.questions.filter(q => q.rcaClassification?.tag === 'T');
                            handleStartDrillFromHeatmap(item.topic, tQs, '[T] Trap');
                          }}
                          className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                          title={`Practice ${item.rcaCounts.T} [T] Time trap questions for ${item.topic}`}
                        >
                          {item.rcaCounts.T}
                        </button>
                      ) : (
                        <span className="text-slate-200 text-xs">—</span>
                      )}
                    </div>

                    {/* [G] Guess */}
                    <div className="col-span-1 flex justify-center">
                      {item.rcaCounts.G > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const gQs = item.questions.filter(q => q.rcaClassification?.tag === 'G');
                            handleStartDrillFromHeatmap(item.topic, gQs, '[G] Guess');
                          }}
                          className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                          title={`Practice ${item.rcaCounts.G} [G] Guesswork questions for ${item.topic}`}
                        >
                          {item.rcaCounts.G}
                        </button>
                      ) : (
                        <span className="text-slate-200 text-xs">—</span>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Footer legend */}
        {filteredChapters.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-semibold text-slate-400">
              Showing <strong className="text-slate-600">{filteredChapters.length}</strong> of {currentSubjectData.chapters.length} topics
            </span>
            <div className="flex items-center gap-4">
              {(['critical', 'high', 'medium'] as const).map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${SEVERITY_CONFIG[s].dot}`} />
                  <span className="text-[10px] font-semibold text-slate-500">{SEVERITY_CONFIG[s].label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* ─── Drill-down Modal ─── */}
      <AnimatePresence>
        {activeDrillChapter && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-slate-950/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setActiveDrillChapter(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="bg-white w-full sm:max-w-3xl max-h-[90vh] sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            >
              {/* Modal header */}
              <div className={`px-6 pt-6 pb-5 bg-gradient-to-br ${
                SUBJECT_CONFIG[activeDrillChapter.subject]?.gradient || 'from-indigo-600 to-violet-600'
              } rounded-t-3xl`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {activeDrillChapter.subject}
                      </span>
                      <span className="text-white/60 text-[10px] font-semibold">
                        {activeDrillChapter.questions.length} questions
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-white leading-tight">{activeDrillChapter.topic}</h2>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {activeDrillChapter.wrongCount > 0 && (
                        <span className="text-white/80 text-xs font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> {activeDrillChapter.wrongCount} wrong
                        </span>
                      )}
                      {activeDrillChapter.unattemptedCount > 0 && (
                        <span className="text-white/80 text-xs font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {activeDrillChapter.unattemptedCount} skipped
                        </span>
                      )}
                      {activeDrillChapter.speedIssueCount > 0 && (
                        <span className="text-white/80 text-xs font-bold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" /> {activeDrillChapter.speedIssueCount} slow
                        </span>
                      )}
                    </div>

                    {/* In-Modal RCA Filter Tabs and Practice Button */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-white/20">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setModalRcaFilter('all')}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            modalRcaFilter === 'all'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'bg-white/20 hover:bg-white/30 text-white'
                          }`}
                        >
                          All ({activeDrillChapter.questions.length})
                        </button>
                        {(['C', 'A', 'T', 'G'] as const).map(tagKey => {
                          const count = activeDrillChapter.rcaCounts[tagKey] || 0;
                          const isSelected = modalRcaFilter === tagKey;
                          const tagLabels = { C: 'Concept', A: 'Silly', T: 'Trap', G: 'Guess' };
                          return (
                            <button
                              key={tagKey}
                              type="button"
                              onClick={() => setModalRcaFilter(tagKey)}
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-white text-slate-900 shadow-xs ring-2 ring-white/40'
                                  : count > 0
                                  ? 'bg-white/20 hover:bg-white/30 text-white'
                                  : 'bg-white/10 text-white/50'
                              }`}
                            >
                              <span className="font-mono">[{tagKey}]</span>
                              <span>{tagLabels[tagKey]}</span>
                              <span className="px-1 rounded-full text-[9px] bg-black/20 font-black">
                                {count}
                              </span>
                            </button>
                          );
                        })}
                        {activeDrillChapter.rcaCounts.unclassified > 0 && (
                          <button
                            type="button"
                            onClick={() => setModalRcaFilter('unclassified')}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              modalRcaFilter === 'unclassified'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'bg-white/20 hover:bg-white/30 text-white'
                            }`}
                          >
                            <span>Unclassified</span>
                            <span className="px-1 rounded-full text-[9px] bg-black/20 font-black ml-1">
                              {activeDrillChapter.rcaCounts.unclassified}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Drill & Ask Tommy Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const scopedQuestions: AiFocusedQuestion[] = drillFilteredQuestions.map((q, idx) => ({
                              id: q.id,
                              qNum: idx + 1,
                              question: q.question,
                              options: q.options as any,
                              correctAnswer: q.answer,
                              userAnswer: (q as any).userAnswer,
                              solution: q.solution,
                              status: (q.errorType || 'wrong') as any,
                              subject: activeDrillChapter.subject,
                              topic: activeDrillChapter.topic,
                              sourceType: (q as any).sourceType,
                              sourceLabel: (q as any).sourceLabel,
                              testName: (q as any).testName
                            }));

                            const hasFull = drillFilteredQuestions.some(q => (q as any).sourceType === 'full_mock');
                            const hasSec = drillFilteredQuestions.some(q => (q as any).sourceType === 'sectional');
                            const sourceScope = hasFull && hasSec ? 'mixed' : hasFull ? 'full_mock' : hasSec ? 'sectional' : 'subject_wise';

                            openAiWithScope({
                              type: 'topic',
                              title: activeDrillChapter.topic,
                              subject: activeDrillChapter.subject,
                              sourceScope,
                              sourceScopeLabel: sourceScope === 'full_mock'
                                ? `Full Mock Errors (${activeDrillChapter.subject} • ${activeDrillChapter.topic})`
                                : sourceScope === 'sectional'
                                ? `Sectional Errors (${activeDrillChapter.subject} • ${activeDrillChapter.topic})`
                                : `Subject-Wise Errors (${activeDrillChapter.subject} • ${activeDrillChapter.topic})`,
                              stats: {
                                totalQuestions: activeDrillChapter.totalErrors,
                                wrong: activeDrillChapter.wrongCount,
                                slow: activeDrillChapter.speedIssueCount,
                                unattempted: activeDrillChapter.unattemptedCount
                              },
                              questions: scopedQuestions
                            });
                          }}
                          className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors border border-white/20 flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="Ask Tommy AI to analyze all errors in this chapter"
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Ask Tommy</span>
                        </button>

                        {onStartQuiz && drillFilteredQuestions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const subLabel = modalRcaFilter === 'all'
                                ? 'All Errors'
                                : modalRcaFilter === 'unclassified'
                                ? 'Unclassified'
                                : `[${modalRcaFilter}]`;
                              handleStartDrillFromHeatmap(activeDrillChapter.topic, drillFilteredQuestions, subLabel);
                            }}
                            className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Practice {modalRcaFilter !== 'all' ? `[${modalRcaFilter}]` : 'All'} ({drillFilteredQuestions.length})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveDrillChapter(null)}
                    className="w-9 h-9 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Questions list */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {drillFilteredQuestions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium">
                    No questions match the selected RCA filter in this chapter.
                  </div>
                ) : (
                  drillFilteredQuestions.map((q, qIdx) => {
                    const isWrong = q.errorType === 'wrong';
                    const isSlow  = q.errorType === 'speed_issue';

                    return (
                      <div key={q.id || qIdx} className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                        {/* Question header */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">Q{qIdx + 1}</span>
                            {q.rcaClassification && (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                                q.rcaClassification.tag === 'C' ? 'bg-purple-100 text-purple-800' :
                                q.rcaClassification.tag === 'A' ? 'bg-rose-100 text-rose-800' :
                                q.rcaClassification.tag === 'T' ? 'bg-amber-100 text-amber-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                <span className="font-mono font-black">[{q.rcaClassification.tag}]</span>
                                <span>{q.rcaClassification.tagName}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Origin Tag */}
                            {((q as any).sourceType || (q as any).testName) && (
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                                (q as any).sourceType === 'full_mock'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : (q as any).sourceType === 'sectional'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {(q as any).sourceType === 'full_mock' ? 'Full Mock' : (q as any).sourceType === 'sectional' ? 'Sectional' : 'Subject-Wise'}
                                {(q as any).testName ? ` • ${(q as any).testName}` : ''}
                              </span>
                            )}

                            {/* Ask Tommy Button */}
                            <button
                              type="button"
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent('cgl_ask_ai_question', {
                                  detail: {
                                    questionNumber: qIdx + 1,
                                    questionText: q.question,
                                    options: q.options,
                                    userAnswer: (q as any).userAnswer,
                                    correctAnswer: q.answer,
                                    solution: q.solution,
                                    topic: activeDrillChapter.topic,
                                    sourceType: (q as any).sourceType || 'subject_wise',
                                    sourceLabel: (q as any).sourceLabel || ((q as any).sourceType === 'full_mock' ? 'Full Mock Test' : (q as any).sourceType === 'sectional' ? 'Sectional Test' : `Subject-Wise (${activeDrillChapter.subject})`),
                                    testName: (q as any).testName
                                  }
                                }));
                              }}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white transition-colors flex items-center gap-1 cursor-pointer border border-purple-200"
                              title="Ask Tommy to analyze this question"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Ask Tommy</span>
                            </button>

                            {onStartQuiz && (
                              <button
                                type="button"
                                onClick={() => handleStartDrillFromHeatmap(activeDrillChapter.topic, [q], `Q${qIdx + 1}`)}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-1 cursor-pointer border border-indigo-200"
                                title="Drill just this single question"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" />
                                <span>Drill This Q</span>
                              </button>
                            )}
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                              isWrong ? 'bg-red-100 text-red-700' :
                              isSlow  ? 'bg-amber-100 text-amber-700' :
                                        'bg-orange-100 text-orange-700'
                            }`}>
                              {isWrong ? '✗ Wrong −0.5' : isSlow ? '⚡ Speed Issue' : '◯ Skipped'}
                            </span>
                          </div>
                        </div>

                      <div className="p-4 space-y-3">
                        {/* Silly Mistake Note if classified under A */}
                        {q.rcaClassification?.sillyMistakeNote && (
                          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-rose-700 block mb-0.5">
                              Recorded Silly Mistake:
                            </span>
                            <span className="italic font-medium">"{q.rcaClassification.sillyMistakeNote}"</span>
                          </div>
                        )}

                        {/* Question text */}
                        <FormattedText
                          text={q.question}
                          as="p"
                          className="text-sm font-semibold text-slate-900 whitespace-pre-line leading-relaxed"
                        />

                        {/* Options */}
                        {q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(['a', 'b', 'c', 'd'] as const).map(optKey => {
                              const optText = q.options[optKey] || (q.options as any)[optKey.toUpperCase()];
                              if (!optText) return null;
                              const isCorrect = normalizeAnswerKey(q.answer || (q as any).correct_answer || (q as any).correctOption) === optKey;
                              return (
                                <div
                                  key={optKey}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <span className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center font-black text-[11px] uppercase ${
                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {optKey}
                                  </span>
                                  <FormattedText text={optText} className="flex-1 min-w-0" />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Solution */}
                        {q.solution && (
                          <details className="group">
                            <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 select-none">
                              <BookOpen className="w-3.5 h-3.5" />
                              View Solution
                              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                            </summary>
                            <div className="mt-2 text-xs font-medium text-slate-700 whitespace-pre-line leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200">
                              <FormattedText text={cleanSolutionText(q.solution)} as="div" />
                            </div>
                          </details>
                        )}

                        {/* Interactive In-Modal RCA Classification Toolbar */}
                        <div className="pt-3 border-t border-slate-200/80">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">RCA Reason:</span>
                              {(['C', 'A', 'T', 'G'] as const).map(tagKey => {
                                const isSelected = q.rcaClassification?.tag === tagKey;
                                const tagLabels = { C: 'Conceptual Gap', A: 'Silly Mistake', T: 'Time Trap', G: 'Guesswork' };
                                const tagClasses = {
                                  C: isSelected ? 'bg-purple-600 text-white shadow-xs border-purple-600' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200',
                                  A: isSelected ? 'bg-rose-600 text-white shadow-xs border-rose-600' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200',
                                  T: isSelected ? 'bg-amber-600 text-white shadow-xs border-amber-600' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200',
                                  G: isSelected ? 'bg-blue-600 text-white shadow-xs border-blue-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                                };
                                return (
                                  <button
                                    key={tagKey}
                                    type="button"
                                    onClick={() => {
                                      handleClassifyQuestionInModal(q, tagKey);
                                      if (tagKey === 'A') {
                                        setEditingNoteForQ(q.id || String(qIdx));
                                        setModalSillyNoteInput(q.rcaClassification?.sillyMistakeNote || '');
                                      } else {
                                        setEditingNoteForQ(null);
                                      }
                                    }}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${tagClasses[tagKey]}`}
                                  >
                                    <span className="font-mono">[{tagKey}]</span>
                                    <span>{tagLabels[tagKey]}</span>
                                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </button>
                                );
                              })}
                            </div>

                            {q.rcaClassification?.tag && (
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    const globalRaw = safeStorage.getItem('cgl_rca_global_store');
                                    const globalStore: Record<string, any> = globalRaw ? JSON.parse(globalRaw) : {};
                                    const qId = q.id || `${q.parentSubject || 'mock'}_${q.detectedTopic || 'topic'}`;
                                    const textNorm = q.question ? q.question.trim().toLowerCase() : '';
                                    delete globalStore[qId];
                                    if (textNorm) delete globalStore[textNorm];
                                    safeStorage.setItem('cgl_rca_global_store', JSON.stringify(globalStore));
                                    if (typeof window !== 'undefined') {
                                      window.dispatchEvent(new CustomEvent('cgl_rca_updated', { detail: { qId, rca: null } }));
                                    }
                                  } catch {}
                                  setActiveDrillChapter(prev => {
                                    if (!prev) return null;
                                    return {
                                      ...prev,
                                      questions: prev.questions.map(it => it === q ? { ...it, rcaClassification: undefined, rca: undefined } : it)
                                    };
                                  });
                                  setRcaVersion(v => v + 1);
                                }}
                                className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer underline decoration-dotted"
                              >
                                Clear Tag
                              </button>
                            )}
                          </div>

                          {/* Editable Silly Note box if tag is 'A' */}
                          {(q.rcaClassification?.tag === 'A' || editingNoteForQ === (q.id || String(qIdx))) && (
                            <div className="mt-2.5 p-2 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2">
                              <input
                                type="text"
                                value={editingNoteForQ === (q.id || String(qIdx)) ? modalSillyNoteInput : (q.rcaClassification?.sillyMistakeNote || '')}
                                onChange={e => {
                                  setEditingNoteForQ(q.id || String(qIdx));
                                  setModalSillyNoteInput(e.target.value);
                                }}
                                placeholder="Add silly mistake note (e.g., calculation slip, misread question)..."
                                className="flex-1 bg-white border border-rose-300 rounded px-2.5 py-1 text-xs text-rose-950 focus:outline-none focus:ring-1 focus:ring-rose-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  handleClassifyQuestionInModal(q, 'A', modalSillyNoteInput);
                                  setEditingNoteForQ(null);
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0"
                              >
                                Save Note
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              </div>

              {/* Modal footer */}
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex justify-end">
                <button
                  onClick={() => setActiveDrillChapter(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
