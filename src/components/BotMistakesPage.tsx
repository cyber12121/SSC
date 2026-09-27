import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { safeStorage } from '../utils/safeStorage';
import {
  ArrowLeft,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Zap,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  Filter,
  Check,
  Smartphone,
  Laptop,
  Eye,
  EyeOff,
  Play,
  Folder,
  FolderOpen,
  RotateCcw,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface RecordedMistake {
  id: string;
  userId: number;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness';
  topic: string;
  topicSlug: string;
  source: 'telegram_quiz' | 'website_quiz' | 'telegram_drill' | 'website_mock';
  timestamp: number;
  wrongCount: number;
  mastered: boolean;
}

interface BotMistakesPageProps {
  onBack: () => void;
  onDeleteQuestion?: (questionId: string, questionText: string) => void;
}

const SYNCED_STORAGE_KEY = 'cgl_synced_telegram_mistakes';

// Safe base64 / base64url UTF-8 decoder
function decodeSyncPayload(str: string): any {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decodedText = new TextDecoder().decode(bytes);
    return JSON.parse(decodedText);
  } catch (e) {
    console.error('[BotMistakesPage] Failed to decode sync payload:', e);
    return null;
  }
}

// Canonical subject normalization
function normalizeSubject(sub?: string): 'english' | 'mathematics' | 'reasoning' | 'general_awareness' {
  if (!sub) return 'general_awareness';
  const s = String(sub).toLowerCase().trim();
  if (s.includes('eng') || s.includes('vocab') || s.includes('synonym') || s.includes('grammar') || s.includes('idiom') || s.includes('antonym')) return 'english';
  if (s.includes('math') || s.includes('quant') || s.includes('arithmetic') || s.includes('algebra') || s.includes('geometry') || s.includes('trig') || s.includes('calc')) return 'mathematics';
  if (s.includes('reason') || s.includes('logic') || s.includes('analogy') || s.includes('series') || s.includes('syllogism')) return 'reasoning';
  return 'general_awareness';
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
  onDeleteQuestion,
}) => {
  const [mistakes, setMistakes] = useState<RecordedMistake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Hierarchy States
  const [selectedSubject, setSelectedSubject] = useState<'all' | 'english' | 'mathematics' | 'reasoning' | 'general_awareness'>('english');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'telegram' | 'website'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [studyMode, setStudyMode] = useState<'study' | 'recall'>('study');

  // Open / Closed states for Topic Cards (key = "subject:topic")
  const [openTopicCards, setOpenTopicCards] = useState<Record<string, boolean>>({});

  // Individual question states
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});
  const [userSelectedOptions, setUserSelectedOptions] = useState<Record<string, number>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      let serverMistakes: RecordedMistake[] = [];
      try {
        const res = await fetch('/api/mistakes');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.mistakes)) {
            serverMistakes = data.mistakes;
          }
        }
      } catch (err: any) {
        console.warn('[BotMistakesPage] Server mistakes endpoint not available, falling back to local storage:', err);
      }

      // Load synced telegram mistakes from safeStorage
      let localSynced: RecordedMistake[] = [];
      try {
        const raw = safeStorage.getItem(SYNCED_STORAGE_KEY);
        if (raw) localSynced = JSON.parse(raw);
      } catch {}

      // Load from Firestore if user is logged in
      let firestoreMistakes: RecordedMistake[] = [];
      if (auth.currentUser) {
        try {
          const snap = await getDocs(collection(db, `user_mistakes_${auth.currentUser.uid}`));
          snap.forEach((d) => {
            const data = d.data() as RecordedMistake;
            if (data && data.question) {
              firestoreMistakes.push({ ...data, id: data.id || d.id });
            }
          });
        } catch {}
      }

      // Merge and deduplicate
      const mergedMap = new Map<string, RecordedMistake>();
      for (const m of serverMistakes) {
        const key = m.id || m.question.trim().toLowerCase();
        mergedMap.set(key, { ...m, subject: normalizeSubject(m.subject) });
      }
      for (const m of firestoreMistakes) {
        const key = m.id || m.question.trim().toLowerCase();
        mergedMap.set(key, { ...m, subject: normalizeSubject(m.subject) });
      }
      for (const m of localSynced) {
        const key = m.id || m.question.trim().toLowerCase();
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          existing.wrongCount = Math.max(existing.wrongCount || 1, m.wrongCount || 1);
        } else {
          mergedMap.set(key, { ...m, subject: normalizeSubject(m.subject) });
        }
      }

      // Filter out deleted questions
      let deletedIds = new Set<string>();
      try {
        const delRaw = safeStorage.getItem('cgl_deleted_question_ids');
        if (delRaw) {
          const arr = JSON.parse(delRaw);
          if (Array.isArray(arr)) arr.forEach((id) => deletedIds.add(String(id).toLowerCase()));
        }
      } catch {}

      const finalList = Array.from(mergedMap.values()).filter((item) => {
        if (item.id && deletedIds.has(item.id.toLowerCase())) return false;
        if (item.question && deletedIds.has(item.question.trim().toLowerCase())) return false;
        return true;
      });

      finalList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setMistakes(finalList);

      // Auto-select subject with mistakes
      if (finalList.length > 0) {
        const subjectsPriority: Array<'english' | 'mathematics' | 'reasoning' | 'general_awareness'> = [
          'english',
          'mathematics',
          'reasoning',
          'general_awareness',
        ];
        const foundWithMistakes = subjectsPriority.find(
          (s) => finalList.some((m) => normalizeSubject(m.subject) === s)
        );
        if (foundWithMistakes) {
          setSelectedSubject(foundWithMistakes);
        }

        // Expand all topic cards by default for smooth browsing
        const initialOpens: Record<string, boolean> = {};
        finalList.forEach((m) => {
          const sub = normalizeSubject(m.subject);
          const top = m.topic || 'General Practice';
          initialOpens[`${sub}:${top}`] = true;
        });
        setOpenTopicCards(initialOpens);
      }
    } catch (err: any) {
      console.error('[BotMistakesPage] Fetch error:', err);
      setError('Unable to load mistakes. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check URL parameters for direct sync from Telegram
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const syncQParam = params.get('syncQ');
        const syncBatchParam = params.get('syncBatch');

        if (syncQParam || syncBatchParam) {
          const importedQuestions: any[] = [];
          if (syncQParam) {
            const decoded = decodeSyncPayload(syncQParam);
            if (decoded && decoded.q) importedQuestions.push(decoded);
          }
          if (syncBatchParam) {
            const decoded = decodeSyncPayload(syncBatchParam);
            if (Array.isArray(decoded)) {
              importedQuestions.push(...decoded);
            } else if (decoded && decoded.q) {
              importedQuestions.push(decoded);
            }
          }

          if (importedQuestions.length > 0) {
            let existingSynced: RecordedMistake[] = [];
            try {
              const raw = safeStorage.getItem(SYNCED_STORAGE_KEY);
              if (raw) existingSynced = JSON.parse(raw);
            } catch {}

            const existingMap = new Map<string, RecordedMistake>();
            for (const item of existingSynced) {
              const key = item.id || item.question.trim().toLowerCase();
              existingMap.set(key, item);
            }

            let newlyAdded = 0;
            for (const rawQ of importedQuestions) {
              const qId = rawQ.id || `tg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              const key = qId || rawQ.q?.trim().toLowerCase();

              let opts: string[] = [];
              if (Array.isArray(rawQ.opts)) {
                opts = rawQ.opts.map(String);
              } else if (rawQ.opts && typeof rawQ.opts === 'object') {
                opts = Object.values(rawQ.opts).map(String);
              }

              if (existingMap.has(key)) {
                const ex = existingMap.get(key)!;
                ex.wrongCount = (ex.wrongCount || 1) + 1;
                ex.timestamp = Date.now();
              } else {
                const normSub = normalizeSubject(rawQ.sub);
                const newMistake: RecordedMistake = {
                  id: qId,
                  userId: 0,
                  question: rawQ.q || '',
                  options: opts,
                  correctOptionIndex: typeof rawQ.ans === 'number' ? rawQ.ans : 0,
                  explanation: rawQ.exp || '',
                  subject: normSub,
                  topic: rawQ.top || 'Telegram Practice',
                  topicSlug: (rawQ.top || 'telegram').toLowerCase().replace(/\s+/g, '-'),
                  source: 'telegram_quiz',
                  timestamp: Date.now(),
                  wrongCount: 1,
                  mastered: false,
                };
                existingMap.set(key, newMistake);
                newlyAdded++;
              }
            }

            const updatedList = Array.from(existingMap.values());
            safeStorage.setItem(SYNCED_STORAGE_KEY, JSON.stringify(updatedList));

            params.delete('syncQ');
            params.delete('syncBatch');
            const cleanQuery = params.toString() ? `?${params.toString()}` : window.location.pathname;
            window.history.replaceState({}, document.title, cleanQuery);

            showToast(`✨ Synced ${newlyAdded > 0 ? newlyAdded : importedQuestions.length} mistake(s) from Telegram!`);
          }
        }
      } catch (e) {
        console.error('[BotMistakesPage] URL sync parsing error:', e);
      }
    }

    fetchMistakes();
  }, []);

  const handleDelete = async (m: RecordedMistake) => {
    if (!window.confirm('Delete this question permanently from your Mistake Notebook? It will not appear in future bot drills.')) {
      return;
    }

    setDeletingId(m.id);
    try {
      try {
        const raw = safeStorage.getItem(SYNCED_STORAGE_KEY);
        if (raw) {
          const list: RecordedMistake[] = JSON.parse(raw);
          const filtered = list.filter((item) => item.id !== m.id && item.question.trim().toLowerCase() !== m.question.trim().toLowerCase());
          safeStorage.setItem(SYNCED_STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch {}

      try {
        let deletedSet: string[] = [];
        const delRaw = safeStorage.getItem('cgl_deleted_question_ids');
        if (delRaw) {
          deletedSet = JSON.parse(delRaw);
        }
        if (m.id) deletedSet.push(m.id.toLowerCase());
        if (m.question) deletedSet.push(m.question.trim().toLowerCase());
        safeStorage.setItem('cgl_deleted_question_ids', JSON.stringify(Array.from(new Set(deletedSet))));
      } catch {}

      fetch('/api/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          questionId: m.id,
          questionText: m.question,
        }),
      }).catch((err) => console.warn('[BotMistakesPage] delete error:', err));

      if (auth.currentUser) {
        try {
          await addDoc(collection(db, 'deleted_questions'), {
            questionId: m.id,
            questionText: m.question.trim().toLowerCase(),
            chapter_title: m.topic || 'Telegram Mistake',
            subject: m.subject,
            deletedBy: auth.currentUser.uid,
            deletedAt: new Date().toISOString(),
            source: m.source,
          });
        } catch {}
      }

      setMistakes((prev) => prev.filter((item) => item.id !== m.id && item.question !== m.question));

      if (onDeleteQuestion) {
        onDeleteQuestion(m.id, m.question);
      }

      showToast('Question deleted permanently.');
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Error deleting question: ' + (err?.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  // Filter by search and source
  const searchFilteredMistakes = useMemo(() => {
    return mistakes.filter((m) => {
      if (sourceFilter === 'telegram' && !m.source.startsWith('telegram')) return false;
      if (sourceFilter === 'website' && !m.source.startsWith('website')) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQ = m.question.toLowerCase().includes(q);
        const matchesExpl = (m.explanation || '').toLowerCase().includes(q);
        const matchesTopic = (m.topic || '').toLowerCase().includes(q);
        if (!matchesQ && !matchesExpl && !matchesTopic) return false;
      }
      return true;
    });
  }, [mistakes, sourceFilter, searchQuery]);

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
      const topicName = m.topic || 'General Practice';
      if (!map[sub].topicMap.has(topicName)) {
        map[sub].topicMap.set(topicName, []);
      }
      map[sub].topicMap.get(topicName)!.push(m);
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

  const toggleTopicCard = (sub: string, topic: string) => {
    const key = `${sub}:${topic}`;
    setOpenTopicCards((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleSolution = (id: string) => {
    setExpandedSolutions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Start Interactive Practice Drill
  const startPractice = (questionsToPractice: RecordedMistake[]) => {
    if (!questionsToPractice || questionsToPractice.length === 0) return;
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Mistake Notebook
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                {totalFilteredCount} {totalFilteredCount === 1 ? 'question' : 'questions'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Subject cards & topic-wise revision bank from @My_cgl_bot & Mock tests.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {totalFilteredCount > 0 && (
            <button
              onClick={() => startPractice(searchFilteredMistakes)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Practice all questions"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Practice All ({totalFilteredCount})</span>
            </button>
          )}
          <a
            href="https://t.me/My_cgl_bot?start=sync"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Sync latest quiz mistakes from @My_cgl_bot"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Sync Telegram</span>
          </a>
          <button
            onClick={fetchMistakes}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors border border-slate-200/80 cursor-pointer disabled:opacity-50"
            title="Refresh notebook"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* LEVEL 1: SUBJECT CARDS GRID */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Select Subject:
          </span>
          <button
            onClick={() => setSelectedSubject('all')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedSubject === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            Show All Subjects ({totalFilteredCount})
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {(['english', 'mathematics', 'reasoning', 'general_awareness'] as const).map((subKey) => {
            const conf = SUBJECT_CONFIG[subKey];
            const stats = subjectStats[subKey];
            const isSelected = selectedSubject === subKey;
            const hasMistakes = stats.total > 0;

            return (
              <div
                key={subKey}
                onClick={() => setSelectedSubject(subKey)}
                className={`rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[120px] sm:min-h-[135px] ${
                  isSelected
                    ? `${conf.activeBorder} ${conf.activeBg}`
                    : `bg-white hover:border-slate-300 border-slate-200/80 shadow-2xs hover:shadow-xs`
                }`}
              >
                {/* Active Indicator Pip */}
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-rose-500" />
                )}

                {/* Top Row: Icon & Subject Label */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">{conf.icon}</span>
                    <span className={`text-sm sm:text-base font-bold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                      {conf.label}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  )}
                </div>

                {/* Bottom Row: Large Metric Count & Topic Sub-stat */}
                <div className="mt-3 pt-3 border-t border-slate-100/80 flex items-end justify-between">
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">
                      {stats.total}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 mt-1">
                      {hasMistakes
                        ? `${stats.topicMap.size} ${stats.topicMap.size === 1 ? 'Topic' : 'Topics'}`
                        : '0 Mistakes'}
                    </div>
                  </div>

                  {hasMistakes && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const allSubQuestions = Array.from(stats.topicMap.values()).flat();
                        startPractice(allSubQuestions);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within questions, topics, or explanations..."
            className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Source Toggle & Study Mode Switch */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Source Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                sourceFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter('telegram')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                sourceFilter === 'telegram' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span>Telegram</span>
            </button>
            <button
              onClick={() => setSourceFilter('website')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                sourceFilter === 'website' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-3 h-3" />
              <span>Website</span>
            </button>
          </div>

          {/* Self-Test Mode Switch */}
          <button
            onClick={() => setStudyMode((prev) => (prev === 'study' ? 'recall' : 'study'))}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              studyMode === 'recall'
                ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle between showing solutions or hiding answers for self-testing"
          >
            {studyMode === 'recall' ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
            <span>{studyMode === 'recall' ? 'Self-Test Mode' : 'Study Mode'}</span>
          </button>
        </div>
      </div>

      {/* LEVEL 2: TOPIC-WISE CARDS (UNDER SELECTED SUBJECT) */}
      <div className="space-y-6">
        {loading && mistakes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-semibold text-slate-600">Loading your mistake notebook...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-rose-600" />
            <p className="text-sm font-bold text-rose-800">{error}</p>
            <button
              onClick={fetchMistakes}
              className="mt-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : totalFilteredCount === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-10 sm:p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl">
              🎯
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">No Mistakes Found</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
              When you miss questions in @My_cgl_bot quizzes or website mocks, they will be organized into subject cards and chapter cards here.
            </p>
            <div className="pt-2">
              <a
                href="https://t.me/My_cgl_bot?start=sync"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Sync with Telegram Bot (@My_cgl_bot)</span>
              </a>
            </div>
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
                    className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center flex flex-col items-center justify-center gap-2 shadow-xs"
                  >
                    <span className="text-3xl">{conf.icon}</span>
                    <h3 className="text-base font-bold text-slate-800">All Mastered in {conf.label}!</h3>
                    <p className="text-xs text-slate-500 max-w-md">
                      You have zero pending mistakes in {conf.label}. Keep drilling to retain mastery!
                    </p>
                  </div>
                );
              }
              return null;
            }

            return (
              <div key={subKey} className="space-y-4">
                {/* Subject Section Title Bar */}
                <div className="flex items-center justify-between gap-3 px-1 border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{conf.icon}</span>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      {conf.label} Topics
                    </h2>
                    <span className="text-xs text-slate-500 font-medium">
                      ({stat.total} {stat.total === 1 ? 'question' : 'questions'} across {stat.topicMap.size} {stat.topicMap.size === 1 ? 'topic' : 'topics'})
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      const allSubQuestions = Array.from(stat.topicMap.values()).flat();
                      startPractice(allSubQuestions);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${conf.accentBtn}`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Practice All {conf.label}</span>
                  </button>
                </div>

                {/* TOPIC-WISE CARDS GRID FOR THIS SUBJECT */}
                <div className="space-y-3.5">
                  {topicEntries.map(([topicName, topicQuestions]) => {
                    const cardKey = `${subKey}:${topicName}`;
                    const isOpen = openTopicCards[cardKey] ?? true;
                    const topicIcon = getTopicIcon(topicName);

                    return (
                      <div
                        key={topicName}
                        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                      >
                        {/* Topic Card Header */}
                        <div
                          onClick={() => toggleTopicCard(subKey, topicName)}
                          className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shadow-2xs shrink-0">
                              {topicIcon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                  {topicName}
                                </h3>
                                <span className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border ${conf.bg} ${conf.text} ${conf.border}`}>
                                  {conf.label}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500">
                                {topicQuestions.length} {topicQuestions.length === 1 ? 'mistake recorded' : 'mistakes recorded'}
                              </span>
                            </div>
                          </div>

                          {/* Topic Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startPractice(topicQuestions);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200 cursor-pointer shadow-2xs"
                              title={`Drill ${topicQuestions.length} questions in ${topicName}`}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Practice</span>
                            </button>
                            <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                              {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                            </div>
                          </div>
                        </div>

                        {/* LEVEL 3: QUESTION CARDS (INSIDE TOPIC CARD) */}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="border-t border-slate-100 divide-y divide-slate-100 p-4 sm:p-5 space-y-4"
                            >
                              {topicQuestions.map((m, idx) => (
                                <QuestionItemCard
                                  key={m.id || idx}
                                  index={idx + 1}
                                  mistake={m}
                                  studyMode={studyMode}
                                  onDelete={() => handleDelete(m)}
                                  isDeleting={deletingId === m.id}
                                  isExpanded={expandedSolutions[m.id] ?? true}
                                  onToggleSolution={() => toggleSolution(m.id)}
                                  selectedOption={userSelectedOptions[m.id]}
                                  onSelectOption={(opt) => {
                                    setUserSelectedOptions((prev) => ({ ...prev, [m.id]: opt }));
                                  }}
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

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

// ----------------------------------------------------
// QUESTION ITEM CARD COMPONENT
// ----------------------------------------------------

interface QuestionItemCardProps {
  index: number;
  mistake: RecordedMistake;
  studyMode: 'study' | 'recall';
  onDelete: () => void;
  isDeleting: boolean;
  isExpanded: boolean;
  onToggleSolution: () => void;
  selectedOption?: number;
  onSelectOption?: (optIdx: number) => void;
}

const QuestionItemCard: React.FC<QuestionItemCardProps> = ({
  index,
  mistake,
  studyMode,
  onDelete,
  isDeleting,
  isExpanded,
  onToggleSolution,
  selectedOption,
  onSelectOption,
}) => {
  const letters = ['A', 'B', 'C', 'D'];
  const normSub = normalizeSubject(mistake.subject);
  const subConf = SUBJECT_CONFIG[normSub] || SUBJECT_CONFIG.general_awareness;
  const isTelegram = mistake.source && mistake.source.startsWith('telegram');

  const { coreExplanation, definitions } = useMemo(
    () => cleanAndFormatExplanation(mistake.explanation),
    [mistake.explanation]
  );

  return (
    <div className="space-y-3.5 pt-2">
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 font-mono">#{index}</span>
          <span className={`px-2 py-0.5 text-xs font-bold rounded-lg border ${subConf.bg} ${subConf.text} ${subConf.border}`}>
            {subConf.label}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            📌 {mistake.topic || 'Practice'}
          </span>
          <span
            className={`px-2 py-0.5 text-[11px] font-semibold rounded-lg border flex items-center gap-1 ${
              isTelegram ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {isTelegram ? (
              <>
                <Smartphone className="w-3 h-3 text-sky-600" />
                <span>Telegram Bot</span>
              </>
            ) : (
              <>
                <Laptop className="w-3 h-3 text-emerald-600" />
                <span>Website Mock</span>
              </>
            )}
          </span>
          {mistake.wrongCount > 1 && (
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
              Missed {mistake.wrongCount}x
            </span>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          title="Delete from mistake notebook"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
        </button>
      </div>

      {/* Question Prompt */}
      <div className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
        {mistake.question}
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {mistake.options.map((opt, optIdx) => {
          const isCorrect = optIdx === mistake.correctOptionIndex;
          const isChosen = selectedOption === optIdx;

          if (studyMode === 'recall') {
            const hasChosen = selectedOption !== undefined;
            let optStyle = 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700';
            if (hasChosen) {
              if (isCorrect) optStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold';
              else if (isChosen) optStyle = 'bg-rose-50 border-rose-400 text-rose-950 font-medium';
              else optStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
            }

            return (
              <button
                key={optIdx}
                onClick={() => onSelectOption && onSelectOption(optIdx)}
                className={`text-left p-3 rounded-xl border text-xs sm:text-sm transition-all flex items-start gap-2.5 cursor-pointer ${optStyle}`}
              >
                <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 bg-white border border-slate-200">
                  {letters[optIdx]}
                </span>
                <span className="leading-snug">{opt}</span>
              </button>
            );
          }

          return (
            <div
              key={optIdx}
              className={`flex items-start gap-2.5 p-3 rounded-xl text-xs sm:text-sm transition-all border ${
                isCorrect
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-medium shadow-2xs'
                  : 'bg-slate-50/60 border-slate-200/70 text-slate-700'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                  isCorrect ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isCorrect ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : letters[optIdx]}
              </span>
              <span className="leading-snug">{opt}</span>
            </div>
          );
        })}
      </div>

      {/* Explanation Panel */}
      {(coreExplanation || definitions.length > 0) && (
        <div className="pt-1">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 overflow-hidden">
            <button
              onClick={onToggleSolution}
              className="w-full p-2.5 sm:px-3.5 sm:py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100/50 hover:bg-slate-100/80 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-indigo-700">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Concept & Solution Breakdown</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {isExpanded ? 'Hide' : 'Show Details'}
              </span>
            </button>

            {isExpanded && (
              <div className="p-3.5 sm:p-4 space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed border-t border-slate-200/60">
                {coreExplanation && (
                  <p className="whitespace-pre-wrap text-slate-800">
                    {coreExplanation}
                  </p>
                )}

                {definitions.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Options Breakdown:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {definitions.map((def, dIdx) => (
                        <div
                          key={dIdx}
                          className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs text-xs space-y-0.5"
                        >
                          <span className="font-bold text-indigo-900">{def.word}: </span>
                          <span className="text-slate-600">{def.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
