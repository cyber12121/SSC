import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Flame, Sparkles, XCircle, Zap, AlertCircle, BookOpen, ChevronRight, Target, Check, Tag, Info, Edit3, Eye, EyeOff } from 'lucide-react';
import { Question, RCATagType, RCAClassification } from '../../types';
import { FormattedText } from '../FormattedText';
import { SolutionViewer } from '../SolutionViewer';
import { cleanSolutionText } from '../../utils/cleanSolution';
import { normalizeAnswerKey } from '../../utils/mathSanitizer';
import {
  RCA_TAG_CONFIG,
  findQuestionRca,
  saveQuestionRca,
  SILLY_SUB_TYPES,
  getQuestionSillySubTypes,
  matchesSillySubFilter,
  getSillyPrimaryBadge,
  generatePatternInsight
} from '../../utils/rcaHelper';

export interface MockChapterModalData {
  topic: string;
  subject: string;
  total: number;
  slow: number;
  unattempted: number;
  wrong: number;
  questions: (Question & {
    errorType: 'speed_issue' | 'unattempted' | 'wrong';
    rca?: RCAClassification;
    rcaClassification?: RCAClassification;
    sourceType?: 'full_mock' | 'sectional' | 'subject_wise';
    sourceLabel?: string;
    testName?: string;
  })[];
  slowQuestions: Question[];
  unattemptedQuestions: Question[];
  wrongQuestions: Question[];
  rcaCounts?: Record<RCATagType | 'unclassified', number>;
  rcaQuestions?: Record<RCATagType | 'unclassified', Question[]>;
}

export type ModalFilterType = 'all' | 'wrong' | 'slow' | 'unattempted' | 'C' | 'S' | 'A' | 'T' | 'G' | 'unclassified';

interface MockChapterErrorsModalProps {
  data: MockChapterModalData | null;
  modalErrorFilter: ModalFilterType;
  setModalErrorFilter: (filter: ModalFilterType) => void;
  modalActiveSet: number | 'all';
  setModalActiveSet: (set: number | 'all') => void;
  mockViewMode?: 'chapters' | 'buckets' | 'rca';
  initialSillySubFilter?: string;
  onClose: () => void;
  onStartPractice: (topic: string, questions: Question[], subType?: string, setNum?: number) => void;
  onAskAi: (
    topic: string,
    subject: string,
    questions: Question[],
    counts: { total: number; wrong: number; slow: number; unattempted: number },
    mockViewMode?: 'chapters' | 'buckets' | 'rca',
    activeFilter?: ModalFilterType
  ) => void;
}

