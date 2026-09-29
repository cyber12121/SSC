import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { safeStorage } from '../utils/safeStorage';
import { normalizeTopicTitle } from '../utils/topicDetector';
import { Question } from '../types';
import {
  ArrowLeft,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  X,
  ChevronRight,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  autoRecoverMistakesFromStorage, 
  RecordedMistake, 
  MISTAKE_NOTEBOOK_KEY, 
  normalizeSubject,
  getDedupeKey,
  isSpeedLabQuestion
} from '../utils/mistakeRecorder';
export type { RecordedMistake };

interface BotMistakesPageProps {
  onBack: () => void;
  onStartPractice?: (topic: string, questions: Question[]) => void;
}


function getTopicIcon(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes('antonym')) return '🔠';
  if (t.includes('synonym')) return '🔤';
  if (t.includes('one word') || t.includes('ows')) return '📝';
  if (t.includes('idiom') || t.includes('phrase')) return '💬';
  if (t.includes('spell')) return '🔤';
  if (t.includes('spot') || t.includes('error')) return '🔍';
  if (t.includes('algebra')) return '📐';
  if (t.includes('trigo')) return '📐';
  if (t.includes('geom') || t.includes('circle')) return '⭕';
  if (t.includes('mensur')) return '📦';
  if (t.includes('percent')) return '📊';
  if (t.includes('ratio')) return '⚖️';
  if (t.includes('profit') || t.includes('loss')) return '🏷️';
  if (t.includes('syllogism')) return '🧠';
  if (t.includes('series')) return '🔢';
  if (t.includes('polity') || t.includes('constitution')) return '🏛️';
  if (t.includes('history')) return '📜';
  if (t.includes('geo')) return '🌍';
  if (t.includes('bio')) return '🧬';
  if (t.includes('phys')) return '⚛️';
  if (t.includes('chem')) return '🧪';
  return '📌';
}

const SUBJECT_CONFIG: Record<
  'english' | 'mathematics' | 'reasoning' | 'general_awareness',
  {
    label: string;
    icon: string;
    bg: string;
    text: string;
    border: string;
    activeBorder: string;
    activeBg: string;
    badgeBg: string;
    badgeText: string;
    accentBtn: string;
  }
