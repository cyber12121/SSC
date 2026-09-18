import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Play,
  Search,
  X,
  Target,
  ChevronRight,
  BookOpen,
  ArrowLeft,
  Filter,
  Edit3,
  Check,
  Flame
} from 'lucide-react';
import { Question, RCATagType } from '../../types';
import { FormattedText } from '../FormattedText';
import { SolutionViewer } from '../SolutionViewer';
import { normalizeAnswerKey } from '../../utils/mathSanitizer';
import { saveQuestionRca } from '../../utils/rcaHelper';

interface SillyMistakesAggregateViewProps {
  subjectRcaData: Record<string, {
    totals: Record<RCATagType | 'unclassified', number>;
    questionsByTag: Record<RCATagType | 'unclassified', Question[]>;
  }>;
  selectedSubject: string;
  onSelectSubject?: (subject: string) => void;
  onStartPractice: (title: string, questions: Question[]) => void;
  onBack: () => void;
  language?: 'english' | 'hindi';
}

const CANONICAL_SUBJECTS = ['Mathematics', 'Reasoning', 'English', 'General Awareness'] as const;

const SUBJECT_CONFIG: Record<string, { bg: string; text: string; border: string; activeTab: string }> = {
  Mathematics: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    activeTab: 'bg-indigo-600 text-white'
  },
  Reasoning: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    activeTab: 'bg-purple-600 text-white'
  },
  English: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    activeTab: 'bg-sky-600 text-white'
  },
  'General Awareness': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    activeTab: 'bg-emerald-600 text-white'
  }
};

