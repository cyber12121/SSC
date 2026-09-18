import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Flame, Sparkles, XCircle, Zap, AlertCircle, BookOpen, ChevronRight, Target, Check, Tag } from 'lucide-react';
import { Question, RCATagType, RCAClassification } from '../../types';
import { FormattedText } from '../FormattedText';
import { SolutionViewer } from '../SolutionViewer';
import { cleanSolutionText } from '../../utils/cleanSolution';
import { normalizeAnswerKey } from '../../utils/mathSanitizer';
import { RCA_TAG_CONFIG, findQuestionRca, saveQuestionRca } from '../../utils/rcaHelper';

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

export type ModalFilterType = 'all' | 'wrong' | 'slow' | 'unattempted' | 'C' | 'A' | 'T' | 'G' | 'unclassified';

interface MockChapterErrorsModalProps {
  data: MockChapterModalData | null;
  modalErrorFilter: ModalFilterType;
  setModalErrorFilter: (filter: ModalFilterType) => void;
  modalActiveSet: number | 'all';
  setModalActiveSet: (set: number | 'all') => void;
  onClose: () => void;
  onStartPractice: (topic: string, questions: Question[], subType?: string, setNum?: number) => void;
  onAskAi: (topic: string, subject: string, questions: Question[], counts: { total: number; wrong: number; slow: number; unattempted: number }) => void;
}

export const MockChapterErrorsModal: React.FC<MockChapterErrorsModalProps> = ({
  data,
  modalErrorFilter,
  setModalErrorFilter,
  modalActiveSet,
  setModalActiveSet,
  onClose,
  onStartPractice,
  onAskAi
}) => {
  const [editingNoteQId, setEditingNoteQId] = useState<string | null>(null);
  const [sillyNoteInput, setSillyNoteInput] = useState<string>('');
  const [localRcaOverrides, setLocalRcaOverrides] = useState<Record<string, RCAClassification | null>>({});
  const [language] = useState<'English'>('English');

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

  // Filter questions according to active filter
  const modalFilteredQuestions = (() => {
    if (modalErrorFilter === 'wrong') return data.wrongQuestions;
    if (modalErrorFilter === 'slow') return data.slowQuestions;
    if (modalErrorFilter === 'unattempted') return data.unattemptedQuestions;
    if (['C', 'A', 'T', 'G', 'unclassified'].includes(modalErrorFilter)) {
      return data.questions.filter(q => {
        const rca = getQuestionEffectiveRca(q);
        if (modalErrorFilter === 'unclassified') {
          return !rca || !rca.tag;
        }
        return rca?.tag === modalErrorFilter;
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
                  <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                    {data.subject}
                  </span>
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

                {/* Primary Error Type & RCA Filter Tabs */}
                <div className="space-y-2 mt-3">
                  {/* Row 1: Traditional Error Filters */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => {
                        setModalErrorFilter('all');
                        setModalActiveSet(totalSetsInModal > 1 ? 1 : 'all');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        modalErrorFilter === 'all'
                          ? 'bg-white text-indigo-900 shadow-xs'
                          : 'bg-white/15 hover:bg-white/25 text-white'
                      }`}
                    >
                      All ({data.total})
                    </button>
                    {data.wrong > 0 && (
                      <button
                        onClick={() => {
                          setModalErrorFilter('wrong');
                          setModalActiveSet(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          modalErrorFilter === 'wrong'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-rose-500/30 hover:bg-rose-500/40 text-rose-100 border border-rose-300/30'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> {data.wrong} Wrong
                      </button>
                    )}
                    {data.slow > 0 && (
                      <button
                        onClick={() => {
                          setModalErrorFilter('slow');
                          setModalActiveSet(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          modalErrorFilter === 'slow'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-amber-500/30 hover:bg-amber-500/40 text-amber-100 border border-amber-300/30'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" /> {data.slow} Slow
                      </button>
                    )}
                    {data.unattempted > 0 && (
                      <button
                        onClick={() => {
                          setModalErrorFilter('unattempted');
                          setModalActiveSet(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          modalErrorFilter === 'unattempted'
                            ? 'bg-blue-500 text-white shadow-xs'
                            : 'bg-blue-500/30 hover:bg-blue-500/40 text-blue-100 border border-blue-300/30'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5" /> {data.unattempted} Skipped
                      </button>
                    )}
                  </div>

                  {/* Row 2: 4-Bucket RCA Filters */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-white/15">
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider mr-1 flex items-center gap-1">
                      <Target className="w-3 h-3 text-amber-300" /> RCA:
                    </span>
                    {(['C', 'S', 'T', 'G'] as const).map(tagKey => {
                      const cfg = RCA_TAG_CONFIG[tagKey];
                      const count = rcaCounts[tagKey] || 0;
                      const isSelected = modalErrorFilter === tagKey;
                      return (
                        <button
                          key={tagKey}
                          onClick={() => {
                            setModalErrorFilter(tagKey);
                            setModalActiveSet(1);
                          }}
                          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-white text-slate-900 shadow-xs ring-2 ring-white/50'
                              : count > 0
                              ? 'bg-white/20 hover:bg-white/30 text-white'
                              : 'bg-white/10 text-white/50 hover:bg-white/20'
                          }`}
                          title={cfg.desc}
                        >
                          <span className="font-mono font-black">[{tagKey}]</span>
                          <span>{cfg.shortLabel}</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black/20 font-black">
                            {count}
                          </span>
                        </button>
                      );
                    })}

                    {rcaCounts.unclassified > 0 && (
                      <button
                        onClick={() => {
                          setModalErrorFilter('unclassified');
                          setModalActiveSet(1);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          modalErrorFilter === 'unclassified'
                            ? 'bg-white text-slate-900 shadow-xs ring-2 ring-white/50'
                            : 'bg-white/15 hover:bg-white/25 text-white/90'
                        }`}
                        title="Questions not yet classified into an RCA bucket"
                      >
                        <span>Unclassified</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black/20 font-black">
                          {rcaCounts.unclassified}
                        </span>
                      </button>
                    )}
                  </div>
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
                    }
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
            {modalDisplayedQuestions.length === 0 ? (
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

                        {/* Current RCA Badge */}
                        {qRca?.tag ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            RCA_TAG_CONFIG[qRca.tag]?.lightClass || 'bg-slate-100 text-slate-700'
                          }`}>
                            <span className="font-mono">[{qRca.tag}]</span>
                            <span>{qRca.tagName || RCA_TAG_CONFIG[qRca.tag]?.label}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                            Unclassified
                          </span>
                        )}
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
                                  testName: (q as any).testName
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
