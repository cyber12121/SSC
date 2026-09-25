import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Search,
  X,
  Target,
  ListChecks,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info,
  BookOpen,
  Flame,
  Eye
} from 'lucide-react';
import { Question, RCATagType } from '../../types';
import { MockChapterModalData, ModalFilterType } from '../modals/MockChapterErrorsModal';
import { TestScopeFilter } from '../../utils/testClassifier';
import { RcaRulesModal } from './RcaRulesModal';
import { getConsolidatedSubtopicsForQuestions } from '../../utils/subtopicNormalizer';
import { SILLY_SUB_TYPES, getQuestionSillySubTypes, matchesSillySubFilter } from '../../utils/rcaHelper';

interface MockErrorsRcaCockpitProps {
  mode?: 'rca' | 'chapters';
  selectedSubject: string;
  clubbedChapters: MockChapterModalData[];
  filteredChapters: MockChapterModalData[];
  subjectRcaData: {
    totals: Record<RCATagType | 'unclassified', number>;
    questionsByTag: Record<RCATagType | 'unclassified', Question[]>;
  };
  mockTestTypeFilter: TestScopeFilter;
  setMockTestTypeFilter: (filter: TestScopeFilter) => void;
  mockScopeCounts: { all: number; full: number; sectional: number };
  mockViewMode: 'chapters' | 'buckets' | 'rca';
  setMockViewMode: (mode: 'chapters' | 'buckets' | 'rca') => void;
  rcaSelectedFilter: 'all' | RCATagType | 'unclassified';
  setRcaSelectedFilter: (filter: 'all' | RCATagType | 'unclassified') => void;
  rcaSearchQuery: string;
  setRcaSearchQuery: (query: string) => void;
  onStartClubbedChapterQuiz: (topic: string, questions: Question[], subType?: string, setNum?: number) => void;
  onStartSubjectRcaQuiz: (tag: RCATagType | 'unclassified', subTag?: string) => void;
  onStartSubjectErrorTypeQuiz?: (type: 'wrong' | 'slow' | 'unattempted') => void;
  onStartAllSubjectQuiz: (subject: string) => void;
  onAskAiTopic: (
    topic: string,
    subject: string,
    questions: Question[],
    counts: { total: number; wrong: number; slow: number; unattempted: number },
    mode?: 'chapters' | 'buckets' | 'rca',
    rcaTagFilter?: string
  ) => void;
  onAskAiRca: (tag: RCATagType | 'unclassified', subTag?: string) => void;
  onAskAiErrorType?: (type: 'wrong' | 'slow' | 'unattempted') => void;
  onAskAiSubject: (subject: string) => void;
  onOpenQuestionsReview?: (title: string, questions: Question[], subject: string) => void;
  onOpenChapterModal: (chapter: MockChapterModalData, filter?: ModalFilterType, sillySubFilter?: string) => void;
}