export const MockChapterErrorsModal: React.FC<MockChapterErrorsModalProps> = ({
  data,
  modalErrorFilter,
  setModalErrorFilter,
  modalActiveSet,
  setModalActiveSet,
  mockViewMode,
  initialSillySubFilter,
  onClose,
  onStartPractice,
  onAskAi
}) => {
  const [editingNoteQId, setEditingNoteQId] = useState<string | null>(null);
  const [sillyNoteInput, setSillyNoteInput] = useState<string>('');
  const [localRcaOverrides, setLocalRcaOverrides] = useState<Record<string, RCAClassification | null>>({});
  const [modalSillySubFilter, setModalSillySubFilter] = useState<string>(initialSillySubFilter || 'all');
  const [language] = useState<'English'>('English');

  const [showSillyRevisionList, setShowSillyRevisionList] = useState<boolean>(false);
  const [revisedQKeys, setRevisedQKeys] = useState<Set<string>>(new Set());
  const [peekQuestionQId, setPeekQuestionQId] = useState<string | null>(null);

  // Keep modal silly sub-filter in sync with incoming prop
  useEffect(() => {
    if (initialSillySubFilter) {
      setModalSillySubFilter(initialSillySubFilter);
    }
  }, [initialSillySubFilter]);

  // Turn off revision view when user switches to a non-silly filter
  useEffect(() => {
    if (modalErrorFilter !== 'S' && (modalErrorFilter as any) !== 'A') {
      setShowSillyRevisionList(false);
    }
  }, [modalErrorFilter]);

  if (!data) return null;

  // Resolve question's effective RCA with local override
  const getQuestionEffectiveRca = (q: any): RCAClassification | undefined => {
    const qKey = q.id || q.question?.trim().toLowerCase() || '';
    if (localRcaOverrides[qKey] !== undefined) {
      return localRcaOverrides[qKey] || undefined;
    }
    return findQuestionRca(q) || q.rca || q.rcaClassification;
  };

  const handleUpdateRca = (q: any, tag: RCATagType | null, note?: string) => {
    const saved = saveQuestionRca(q, tag, note, data.subject);
    const qKey = q.id || q.question?.trim().toLowerCase() || '';
    setLocalRcaOverrides(prev => ({
      ...prev,
      [qKey]: saved || null
    }));
    if (q) {
      q.rca = saved;
      q.rcaClassification = saved;
    }
  };

  // Silly Mistake Sub-Type counts for this specific chapter
  const chapterSillySubTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      calculation: 0,
      misread: 0,
      option: 0,
      formula: 0,
      rushed: 0,
      unit: 0,
      custom: 0,
      unspecified: 0
    };
    data.questions.forEach(q => {
      const r = getQuestionEffectiveRca(q);
      if (r?.tag === 'S' || (r?.tag as any) === 'A') {
        counts.all++;
        const types = getQuestionSillySubTypes(q);
        types.forEach(t => {
          if (counts[t] !== undefined) counts[t]++;
        });
      }
    });
    return counts;
  }, [data.questions, localRcaOverrides]);

  // Filter questions according to active filter
  const modalFilteredQuestions = (() => {
    if (modalErrorFilter === 'wrong') return data.wrongQuestions;
    if (modalErrorFilter === 'slow') return data.slowQuestions;
    if (modalErrorFilter === 'unattempted') return data.unattemptedQuestions;
    if (['C', 'S', 'A', 'T', 'G', 'unclassified'].includes(modalErrorFilter)) {
      return data.questions.filter(q => {
        const rca = getQuestionEffectiveRca(q);
        if (modalErrorFilter === 'unclassified') {
          return !rca || !rca.tag;
        }
        const effectiveTag = ((rca?.tag as any) === 'A') ? 'S' : rca?.tag;
        const targetTag = ((modalErrorFilter as any) === 'A') ? 'S' : modalErrorFilter;
        if (effectiveTag !== targetTag) return false;

        // Sub-filter by silly mistake type
        if (targetTag === 'S' && modalSillySubFilter !== 'all') {
          return matchesSillySubFilter(q, modalSillySubFilter);
        }
        return true;
      });
    }
    return data.questions;
  })();

  const totalSetsInModal = Math.ceil(modalFilteredQuestions.length / 25);
  const currentSetNum = typeof modalActiveSet === 'number' && modalActiveSet <= totalSetsInModal ? modalActiveSet : 1;
  const modalDisplayedQuestions = (modalActiveSet === 'all' || totalSetsInModal <= 1)
    ? modalFilteredQuestions
    : modalFilteredQuestions.slice((currentSetNum - 1) * 25, currentSetNum * 25);

  const rcaCounts: Record<string, number> = {
    C: (data.rcaCounts?.C || 0),
    S: (data.rcaCounts?.S || (data.rcaCounts as any)?.A || 0),
    T: (data.rcaCounts?.T || 0),
    G: (data.rcaCounts?.G || 0),
    unclassified: (data.rcaCounts?.unclassified || 0)
  };

  const patternInsight = useMemo(() => {
    if (modalErrorFilter !== 'S' && modalErrorFilter !== 'A') return null;
    return generatePatternInsight(modalFilteredQuestions, modalSillySubFilter);
  }, [modalErrorFilter, modalFilteredQuestions, modalSillySubFilter]);

  // Formatted silly mistake items for the Revision Sheet (typed notes and selected slips to revise, NOT the questions)
  const sillyMistakesList = useMemo(() => {
    return data.questions.filter(q => {
      const r = getQuestionEffectiveRca(q);
      const tag = (r?.tag as any) === 'A' ? 'S' : r?.tag;
      if (tag !== 'S') return false;
      if (modalSillySubFilter !== 'all') {
        return matchesSillySubFilter(q, modalSillySubFilter);
      }
      return true;
    }).map((q, idx) => {
      const rca = getQuestionEffectiveRca(q);
      const subTypes = getQuestionSillySubTypes(q);
      const primarySub = subTypes[0] || rca?.subTag || 'unspecified';
      const subConfig = SILLY_SUB_TYPES[primarySub] || SILLY_SUB_TYPES.unspecified;
      const typedNote = (rca?.note || rca?.sillyMistakeNote || (q as any).sillyMistakeNote || (q as any).userTypedSillyNote || '').trim();
      const qKey = q.id || q.question?.trim().toLowerCase() || String(idx);
      const originalIdx = data.questions.indexOf(q);
      const displayNum = originalIdx >= 0 ? originalIdx + 1 : idx + 1;

      return {
        question: q,
        qKey,
        displayNum,
        primarySub,
        subConfig,
        typedNote,
        topic: (q as any).topic || data.topic,
        sourceLabel: (q as any).sourceLabel || ((q as any).sourceType === 'full_mock' ? 'Full Mock' : (q as any).sourceType === 'sectional' ? 'Sectional' : data.subject),
        testName: (q as any).testName,
        timeTaken: (q as any).timeTaken || (q as any).timeSpent,
        rca
      };
    });
  }, [data.questions, localRcaOverrides, modalSillySubFilter, data.topic, data.subject]);

  const toggleRevised = (qKey: string) => {
    setRevisedQKeys(prev => {
      const next = new Set(prev);
      if (next.has(qKey)) {
        next.delete(qKey);
      } else {
        next.add(qKey);
      }
      return next;
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="bg-white w-full sm:max-w-3xl max-h-[90vh] sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
        >
          {/* Modal Header */}
          <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 text-white rounded-t-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-white/80 text-xs font-semibold">
                    {data.total} total error questions
                  </span>
                  {totalSetsInModal > 1 && (
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md">
                      {totalSetsInModal} Sets of 25
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black text-white leading-tight">{data.topic}</h2>

                {/* Main Filter Section */}
                <div className="space-y-2 mt-3.5">
                  {/* 1. Main Filter Bar (Top Level) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* [ All Mistakes ] */}
                    <button
                      type="button"
                      onClick={() => {
                        setModalErrorFilter('all');
                        setModalActiveSet(totalSetsInModal > 1 ? 1 : 'all');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        modalErrorFilter === 'all'
                          ? 'bg-white text-indigo-950 shadow-md ring-2 ring-white/60 font-black'
                          : 'bg-white/15 hover:bg-white/25 text-white border border-white/10'
                      }`}
                    >
                      <span>All Mistakes</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        modalErrorFilter === 'all' ? 'bg-indigo-100 text-indigo-900 font-black' : 'bg-black/25 text-white font-bold'
                      }`}>
                        {data.total}
                      </span>
                    </button>

                    {/* [ ⚡ Silly Mistakes ] */}
                    <button
                      type="button"
                      onClick={() => {
                        setModalErrorFilter('S');
                        setModalActiveSet(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        modalErrorFilter === 'S' || modalErrorFilter === 'A'
                          ? 'bg-rose-500 text-white shadow-md ring-2 ring-white/80 font-black'
                          : rcaCounts.S > 0
                          ? 'bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 border border-rose-400/30'
                          : 'bg-white/10 text-white/50 hover:bg-white/20'
                      }`}
                    >
                      <span>⚡ Silly Mistakes</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        modalErrorFilter === 'S' || modalErrorFilter === 'A' ? 'bg-white text-rose-800 font-black' : 'bg-black/25 text-white font-bold'
                      }`}>
                        {rcaCounts.S}
                      </span>
                    </button>

                    {/* [ 🧠 Concept Gaps ] */}
                    <button
                      type="button"
                      onClick={() => {
                        setModalErrorFilter('C');
                        setModalActiveSet(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        modalErrorFilter === 'C'
                          ? 'bg-purple-600 text-white shadow-md ring-2 ring-white/80 font-black'
                          : rcaCounts.C > 0
                          ? 'bg-purple-500/25 hover:bg-purple-500/40 text-purple-100 border border-purple-400/30'
                          : 'bg-white/10 text-white/50 hover:bg-white/20'
                      }`}
                    >
                      <span>🧠 Concept Gaps</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        modalErrorFilter === 'C' ? 'bg-white text-purple-900 font-black' : 'bg-black/25 text-white font-bold'
                      }`}>
                        {rcaCounts.C}
                      </span>
                    </button>

                    {/* [ ⏱️ Time Traps ] */}
                    <button
                      type="button"
                      onClick={() => {
                        setModalErrorFilter('T');
                        setModalActiveSet(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        modalErrorFilter === 'T'
                          ? 'bg-amber-500 text-white shadow-md ring-2 ring-white/80 font-black'
                          : rcaCounts.T > 0
                          ? 'bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 border border-amber-400/30'
                          : 'bg-white/10 text-white/50 hover:bg-white/20'
                      }`}
                    >
                      <span>⏱️ Time Traps</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        modalErrorFilter === 'T' ? 'bg-white text-amber-950 font-black' : 'bg-black/25 text-white font-bold'
                      }`}>
                        {rcaCounts.T}
                      </span>
                    </button>

                    {/* Optional Guesswork & Unclassified */}
                    {rcaCounts.G > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalErrorFilter('G');
                          setModalActiveSet(1);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                          modalErrorFilter === 'G'
                            ? 'bg-blue-600 text-white shadow-md ring-2 ring-white/80 font-black'
                            : 'bg-blue-500/25 hover:bg-blue-500/40 text-blue-100 border border-blue-400/30'
                        }`}
                      >
                        <span>🎯 Guesswork</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25 font-mono">
                          {rcaCounts.G}
                        </span>
                      </button>
                    )}

                    {rcaCounts.unclassified > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalErrorFilter('unclassified');
                          setModalActiveSet(1);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                          modalErrorFilter === 'unclassified'
                            ? 'bg-slate-800 text-white shadow-md ring-2 ring-slate-400 font-black'
                            : 'bg-white/15 hover:bg-white/25 text-white/90 border border-white/10'
                        }`}
                      >
                        <span>❓ Unclassified</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25 font-mono">
                          {rcaCounts.unclassified}
                        </span>
                      </button>
                    )}

                    {/* Non-RCA error filter quick toggles when in chapter view */}
                    {mockViewMode !== 'rca' && (
                      <div className="flex items-center gap-1 pl-1.5 ml-1 border-l border-white/20">
                        {data.wrong > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalErrorFilter('wrong');
                              setModalActiveSet(1);
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              modalErrorFilter === 'wrong'
                                ? 'bg-rose-600 text-white shadow-xs ring-1 ring-white/60'
                                : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-100'
                            }`}
                          >
                            <XCircle className="w-3 h-3" /> {data.wrong} Wrong
                          </button>
                        )}
                        {data.slow > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalErrorFilter('slow');
                              setModalActiveSet(1);
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              modalErrorFilter === 'slow'
                                ? 'bg-amber-600 text-white shadow-xs ring-1 ring-white/60'
                                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100'
                            }`}
                          >
                            <Zap className="w-3 h-3" /> {data.slow} Slow
                          </button>
                        )}
                        {data.unattempted > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalErrorFilter('unattempted');
                              setModalActiveSet(1);
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              modalErrorFilter === 'unattempted'
                                ? 'bg-blue-600 text-white shadow-xs ring-1 ring-white/60'
                                : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-100'
                            }`}
                          >
                            <AlertCircle className="w-3 h-3" /> {data.unattempted} Skipped
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Sub-Type Pills (Appears when you click "Silly Mistakes") */}
                  {(modalErrorFilter === 'S' || modalErrorFilter === 'A') && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-white/20 mt-1">
                      {/* (i) Icon on the left for Revision Mode */}
                      <button
                        type="button"
                        onClick={() => setShowSillyRevisionList(prev => !prev)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border ${
                          showSillyRevisionList
                            ? 'bg-amber-300 text-slate-950 border-amber-400 font-extrabold shadow-md ring-2 ring-white/90 scale-105'
                            : 'bg-white/25 hover:bg-white/35 text-white border-white/25'
                        }`}
                        title={showSillyRevisionList ? "Switch back to Question Cards" : "Revise Silly Mistakes (typed notes & slips only, not questions)"}
                      >
                        <Info className="w-3.5 h-3.5 text-amber-200" />
                        <span>{showSillyRevisionList ? 'Show Questions' : 'Revise Mistakes'}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          showSillyRevisionList ? 'bg-black/20 text-slate-950 font-black' : 'bg-black/20 text-white'
                        }`}>
                          {sillyMistakesList.length}
                        </span>
                      </button>

                      <span className="text-[10px] font-black text-rose-200 uppercase tracking-wider mr-1 ml-1 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-rose-300" /> Sub-Types:
                      </span>

                      {/* [ All Silly ] */}
                      <button
                        type="button"
                        onClick={() => {
                          setModalSillySubFilter('all');
                          setModalActiveSet(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                          modalSillySubFilter === 'all'
                            ? 'bg-white text-rose-900 shadow-sm ring-2 ring-white/80 font-black'
                            : 'bg-white/20 hover:bg-white/30 text-white'
                        }`}
                      >
                        <span>All Silly</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono font-bold">
                          ({rcaCounts.S})
                        </span>
                      </button>

                      {/* Sub-type pills breakdown */}
                      {Object.values(SILLY_SUB_TYPES).map(sub => {
                        const count = chapterSillySubTypeCounts[sub.id] || 0;
                        if (count === 0 && sub.id !== 'calculation' && sub.id !== 'misread' && sub.id !== 'option' && sub.id !== 'formula') {
                          return null;
                        }
                        const isSelected = modalSillySubFilter === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setModalSillySubFilter(isSelected ? 'all' : sub.id);
                              setModalActiveSet(1);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                              isSelected
                                ? 'bg-white text-rose-900 font-extrabold shadow-md ring-2 ring-rose-200'
                                : count > 0
                                ? 'bg-white/20 hover:bg-white/30 text-white'
                                : 'bg-white/10 text-white/50 hover:bg-white/20'
                            }`}
                            title={sub.desc}
                          >
                            <span>{sub.icon}</span>
                            <span>{sub.label}</span>
                            <span className="text-[10px] font-mono opacity-80 font-bold">
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-xl bg-white/20 text-white font-bold text-[10px] border border-white/20 shadow-2xs">
                  English
                </span>

                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Set Selector Tabs (if > 25 questions in current filter) */}
            {totalSetsInModal > 1 && (
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/15 overflow-x-auto pb-0.5">
                <span className="text-[11px] font-bold text-white/75 shrink-0 mr-1">Choose Set:</span>
                {Array.from({ length: totalSetsInModal }).map((_, sIdx) => {
                  const sNum = sIdx + 1;
                  const sStart = sIdx * 25 + 1;
                  const sEnd = Math.min((sIdx + 1) * 25, modalFilteredQuestions.length);
                  const isSelected = modalActiveSet === sNum;
                  return (
                    <button
                      key={sNum}
                      onClick={() => setModalActiveSet(sNum)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'bg-white/15 hover:bg-white/25 text-white'
                      }`}
                    >
                      Set {sNum} ({sStart}-{sEnd})
                    </button>
                  );
                })}
                <button
                  onClick={() => setModalActiveSet('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    modalActiveSet === 'all'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  All ({modalFilteredQuestions.length})
                </button>
              </div>
            )}

            {/* Quick Drill Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/15">
              {/* Practice Active Set Button */}
              {totalSetsInModal > 1 && modalActiveSet !== 'all' ? (
                <button
                  onClick={() => {
                    const subType = modalErrorFilter === 'all' ? undefined : modalErrorFilter;
                    onClose();
                    onStartPractice(data.topic, modalFilteredQuestions, subType, currentSetNum);
                  }}
                  className="h-8 px-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start Set {currentSetNum} ({modalDisplayedQuestions.length})</span>
                </button>
              ) : null}

              {/* Practice All Questions in Active Filter */}
              <button
                onClick={() => {
                  const subType = modalErrorFilter === 'all' ? undefined : modalErrorFilter;
                  onClose();
                  onStartPractice(data.topic, modalFilteredQuestions, subType);
                }}
                className={`h-8 px-3.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  totalSetsInModal > 1 && modalActiveSet !== 'all'
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-white text-indigo-900 hover:bg-indigo-50 shadow-sm'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Practice All ({modalFilteredQuestions.length})</span>
              </button>

              {/* 1-Click Drill Silly Mistakes [S] */}
              {rcaCounts.S > 0 && modalErrorFilter !== 'S' && (
                <button
                  onClick={() => {
                    const sQuestions = data.questions.filter(q => {
                      const t = getQuestionEffectiveRca(q)?.tag;
                      return t === 'S' || (t as any) === 'A';
                    });
                    onClose();
                    onStartPractice(data.topic, sQuestions, 'S');
                  }}
                  className="h-8 px-3 bg-rose-500 hover:bg-rose-400 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title={`Drill all ${rcaCounts.S} silly mistake questions`}
                >
                  <span className="font-mono text-[10px] font-bold">[S]</span>
                  <span>Drill Silly ({rcaCounts.S})</span>
                </button>
              )}

              {/* 1-Click Drill Conceptual Gaps [C] */}
              {rcaCounts.C > 0 && modalErrorFilter !== 'C' && (
                <button
                  onClick={() => {
                    const cQuestions = data.questions.filter(q => getQuestionEffectiveRca(q)?.tag === 'C');
                    onClose();
                    onStartPractice(data.topic, cQuestions, 'C');
                  }}
                  className="h-8 px-3 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title={`Drill all ${rcaCounts.C} conceptual gap questions`}
                >
                  <span className="font-mono text-[10px] font-bold">[C]</span>
                  <span>Drill Concept ({rcaCounts.C})</span>
                </button>
              )}

              <button
                onClick={() => {
                  onAskAi(
                    data.topic,
                    data.subject,
                    modalFilteredQuestions,
                    {
                      total: data.total,
                      wrong: data.wrong,
                      slow: data.slow,
                      unattempted: data.unattempted
                    },
                    mockViewMode,
                    modalErrorFilter
                  );
                }}
                className="h-8 px-3 bg-white/20 hover:bg-white/30 border border-white/30 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ml-auto active:scale-95"
                title={`Ask Tommy AI to analyze ${data.topic}`}
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Ask AI</span>
              </button>
            </div>
          </div>

          {/* Questions List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Speed & Pattern Insight Banner */}
            {patternInsight && (
              <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 border border-amber-400/40 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-100" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <span>⚡ Speed & Pattern Insight</span>
                    {modalSillySubFilter !== 'all' && SILLY_SUB_TYPES[modalSillySubFilter] && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-900 font-bold">
                        {SILLY_SUB_TYPES[modalSillySubFilter].label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-800 mt-1 leading-relaxed">
                    "{patternInsight}"
                  </p>
                </div>
              </div>
            )}

            {showSillyRevisionList ? (
              /* Silly Mistakes Revision Sheet (Habits & Notes Only, NOT Questions) */
              <div className="space-y-3.5">
                {/* Revision Header / Mode Indicator */}
                <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-pink-500/10 border border-rose-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs font-black uppercase tracking-wider text-rose-950">
                          ⚡ Silly Mistakes Revision Sheet
                        </h3>
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.2 rounded-full border border-rose-200">
                          {revisedQKeys.size} of {sillyMistakesList.length} Revised
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                        Reviewing your typed notes & slip classifications to rewire habits before exam. Questions hidden.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSillyRevisionList(false)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>View Questions</span>
                  </button>
                </div>

                {sillyMistakesList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-semibold bg-white rounded-2xl border border-dashed border-slate-200">
                    No silly mistakes found under the current sub-filter.
                  </div>
                ) : (
                  sillyMistakesList.map((item) => {
                    const isRevised = revisedQKeys.has(item.qKey);
                    const isEditing = editingNoteQId === item.qKey;
                    const isPeeking = peekQuestionQId === item.qKey;
                    const cfg = item.subConfig;

                    return (
                      <div
                        key={item.qKey}
                        className={`rounded-2xl border transition-all p-4 ${
                          isRevised
                            ? 'bg-slate-50/80 border-slate-200 opacity-75'
                            : 'bg-white border-rose-100 shadow-xs hover:border-rose-300'
                        }`}
                      >
                        {/* Meta Header */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {/* Checkbox to mark revised */}
                            <button
                              type="button"
                              onClick={() => toggleRevised(item.qKey)}
                              className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                                isRevised
                                  ? 'bg-emerald-500 border-emerald-600 text-white shadow-2xs'
                                  : 'border-slate-300 hover:border-slate-400 bg-white'
                              }`}
                              title={isRevised ? "Mark unrevised" : "Mark revised"}
                            >
                              {isRevised && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>

                            <span className={`text-xs font-black font-mono ${isRevised ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              Q{item.displayNum}
                            </span>

                            {/* Slip Type Badge */}
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${cfg.badgeClass}`}>
                              <span>{cfg.icon}</span>
                              <span>{cfg.label}</span>
                            </span>

                            {/* Topic pill */}
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {item.topic}
                            </span>

                            {item.timeTaken && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                ⏱️ {item.timeTaken}s
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Peek question toggle (collapsed by default) */}
                            <button
                              type="button"
                              onClick={() => setPeekQuestionQId(isPeeking ? null : item.qKey)}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
                              title="Glance at question text without leaving revision sheet"
                            >
                              {isPeeking ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              <span>{isPeeking ? 'Hide Q' : 'Peek Q'}</span>
                            </button>

                            {/* Drill this Q */}
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onStartPractice(`${data.topic} (Q${item.displayNum})`, [item.question]);
                              }}
                              className="text-[10px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer flex items-center gap-1"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>Drill</span>
                            </button>
                          </div>
                        </div>

                        {/* Note & Slip Reason Display */}
                        <div className="mt-3 space-y-2">
                          {item.typedNote ? (
                            <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-900 flex items-center gap-1">
                                  ✍️ Your Typed Slip Note:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteQId(isEditing ? null : item.qKey);
                                    setSillyNoteInput(item.typedNote);
                                  }}
                                  className="text-[10px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" /> {isEditing ? 'Cancel' : 'Edit'}
                                </button>
                              </div>
                              <p className="font-semibold text-slate-900 text-xs leading-relaxed italic">
                                "{item.typedNote}"
                              </p>
                            </div>
                          ) : (
                            <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-extrabold uppercase tracking-wider text-[10px] text-rose-800 flex items-center gap-1">
                                  📌 Selected Slip: {cfg.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteQId(isEditing ? null : item.qKey);
                                    setSillyNoteInput('');
                                  }}
                                  className="text-[10px] font-bold text-rose-700 hover:text-rose-950 flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" /> {isEditing ? 'Cancel' : '+ Add personal note'}
                                </button>
                              </div>
                              <p className="text-slate-700 text-xs leading-relaxed">
                                {cfg.desc}
                              </p>
                            </div>
                          )}

                          {/* Inline note edit box */}
                          {isEditing && (
                            <div className="flex items-center gap-2 p-2 bg-white border border-rose-300 rounded-xl shadow-2xs">
                              <input
                                type="text"
                                value={sillyNoteInput}
                                onChange={e => setSillyNoteInput(e.target.value)}
                                placeholder="Type what you did wrong (e.g., misread sign, forgot to multiply by 100)..."
                                className="flex-1 bg-rose-50/50 border border-rose-200 rounded px-2.5 py-1 text-xs text-rose-950 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateRca(item.question, 'S', sillyNoteInput);
                                  setEditingNoteQId(null);
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-3 py-1 rounded transition-colors cursor-pointer shrink-0"
                              >
                                Save Note
                              </button>
                            </div>
                          )}

                          {/* Collapsible Question Peek (only shown if user clicks "Peek Q") */}
                          {isPeeking && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs mt-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                Question Preview (Q{item.displayNum}):
                              </span>
                              <div className="text-slate-800 leading-relaxed max-h-36 overflow-y-auto">
                                <FormattedText text={item.question.question} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : modalDisplayedQuestions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm font-semibold">
                No questions found under this filter ({modalErrorFilter}).
              </div>
            ) : (
              modalDisplayedQuestions.map((q, qIdx) => {
                const isWrong = q.errorType === 'wrong';
                const isSlow = q.errorType === 'speed_issue';
                const displayNum = (typeof modalActiveSet === 'number' && modalActiveSet > 1)
                  ? (modalActiveSet - 1) * 25 + qIdx + 1
                  : qIdx + 1;

                const qRca = getQuestionEffectiveRca(q);
                const qKey = q.id || q.question?.trim().toLowerCase() || String(qIdx);
                const isEditingSilly = editingNoteQId === qKey;

                return (
                  <div key={qKey} className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden shadow-xs">
                    {/* Question header with Error Status & RCA Tag */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Q{displayNum}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          isWrong ? 'bg-red-100 text-red-700' :
                          isSlow ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {isWrong ? '✗ Wrong Answer' : isSlow ? '⚡ Speed Issue' : '◯ Skipped / Left'}
                        </span>
                      </div>

                      {/* Origin and RCA Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Origin Pill: Full Mock vs Sectional vs Subject-Wise */}
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

                        {/* Current RCA Badge (for non-Silly) */}
                        {qRca?.tag && qRca.tag !== 'S' && (qRca.tag as any) !== 'A' ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            RCA_TAG_CONFIG[qRca.tag]?.lightClass || 'bg-slate-100 text-slate-700'
                          }`}>
                            <span className="font-mono">[{qRca.tag}]</span>
                            <span>{qRca.tagName || RCA_TAG_CONFIG[qRca.tag]?.label}</span>
                          </span>
                        ) : !qRca?.tag ? (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                            Unclassified
                          </span>
                        ) : null}

                        {/* Exact Silly Mistake Categorized Badge */}
                        {(qRca?.tag === 'S' || (qRca?.tag as any) === 'A') && (() => {
                          const badge = getSillyPrimaryBadge(q);
                          return (
                            <span 
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border shadow-2xs max-w-xs truncate ${badge.badgeClass}`} 
                              title={badge.noteText ? `Silly Mistake: ${badge.noteText}` : badge.label}
                            >
                              <span>{badge.icon}</span>
                              <span className="truncate">{badge.label}</span>
                              {badge.noteText && (
                                <span className="text-[9px] opacity-75 font-normal truncate max-w-[130px] italic">
                                  ({badge.noteText})
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <FormattedText
                        text={q.question}
                        language={language}
                        as="div"
                        className="text-sm font-semibold text-slate-900 whitespace-pre-line leading-relaxed"
                        isQuestion={true}
                        subject={q.subject || q.section || data.subject}
                      />

                      {/* Question Image if present */}
                      {q.image?.src && (
                        <div className="my-3 border border-slate-200 rounded-xl p-2 inline-block bg-white shadow-xs">
                          <img
                            src={q.image.src}
                            alt={q.image.caption || "Question diagram"}
                            className="max-w-full h-auto object-contain max-h-72 rounded-lg"
                            referrerPolicy="no-referrer"
                          />
                          {q.image.caption && (
                            <p className="mt-1 text-xs text-slate-500 italic text-center">{q.image.caption}</p>
                          )}
                        </div>
                      )}

                      {/* Options */}
                      {q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(['a', 'b', 'c', 'd'] as const).map(optKey => {
                            const optText = q.options[optKey] || (q.options as any)[optKey.toUpperCase()] || '';
                            if (!optText) return null;
                            const correctKey = normalizeAnswerKey(q.answer || (q as any).correct_answer || (q as any).correctOption);
                            const isCorrect = correctKey === optKey;
                            return (
                              <div
                                key={optKey}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs font-semibold ${
                                  isCorrect
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                <span className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center font-black text-[11px] uppercase ${
                                  isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {optKey}
                                </span>
                                <span className="flex-1 min-w-0">
                                  <FormattedText text={optText} language={language} subject={q.subject || q.section || data.subject} />
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Silly Note if present */}
                      {(qRca?.tag === 'S' || (qRca?.tag as any) === 'A') && qRca.sillyMistakeNote && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-800 flex items-start gap-2">
                          <span className="font-bold shrink-0">📝 Silly Note:</span>
                          <span className="italic">{qRca.sillyMistakeNote}</span>
                        </div>
                      )}

                      {/* Solution Dropdown */}
                      {q.solution && (
                        <details className="group">
                          <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 select-none py-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            View Solution
                            <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                          </summary>
                          <div className="mt-2 text-xs font-medium text-slate-700 leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                            <SolutionViewer
                              solution={q.solution}
                              language={language}
                              subject={q.subject || q.section || data.subject}
                            />
                          </div>
                        </details>
                      )}

                      {/* Interactive RCA Classifier Bar */}
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-indigo-500" /> Classify RCA:
                          </span>
                          {(['C', 'S', 'T', 'G'] as const).map(tagKey => {
                            const cfg = RCA_TAG_CONFIG[tagKey];
                            const isCurrent = qRca?.tag === tagKey || (tagKey === 'S' && (qRca?.tag as any) === 'A');
                            return (
                              <button
                                key={tagKey}
                                type="button"
                                onClick={() => {
                                  if (tagKey === 'S') {
                                    setEditingNoteQId(isEditingSilly ? null : qKey);
                                    setSillyNoteInput(qRca?.sillyMistakeNote || '');
                                  } else {
                                    setEditingNoteQId(null);
                                  }
                                  handleUpdateRca(q, tagKey, tagKey === 'S' ? (sillyNoteInput || qRca?.sillyMistakeNote) : undefined);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  isCurrent
                                    ? cfg.pillClass + ' ring-1 ring-slate-900/20'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                }`}
                                title={cfg.desc}
                              >
                                <span>[{tagKey}] {cfg.shortLabel}</span>
                                {isCurrent && <Check className="w-2.5 h-2.5" />}
                              </button>
                            );
                          })}
                          {qRca?.tag && (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateRca(q, null);
                                setEditingNoteQId(null);
                              }}
                              className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Clear RCA classification"
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => {
                              const effectiveTag = (qRca?.tag as any) === 'A' ? 'S' : qRca?.tag;
                              const effectiveTagName = qRca?.tagName || (effectiveTag ? RCA_TAG_CONFIG[effectiveTag as RCATagType]?.label : undefined);
                              const sillyNote = qRca?.sillyMistakeNote || (q as any).sillyMistakeNote;
                              const isRcaActive = mockViewMode === 'rca' || ['C', 'S', 'T', 'G', 'A'].includes(modalErrorFilter);

                              window.dispatchEvent(new CustomEvent('cgl_ask_ai_question', {
                                detail: {
                                  questionNumber: displayNum,
                                  questionText: q.question,
                                  options: q.options,
                                  userAnswer: (q as any).userAnswer,
                                  correctAnswer: q.answer,
                                  solution: q.solution,
                                  topic: data.topic,
                                  sourceType: (q as any).sourceType || 'subject_wise',
                                  sourceLabel: (q as any).sourceLabel || ((q as any).sourceType === 'full_mock' ? 'Full Mock Test' : (q as any).sourceType === 'sectional' ? 'Sectional Test' : `Subject-Wise (${data.subject})`),
                                  testName: (q as any).testName,
                                  rcaMode: isRcaActive ? 'rca' : mockViewMode,
                                  rcaTag: effectiveTag,
                                  rcaTagName: effectiveTagName,
                                  sillyMistakeNote: sillyNote
                                }
                              }));
                            }}
                            className="h-6 px-2 text-[10px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-md border border-purple-200/70 transition shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Ask Tommy to explain this question and eliminate traps"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                            <span>Ask Tommy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onStartPractice(`${data.topic} (Q${displayNum})`, [q]);
                            }}
                            className="h-6 px-2 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200/70 transition shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Drill Q</span>
                          </button>
                        </div>
                      </div>

                      {/* Silly Mistake Note Input box when editing */}
                      {isEditingSilly && (
                        <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-200 rounded-xl">
                          <input
                            type="text"
                            value={sillyNoteInput}
                            onChange={e => setSillyNoteInput(e.target.value)}
                            placeholder="Why was it a silly mistake? (e.g., misread units, calculation error)..."
                            className="flex-1 bg-white border border-rose-300 rounded px-2.5 py-1 text-xs text-rose-950 focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateRca(q, 'S', sillyNoteInput);
                              setEditingNoteQId(null);
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-3 py-1 rounded transition-colors cursor-pointer shrink-0"
                          >
                            Save Note
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Showing {modalDisplayedQuestions.length} of {modalFilteredQuestions.length} questions
              {totalSetsInModal > 1 && typeof modalActiveSet === 'number' ? ` • Set ${currentSetNum}` : ''}
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
