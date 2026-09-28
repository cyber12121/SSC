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
  Smartphone,
  Laptop,
  Play,
  RotateCcw,
  X,
  ChevronRight
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
  onStartPractice?: (topic: string, questions: Question[]) => void;
}

const SYNCED_STORAGE_KEY = 'cgl_synced_telegram_mistakes';

// Safe base64 / base64url UTF-8 decoder
function decodeSyncPayload(str: string): any {
  try {
    let cleanStr = str;
    try {
      cleanStr = decodeURIComponent(str);
    } catch {}
    let base64 = cleanStr.replace(/-/g, '+').replace(/_/g, '/');
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

// Checks if a question belongs to Speed Drills (Mental Math, Calc Studio, Simplification, etc.)
export function isSpeedLabQuestion(item: { id?: string; topic?: string; question?: string; source?: string }): boolean {
  const s = ((item.id || '') + ' ' + (item.topic || '') + ' ' + (item.source || '')).toLowerCase();
  return (
    s.includes('speed') ||
    s.includes('mental_math') ||
    s.includes('calc_studio') ||
    s.includes('simplification') ||
    s.includes('step_triplets') ||
    s.includes('step_tables') ||
    s.includes('step_squares') ||
    s.includes('step_cubes') ||
    s.includes('step_fractions') ||
    s.includes('step_compl') ||
    s.includes('step_mult') ||
    s.includes('mm_add') ||
    s.includes('mm_sub') ||
    s.includes('mm_mul') ||
    s.includes('mm_div') ||
    s.includes('mm_sq') ||
    s.includes('mm_cu') ||
    s.includes('mm_pct') ||
    s.includes('simp_cat')
  );
}

// Canonical question deduplication key based on normalized question text
export function getDedupeKey(qText?: string, id?: string): string {
  const text = (qText || '')
    .toLowerCase()
    // Strip leading question numbers like "Q1.", "Q 1:", "1.", "1)", "Question 1:"
    .replace(/^(?:question\s*\d+[:.]?|\bq\s*\d+[:.]?|\d+[.)]\s*)/i, '')
    // Normalize all whitespace & punctuation
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ')
    .replace(/[?.!,:;'"()\[\]{}]+$/g, '')
    .trim();
  return text || (id || '').trim().toLowerCase();
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
  onStartPractice,
}) => {
  const [mistakes, setMistakes] = useState<RecordedMistake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Hierarchy States
  const [selectedSubject, setSelectedSubject] = useState<'all' | 'english' | 'mathematics' | 'reasoning' | 'general_awareness'>('english');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'telegram' | 'website'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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

      // Load from dedicated website mistake notebook (user-confirmed mistakes only)
      let websiteMistakes: RecordedMistake[] = [];
      try {
        const nbRaw = safeStorage.getItem('cgl_user_mistake_notebook');
        if (nbRaw) {
          const parsed = JSON.parse(nbRaw);
          if (Array.isArray(parsed)) websiteMistakes = parsed;
        }
      } catch (err) {
        console.warn('[BotMistakesPage] Error reading cgl_user_mistake_notebook:', err);
      }

      // Merge and deduplicate across all sources using canonical normalized question key
      const mergedMap = new Map<string, RecordedMistake>();

      const addOrMerge = (m: RecordedMistake) => {
        if (!m || isSpeedLabQuestion(m)) return;
        const key = getDedupeKey(m.question, m.id);
        if (!key) return;

        const normalizedSub = normalizeSubject(m.subject);
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          existing.wrongCount = Math.max(existing.wrongCount || 1, m.wrongCount || 1);
          existing.timestamp = Math.max(existing.timestamp || 0, m.timestamp || 0);
          if ((!existing.explanation || existing.explanation.trim().length < 10) && m.explanation) {
            existing.explanation = m.explanation;
          }
          if ((!existing.options || existing.options.length === 0) && (m.options && m.options.length > 0)) {
            existing.options = m.options;
            existing.correctOptionIndex = m.correctOptionIndex;
          }
          if ((!existing.topic || existing.topic === 'Mock Mistake') && m.topic && m.topic !== 'Mock Mistake') {
            existing.topic = m.topic;
            existing.topicSlug = m.topicSlug;
          }
        } else {
          mergedMap.set(key, { ...m, subject: normalizedSub });
        }
      };

      for (const m of serverMistakes) addOrMerge(m);
      for (const m of firestoreMistakes) addOrMerge(m);
      for (const m of websiteMistakes) addOrMerge(m);
      for (const m of localSynced) addOrMerge(m);

      // Filter out deleted questions and speed lab items
      let deletedIds = new Set<string>();
      try {
        const delRaw = safeStorage.getItem('cgl_deleted_question_ids');
        if (delRaw) {
          const arr = JSON.parse(delRaw);
          if (Array.isArray(arr)) arr.forEach((id) => deletedIds.add(String(id).toLowerCase()));
        }
      } catch {}

      const finalList = Array.from(mergedMap.values()).filter((item) => {
        if (isSpeedLabQuestion(item)) return false;
        if (item.id && deletedIds.has(item.id.toLowerCase())) return false;
        if (item.question && deletedIds.has(item.question.trim().toLowerCase())) return false;
        return true;
      });
      finalList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setMistakes(finalList);

      // Persist to safeStorage so loaded mistakes stay permanently cached
      if (finalList.length > 0) {
        try {
          safeStorage.setItem(SYNCED_STORAGE_KEY, JSON.stringify(finalList));
        } catch {}

        if (auth.currentUser) {
          try {
            for (const m of finalList) {
              const docId = m.id ? m.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) : `m_${Date.now()}`;
              setDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, docId), m, { merge: true }).catch(() => {});
            }
          } catch {}
        }
      }

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
      }
    } catch (err: any) {
      console.error('[BotMistakesPage] Fetch error:', err);
      setError('Unable to load mistakes. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check URL parameters for direct automatic sync from Telegram
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const syncQParam = params.get('syncQ');
        const syncBatchParam = params.get('syncBatch');

        if (syncQParam || syncBatchParam) {
          const importedQuestions: any[] = [];
          if (syncQParam) {
            const decoded = decodeSyncPayload(syncQParam);
            if (decoded) importedQuestions.push(decoded);
          }
          if (syncBatchParam) {
            const decoded = decodeSyncPayload(syncBatchParam);
            if (Array.isArray(decoded)) {
              importedQuestions.push(...decoded);
            } else if (decoded) {
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
              const key = getDedupeKey(item.question, item.id);
              if (key) existingMap.set(key, item);
            }

            let newlyAdded = 0;
            for (const rawQ of importedQuestions) {
              let qId = '';
              let qText = '';
              let opts: string[] = [];
              let ans = 0;
              let exp = '';
              let sub = 'general_awareness';
              let top = 'Telegram Practice';

              if (Array.isArray(rawQ)) {
                // Compact tuple: [id, q, opts, ans, exp, sub, top]
                [qId, qText, opts, ans, exp, sub, top] = rawQ;
              } else if (rawQ && typeof rawQ === 'object') {
                qId = rawQ.id || '';
                qText = rawQ.q || rawQ.question || '';
                if (Array.isArray(rawQ.opts)) opts = rawQ.opts;
                else if (Array.isArray(rawQ.options)) opts = rawQ.options;
                else if (rawQ.opts && typeof rawQ.opts === 'object') opts = Object.values(rawQ.opts);
                ans = typeof rawQ.ans === 'number' ? rawQ.ans : (typeof rawQ.correctOptionIndex === 'number' ? rawQ.correctOptionIndex : 0);
                exp = rawQ.exp || rawQ.explanation || rawQ.fullSolution || '';
                sub = rawQ.sub || rawQ.subject || 'general_awareness';
                top = rawQ.top || rawQ.topic || 'Telegram Practice';
              }

              if (!qText) continue;
              if (isSpeedLabQuestion({ id: qId, topic: top, question: qText })) continue;
              opts = (opts || []).map(String);
              const key = getDedupeKey(qText, qId);
              if (!key) continue;

              const finalQId = qId || `tg_${key.slice(0, 24)}`;

              if (existingMap.has(key)) {
                const ex = existingMap.get(key)!;
                ex.wrongCount = (ex.wrongCount || 1) + 1;
                ex.timestamp = Date.now();
                if ((!ex.explanation || ex.explanation.length < 10) && exp) {
                  ex.explanation = exp;
                }
                if ((!ex.options || ex.options.length === 0) && opts.length > 0) {
                  ex.options = opts;
                }
              } else {
                const normSub = normalizeSubject(sub);
                const newMistake: RecordedMistake = {
                  id: finalQId,
                  userId: 0,
                  question: qText,
                  options: opts,
                  correctOptionIndex: typeof ans === 'number' ? ans : 0,
                  explanation: exp,
                  subject: normSub,
                  topic: top,
                  topicSlug: (top || 'telegram').toLowerCase().replace(/\s+/g, '-'),
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

            // Auto-backup to Firestore if authenticated
            if (auth.currentUser) {
              try {
                for (const m of updatedList) {
                  const docId = m.id ? m.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) : `m_${Date.now()}`;
                  setDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, docId), m, { merge: true }).catch(() => {});
                }
              } catch {}
            }

            // Clean query params from address bar silently without reloading
            params.delete('syncQ');
            params.delete('syncBatch');
            const cleanQuery = params.toString() ? `?${params.toString()}` : window.location.pathname;
            window.history.replaceState({}, document.title, cleanQuery);

            showToast(`✨ Automatically synced ${newlyAdded > 0 ? newlyAdded : importedQuestions.length} mistake(s) from Telegram!`);
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
      // 1. Remove from local synced telegram mistakes
      try {
        const raw = safeStorage.getItem(SYNCED_STORAGE_KEY);
        if (raw) {
          const list: RecordedMistake[] = JSON.parse(raw);
          const filtered = list.filter((item) => item.id !== m.id && item.question.trim().toLowerCase() !== m.question.trim().toLowerCase());
          safeStorage.setItem(SYNCED_STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch {}

      // 2. Remove from dedicated website mistake notebook
      try {
        const nbRaw = safeStorage.getItem('cgl_user_mistake_notebook');
        if (nbRaw) {
          const list: RecordedMistake[] = JSON.parse(nbRaw);
          const filtered = list.filter((item) => item.id !== m.id && item.question.trim().toLowerCase() !== m.question.trim().toLowerCase());
          safeStorage.setItem('cgl_user_mistake_notebook', JSON.stringify(filtered));
        }
      } catch {}

      // 3. Mark in deleted questions set
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

      // 4. Delete on server API / Telegram store
      fetch('/api/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          questionId: m.id,
          questionText: m.question,
        }),
      }).catch((err) => console.warn('[BotMistakesPage] delete error:', err));

      // 5. Delete from Firebase Firestore permanently
      if (auth.currentUser) {
        try {
          const docId = m.id ? m.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) : '';
          if (docId) {
            await deleteDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, docId)).catch(() => {});
          }
          // Also match and delete by question text or ID across docs
          const snap = await getDocs(collection(db, `user_mistakes_${auth.currentUser.uid}`));
          const qClean = (m.question || '').trim().toLowerCase();
          for (const d of snap.docs) {
            const dData = d.data();
            if (d.id === docId || d.id === m.id || (dData?.question && dData.question.trim().toLowerCase() === qClean)) {
              await deleteDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, d.id)).catch(() => {});
            }
          }
        } catch (err) {
          console.warn('[BotMistakesPage] Firestore deleteDoc error:', err);
        }
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

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to completely clear ALL mistakes from your Mistake Notebook? This cannot be undone.')) {
      return;
    }
    setLoading(true);
    try {
      // 1. Wipe local synced telegram mistakes
      safeStorage.removeItem(SYNCED_STORAGE_KEY);

      // 2. Wipe dedicated mistake notebook
      safeStorage.removeItem('cgl_user_mistake_notebook');

      // 3. Wipe mistake entries from cgl_rca_global_store
      safeStorage.removeItem('cgl_rca_global_store');

      // 4. Clear on server / Telegram bot store
      await fetch('/api/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' }),
      }).catch((err) => console.warn('Server clear error:', err));

      // 5. Delete all user_mistakes documents in Firestore if authenticated
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
      showToast('✨ Mistake Notebook has been completely cleared!');
    } catch (err: any) {
      console.error('Error clearing mistakes:', err);
      showToast('Error clearing mistakes: ' + (err?.message || err));
    } finally {
      setLoading(false);
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
    if (!window.confirm(`Delete all ${topicQuestions.length} mistake(s) in "${topicName}"?`)) {
      return;
    }
    const qIds = new Set(topicQuestions.map((q) => q.id));
    const qTexts = new Set(topicQuestions.map((q) => q.question.trim().toLowerCase()));

    // 1. Remove from local synced telegram mistakes
    try {
      const raw = safeStorage.getItem(SYNCED_STORAGE_KEY);
      if (raw) {
        const list: RecordedMistake[] = JSON.parse(raw);
        const filtered = list.filter((item) => !qIds.has(item.id) && !qTexts.has(item.question.trim().toLowerCase()));
        safeStorage.setItem(SYNCED_STORAGE_KEY, JSON.stringify(filtered));
      }
    } catch {}

    // 2. Remove from dedicated website mistake notebook
    try {
      const nbRaw = safeStorage.getItem('cgl_user_mistake_notebook');
      if (nbRaw) {
        const list: RecordedMistake[] = JSON.parse(nbRaw);
        const filtered = list.filter((item) => !qIds.has(item.id) && !qTexts.has(item.question.trim().toLowerCase()));
        safeStorage.setItem('cgl_user_mistake_notebook', JSON.stringify(filtered));
      }
    } catch {}

    // 3. Mark in deleted questions set
    try {
      let deletedSet: string[] = [];
      const delRaw = safeStorage.getItem('cgl_deleted_question_ids');
      if (delRaw) deletedSet = JSON.parse(delRaw);
      topicQuestions.forEach((q) => {
        if (q.id) deletedSet.push(q.id.toLowerCase());
        deletedSet.push(q.question.trim().toLowerCase());
      });
      safeStorage.setItem('cgl_deleted_question_ids', JSON.stringify(Array.from(new Set(deletedSet))));
    } catch {}

    // 4. Delete on server API / Telegram store
    for (const q of topicQuestions) {
      fetch('/api/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          questionId: q.id,
          questionText: q.question,
        }),
      }).catch(() => {});
    }

    // 5. Delete from Firebase Firestore if authenticated
    if (auth.currentUser) {
      try {
        const snap = await getDocs(collection(db, `user_mistakes_${auth.currentUser.uid}`));
        for (const d of snap.docs) {
          const dData = d.data();
          if (qIds.has(d.id) || (dData?.question && qTexts.has(dData.question.trim().toLowerCase()))) {
            deleteDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, d.id)).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[BotMistakesPage] Firestore deleteDoc error:', err);
      }
    }

    setMistakes((prev) => prev.filter((item) => !qIds.has(item.id) && !qTexts.has(item.question.trim().toLowerCase())));
    showToast(`Deleted ${topicQuestions.length} mistake(s) from "${topicName}".`);
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
              Subject cards & topic-wise revision bank from @My_cgl_bot & Mock tests.
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
          <a
            href="https://t.me/My_cgl_bot?start=sync"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Sync latest quiz mistakes from @My_cgl_bot"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Sync Telegram</span>
          </a>
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

        {/* Source Toggle & Study Mode Switch */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
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
              onClick={() => setSourceFilter('telegram')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                sourceFilter === 'telegram' ? 'bg-white text-sky-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-2.5 h-2.5" />
              <span>Telegram</span>
            </button>
            <button
              onClick={() => setSourceFilter('website')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                sourceFilter === 'website' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-2.5 h-2.5" />
              <span>Website</span>
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
              When you miss questions in @My_cgl_bot quizzes or website mocks, they will be organized into subject cards and chapter cards here.
            </p>
            <div className="pt-1">
              <a
                href="https://t.me/My_cgl_bot?start=sync"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
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