export const MockErrorsRcaCockpit: React.FC<MockErrorsRcaCockpitProps> = ({
  mode = 'rca',
  selectedSubject,
  clubbedChapters,
  filteredChapters,
  subjectRcaData,
  mockTestTypeFilter,
  setMockTestTypeFilter,
  mockScopeCounts,
  mockViewMode,
  setMockViewMode,
  rcaSelectedFilter,
  setRcaSelectedFilter,
  rcaSearchQuery,
  setRcaSearchQuery,
  onStartClubbedChapterQuiz,
  onStartSubjectRcaQuiz,
  onStartSubjectErrorTypeQuiz,
  onStartAllSubjectQuiz,
  onAskAiTopic,
  onAskAiRca,
  onAskAiErrorType,
  onAskAiSubject,
  onOpenQuestionsReview,
  onOpenChapterModal
}) => {
  const [showRcaRulesModal, setShowRcaRulesModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chapterFilter, setChapterFilter] = useState<'all' | 'wrong' | 'slow' | 'unattempted'>('all');
  const [sillySubFilter, setSillySubFilter] = useState<string>('all');
  // Topic whose subtopic dropdown is currently open (null = none)
  const [expandedSubtopicTopic, setExpandedSubtopicTopic] = useState<string | null>(null);

  // Reset silly sub-filter when switching away from silly tag or changing subject
  useEffect(() => {
    if (rcaSelectedFilter !== 'S') {
      setSillySubFilter('all');
    }
  }, [rcaSelectedFilter, selectedSubject]);

  // Topic whose sets dropdown is open (anchored floating popover)
  const [openSetDropdown, setOpenSetDropdown] = useState<{
    topic: string;
    totalSets: number;
    total: number;
    questions: Question[];
    rect: { top: number; right: number; bottom: number; left: number };
  } | null>(null);

  useEffect(() => {
    if (!openSetDropdown) return;
    const handleClose = () => setOpenSetDropdown(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenSetDropdown(null);
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openSetDropdown]);

  const isChaptersMode = mode === 'chapters';

  // Total mistakes in current view scope
  const totalMistakes = useMemo(() => {
    return clubbedChapters.reduce((acc, ch) => acc + ch.total, 0);
  }, [clubbedChapters]);

  // Error type aggregate totals for chapters mode
  const totalWrong = useMemo(() => clubbedChapters.reduce((acc, ch) => acc + ch.wrong, 0), [clubbedChapters]);
  const totalSlow = useMemo(() => clubbedChapters.reduce((acc, ch) => acc + ch.slow, 0), [clubbedChapters]);
  const totalUnattempted = useMemo(() => clubbedChapters.reduce((acc, ch) => acc + ch.unattempted, 0), [clubbedChapters]);

  // RCA counts
  const cCount = subjectRcaData.totals.C || 0;
  const sCount = (subjectRcaData.totals.S || (subjectRcaData.totals as any).A) || 0;
  const tCount = subjectRcaData.totals.T || 0;
  const gCount = subjectRcaData.totals.G || 0;
  const unclassifiedCount = subjectRcaData.totals.unclassified || 0;

  const diagnosedCount = cCount + sCount + tCount + gCount;
  const diagnosedPct = totalMistakes > 0 ? Math.round((diagnosedCount / totalMistakes) * 100) : 0;

  // Dynamic Silly Mistake Sub-Type Counts across the subject
  const sillySubTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: sCount,
      calculation: 0,
      misread: 0,
      option: 0,
      formula: 0,
      rushed: 0,
      unit: 0,
      custom: 0,
      unspecified: 0
    };

    const sillyQs = subjectRcaData.questionsByTag?.S || (subjectRcaData.questionsByTag as any)?.A || [];
    sillyQs.forEach((q: any) => {
      const types = getQuestionSillySubTypes(q);
      types.forEach(t => {
        if (counts[t] !== undefined) {
          counts[t]++;
        }
      });
    });

    return counts;
  }, [sCount, subjectRcaData]);

  // Compute active filtered list depending on mode
  const activeTopicList = useMemo(() => {
    let list = clubbedChapters;

    if (isChaptersMode) {
      if (chapterFilter === 'wrong') list = list.filter(ch => ch.wrong > 0);
      else if (chapterFilter === 'slow') list = list.filter(ch => ch.slow > 0);
      else if (chapterFilter === 'unattempted') list = list.filter(ch => ch.unattempted > 0);
    } else {
      if (rcaSelectedFilter !== 'all') {
        list = list.filter(ch => ((ch.rcaCounts?.[rcaSelectedFilter]) || 0) > 0);
        // Secondary drill-down for Silly Mistake sub-types
        if (rcaSelectedFilter === 'S' && sillySubFilter !== 'all') {
          list = list.filter(ch => {
            const sillyQs = ch.rcaQuestions?.S || (ch.rcaQuestions as any)?.A || [];
            return sillyQs.some((q: any) => matchesSillySubFilter(q, sillySubFilter));
          });
        }
      }
    }

    if (rcaSearchQuery.trim()) {
      const q = rcaSearchQuery.toLowerCase();
      list = list.filter(ch => ch.topic.toLowerCase().includes(q));
    }
    return list;
  }, [clubbedChapters, isChaptersMode, chapterFilter, rcaSelectedFilter, sillySubFilter, rcaSearchQuery]);

  // Max errors for heatbar normalization
  const maxErrors = useMemo(() => {
    return activeTopicList.length > 0 ? activeTopicList[0].total : 1;
  }, [activeTopicList]);

  // Topic display pagination (show 10 by default, expand for all)
  const displayedTopics = useMemo(() => {
    if (isExpanded || activeTopicList.length <= 10) {
      return activeTopicList;
    }
    return activeTopicList.slice(0, 10);
  }, [activeTopicList, isExpanded]);

  const remainingTopicsCount = activeTopicList.length - 10;
  const remainingTopicNames = useMemo(() => {
    if (remainingTopicsCount <= 0) return '';
    return activeTopicList
      .slice(10, 13)
      .map(t => t.topic)
      .join(', ') + (remainingTopicsCount > 3 ? '...' : '');
  }, [activeTopicList, remainingTopicsCount]);

  const scopeLabel =
    mockTestTypeFilter === 'full'
      ? 'Full Mocks Only'
      : mockTestTypeFilter === 'sectional'
      ? 'Sectionals Only'
      : 'All Mock Sources';

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* ========================================================= */}
      {/* 1. COCKPIT CONTROL STRIP (STITCH DESIGN)                  */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 sm:gap-4">
        {/* Left Info */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            {selectedSubject} Mock Errors
          </h2>
          <span className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-slate-200/70">
            {clubbedChapters.length} Topics
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            {totalMistakes} total mistakes recorded •{' '}
            <strong className="text-indigo-600 font-semibold">{scopeLabel}</strong>
          </span>
        </div>

        {/* Right Toggle & Launch Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
          {/* Scope filter segment */}
          <div className="bg-slate-100/90 p-0.5 rounded-xl flex items-center text-xs font-medium text-slate-600 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setMockTestTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                mockTestTypeFilter === 'all'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/60'
                  : 'hover:text-slate-900'
              }`}
            >
              Combined <span className="ml-1 text-slate-400 font-normal">{mockScopeCounts.all}</span>
            </button>
            <button
              type="button"
              onClick={() => setMockTestTypeFilter('full')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                mockTestTypeFilter === 'full'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/60'
                  : 'hover:text-slate-900'
              }`}
            >
              Full <span className="ml-1 text-indigo-600 font-semibold">{mockScopeCounts.full}</span>
            </button>
            <button
              type="button"
              onClick={() => setMockTestTypeFilter('sectional')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                mockTestTypeFilter === 'sectional'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/60'
                  : 'hover:text-slate-900'
              }`}
            >
              Sectional <span className="ml-1 text-slate-400 font-normal">{mockScopeCounts.sectional}</span>
            </button>
          </div>

          {/* View switches: Chapters / By Type / RCA */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMockViewMode('chapters')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors border cursor-pointer ${
                mockViewMode === 'chapters'
                  ? 'text-indigo-700 bg-indigo-50 border-indigo-200 shadow-xs'
                  : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5 text-indigo-600" />
              Chapters
            </button>
            <button
              type="button"
              onClick={() => setMockViewMode('buckets')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors border cursor-pointer ${
                mockViewMode === 'buckets'
                  ? 'text-indigo-700 bg-indigo-50 border-indigo-200 shadow-xs font-semibold'
                  : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              By Type
            </button>
            <button
              type="button"
              onClick={() => setMockViewMode('rca')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg shadow-xs border cursor-pointer ${
                mockViewMode === 'rca'
                  ? 'text-purple-700 bg-purple-50 border-purple-200'
                  : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-purple-600" />
              RCA
            </button>
          </div>

          {/* Primary Launch Drill CTA */}
          <button
            type="button"
            onClick={() => onStartAllSubjectQuiz(selectedSubject)}
            disabled={totalMistakes === 0}
            className={`inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-bold rounded-lg shadow-xs transition-all focus:ring-2 focus:ring-indigo-400 focus:outline-none ml-auto xl:ml-0 cursor-pointer ${
              totalMistakes === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white active:scale-95'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Start All ({totalMistakes})</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. COMPACT TOP METRIC CARDS (HALVED SIZE)                 */}
      {/* ========================================================= */}
      {isChaptersMode ? (
        /* CHAPTERS MODE: 4 Compact Cards (All, Incorrect, Slow, Skipped) */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: All Mistakes */}
          <article
            onClick={() => setChapterFilter(chapterFilter === 'all' ? 'all' : 'all')}
            className={`bg-white rounded-xl border p-2.5 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between cursor-pointer ${
              chapterFilter === 'all'
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                : 'border-slate-200/90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Total Errors
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{totalMistakes}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                Across {clubbedChapters.length} topics in {selectedSubject}
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{totalMistakes} Qs</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={totalMistakes === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskAiSubject(selectedSubject);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  AI
                </button>
                <button
                  type="button"
                  disabled={totalMistakes === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartAllSubjectQuiz(selectedSubject);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded-md transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-2 h-2 fill-current" />
                  Drill
                </button>
              </div>
            </div>
          </article>

          {/* Card 2: [W] Incorrect */}
          <article
            onClick={() => setChapterFilter(chapterFilter === 'wrong' ? 'all' : 'wrong')}
            className={`bg-white rounded-xl border p-2.5 shadow-xs hover:border-rose-300 transition-all flex flex-col justify-between cursor-pointer ${
              chapterFilter === 'wrong'
                ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
                : 'border-slate-200/90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                  [W] Incorrect
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{totalWrong}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                Wrong options & calculation slips
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{totalWrong} Qs</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={totalWrong === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onAskAiErrorType) onAskAiErrorType('wrong');
                    else onAskAiSubject(selectedSubject);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  AI
                </button>
                <button
                  type="button"
                  disabled={totalWrong === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStartSubjectErrorTypeQuiz) onStartSubjectErrorTypeQuiz('wrong');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded-md transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-2 h-2 fill-current" />
                  Drill
                </button>
              </div>
            </div>
          </article>

          {/* Card 3: [S] Slow */}
          <article
            onClick={() => setChapterFilter(chapterFilter === 'slow' ? 'all' : 'slow')}
            className={`bg-white rounded-xl border p-2.5 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between cursor-pointer ${
              chapterFilter === 'slow'
                ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                : 'border-slate-200/90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                  [S] Slow
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{totalSlow}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                Excessive time (&gt;60s) spent
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{totalSlow} Qs</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={totalSlow === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onAskAiErrorType) onAskAiErrorType('slow');
                    else onAskAiSubject(selectedSubject);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  AI
                </button>
                <button
                  type="button"
                  disabled={totalSlow === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStartSubjectErrorTypeQuiz) onStartSubjectErrorTypeQuiz('slow');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-2 py-0.5 rounded-md transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-2 h-2 fill-current" />
                  Drill
                </button>
              </div>
            </div>
          </article>

          {/* Card 4: [U] Skipped */}
          <article
            onClick={() => setChapterFilter(chapterFilter === 'unattempted' ? 'all' : 'unattempted')}
            className={`bg-white rounded-xl border p-2.5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between cursor-pointer ${
              chapterFilter === 'unattempted'
                ? 'border-slate-800 ring-2 ring-slate-800/20 shadow-sm'
                : 'border-slate-200/90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  [U] Skipped
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{totalUnattempted}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                Unattempted or skipped items
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{totalUnattempted} Qs</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={totalUnattempted === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onAskAiErrorType) onAskAiErrorType('unattempted');
                    else onAskAiSubject(selectedSubject);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  AI
                </button>
                <button
                  type="button"
                  disabled={totalUnattempted === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStartSubjectErrorTypeQuiz) onStartSubjectErrorTypeQuiz('unattempted');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-900 px-2 py-0.5 rounded-md transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-2 h-2 fill-current" />
                  Drill
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : (
        /* RCA MODE: 5 Compact Cards (Concept, Silly, Time Trap, Guesswork, Unclassified) */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {/* Card 1: [C] Concept */}
          <article
            onClick={() => setRcaSelectedFilter(rcaSelectedFilter === 'C' ? 'all' : 'C')}
            className={`bg-white rounded-xl border p-2.5 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between cursor-pointer ${
              rcaSelectedFilter === 'C'
                ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-sm'
                : 'border-slate-200/90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                  [C] Concept
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{cCount}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                Core logic or formula gap
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{cCount} Qs</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={cCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskAiRca('C');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  AI
                </button>
                <button
                  type="button"
                  disabled={cCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartSubjectRcaQuiz('C');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2 py-0.5 rounded-md transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-2 h-2 fill-current" />
                  Drill
                </button>
              </div>
            </div>
          </article>

          {/* Card 2: [S] Silly */}
          <article
            onClick={() => setRcaSelectedFilter(rcaSelectedFilter === 'S' ? 'all' : 'S')}
            className={`bg-white rounded-xl border p-2.5 shadow-xs hover:border-rose-300 transition-all flex flex-col justify-between cursor-pointer ${
              rcaSelectedFilter === 'S'
                ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
                : 'border-slate-200/90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                  [S] Silly
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{sCount}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-slate-400 truncate leading-tight">
                  Calculation slip, misread or rushed
                </p>
              </div>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{sCount} Qs</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={sCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskAiRca('S', rcaSelectedFilter === 'S' && sillySubFilter !== 'all' ? sillySubFilter : undefined);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  AI
                </button>
                <button
                  type="button"
                  disabled={sCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartSubjectRcaQuiz('S', rcaSelectedFilter === 'S' && sillySubFilter !== 'all' ? sillySubFilter : undefined);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded-md transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-2 h-2 fill-current" />
                  Drill
                </button>
              </div>
            </div>
          </article>

          {/* Card 3: [T] Time Trap */}
          <article
            onClick={() => setRcaSelectedFilter(rcaSelectedFilter === 'T' ? 'all' : 'T')}
            className={`bg-white rounded-xl border p-2.5 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between cursor-pointer ${
              rcaSelectedFilter === 'T'
                ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                : 'border-slate-200/90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                  [T] Time Trap
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{tCount}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                Excessive time (&gt;90s) wasted
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{tCount} Qs</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={tCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskAiRca('T');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  AI
                </button>
                <button
                  type="button"
                  disabled={tCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartSubjectRcaQuiz('T');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-2 py-0.5 rounded-md transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-2 h-2 fill-current" />
                  Drill
                </button>
              </div>
            </div>
          </article>

          {/* Card 4: [G] Guesswork */}
          <article
            onClick={() => setRcaSelectedFilter(rcaSelectedFilter === 'G' ? 'all' : 'G')}
            className={`bg-white rounded-xl border p-2.5 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between cursor-pointer ${
              rcaSelectedFilter === 'G'
                ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
                : 'border-slate-200/90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-100">
                  [G] Guesswork
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{gCount}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 truncate leading-tight">
                50-50 elimination failed
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{gCount} Qs</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={gCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskAiRca('G');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  AI
                </button>
                <button
                  type="button"
                  disabled={gCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartSubjectRcaQuiz('G');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-sky-600 hover:bg-sky-700 px-2 py-0.5 rounded-md transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-2 h-2 fill-current" />
                  Drill
                </button>
              </div>
            </div>
          </article>

          {/* Card 5: Unclassified */}
          <article
            onClick={() => setRcaSelectedFilter(rcaSelectedFilter === 'unclassified' ? 'all' : 'unclassified')}
            className={`bg-white rounded-xl border p-2.5 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between cursor-pointer col-span-2 sm:col-span-1 ${
              rcaSelectedFilter === 'unclassified'
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                : 'border-slate-200/90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  Unclassified
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{unclassifiedCount}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] leading-tight">
                <span className="text-slate-400 font-medium">{diagnosedPct}% Diagnosed</span>
                <span className="font-semibold text-indigo-600">
                  {diagnosedCount}/{totalMistakes}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-0.5">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, diagnosedPct)}%` }}
                />
              </div>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400">{unclassifiedCount} Qs</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={unclassifiedCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskAiRca('unclassified');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  AI
                </button>
                <button
                  type="button"
                  disabled={unclassifiedCount === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    const unclassifiedQs = subjectRcaData.questionsByTag?.unclassified || [];
                    if (onOpenQuestionsReview) {
                      onOpenQuestionsReview(`${selectedSubject} • All Unclassified Mistakes`, unclassifiedQs, selectedSubject);
                    } else {
                      onStartSubjectRcaQuiz('unclassified');
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={`Review ${unclassifiedCount} unclassified questions`}
                >
                  <Eye className="w-2.5 h-2.5" />
                  Review
                </button>
              </div>
            </div>
          </article>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CLASSIFICATION FILTER BAR                              */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Left Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {isChaptersMode ? (
            <>
              <button
                type="button"
                onClick={() => setChapterFilter('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  chapterFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Topics ({clubbedChapters.length})
              </button>
              <button
                type="button"
                onClick={() => setChapterFilter('wrong')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  chapterFilter === 'wrong'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold'
                    : 'bg-rose-50/70 text-rose-800 border-rose-100 hover:bg-rose-100'
                }`}
              >
                [W] Incorrect <span className="ml-1 opacity-85 font-mono">{totalWrong}</span>
              </button>
              <button
                type="button"
                onClick={() => setChapterFilter('slow')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  chapterFilter === 'slow'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-bold'
                    : 'bg-amber-50/70 text-amber-800 border-amber-100 hover:bg-amber-100'
                }`}
              >
                [S] Slow <span className="ml-1 opacity-85 font-mono">{totalSlow}</span>
              </button>
              <button
                type="button"
                onClick={() => setChapterFilter('unattempted')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  chapterFilter === 'unattempted'
                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                [U] Skipped <span className="ml-1 opacity-85 font-mono">{totalUnattempted}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRcaSelectedFilter('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  rcaSelectedFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Topics ({clubbedChapters.length})
              </button>
              <button
                type="button"
                onClick={() => setRcaSelectedFilter('C')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  rcaSelectedFilter === 'C'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs font-bold'
                    : 'bg-purple-50/70 text-purple-800 border-purple-100 hover:bg-purple-100'
                }`}
              >
                [C] Concept <span className="ml-1 opacity-85 font-mono">{cCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setRcaSelectedFilter('S')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  rcaSelectedFilter === 'S'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold'
                    : 'bg-rose-50/70 text-rose-800 border-rose-100 hover:bg-rose-100'
                }`}
              >
                [S] Silly <span className="ml-1 opacity-85 font-mono">{sCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setRcaSelectedFilter('T')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  rcaSelectedFilter === 'T'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-bold'
                    : 'bg-amber-50/70 text-amber-800 border-amber-100 hover:bg-amber-100'
                }`}
              >
                [T] Time Trap <span className="ml-1 opacity-85 font-mono">{tCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setRcaSelectedFilter('G')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  rcaSelectedFilter === 'G'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-bold'
                    : 'bg-sky-50/70 text-sky-800 border-sky-100 hover:bg-sky-100'
                }`}
              >
                [G] Guesswork <span className="ml-1 opacity-85 font-mono">{gCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setRcaSelectedFilter('unclassified')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  rcaSelectedFilter === 'unclassified'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs font-bold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Unclassified <span className="ml-1 font-bold font-mono text-slate-700">{unclassifiedCount}</span>
              </button>
            </>
          )}
        </div>

        {/* Right Search & Ask AI */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="relative w-full md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search chapter/topic..."
              value={rcaSearchQuery}
              onChange={(e) => setRcaSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 text-slate-700 transition"
            />
            {rcaSearchQuery && (
              <button
                type="button"
                onClick={() => setRcaSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (isChaptersMode) {
                if (chapterFilter !== 'all' && onAskAiErrorType) {
                  onAskAiErrorType(chapterFilter);
                } else {
                  onAskAiSubject(selectedSubject);
                }
              } else {
                if (rcaSelectedFilter === 'all') {
                  onAskAiSubject(selectedSubject);
                } else {
                  onAskAiRca(rcaSelectedFilter, rcaSelectedFilter === 'S' && sillySubFilter !== 'all' ? sillySubFilter : undefined);
                }
              }
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-purple-700 bg-purple-50/80 hover:bg-purple-100 border border-purple-200/80 rounded-lg transition shadow-2xs whitespace-nowrap cursor-pointer active:scale-95"
            title={`Ask Tommy AI to analyze ${selectedSubject} errors`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            Ask AI
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3b. 2-TIER SUB-FILTER: SILLY MISTAKE SUB-TYPES            */}
      {/* ========================================================= */}
      {!isChaptersMode && rcaSelectedFilter === 'S' && (
        <div className="bg-gradient-to-r from-rose-50/90 via-pink-50/70 to-amber-50/60 rounded-2xl p-2.5 sm:p-3 border border-rose-200/80 shadow-xs flex flex-wrap items-center justify-between gap-2.5 transition-all">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-rose-950 flex items-center gap-1 mr-1">
              <Flame className="w-3.5 h-3.5 text-rose-600" />
              <span>Silly Type:</span>
            </span>

            {/* All Silly */}
            <button
              type="button"
              onClick={() => setSillySubFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                sillySubFilter === 'all'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white hover:bg-rose-100 text-rose-800 border border-rose-200/80'
              }`}
            >
              <span>All Silly</span>
              <span className="text-[10px] font-mono opacity-85 font-normal">({sCount})</span>
            </button>

            {/* Sub-type pills */}
            {Object.values(SILLY_SUB_TYPES).map(sub => {
              const count = sillySubTypeCounts[sub.id] || 0;
              if (count === 0 && sub.id !== 'calculation' && sub.id !== 'misread' && sub.id !== 'option' && sub.id !== 'formula') {
                return null;
              }
              const isSelected = sillySubFilter === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSillySubFilter(isSelected ? 'all' : sub.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? `${sub.activePillClass}`
                      : count > 0
                      ? `${sub.inactivePillClass} border`
                      : 'bg-white/60 text-slate-400 border border-slate-200 opacity-60'
                  }`}
                  title={sub.desc}
                >
                  <span className="text-xs">{sub.icon}</span>
                  <span>{sub.shortLabel}</span>
                  <span className="text-[10px] font-mono font-bold">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Drill for Selected Sub-Type */}
          {sillySubFilter !== 'all' && (sillySubTypeCounts[sillySubFilter] || 0) > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => onAskAiRca('S', sillySubFilter)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-white hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 transition shadow-2xs cursor-pointer active:scale-95"
              >
                <Sparkles className="w-2.5 h-2.5 text-rose-600" />
                <span>AI</span>
              </button>
              <button
                type="button"
                onClick={() => onStartSubjectRcaQuiz('S', sillySubFilter)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1 rounded-lg transition shadow-xs cursor-pointer active:scale-95"
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Drill {SILLY_SUB_TYPES[sillySubFilter]?.shortLabel || 'Selected'} ({sillySubTypeCounts[sillySubFilter]})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. WEAK TOPICS TABLE (ADAPTIVE: CHAPTERS vs RCA)          */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-3 px-3.5 w-12 text-center">#</th>
                <th className="py-3 px-3.5 min-w-[220px]">TOPIC NAME</th>
                <th className="py-3 px-3.5 min-w-[160px]">HEAT BAR</th>
                {isChaptersMode ? (
                  <>
                    <th className="py-3 px-3 w-20 text-center text-rose-600">INCORRECT</th>
                    <th className="py-3 px-3 w-20 text-center text-amber-600">SLOW</th>
                    <th className="py-3 px-3 w-20 text-center text-slate-600">SKIPPED</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-2.5 w-14 text-center text-purple-600">[C]</th>
                    <th className="py-3 px-2.5 w-14 text-center text-rose-600">[S]</th>
                    <th className="py-3 px-2.5 w-14 text-center text-amber-600">[T]</th>
                    <th className="py-3 px-2.5 w-14 text-center text-sky-600">[G]</th>
                  </>
                )}
                <th className="py-3 px-4 w-32 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {displayedTopics.length === 0 ? (
                <tr>
                  <td colSpan={isChaptersMode ? 7 : 8} className="py-12 text-center text-slate-400 font-medium text-xs">
                    No chapters match the selected search or filter.
                  </td>
                </tr>
              ) : (
                displayedTopics.map((ch, idx) => {
                  const totalSets = Math.ceil(ch.total / 25);
                  const barPct = Math.min(100, Math.round((ch.total / maxErrors) * 100));

                  const heatBarColor =
                    barPct >= 85
                      ? 'bg-red-500'
                      : barPct >= 60
                      ? 'bg-amber-500'
                      : 'bg-indigo-500';

                  const cTag = ch.rcaCounts?.C || 0;
                  const sTag = (ch.rcaCounts?.S || (ch.rcaCounts as any)?.A) || 0;
                  const tTag = ch.rcaCounts?.T || 0;
                  const gTag = ch.rcaCounts?.G || 0;
                  const unclassifiedTag = ch.rcaCounts?.unclassified ?? Math.max(0, ch.total - (cTag + sTag + tTag + gTag));

                  return (
                    <React.Fragment key={ch.topic}>
                    <tr
                      onClick={() => {
                        // Toggle subtopic dropdown instead of immediately opening modal
                        setExpandedSubtopicTopic(
                          expandedSubtopicTopic === ch.topic ? null : ch.topic
                        );
                      }}
                      className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                        expandedSubtopicTopic === ch.topic ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      {/* 1. Rank */}
                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-[11px] ${
                            idx < 3
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      {/* 2. Topic name + breakdowns */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-xs sm:text-[13px] group-hover:text-indigo-600 transition">
                            {ch.topic}
                          </span>
                          {ch.total > 25 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openSetDropdown?.topic === ch.topic) {
                                  setOpenSetDropdown(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setOpenSetDropdown({
                                    topic: ch.topic,
                                    totalSets,
                                    total: ch.total,
                                    questions: ch.questions,
                                    rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left }
                                  });
                                }
                              }}
                              className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors cursor-pointer"
                              title="Click to choose a set"
                            >
                              {totalSets} Sets
                            </button>
                          )}
                          {/* Chevron to indicate expandable subtopics */}
                          <ChevronRight
                            className={`w-3.5 h-3.5 ml-0.5 text-indigo-400 transition-transform shrink-0 ${
                              expandedSubtopicTopic === ch.topic ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                        {/* Topic metadata: Total questions & Unclassified (Option B) */}
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-medium">
                          <span>{ch.total} {ch.total === 1 ? 'question' : 'questions'}</span>
                          {!isChaptersMode && (
                            <>
                              <span className="text-slate-300">•</span>
                              {unclassifiedTag > 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const unclassifiedQs = ch.rcaQuestions?.unclassified || ch.questions.filter(q => !q.rcaTag || q.rcaTag === 'unclassified');
                                    if (onOpenQuestionsReview) {
                                      onOpenQuestionsReview(`${ch.topic} • Unclassified Review`, unclassifiedQs, selectedSubject);
                                    } else {
                                      onStartClubbedChapterQuiz(ch.topic, unclassifiedQs, 'unclassified');
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 px-1.5 py-0.2 rounded transition-colors cursor-pointer"
                                  title={`Review ${unclassifiedTag} unclassified questions for ${ch.topic}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>{unclassifiedTag} unclassified</span>
                                </button>
                              ) : (
                                <span className="text-emerald-600 font-semibold text-[10px] inline-flex items-center gap-0.5">
                                  ✓ All diagnosed
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* 3. Heat Bar */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-28 sm:w-36 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`${heatBarColor} h-full rounded-full transition-all duration-300`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <span className="text-slate-500 font-medium text-[10px] w-7">{barPct}%</span>
                        </div>
                      </td>

                      {/* Columns for Chapters mode vs RCA mode */}
                      {isChaptersMode ? (
                        <>
                          {/* INCORRECT CELL */}
                          <td className="py-2.5 px-3 text-center">
                            {ch.wrong > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartClubbedChapterQuiz(ch.topic, ch.wrongQuestions, 'wrong');
                                }}
                                className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200/60 shadow-xs hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                                title={`Practice ${ch.wrong} incorrect questions for ${ch.topic}`}
                              >
                                {ch.wrong}
                              </button>
                            ) : (
                              <span className="text-slate-300 opacity-40 font-normal">—</span>
                            )}
                          </td>

                          {/* SLOW CELL */}
                          <td className="py-2.5 px-3 text-center">
                            {ch.slow > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartClubbedChapterQuiz(ch.topic, ch.slowQuestions, 'slow');
                                }}
                                className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200/60 shadow-xs hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                                title={`Practice ${ch.slow} slow questions for ${ch.topic}`}
                              >
                                {ch.slow}
                              </button>
                            ) : (
                              <span className="text-slate-300 opacity-40 font-normal">—</span>
                            )}
                          </td>

                          {/* SKIPPED CELL */}
                          <td className="py-2.5 px-3 text-center">
                            {ch.unattempted > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartClubbedChapterQuiz(ch.topic, ch.unattemptedQuestions, 'unattempted');
                                }}
                                className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200/60 shadow-xs hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                                title={`Practice ${ch.unattempted} skipped questions for ${ch.topic}`}
                              >
                                {ch.unattempted}
                              </button>
                            ) : (
                              <span className="text-slate-300 opacity-40 font-normal">—</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {/* RCA [C] */}
                          <td className="py-2.5 px-2.5 text-center">
                            {cTag > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartClubbedChapterQuiz(ch.topic, ch.rcaQuestions?.C || [], 'C');
                                }}
                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold text-[11px] border border-purple-200/60 shadow-xs hover:bg-purple-600 hover:text-white transition-colors cursor-pointer"
                                title={`Practice ${cTag} [C] Concept questions for ${ch.topic}`}
                              >
                                {cTag}
                              </button>
                            ) : (
                              <span className="text-slate-300 opacity-40 font-normal">—</span>
                            )}
                          </td>

                          {/* RCA [S] */}
                          <td className="py-2.5 px-2.5 text-center">
                            {sTag > 0 ? (() => {
                              const allSillyQs = ch.rcaQuestions?.S || (ch.rcaQuestions as any)?.A || [];
                              const isSubFiltered = rcaSelectedFilter === 'S' && sillySubFilter !== 'all';
                              const targetSillyQs = isSubFiltered
                                ? allSillyQs.filter(q => matchesSillySubFilter(q, sillySubFilter))
                                : allSillyQs;
                              const count = targetSillyQs.length;
                              if (count === 0) {
                                return <span className="text-slate-300 opacity-40 font-normal">—</span>;
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onStartClubbedChapterQuiz(
                                      ch.topic,
                                      targetSillyQs,
                                      isSubFiltered ? `S_${sillySubFilter}` : 'S'
                                    );
                                  }}
                                  className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md font-bold text-[11px] border shadow-xs transition-colors cursor-pointer ${
                                    isSubFiltered
                                      ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300'
                                      : 'bg-rose-100 text-rose-700 border-rose-200/60 hover:bg-rose-600 hover:text-white'
                                  }`}
                                  title={`Practice ${count} ${isSubFiltered ? SILLY_SUB_TYPES[sillySubFilter]?.label || 'Silly' : '[S] Silly'} questions for ${ch.topic}`}
                                >
                                  {count}
                                </button>
                              );
                            })() : (
                              <span className="text-slate-300 opacity-40 font-normal">—</span>
                            )}
                          </td>

                          {/* RCA [T] */}
                          <td className="py-2.5 px-2.5 text-center">
                            {tTag > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartClubbedChapterQuiz(ch.topic, ch.rcaQuestions?.T || [], 'T');
                                }}
                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200/60 shadow-xs hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                                title={`Practice ${tTag} [T] Time Trap questions for ${ch.topic}`}
                              >
                                {tTag}
                              </button>
                            ) : (
                              <span className="text-slate-300 opacity-40 font-normal">—</span>
                            )}
                          </td>

                          {/* RCA [G] */}
                          <td className="py-2.5 px-2.5 text-center">
                            {gTag > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartClubbedChapterQuiz(ch.topic, ch.rcaQuestions?.G || [], 'G');
                                }}
                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800 font-bold text-[11px] border border-sky-200/60 shadow-xs hover:bg-sky-600 hover:text-white transition-colors cursor-pointer"
                                title={`Practice ${gTag} [G] Guesswork questions for ${ch.topic}`}
                              >
                                {gTag}
                              </button>
                            ) : (
                              <span className="text-slate-300 opacity-40 font-normal">—</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Actions */}
                      <td className="py-2 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rcaQs = mode === 'rca' && rcaSelectedFilter !== 'all'
                                ? (rcaSelectedFilter === 'unclassified'
                                    ? (ch.rcaQuestions?.unclassified || [])
                                    : (ch.rcaQuestions?.[rcaSelectedFilter] || []))
                                : ch.questions;
                              onAskAiTopic(
                                ch.topic,
                                selectedSubject,
                                rcaQs.length > 0 ? rcaQs : ch.questions,
                                {
                                  total: rcaQs.length || ch.total,
                                  wrong: ch.wrong,
                                  slow: ch.slow,
                                  unattempted: ch.unattempted
                                },
                                mode,
                                rcaSelectedFilter !== 'all' ? rcaSelectedFilter : undefined
                              );
                            }}
                            className="inline-flex items-center gap-1 h-6 px-1.5 text-[10px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 hover:text-indigo-800 rounded-md border border-indigo-200/70 transition shadow-2xs cursor-pointer active:scale-95"
                            title={`Ask Tommy AI to analyze ${ch.topic}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                            <span>AI</span>
                          </button>

                          {ch.total > 25 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openSetDropdown?.topic === ch.topic) {
                                  setOpenSetDropdown(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setOpenSetDropdown({
                                    topic: ch.topic,
                                    totalSets,
                                    total: ch.total,
                                    questions: ch.questions,
                                    rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left }
                                  });
                                }
                              }}
                              className={`inline-flex items-center gap-1 h-6 px-2 text-[10px] font-bold text-white rounded-md transition shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap ${
                                openSetDropdown?.topic === ch.topic
                                  ? 'bg-indigo-800 ring-2 ring-indigo-400'
                                  : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800'
                              }`}
                              title={`Choose from ${totalSets} sets for ${ch.topic}`}
                            >
                              <Play className="w-2 h-2 fill-current" />
                              <span>{totalSets} Sets</span>
                              <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-150 ${openSetDropdown?.topic === ch.topic ? 'rotate-180' : ''}`} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (rcaSelectedFilter === 'S' && sillySubFilter !== 'all') {
                                  const sillyQs = (ch.rcaQuestions?.S || (ch.rcaQuestions as any)?.A || [])
                                    .filter(q => matchesSillySubFilter(q, sillySubFilter));
                                  onStartClubbedChapterQuiz(ch.topic, sillyQs, `S_${sillySubFilter}`);
                                } else {
                                  onStartClubbedChapterQuiz(ch.topic, ch.questions);
                                }
                              }}
                              className="inline-flex items-center gap-1 h-6 px-2 text-[10px] font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-md transition shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
                              title={`Practice questions for ${ch.topic}`}
                            >
                              <Play className="w-2 h-2 fill-current" />
                              <span>
                                Drill ({rcaSelectedFilter === 'S' && sillySubFilter !== 'all'
                                  ? (ch.rcaQuestions?.S || (ch.rcaQuestions as any)?.A || []).filter(q => matchesSillySubFilter(q, sillySubFilter)).length
                                  : ch.total
                                })
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Subtopic inline dropdown */}
                    {expandedSubtopicTopic === ch.topic && (() => {
                      // Consolidate fragmented AI subtopics into MAX 7-8 canonical subtopics
                      const subtopics = getConsolidatedSubtopicsForQuestions(ch.topic, ch.questions, 7);

                      const colSpan = isChaptersMode ? 7 : 8;
                      const defaultFilter: ModalFilterType = isChaptersMode
                        ? chapterFilter === 'all' ? 'all' : chapterFilter
                        : rcaSelectedFilter === 'all' ? 'all' : rcaSelectedFilter;

                      return (
                        <tr>
                          <td
                            colSpan={colSpan}
                            className="px-4 pb-3 pt-1 bg-indigo-50/40 border-b border-indigo-100"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 shrink-0">
                                <BookOpen className="w-3 h-3" />
                                Subtopics:
                              </span>

                              {subtopics.length === 0 ? (
                                <span className="text-[11px] text-slate-400 italic">
                                  No subtopic tags on these questions.
                                </span>
                              ) : (
                                subtopics.map(({ label, qs }) => (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Build a filtered chapter data object with only this subtopic's questions
                                      const filteredCh = {
                                        ...ch,
                                        topic: `${ch.topic} › ${label}`,
                                        questions: qs,
                                        total: qs.length,
                                        wrong: qs.filter(q => q.errorType === 'wrong').length,
                                        slow: qs.filter(q => q.errorType === 'speed_issue').length,
                                        unattempted: qs.filter(q => q.errorType === 'unattempted').length,
                                        wrongQuestions: qs.filter(q => q.errorType === 'wrong'),
                                        slowQuestions: qs.filter(q => q.errorType === 'speed_issue'),
                                        unattemptedQuestions: qs.filter(q => q.errorType === 'unattempted'),
                                      };
                                      setExpandedSubtopicTopic(null);
                                      onOpenChapterModal(
                                        filteredCh as any,
                                        defaultFilter,
                                        rcaSelectedFilter === 'S' && sillySubFilter !== 'all' ? sillySubFilter : undefined
                                      );
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors shadow-xs cursor-pointer group/st"
                                    title={`Open ${qs.length} questions under "${label}"`}
                                  >
                                    <span>{label}</span>
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700 group-hover/st:bg-white/30 group-hover/st:text-white">
                                      {qs.length}
                                    </span>
                                  </button>
                                ))
                              )}

                              {/* View All button → open normal full-topic modal */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSubtopicTopic(null);
                                  onOpenChapterModal(
                                    ch,
                                    defaultFilter,
                                    rcaSelectedFilter === 'S' && sillySubFilter !== 'all' ? sillySubFilter : undefined
                                  );
                                }}
                                className="inline-flex items-center gap-1 ml-auto h-6 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-all shadow-2xs cursor-pointer shrink-0 active:scale-95"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" />
                                <span>View All ({ch.total})</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expand / Collapse Remaining Topics Prompt */}
        {activeTopicList.length > 10 && (
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="border-t border-slate-100 p-2.5 sm:p-3 text-center bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer"
          >
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              <span>
                {isExpanded
                  ? 'Show fewer topics'
                  : `View remaining ${remainingTopicsCount} topics (${remainingTopicNames})`}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. ADVISORY FOOTER STRIP                                  */}
      {/* ========================================================= */}
      <aside className="bg-indigo-50/60 border border-indigo-100/90 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-indigo-900 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-indigo-600/10 text-indigo-700 flex items-center justify-center shrink-0">
            <Info className="w-3.5 h-3.5" />
          </div>
          <p className="leading-relaxed font-medium text-[11px] sm:text-xs">
            <strong className="font-semibold text-indigo-950">Remediation Tip:</strong>{' '}
            {isChaptersMode
              ? 'Drill high-error chapters with timed sets of 25 questions to build pacing endurance.'
              : 'Untangle marked Concept Gaps with visual explanations before attempting speed-timed drills.'}
          </p>
        </div>
        {!isChaptersMode && (
          <button
            type="button"
            onClick={() => setShowRcaRulesModal(true)}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 shrink-0 cursor-pointer"
          >
            Review RCA Rules
          </button>
        )}
      </aside>

      {/* Sets Floating Dropdown Menu */}
      {openSetDropdown && (() => {
        const dropdownWidth = 190;
        const estimatedHeight = Math.min(260, 42 + openSetDropdown.totalSets * 34 + 38);
        const spaceBelow = window.innerHeight - openSetDropdown.rect.bottom;
        const openUpward = spaceBelow < estimatedHeight && openSetDropdown.rect.top > estimatedHeight;

        const topPos = openUpward
          ? Math.max(8, openSetDropdown.rect.top - estimatedHeight - 4)
          : Math.min(window.innerHeight - estimatedHeight - 8, openSetDropdown.rect.bottom + 4);

        const rightPos = Math.max(8, window.innerWidth - openSetDropdown.rect.right);

        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/10"
              onClick={(e) => {
                e.stopPropagation();
                setOpenSetDropdown(null);
              }}
            />
            <div
              style={{
                position: 'fixed',
                top: `${topPos}px`,
                right: `${rightPos}px`,
                width: `${dropdownWidth}px`,
                zIndex: 50,
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Select Set
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
                  {openSetDropdown.totalSets} Sets
                </span>
              </div>

              <div className="py-1 max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-50">
                {Array.from({ length: openSetDropdown.totalSets }).map((_, sIdx) => {
                  const setNum = sIdx + 1;
                  const startQ = sIdx * 25 + 1;
                  const endQ = Math.min((sIdx + 1) * 25, openSetDropdown.total);
                  return (
                    <button
                      key={setNum}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const { topic, questions } = openSetDropdown;
                        setOpenSetDropdown(null);
                        onStartClubbedChapterQuiz(topic, questions, undefined, setNum);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-between transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white font-bold text-[10px] flex items-center justify-center transition-colors">
                          {setNum}
                        </span>
                        <span>Set {setNum}</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 group-hover:text-indigo-500">
                        Q{startQ}–{endQ}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-1 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const { topic, questions } = openSetDropdown;
                    setOpenSetDropdown(null);
                    onStartClubbedChapterQuiz(topic, questions);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold text-indigo-700 hover:bg-indigo-100/70 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>Practice All</span>
                  <span className="text-[10px] font-semibold text-indigo-500">({openSetDropdown.total} Qs)</span>
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* RCA Rules Reference Modal */}
      <RcaRulesModal isOpen={showRcaRulesModal} onClose={() => setShowRcaRulesModal(false)} />
    </div>
  );
};