export const SillyMistakesAggregateView: React.FC<SillyMistakesAggregateViewProps> = ({
  subjectRcaData,
  selectedSubject,
  onSelectSubject,
  onStartPractice,
  onBack,
  language = 'english'
}) => {
  const [activeSubject, setActiveSubject] = useState<'all' | string>(selectedSubject || 'all');
  const [selectedReasonTag, setSelectedReasonTag] = useState<'all' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  // 1. Gather all silly mistake questions across all subjects
  const allSillyMistakes = useMemo(() => {
    const list: (Question & { sillyNote: string; effectiveSubject: string })[] = [];
    const seen = new Set<string>();

    CANONICAL_SUBJECTS.forEach(sub => {
      const qs = subjectRcaData[sub]?.questionsByTag?.['S'] || [];
      qs.forEach((q: any) => {
        const qId = q.id || q.question || '';
        if (seen.has(qId)) return;
        seen.add(qId);

        const sillyNote = (q.rca?.sillyMistakeNote || q.sillyMistakeNote || '').trim();
        list.push({
          ...q,
          sillyNote: sillyNote || 'Unspecified silly mistake',
          effectiveSubject: q.subject || q.parentSubject || sub
        });
      });
    });

    return list;
  }, [subjectRcaData]);

  // 2. Count by subject
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allSillyMistakes.length,
      Mathematics: 0,
      Reasoning: 0,
      English: 0,
      'General Awareness': 0
    };

    allSillyMistakes.forEach(q => {
      if (counts[q.effectiveSubject] !== undefined) {
        counts[q.effectiveSubject]++;
      }
    });

    return counts;
  }, [allSillyMistakes]);

  // 3. Filter questions by subject
  const subjectFilteredQuestions = useMemo(() => {
    if (activeSubject === 'all') return allSillyMistakes;
    return allSillyMistakes.filter(q => q.effectiveSubject === activeSubject);
  }, [allSillyMistakes, activeSubject]);

  // 4. Aggregate unique Silly Mistake tags/reasons across the subject-filtered questions
  const aggregatedReasonTags = useMemo(() => {
    const tagCountMap: Record<string, number> = {};

    subjectFilteredQuestions.forEach(q => {
      const note = q.sillyNote.trim();
      if (!note || note === 'Unspecified silly mistake') {
        tagCountMap['Unspecified slip'] = (tagCountMap['Unspecified slip'] || 0) + 1;
        return;
      }

      // If note contains comma-separated items, aggregate each token
      if (note.includes(',')) {
        const tokens = note.split(',').map(s => s.trim()).filter(Boolean);
        tokens.forEach(tok => {
          tagCountMap[tok] = (tagCountMap[tok] || 0) + 1;
        });
      } else {
        tagCountMap[note] = (tagCountMap[note] || 0) + 1;
      }
    });

    return Object.entries(tagCountMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [subjectFilteredQuestions]);

  // 5. Final filtered questions by Reason Tag & Search Query
  const displayedQuestions = useMemo(() => {
    return subjectFilteredQuestions.filter(q => {
      // Reason Tag Filter
      if (selectedReasonTag !== 'all') {
        const lowerNote = q.sillyNote.toLowerCase();
        const lowerTag = selectedReasonTag.toLowerCase();
        if (selectedReasonTag === 'Unspecified slip') {
          if (q.sillyNote !== 'Unspecified silly mistake' && q.sillyNote !== '') return false;
        } else if (!lowerNote.includes(lowerTag)) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchText = (q.question || '').toLowerCase().includes(query);
        const matchTopic = (q.topic || (q.tags as any)?.topic || '').toLowerCase().includes(query);
        const matchNote = q.sillyNote.toLowerCase().includes(query);
        if (!matchText && !matchTopic && !matchNote) return false;
      }

      return true;
    });
  }, [subjectFilteredQuestions, selectedReasonTag, searchQuery]);

  // Handle saving an edited note
  const handleSaveEditedNote = (q: Question) => {
    const qKey = q.id || q.question;
    const parentSub = (q as any).effectiveSubject || q.subject || 'General Awareness';
    saveQuestionRca(q, 'S', editNoteText, parentSub);
    if (q.rca) q.rca.sillyMistakeNote = editNoteText;
    (q as any).sillyMistakeNote = editNoteText;
    (q as any).sillyNote = editNoteText;
    setEditingQId(null);
  };

  return (
    <div className="space-y-4">
      {/* ── TOP BANNER & SUBJECT SELECTOR ── */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
              title="Return to Cockpit"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-rose-600 text-white shadow-xs">
                  <Flame className="w-3.5 h-3.5" />
                </span>
                <span>Aggregate Silly Mistakes Hub</span>
                <span className="bg-rose-100 text-rose-800 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {allSillyMistakes.length} Total Slips
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and remediate recurring calculation slips, misread questions, and exact notes recorded across all mock tests.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              disabled={displayedQuestions.length === 0}
              onClick={() => {
                const title = `${activeSubject === 'all' ? 'All Subjects' : activeSubject} • Silly Mistakes Drill`;
                onStartPractice(title, displayedQuestions);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 rounded-xl shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Drill Silly Mistakes ({displayedQuestions.length})</span>
            </button>
          </div>
        </div>

        {/* Subject Filter Tabs */}
        <div className="flex items-center gap-1.5 pt-3.5 overflow-x-auto pb-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => {
              setActiveSubject('all');
              setSelectedReasonTag('all');
              if (onSelectSubject) onSelectSubject('all');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubject === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>All Subjects</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              activeSubject === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {subjectCounts.all}
            </span>
          </button>

          {CANONICAL_SUBJECTS.map(sub => {
            const count = subjectCounts[sub] || 0;
            const isSelected = activeSubject === sub;
            const cfg = SUBJECT_CONFIG[sub];

            return (
              <button
                key={sub}
                type="button"
                onClick={() => {
                  setActiveSubject(sub);
                  setSelectedReasonTag('all');
                  if (onSelectSubject) onSelectSubject(sub);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? `${cfg.activeTab} shadow-xs`
                    : `${cfg.bg} ${cfg.text} border ${cfg.border} hover:opacity-80`
                }`}
              >
                <span>{sub}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-black/10'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── AGGREGATED REASON TAGS & SEARCH STRIP ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Filter className="w-3.5 h-3.5 text-rose-600" />
            <span>Recurring Silly Mistake Traps (Everything You Typed):</span>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search in mistakes or notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Reason Tag Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setSelectedReasonTag('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedReasonTag === 'all'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>All Reasons</span>
            <span className="font-mono text-[10px] opacity-80">({subjectFilteredQuestions.length})</span>
          </button>

          {aggregatedReasonTags.map(({ tag, count }) => {
            const isSelected = selectedReasonTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedReasonTag(isSelected ? 'all' : tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-xs'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200'
                }`}
                title={`Filter by: ${tag}`}
              >
                <span>📝 {tag}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-rose-200/70 text-rose-800'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── QUESTION LIST ── */}
      <div className="space-y-3">
        {displayedQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Check className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">No Silly Mistakes Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery || selectedReasonTag !== 'all'
                ? 'No questions match the active search or tag filter. Try selecting "All Reasons".'
                : `No silly mistake records found for ${activeSubject}. Keep up the great accuracy!`}
            </p>
          </div>
        ) : (
          displayedQuestions.map((q, idx) => {
            const qKey = String(q.id || q.question || idx);
            const isEditing = editingQId === qKey;
            const subCfg = SUBJECT_CONFIG[q.effectiveSubject] || SUBJECT_CONFIG['Mathematics'];

            return (
              <div
                key={qKey}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition hover:border-slate-300"
              >
                {/* Header Strip */}
                <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-xs text-slate-500 font-mono">
                      #{idx + 1}
                    </span>

                    {/* Subject Badge */}
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${subCfg.bg} ${subCfg.text} ${subCfg.border}`}>
                      {q.effectiveSubject}
                    </span>

                    {/* Topic Badge */}
                    {q.topic && (
                      <span className="text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                        {q.topic}
                      </span>
                    )}

                    {/* Mock Source Name */}
                    {(q as any).testName && (
                      <span className="text-[10px] text-slate-400 italic">
                        • {(q as any).testName}
                      </span>
                    )}
                  </div>

                  {/* PROMINENT SILLY MISTAKE RECORDED TAG */}
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-rose-600 text-white shadow-xs"
                      title={q.sillyNote}
                    >
                      <span>📝</span>
                      <span>{q.sillyNote}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setEditingQId(null);
                        } else {
                          setEditingQId(qKey);
                          setEditNoteText(q.sillyNote === 'Unspecified silly mistake' ? '' : q.sillyNote);
                        }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                      title="Edit silly mistake note"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Edit Note Drawer */}
                {isEditing && (
                  <div className="bg-rose-50/90 p-3 border-b border-rose-200 flex items-center gap-2">
                    <input
                      type="text"
                      value={editNoteText}
                      onChange={e => setEditNoteText(e.target.value)}
                      placeholder="Type why you made this silly mistake (e.g. calculation error, sign mistake)..."
                      className="flex-1 bg-white border border-rose-300 rounded-lg px-3 py-1.5 text-xs text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEditedNote(q)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-xs"
                    >
                      Save Note
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingQId(null)}
                      className="px-2 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Question Body */}
                <div className="p-4 sm:p-5 space-y-3">
                  <FormattedText
                    text={q.question}
                    language={language}
                    as="div"
                    className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed"
                    isQuestion={true}
                    subject={q.effectiveSubject}
                  />

                  {/* Image if present */}
                  {q.image?.src && (
                    <div className="my-2 border border-slate-200 rounded-xl p-2 inline-block bg-white shadow-xs">
                      <img
                        src={q.image.src}
                        alt="Question diagram"
                        className="max-w-full h-auto object-contain max-h-60 rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {/* Options */}
                  {q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
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
                                : 'bg-slate-50/60 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center font-black text-[10px] uppercase ${
                              isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {optKey}
                            </span>
                            <span className="flex-1 min-w-0">
                              <FormattedText text={optText} language={language} subject={q.effectiveSubject} />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Solution Accordion */}
                  {q.solution && (
                    <details className="group pt-2">
                      <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 select-none py-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>View Solution</span>
                        <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="mt-2 text-xs font-medium text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <SolutionViewer
                          solution={q.solution}
                          language={language}
                          subject={q.effectiveSubject}
                        />
                      </div>
                    </details>
                  )}

                  {/* Card Action Strip */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('cgl_ask_ai_question', {
                          detail: {
                            questionNumber: idx + 1,
                            questionText: q.question,
                            options: q.options,
                            userAnswer: (q as any).userAnswer,
                            correctAnswer: q.answer,
                            solution: q.solution,
                            topic: q.topic,
                            sourceType: (q as any).sourceType || 'full_mock',
                            sourceLabel: `Silly Mistake: ${q.sillyNote}`,
                            testName: (q as any).testName
                          }
                        }));
                      }}
                      className="h-7 px-2.5 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200/80 transition flex items-center gap-1 cursor-pointer active:scale-95"
                      title="Ask Tommy AI to explain this mistake and how to avoid it"
                    >
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      <span>Ask Tommy AI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onStartPractice(`${q.effectiveSubject} • Silly Mistake (${q.topic || 'Drill'})`, [q]);
                      }}
                      className="h-7 px-3 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Drill This Q</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
