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

const SUBJECT_CONFIG: Record<
  'english' | 'mathematics' | 'reasoning' | 'general_awareness',
  { label: string; icon: string; bg: string; text: string; border: string; pillActive: string }
> = {
  english: {
    label: 'English',
    icon: '📖',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    pillActive: 'bg-sky-600 text-white border-sky-600 shadow-sm'
  },
  mathematics: {
    label: 'Math',
    icon: '📐',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    pillActive: 'bg-amber-600 text-white border-amber-600 shadow-sm'
  },
  reasoning: {
    label: 'Reasoning',
    icon: '🧠',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    pillActive: 'bg-purple-600 text-white border-purple-600 shadow-sm'
  },
  general_awareness: {
    label: 'GK & GA',
    icon: '🏛️',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    pillActive: 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
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

  // Parse lines or bullet points
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

  // Filters & View Controls
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'telegram' | 'website'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'chapters' | 'all'>('chapters');
  const [studyMode, setStudyMode] = useState<'study' | 'recall'>('study');

  // Accordion state for chapter cards: topic -> isOpen
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  // Individual card state
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

      // Default expand the first chapter
      if (finalList.length > 0) {
        const firstTopic = finalList[0].topic || 'General';
        setOpenChapters((prev) => ({ ...prev, [firstTopic]: true }));
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

            // Clean query parameters from URL bar
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
      // 1. Remove from local synced storage
      try {
        const raw = safeStorage.getItem(SYNCED_STORAGE_KEY);
        if (raw) {
          const list: RecordedMistake[] = JSON.parse(raw);
          const filtered = list.filter((item) => item.id !== m.id && item.question.trim().toLowerCase() !== m.question.trim().toLowerCase());
          safeStorage.setItem(SYNCED_STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch {}

      // 2. Add to deleted questions set in safeStorage
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

      // 3. Delete from Server & Telegram Bot Store (background)
      fetch('/api/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          questionId: m.id,
          questionText: m.question,
        }),
      }).catch((err) => console.warn('[BotMistakesPage] delete error:', err));

      // 4. Persist to Firebase Firestore if logged in
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

      // 5. Update local state
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

  // Filtered Mistakes List
  const filteredMistakes = useMemo(() => {
    return mistakes.filter((m) => {
      // Source filter
      if (sourceFilter === 'telegram' && !m.source.startsWith('telegram')) return false;
      if (sourceFilter === 'website' && !m.source.startsWith('website')) return false;

      // Subject filter
      const normSub = normalizeSubject(m.subject);
      if (selectedSubject !== 'all' && normSub !== selectedSubject) return false;

      // Topic filter
      if (selectedTopic !== 'all' && m.topicSlug !== selectedTopic && m.topic !== selectedTopic) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQ = m.question.toLowerCase().includes(q);
        const matchesExpl = (m.explanation || '').toLowerCase().includes(q);
        const matchesTopic = (m.topic || '').toLowerCase().includes(q);
        if (!matchesQ && !matchesExpl && !matchesTopic) return false;
      }
      return true;
    });
  }, [mistakes, sourceFilter, selectedSubject, selectedTopic, searchQuery]);

  // Grouped by Chapter / Topic
  const groupedByTopic = useMemo(() => {
    const groups = new Map<string, { topic: string; subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness'; items: RecordedMistake[] }>();
    for (const m of filteredMistakes) {
      const topic = m.topic || 'General Practice';
      const existing = groups.get(topic) || { topic, subject: normalizeSubject(m.subject), items: [] };
      existing.items.push(m);
      groups.set(topic, existing);
    }
    return Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length);
  }, [filteredMistakes]);

  // Accurate Subject Counts
  const subjectCounts = useMemo(() => {
    const counts = {
      all: mistakes.length,
      english: 0,
      mathematics: 0,
      reasoning: 0,
      general_awareness: 0,
    };
    mistakes.forEach((m) => {
      if (sourceFilter === 'telegram' && !m.source.startsWith('telegram')) return;
      if (sourceFilter === 'website' && !m.source.startsWith('website')) return;
      const sub = normalizeSubject(m.subject);
      counts[sub] = (counts[sub] || 0) + 1;
    });
    return counts;
  }, [mistakes, sourceFilter]);

  // Overall Stats
  const stats = useMemo(() => {
    const telegramCount = mistakes.filter((m) => m.source.startsWith('telegram')).length;
    const websiteCount = mistakes.filter((m) => m.source.startsWith('website')).length;
    return {
      total: mistakes.length,
      telegramCount,
      websiteCount,
    };
  }, [mistakes]);

  const toggleChapter = (topic: string) => {
    setOpenChapters((prev) => ({
      ...prev,
      [topic]: !prev[topic],
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
    <div className="max-w-5xl mx-auto space-y-5 pb-16 animate-in fade-in duration-200">
      {/* Toast Notification */}
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

      {/* COMPACT & MODERN TOP HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {stats.total} {stats.total === 1 ? 'question' : 'questions'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Questions missed in Telegram (@My_cgl_bot) or mock tests, organized for targeted recall.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {filteredMistakes.length > 0 && (
              <button
                onClick={() => startPractice(filteredMistakes)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Practice these questions interactively"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Practice ({filteredMistakes.length})</span>
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
              <span>Sync from Telegram</span>
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

        {/* Clean Subject Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-4 mt-4 border-t border-slate-100 scrollbar-none">
          <button
            onClick={() => { setSelectedSubject('all'); setSelectedTopic('all'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
              selectedSubject === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Subjects ({subjectCounts.all})
          </button>
          {(['english', 'mathematics', 'reasoning', 'general_awareness'] as const).map((sub) => {
            const conf = SUBJECT_CONFIG[sub];
            const isSelected = selectedSubject === sub;
            const count = subjectCounts[sub] || 0;

            return (
              <button
                key={sub}
                onClick={() => { setSelectedSubject(sub); setSelectedTopic('all'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border flex items-center gap-1.5 ${
                  isSelected
                    ? conf.pillActive
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{conf.icon}</span>
                <span>{conf.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FILTER & VIEW CONTROLS TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by question, concept, or word..."
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

        {/* View Mode & Source Controls */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Source Filter */}
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
              <span>Telegram ({stats.telegramCount})</span>
            </button>
            <button
              onClick={() => setSourceFilter('website')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                sourceFilter === 'website' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-3 h-3" />
              <span>Website ({stats.websiteCount})</span>
            </button>
          </div>

          {/* View Mode Switcher: By Chapter vs Flat Stream */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('chapters')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'chapters' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Organize by chapters & topics"
            >
              <Folder className="w-3 h-3" />
              <span>Chapters</span>
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show all questions in a single list"
            >
              <Layers className="w-3 h-3" />
              <span>Stream</span>
            </button>
          </div>

          {/* Study Mode: Visible vs Recall Mode */}
          <button
            onClick={() => setStudyMode((prev) => (prev === 'study' ? 'recall' : 'study'))}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              studyMode === 'recall'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle between showing solutions or hiding answers for active self-testing"
          >
            {studyMode === 'recall' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{studyMode === 'recall' ? 'Self-Test Mode' : 'Study Mode'}</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
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
      ) : filteredMistakes.length === 0 ? (
        /* Clean Empty State */
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 sm:p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl">
            🎯
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800">No Mistakes Found</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
            When you miss questions in @My_cgl_bot quizzes or website mocks, they will be organized chapter-wise here for targeted revision.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <a
              href="https://t.me/My_cgl_bot?start=sync"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Sync from Telegram Bot (@My_cgl_bot)</span>
            </a>
          </div>
        </div>
      ) : viewMode === 'chapters' ? (
        /* CHAPTER / TOPIC GROUPED ACCORDION VIEW */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Organized into <strong>{groupedByTopic.length}</strong> chapter {groupedByTopic.length === 1 ? 'folder' : 'folders'} ({filteredMistakes.length} total questions)
            </span>
            <button
              onClick={() => {
                const allOpen = Object.values(openChapters).every(Boolean);
                const nextState: Record<string, boolean> = {};
                groupedByTopic.forEach((g) => {
                  nextState[g.topic] = !allOpen;
                });
                setOpenChapters(nextState);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              {Object.values(openChapters).every(Boolean) ? 'Collapse All' : 'Expand All'}
            </button>
          </div>

          {groupedByTopic.map((group) => {
            const isOpen = openChapters[group.topic] ?? false;
            const subConf = SUBJECT_CONFIG[group.subject] || SUBJECT_CONFIG.general_awareness;

            return (
              <div
                key={group.topic}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Chapter Folder Header */}
                <div
                  onClick={() => toggleChapter(group.topic)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-2xs">
                      {isOpen ? <FolderOpen className="w-4 h-4 text-indigo-600" /> : <Folder className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                          {group.topic}
                        </h3>
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border ${subConf.bg} ${subConf.text} ${subConf.border}`}>
                          {subConf.label}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {group.items.length} {group.items.length === 1 ? 'question recorded' : 'questions recorded'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startPractice(group.items);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200 cursor-pointer"
                      title="Drill questions from this chapter"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Practice</span>
                    </button>
                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                      {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Chapter Question Cards (Accordion Body) */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-slate-100 divide-y divide-slate-100 p-4 sm:p-5 space-y-4"
                    >
                      {group.items.map((m, idx) => (
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
      ) : (
        /* FLAT STREAM VIEW */
        <div className="space-y-4">
          <div className="text-xs text-slate-500 px-1">
            Showing <strong>{filteredMistakes.length}</strong> recorded mistakes
          </div>
          {filteredMistakes.map((m, idx) => (
            <div key={m.id || idx} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <QuestionItemCard
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
            </div>
          ))}
        </div>
      )}

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
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mistake Recall Drill • Question {practiceIndex + 1} of {practiceQuestions.length}
                  </span>
                </div>
                <button
                  onClick={() => setPracticeModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
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

                    {/* Feedback & Solution */}
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
                              <span>Correct! Great recall.</span>
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
                  /* Practice Finished Score Summary */
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

              {/* Modal Footer */}
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
// CLEAN QUESTION ITEM CARD COMPONENT
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

      {/* Clean Options Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {mistake.options.map((opt, optIdx) => {
          const isCorrect = optIdx === mistake.correctOptionIndex;
          const isChosen = selectedOption === optIdx;

          // In Recall Mode, show selection state
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

          // Study Mode (Default): Highlight the correct option elegantly
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

      {/* ELEGANT & STRUCTURED EXPLANATION PANEL */}
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
                {/* Core Concept */}
                {coreExplanation && (
                  <p className="whitespace-pre-wrap text-slate-800">
                    {coreExplanation}
                  </p>
                )}

                {/* Vocabulary / Option Breakdown Chips */}
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