> = {
  english: {
    label: 'English',
    icon: '📖',
    bg: 'bg-sky-50/60',
    text: 'text-sky-900',
    border: 'border-sky-200',
    activeBorder: 'border-sky-500 ring-2 ring-sky-500/20 shadow-md',
    activeBg: 'bg-gradient-to-br from-sky-50 via-white to-white',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    accentBtn: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  mathematics: {
    label: 'Mathematics',
    icon: '📐',
    bg: 'bg-amber-50/60',
    text: 'text-amber-900',
    border: 'border-amber-200',
    activeBorder: 'border-amber-500 ring-2 ring-amber-500/20 shadow-md',
    activeBg: 'bg-gradient-to-br from-amber-50 via-white to-white',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    accentBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  reasoning: {
    label: 'Reasoning',
    icon: '🧠',
    bg: 'bg-purple-50/60',
    text: 'text-purple-900',
    border: 'border-purple-200',
    activeBorder: 'border-purple-500 ring-2 ring-purple-500/20 shadow-md',
    activeBg: 'bg-gradient-to-br from-purple-50 via-white to-white',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    accentBtn: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
  general_awareness: {
    label: 'GK & GA',
    icon: '🏛️',
    bg: 'bg-emerald-50/60',
    text: 'text-emerald-900',
    border: 'border-emerald-200',
    activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md',
    activeBg: 'bg-gradient-to-br from-emerald-50 via-white to-white',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    accentBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
};

// Formats messy raw explanation into a clean, human-readable card
function cleanAndFormatExplanation(raw: string): {
  coreExplanation: string;
  definitions: Array<{ word: string; meaning: string }>;
} {
  if (!raw) return { coreExplanation: '', definitions: [] };
  let text = raw.trim();

  // Strip robotic auto-generated prefixes & suffixes
  text = text.replace(/^The correct answer is\s*["'].*?["']\.?\s*/i, '');
  text = text.replace(/Therefore,\s*the correct answer is\s*(?:Option\s*)?[A-D]\.?\s*/gi, '');
  text = text.replace(/^Key Points:\s*/gi, '');

  const definitions: Array<{ word: string; meaning: string }> = [];
  const otherLines: string[] = [];

  const rawParts = text.split(/(?:\r?\n|(?=[-•]\s*["']?[A-Za-z]+["']?\s*means))/);

  for (let part of rawParts) {
    part = part.trim();
    if (!part) continue;

    // Check for "- 'Word' means definition" or "- Word: definition"
    const defMatch = part.match(/^[-•*]?\s*["']?([A-Za-z\s-]+)["']?\s*(?:means|:)\s*(.+)$/i);
    if (defMatch && defMatch[1].trim().length < 30) {
      definitions.push({
        word: defMatch[1].trim(),
        meaning: defMatch[2].trim(),
      });
    } else {
      otherLines.push(part.replace(/^[-•*]\s*/, '').trim());
    }
  }

  return {
    coreExplanation: otherLines.join('\n\n').trim(),
    definitions,
  };
}

export const BotMistakesPage: React.FC<BotMistakesPageProps> = ({
  onBack,
  onStartPractice,
}) => {
  const [mistakes, setMistakes] = useState<RecordedMistake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Hierarchy States
  const [selectedSubject, setSelectedSubject] = useState<'all' | 'english' | 'mathematics' | 'reasoning' | 'general_awareness'>('english');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'mock_errors' | 'chapter_bank'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'wrong' | 'unattempted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [inspectTopic, setInspectTopic] = useState<{ topicName: string; questions: RecordedMistake[] } | null>(null);

  // Interactive Practice Modal
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState<RecordedMistake[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceChosen, setPracticeChosen] = useState<number | null>(null);
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceFinished, setPracticeFinished] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchMistakes = async () => {
    setLoading(true);
    setError(null);
    try {
      const recovered = await autoRecoverMistakesFromStorage(auth.currentUser?.uid);
      setMistakes(recovered);

      // Auto-select subject with mistakes
      if (recovered.length > 0) {
        const subjectsPriority: Array<'english' | 'mathematics' | 'reasoning' | 'general_awareness'> = [
          'english',
          'mathematics',
          'reasoning',
          'general_awareness',
        ];
        const foundWithMistakes = subjectsPriority.find(
          (s) => recovered.some((m) => normalizeSubject(m.subject) === s)
        );
        if (foundWithMistakes) {
          setSelectedSubject(foundWithMistakes);
        }
      }
    } catch (err: any) {
      console.error('[BotMistakesPage] Fetch error:', err);
      setError('Unable to load mistakes. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMistakesUpdated = () => {
      fetchMistakes();
    };
    window.addEventListener('cgl_mistakes_updated', handleMistakesUpdated);
    return () => {
      window.removeEventListener('cgl_mistakes_updated', handleMistakesUpdated);
    };
  }, []);

  useEffect(() => {
    fetchMistakes();
  }, []);
  const handleDelete = async (m: RecordedMistake) => {
    if (!window.confirm('Delete this question from your Mistake Notebook? It will only be removed from your mistakes.')) {
      return;
    }

    setDeletingId(m.id);
    try {
      const targetKey = getDedupeKey(m.question, m.id, m.options);

      // 1. Remove from dedicated mistake notebook
      try {
        const nbRaw = safeStorage.getItem('cgl_user_mistake_notebook');
        if (nbRaw) {
          const list: RecordedMistake[] = JSON.parse(nbRaw);
          const filtered = list.filter((item) => {
            const itemKey = getDedupeKey(item.question, item.id, item.options);
            return item.id !== m.id && itemKey !== targetKey;
          });
          safeStorage.setItem('cgl_user_mistake_notebook', JSON.stringify(filtered));
        }
      } catch {}

      // NOTE: We STRICTLY DO NOT modify cgl_deleted_question_ids or call onDeleteQuestion!
      // This guarantees the question remains available in Chapter Bank and tests.

      // 2. Delete from Firebase Firestore user_mistakes permanently
      if (auth.currentUser) {
        try {
          const docId = m.id ? m.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) : '';
          if (docId) {
            await deleteDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, docId)).catch(() => {});
          }
          // Also match and delete by exact dedupe key or matching ID
          const snap = await getDocs(collection(db, `user_mistakes_${auth.currentUser.uid}`));
          for (const d of snap.docs) {
            const dData = d.data();
            const dKey = getDedupeKey(dData?.question, d.id, dData?.options);
            if (d.id === docId || d.id === m.id || dKey === targetKey) {
              await deleteDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, d.id)).catch(() => {});
            }
          }
        } catch (err) {
          console.warn('[BotMistakesPage] Firestore deleteDoc error:', err);
        }
      }

      setMistakes((prev) => prev.filter((item) => {
        const itemKey = getDedupeKey(item.question, item.id, item.options);
        return item.id !== m.id && itemKey !== targetKey;
      }));

      if (inspectTopic) {
        setInspectTopic((prev) => {
          if (!prev) return null;
          const updatedQs = prev.questions.filter((item) => {
            const itemKey = getDedupeKey(item.question, item.id, item.options);
            return item.id !== m.id && itemKey !== targetKey;
          });
          if (updatedQs.length === 0) return null;
          return { ...prev, questions: updatedQs };
        });
      }

      try {
        window.dispatchEvent(new CustomEvent('cgl_mistakes_updated', {
          detail: { count: 1 }
        }));
      } catch {}

      showToast('Question removed from Mistake Notebook.');
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Error deleting question: ' + (err?.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to completely clear ALL mistakes from your Mistake Notebook? This will only remove questions from your mistake notebook.')) {
      return;
    }
    setLoading(true);
    try {
      // 1. Wipe dedicated mistake notebook
      safeStorage.removeItem('cgl_user_mistake_notebook');

      // NOTE: DO NOT remove cgl_rca_global_store! RCA mock store belongs to mock analysis.

      // 3. Delete all user_mistakes documents in Firestore if authenticated
      if (auth.currentUser) {
        try {
          const snap = await getDocs(collection(db, `user_mistakes_${auth.currentUser.uid}`));
          const batchDeletes = snap.docs.map((d) =>
            deleteDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, d.id)).catch(() => {})
          );
          await Promise.all(batchDeletes);
        } catch (err) {
          console.warn('[BotMistakesPage] Error clearing firestore mistakes:', err);
        }
      }

      setMistakes([]);
      setInspectTopic(null);

      try {
        window.dispatchEvent(new CustomEvent('cgl_mistakes_updated', {
          detail: { count: 0 }
        }));
      } catch {}

      showToast('✨ Mistake Notebook has been completely cleared!');
    } catch (err: any) {
      console.error('Error clearing mistakes:', err);
      showToast('Error clearing mistakes: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Filter by search, source, and error status (wrong vs unattempted)
  const searchFilteredMistakes = useMemo(() => {
    return mistakes.filter((m) => {
      const s = (m.source || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      const t = (m.topic || '').toLowerCase();
      const isMock = s.includes('mock') || s === 'mock_errors' || id.startsWith('tb_') || id.startsWith('ob_') || id.startsWith('rca_') || t.includes('mock');

      if (sourceFilter === 'mock_errors' && !isMock) return false;
      if (sourceFilter === 'chapter_bank' && isMock) return false;

      if (statusFilter === 'wrong' && m.errorType === 'unattempted') return false;
      if (statusFilter === 'unattempted' && m.errorType !== 'unattempted') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQ = m.question.toLowerCase().includes(q);
        const matchesExpl = (m.explanation || '').toLowerCase().includes(q);
        const matchesTopic = (m.topic || '').toLowerCase().includes(q);
        if (!matchesQ && !matchesExpl && !matchesTopic) return false;
      }
      return true;
    });
  }, [mistakes, sourceFilter, statusFilter, searchQuery]);

  // Subject Stats Calculation (Total Questions & Topic Count for each subject)
  const subjectStats = useMemo(() => {
    const map: Record<
      'english' | 'mathematics' | 'reasoning' | 'general_awareness',
      {
        total: number;
        topicMap: Map<string, RecordedMistake[]>;
      }
    > = {
      english: { total: 0, topicMap: new Map() },
      mathematics: { total: 0, topicMap: new Map() },
      reasoning: { total: 0, topicMap: new Map() },
      general_awareness: { total: 0, topicMap: new Map() },
    };

    searchFilteredMistakes.forEach((m) => {
      const sub = normalizeSubject(m.subject);
      map[sub].total++;
      const topicName = normalizeTopicTitle(m.topic) || 'General Practice';
      if (!map[sub].topicMap.has(topicName)) {
        map[sub].topicMap.set(topicName, []);
      }
      map[sub].topicMap.get(topicName)!.push({
        ...m,
        topic: topicName
      });
    });

    return map;
  }, [searchFilteredMistakes]);

  // Active Subject List to Display
  const displayedSubjects = useMemo(() => {
    const list: Array<'english' | 'mathematics' | 'reasoning' | 'general_awareness'> = [
      'english',
      'mathematics',
      'reasoning',
      'general_awareness',
    ];
    if (selectedSubject === 'all') return list;
    return [selectedSubject];
  }, [selectedSubject]);

  const totalFilteredCount = searchFilteredMistakes.length;

  const handleClearTopic = async (topicQuestions: RecordedMistake[], topicName: string) => {
    if (!window.confirm(`Remove all ${topicQuestions.length} mistake(s) in "${topicName}" from your Mistake Notebook?`)) {
      return;
    }
    const qIds = new Set(topicQuestions.map((q) => q.id));
    const targetKeys = new Set(topicQuestions.map((q) => getDedupeKey(q.question, q.id, q.options)));

    // 1. Remove from dedicated website mistake notebook
    try {
      const nbRaw = safeStorage.getItem('cgl_user_mistake_notebook');
      if (nbRaw) {
        const list: RecordedMistake[] = JSON.parse(nbRaw);
        const filtered = list.filter((item) => {
          const itemKey = getDedupeKey(item.question, item.id, item.options);
          return !qIds.has(item.id) && !targetKeys.has(itemKey);
        });
        safeStorage.setItem('cgl_user_mistake_notebook', JSON.stringify(filtered));
      }
    } catch {}

    // NOTE: We DO NOT write to cgl_deleted_question_ids! Questions stay available in Chapter Bank.

    // 3. Delete from Firebase Firestore if authenticated
    if (auth.currentUser) {
      try {
        const snap = await getDocs(collection(db, `user_mistakes_${auth.currentUser.uid}`));
        for (const d of snap.docs) {
          const dData = d.data();
          const dKey = getDedupeKey(dData?.question, d.id, dData?.options);
          if (qIds.has(d.id) || targetKeys.has(dKey)) {
            deleteDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, d.id)).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[BotMistakesPage] Firestore deleteDoc error:', err);
      }
    }

    setMistakes((prev) => prev.filter((item) => {
      const itemKey = getDedupeKey(item.question, item.id, item.options);
      return !qIds.has(item.id) && !targetKeys.has(itemKey);
    }));

    if (inspectTopic?.topicName === topicName) {
      setInspectTopic(null);
    }

    try {
      window.dispatchEvent(new CustomEvent('cgl_mistakes_updated', {
        detail: { count: topicQuestions.length }
      }));
    } catch {}

    showToast(`Removed ${topicQuestions.length} mistake(s) from "${topicName}".`);
  };

  // Start Interactive Practice Drill (opens in full Practice Mode)
  const startPractice = (questionsToPractice: RecordedMistake[], topicTitle?: string) => {
    if (!questionsToPractice || questionsToPractice.length === 0) return;
    if (onStartPractice) {
      const convertedQuestions: Question[] = questionsToPractice.map((m, idx) => {
        const optObj: { a: string; b: string; c: string; d: string } = {
          a: m.options[0] || '',
          b: m.options[1] || '',
          c: m.options[2] || '',
          d: m.options[3] || '',
        };
        const correctLetters = ['a', 'b', 'c', 'd'];
        const answer = (correctLetters[m.correctOptionIndex] || 'a') as any;

        return {
          id: m.id || `mistake_${idx + 1}`,
          q_num: idx + 1,
          question: m.question,
          options: optObj,
          answer,
          solution: m.explanation || '',
          subject: normalizeSubject(m.subject),
          topic: topicTitle || normalizeTopicTitle(m.topic) || 'General Practice',
          tags: {
            topic: topicTitle || normalizeTopicTitle(m.topic) || 'General Practice',
          }
        };
      });
      onStartPractice(topicTitle || 'Mistakes Practice', convertedQuestions);
      return;
    }

    setPracticeQuestions(questionsToPractice);
    setPracticeIndex(0);
    setPracticeChosen(null);
    setPracticeScore(0);
    setPracticeFinished(false);
    setPracticeModalOpen(true);
  };

  const handlePracticeAnswer = (optIdx: number) => {
    if (practiceChosen !== null) return;
    setPracticeChosen(optIdx);
    const curr = practiceQuestions[practiceIndex];
    if (optIdx === curr.correctOptionIndex) {
      setPracticeScore((prev) => prev + 1);
    }
  };

  const handleNextPracticeQuestion = () => {
    if (practiceIndex + 1 < practiceQuestions.length) {
      setPracticeIndex((prev) => prev + 1);
      setPracticeChosen(null);
    } else {
      setPracticeFinished(true);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP HEADER & QUICK ACTIONS */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Mistake Notebook
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                {totalFilteredCount} {totalFilteredCount === 1 ? 'question' : 'questions'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Subject cards & chapter-wise revision bank from your practice quizzes and error remediation drills.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {totalFilteredCount > 0 && (
            <button
              onClick={() => startPractice(searchFilteredMistakes, 'All Mistakes')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Practice all questions"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Practice All ({totalFilteredCount})</span>
            </button>
          )}
          <button
            onClick={fetchMistakes}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors border border-slate-200/80 cursor-pointer disabled:opacity-50"
            title="Refresh notebook"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={handleClearAll}
            disabled={loading || mistakes.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200 cursor-pointer disabled:opacity-40"
            title="Clear all mistakes from notebook"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">Clear All</span>
          </button>
        </div>
      </div>

      {/* LEVEL 1: SUBJECT CARDS GRID */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Select Subject:
          </span>
          <button
            onClick={() => setSelectedSubject('all')}
            className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedSubject === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            Show All Subjects ({totalFilteredCount})
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {(['english', 'mathematics', 'reasoning', 'general_awareness'] as const).map((subKey) => {
            const conf = SUBJECT_CONFIG[subKey];
            const stats = subjectStats[subKey];
            const isSelected = selectedSubject === subKey;
            const hasMistakes = stats.total > 0;

            return (
              <div
                key={subKey}
                onClick={() => setSelectedSubject(subKey)}
                className={`rounded-xl border p-3 sm:p-3.5 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[96px] sm:min-h-[104px] ${
                  isSelected
                    ? `${conf.activeBorder} ${conf.activeBg}`
                    : `bg-white hover:border-slate-300 border-slate-200/80 shadow-2xs hover:shadow-xs`
                }`}
              >
                {/* Active Indicator Pip */}
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-rose-500" />
                )}

                {/* Top Row: Icon & Subject Label */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base sm:text-lg">{conf.icon}</span>
                    <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                      {conf.label}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  )}
                </div>

                {/* Bottom Row: Metric Count & Topic Sub-stat */}
                <div className="mt-2 pt-2 border-t border-slate-100/80 flex items-end justify-between">
                  <div>
                    <div className="text-lg sm:text-xl font-black text-slate-900 leading-none">
                      {stats.total}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-400 mt-1">
                      {hasMistakes
                        ? `${stats.topicMap.size} ${stats.topicMap.size === 1 ? 'Topic' : 'Topics'}`
                        : '0 Mistakes'}
                    </div>
                  </div>

                  {hasMistakes && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const allSubQuestions = (Array.from(stats.topicMap.values()) as RecordedMistake[][]).flat();
                        startPractice(allSubQuestions, `${conf.label} Mistakes`);
                      }}
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      title={`Practice all ${stats.total} questions in ${conf.label}`}
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Drill</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within questions, topics, or explanations..."
            className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-0.5"
            >
              ✕
            </button>
          )}
        </div>

        {/* Source & Status Filters */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Source Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                sourceFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter('mock_errors')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                sourceFilter === 'mock_errors' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Mock Errors</span>
            </button>
            <button
              onClick={() => setSourceFilter('chapter_bank')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                sourceFilter === 'chapter_bank' ? 'bg-white text-emerald-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Chapter Bank</span>
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('wrong')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                statusFilter === 'wrong' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Wrong</span>
            </button>
            <button
              onClick={() => setStatusFilter('unattempted')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                statusFilter === 'unattempted' ? 'bg-white text-amber-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Skipped</span>
            </button>
          </div>
        </div>
      </div>

      {/* LEVEL 2: TOPIC-WISE CARDS (UNDER SELECTED SUBJECT) */}
      <div className="space-y-4">
        {loading && mistakes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center flex flex-col items-center justify-center gap-2 shadow-2xs">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold text-slate-600">Loading your mistake notebook...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-6 h-6 text-rose-600" />
            <p className="text-xs font-bold text-rose-800">{error}</p>
            <button
              onClick={fetchMistakes}
              className="mt-1 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : totalFilteredCount === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center flex flex-col items-center justify-center gap-2 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-lg">
              🎯
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Mistakes Found</h3>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              When you miss questions in Chapter Bank quizzes or Mock tests, they will be organized into subject and chapter cards here for targeted re-practice.
            </p>
          </div>
        ) : (
          /* Render Active Subject Sections */
          displayedSubjects.map((subKey) => {
            const conf = SUBJECT_CONFIG[subKey];
            const stat = subjectStats[subKey];
            const topicEntries = Array.from(stat.topicMap.entries());

            if (topicEntries.length === 0) {
              if (selectedSubject !== 'all') {
                return (
                  <div
                    key={subKey}
                    className="bg-white rounded-xl border border-slate-200/80 p-8 text-center flex flex-col items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <span className="text-2xl">{conf.icon}</span>
                    <h3 className="text-sm font-bold text-slate-800">All Mastered in {conf.label}!</h3>
                    <p className="text-xs text-slate-500 max-w-md">
                      You have zero pending mistakes in {conf.label}. Keep drilling to retain mastery!
                    </p>
                  </div>
                );
              }
              return null;
            }

            return (
              <div key={subKey} className="space-y-3">
                {/* Subject Section Title Bar */}
                <div className="flex items-center justify-between gap-2 px-1 border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{conf.icon}</span>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                      {conf.label} Chapters
                    </h2>
                    <span className="text-[11px] text-slate-500 font-medium">
                      ({stat.total} {stat.total === 1 ? 'mistake' : 'mistakes'} across {stat.topicMap.size} {stat.topicMap.size === 1 ? 'chapter' : 'chapters'})
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      const allSubQuestions = (Array.from(stat.topicMap.values()) as RecordedMistake[][]).flat();
                      startPractice(allSubQuestions, `${conf.label} Mistakes`);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${conf.accentBtn}`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Practice All {conf.label}</span>
                  </button>
                </div>

                {/* CHAPTER-WISE CARDS (NO DROPDOWNS, DIRECT OPEN IN PRACTICE) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {topicEntries.map(([topicName, topicQuestions]) => {
                    const topicIcon = getTopicIcon(topicName);
                    const count = topicQuestions.length;

                    return (
                      <div
                        key={topicName}
                        onClick={() => startPractice(topicQuestions, topicName)}
                        className="group bg-white rounded-xl border border-slate-200/90 hover:border-indigo-500 p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-all">
                                {topicIcon}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition-colors" title={topicName}>
                                  {topicName}
                                </h3>
                                <span className={`inline-block px-1.5 py-0.2 text-[10px] font-bold rounded border mt-0.5 ${conf.bg} ${conf.text} ${conf.border}`}>
                                  {conf.label}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearTopic(topicQuestions, topicName);
                              }}
                              className="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                              title={`Clear mistakes in ${topicName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <div className="text-xl sm:text-2xl font-black text-rose-600 leading-none">
                              {count}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                              {count === 1 ? 'Mistake' : 'Mistakes'}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectTopic({ topicName, questions: topicQuestions });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                              title={`View and manage individual mistakes in ${topicName}`}
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startPractice(topicQuestions, topicName);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs group-hover:shadow-xs cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Practice</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* TOPIC QUESTIONS INSPECT MODAL */}
      <AnimatePresence>
        {inspectTopic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {inspectTopic.topicName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {inspectTopic.questions.length} recorded mistake(s) • Delete removes ONLY from Mistake Notebook
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const qs = inspectTopic.questions;
                      const name = inspectTopic.topicName;
                      setInspectTopic(null);
                      startPractice(qs, name);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Practice All</span>
                  </button>
                  <button
                    onClick={() => setInspectTopic(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 divide-y divide-slate-100">
                {inspectTopic.questions.map((m, idx) => (
                  <div key={m.id || idx} className={idx > 0 ? 'pt-4 space-y-3' : 'space-y-3'}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {m.errorType === 'unattempted' ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Skipped
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                Wrong
                              </span>
                            )}
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {((m.source || '').toLowerCase().includes('mock') || (m.id || '').startsWith('tb_') || (m.id || '').startsWith('ob_')) ? 'Mock Error' : 'Chapter Bank'}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                            {m.question}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(m)}
                        disabled={deletingId === m.id}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                        title="Delete question from Mistake Notebook only"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </button>
                    </div>

                    {/* Options Grid */}
                    {m.options && m.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-8">
                        {m.options.map((opt, optIdx) => {
                          const isCorrect = optIdx === m.correctOptionIndex;
                          const letters = ['A', 'B', 'C', 'D'];
                          return (
                            <div
                              key={optIdx}
                              className={`p-2 rounded-lg text-xs flex items-start gap-2 border ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                                  : 'bg-slate-50/70 border-slate-200 text-slate-600'
                              }`}
                            >
                              <span className="font-bold text-[10px] w-4 h-4 rounded flex items-center justify-center bg-white border border-slate-200 shrink-0">
                                {letters[optIdx]}
                              </span>
                              <span className="leading-snug">{opt}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Explanation */}
                    {m.explanation && (
                      <div className="pl-8 pt-1">
                        <div className="text-[11px] bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-slate-600 leading-relaxed">
                          <span className="font-bold text-slate-700 block mb-0.5">Explanation:</span>
                          {m.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INTERACTIVE PRACTICE MODAL */}
      <AnimatePresence>
        {practiceModalOpen && practiceQuestions.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Recall Drill • Question {practiceIndex + 1} of {practiceQuestions.length}
                  </span>
                </div>
                <button
                  onClick={() => setPracticeModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                {!practiceFinished ? (
                  <>
                    <div className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                      {practiceQuestions[practiceIndex].question}
                    </div>

                    {/* Options */}
                    <div className="space-y-2 pt-2">
                      {practiceQuestions[practiceIndex].options.map((opt, optIdx) => {
                        const isCorrect = optIdx === practiceQuestions[practiceIndex].correctOptionIndex;
                        const isChosen = practiceChosen === optIdx;
                        const letters = ['A', 'B', 'C', 'D'];

                        let optClass = 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700';
                        if (practiceChosen !== null) {
                          if (isCorrect) {
                            optClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold';
                          } else if (isChosen) {
                            optClass = 'bg-rose-50 border-rose-400 text-rose-900 font-medium';
                          } else {
                            optClass = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handlePracticeAnswer(optIdx)}
                            disabled={practiceChosen !== null}
                            className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm transition-all flex items-start gap-3 cursor-pointer ${optClass}`}
                          >
                            <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 bg-white border border-slate-200">
                              {letters[optIdx]}
                            </span>
                            <span className="leading-snug">{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Feedback */}
                    {practiceChosen !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-2"
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          {practiceChosen === practiceQuestions[practiceIndex].correctOptionIndex ? (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Correct! Great memory.</span>
                            </span>
                          ) : (
                            <span className="text-rose-700 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4 text-rose-600" />
                              <span>Incorrect. Correct answer is Option {['A', 'B', 'C', 'D'][practiceQuestions[practiceIndex].correctOptionIndex]}.</span>
                            </span>
                          )}
                        </div>
                        {practiceQuestions[practiceIndex].explanation && (
                          <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">
                            {practiceQuestions[practiceIndex].explanation}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <div className="text-4xl">🏆</div>
                    <h3 className="text-xl font-bold text-slate-900">Drill Completed!</h3>
                    <p className="text-sm text-slate-600">
                      You scored <strong className="text-emerald-600 font-black">{practiceScore} / {practiceQuestions.length}</strong> ({Math.round((practiceScore / practiceQuestions.length) * 100)}%)
                    </p>
                    <div className="pt-4 flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setPracticeIndex(0);
                          setPracticeChosen(null);
                          setPracticeScore(0);
                          setPracticeFinished(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Repeat Drill</span>
                      </button>
                      <button
                        onClick={() => setPracticeModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {!practiceFinished && practiceChosen !== null && (
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                  <button
                    onClick={handleNextPracticeQuestion}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>{practiceIndex + 1 < practiceQuestions.length ? 'Next Question' : 'View Results'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
