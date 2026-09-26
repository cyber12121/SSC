import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
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
  Filter,
  Check,
  Smartphone,
  Laptop
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
  source: 'telegram_drill' | 'website_mock';
  timestamp: number;
  wrongCount: number;
  mastered: boolean;
}

interface BotMistakesPageProps {
  onBack: () => void;
  onDeleteQuestion?: (questionId: string, questionText: string) => void;
}

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  english: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  mathematics: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  reasoning: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  general_awareness: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

const SUBJECT_LABELS: Record<string, string> = {
  english: 'English',
  mathematics: 'Math',
  reasoning: 'Reasoning',
  general_awareness: 'GK & GA',
};

export const BotMistakesPage: React.FC<BotMistakesPageProps> = ({
  onBack,
  onDeleteQuestion,
}) => {
  const [mistakes, setMistakes] = useState<RecordedMistake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'telegram_drill' | 'website_mock'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchMistakes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mistakes');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.mistakes)) {
        setMistakes(data.mistakes);
      }
    } catch (err: any) {
      console.error('[BotMistakesPage] Fetch error:', err);
      setError('Unable to load mistakes from server. Check your connection or refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMistakes();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDelete = async (m: RecordedMistake) => {
    if (!window.confirm('Delete this question permanently from Firebase and the Telegram bot? It will not appear in future bot drills.')) {
      return;
    }

    setDeletingId(m.id);
    try {
      // 1. Delete from Server & Telegram Bot Store
      await fetch('/api/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          questionId: m.id,
          questionText: m.question,
        }),
      });

      // 2. Persist to Firebase Firestore deleted_questions (if authenticated)
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
        } catch (fErr) {
          console.warn('[Firestore] Could not write to deleted_questions:', fErr);
        }
      }

      // 3. Update local state
      setMistakes((prev) => prev.filter((item) => item.id !== m.id && item.question !== m.question));

      if (onDeleteQuestion) {
        onDeleteQuestion(m.id, m.question);
      }

      showToast('Question deleted permanently across Firebase & Telegram Bot.');
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Error deleting question: ' + (err?.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered Mistakes
  const filteredMistakes = useMemo(() => {
    return mistakes.filter((m) => {
      // Source filter
      if (sourceFilter !== 'all' && m.source !== sourceFilter) return false;
      // Subject filter
      if (selectedSubject !== 'all' && m.subject !== selectedSubject) return false;
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

  // Topic list for selected subject
  const availableTopics = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; count: number }>();
    mistakes.forEach((m) => {
      if (sourceFilter !== 'all' && m.source !== sourceFilter) return;
      if (selectedSubject !== 'all' && m.subject !== selectedSubject) return;

      const slug = m.topicSlug || m.topic;
      const existing = map.get(slug) || { name: m.topic, slug, count: 0 };
      existing.count++;
      map.set(slug, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [mistakes, sourceFilter, selectedSubject]);

  // Breakdown statistics
  const stats = useMemo(() => {
    const telegramCount = mistakes.filter((m) => m.source === 'telegram_drill').length;
    const mockCount = mistakes.filter((m) => m.source === 'website_mock').length;
    const totalWrongTimes = mistakes.reduce((sum, m) => sum + (m.wrongCount || 1), 0);
    return {
      total: mistakes.length,
      telegramCount,
      mockCount,
      totalWrongTimes,
    };
  }, [mistakes]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xl border border-slate-700 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero & Header Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold tracking-wider uppercase shadow-2xs">
                <Smartphone className="w-3 h-3 text-indigo-600" />
                <span>2-Way Firebase Sync</span>
              </div>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
                @my_cgl_bot & Website Mocks
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Mistake Bank & Error Notebook</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Every missed question from Telegram Bot drills and Full Mock Tests is logged here. Delete any mastered question permanently from Firebase and future Telegram bot drills.
            </p>
          </div>

          {/* Action & Refresh Button */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={fetchMistakes}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors border border-slate-200/80 cursor-pointer disabled:opacity-50"
              title="Sync latest questions from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Syncing...' : 'Sync Questions'}</span>
            </button>
          </div>
        </div>

        {/* Quick Stat Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-5 border-t border-slate-100">
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Mistakes</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</div>
          </div>
          <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-100">
            <div className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              <span>Telegram Bot</span>
            </div>
            <div className="text-2xl font-black text-sky-900 mt-0.5">{stats.telegramCount}</div>
          </div>
          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
            <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
              <Laptop className="w-3 h-3" />
              <span>Website Mocks</span>
            </div>
            <div className="text-2xl font-black text-indigo-900 mt-0.5">{stats.mockCount}</div>
          </div>
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100">
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Total Wrong Attempts</div>
            <div className="text-2xl font-black text-amber-900 mt-0.5">{stats.totalWrongTimes}</div>
          </div>
        </div>
      </div>

      {/* Control & Filter Suite */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Top Row: Search and Source Switcher */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search question text, concepts, or chapter names..."
              className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
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

          {/* Source Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold shrink-0">
            <button
              onClick={() => { setSourceFilter('all'); setSelectedTopic('all'); }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                sourceFilter === 'all'
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌐 All Sources ({stats.total})
            </button>
            <button
              onClick={() => { setSourceFilter('telegram_drill'); setSelectedTopic('all'); }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                sourceFilter === 'telegram_drill'
                  ? 'bg-white text-sky-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span>Telegram Bot ({stats.telegramCount})</span>
            </button>
            <button
              onClick={() => { setSourceFilter('website_mock'); setSelectedTopic('all'); }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                sourceFilter === 'website_mock'
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-3 h-3" />
              <span>Website Mocks ({stats.mockCount})</span>
            </button>
          </div>
        </div>

        {/* Middle Row: Subject Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Subject:</span>
          <button
            onClick={() => { setSelectedSubject('all'); setSelectedTopic('all'); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
              selectedSubject === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Subjects
          </button>
          {(['english', 'mathematics', 'reasoning', 'general_awareness'] as const).map((sub) => {
            const count = mistakes.filter(
              (m) =>
                m.subject === sub &&
                (sourceFilter === 'all' || m.source === sourceFilter)
            ).length;
            const style = SUBJECT_COLORS[sub];
            const isSelected = selectedSubject === sub;

            return (
              <button
                key={sub}
                onClick={() => { setSelectedSubject(sub); setSelectedTopic('all'); }}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                  isSelected
                    ? `${style.bg} ${style.text} ${style.border} ring-2 ring-indigo-500/20 shadow-2xs`
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{SUBJECT_LABELS[sub]}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom Row: Topics Pill Stream (Chapters) */}
        {availableTopics.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap border-t border-slate-100 pt-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Chapter:</span>
            <button
              onClick={() => setSelectedTopic('all')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                selectedTopic === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              All Chapters
            </button>
            {availableTopics.map((top) => (
              <button
                key={top.slug}
                onClick={() => setSelectedTopic(top.slug)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedTopic === top.slug
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{top.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 font-mono">
                  {top.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Stream: Question Cards */}
      <div className="space-y-4">
        {loading && mistakes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-semibold text-slate-600">Loading your mistake notebook from Firebase & bot...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-rose-600" />
            <p className="text-sm font-bold text-rose-800">{error}</p>
            <button
              onClick={fetchMistakes}
              className="mt-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs"
            >
              Retry Sync
            </button>
          </div>
        ) : filteredMistakes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-3xl">
              🎯
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Mistakes Found!</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
              No mistakes recorded for this filter. When you practice questions in the Telegram bot or make mistakes in mock tests, they will automatically appear here!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Showing <strong>{filteredMistakes.length}</strong> of <strong>{mistakes.length}</strong> recorded mistakes</span>
            </div>

            {filteredMistakes.map((m, idx) => {
              const letters = ['A', 'B', 'C', 'D'];
              const subStyle = SUBJECT_COLORS[m.subject] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };

              return (
                <div
                  key={m.id || idx}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col gap-4"
                >
                  {/* Card Header Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        #{idx + 1}
                      </span>
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-lg border ${subStyle.bg} ${subStyle.text} ${subStyle.border}`}>
                        {SUBJECT_LABELS[m.subject] || m.subject}
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                        📌 {m.topic}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-lg border flex items-center gap-1 ${
                          m.source === 'telegram_drill'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {m.source === 'telegram_drill' ? (
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
                      {m.wrongCount > 1 && (
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                          Failed {m.wrongCount}x
                        </span>
                      )}
                    </div>

                    {/* Delete Action Button */}
                    <button
                      onClick={() => handleDelete(m)}
                      disabled={deletingId === m.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs shrink-0"
                      title="Permanently delete from Firebase, App, and Telegram Bot"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>{deletingId === m.id ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  </div>

                  {/* Question Prompt */}
                  <div className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {m.question}
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {m.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === m.correctOptionIndex;
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-start gap-2.5 p-3 rounded-xl text-xs sm:text-sm transition-all border ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                              : 'bg-slate-50/70 border-slate-200/80 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isCorrect ? <Check className="w-3 h-3 stroke-[3]" /> : (letters[optIdx] || optIdx + 1)}
                          </span>
                          <span className="leading-snug">{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Solution & Concept Explanation */}
                  {m.explanation && (
                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs sm:text-sm text-slate-800 leading-relaxed space-y-1">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                        <span>💡 Key Explanation & Concept:</span>
                      </div>
                      <p className="whitespace-pre-wrap text-slate-700 font-normal">{m.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
