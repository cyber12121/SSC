import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { X, Trash2, Search, Filter, RefreshCw, CheckCircle2, AlertCircle, BookOpen, ExternalLink } from 'lucide-react';

interface RecordedMistake {
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

interface TelegramMistakesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteQuestion?: (questionId: string, questionText: string) => void;
}

export const TelegramMistakesModal: React.FC<TelegramMistakesModalProps> = ({
  isOpen,
  onClose,
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
        const seen = new Set<string>();
        const deduped: RecordedMistake[] = [];
        for (const item of data.mistakes) {
          const key = (item.question || '').trim().toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ').replace(/[?.!,:;'"()\[\]{}]+$/g, '') || item.id;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          }
        }
        setMistakes(deduped);
      }
    } catch (err: any) {
      console.error('[TelegramMistakesModal] Fetch error:', err);
      setError('Unable to load mistakes from server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMistakes();
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDelete = async (m: RecordedMistake) => {
    if (!window.confirm('Delete this question permanently from Firebase and the Telegram bot?')) {
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

      showToast('Question deleted permanently from Firebase & Telegram Bot!');
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Error deleting question: ' + (err?.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to completely clear ALL mistakes from the Telegram and Mock Mistake Bank?')) {
      return;
    }
    setLoading(true);
    try {
      await fetch('/api/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' }),
      });

      setMistakes([]);
      showToast('All mistakes cleared successfully!');
    } catch (err: any) {
      console.error('Error clearing mistakes:', err);
      showToast('Failed to clear mistakes: ' + (err?.message || err));
    } finally {
      setLoading(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              📱
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Telegram & Mock Mistake Bank
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                  {filteredMistakes.length} Questions
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Synced 2-way with Firebase & Telegram Bot (@my_cgl_bot)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMistakes}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 disabled:opacity-50"
              title="Refresh questions from server"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleClearAll}
              disabled={loading || mistakes.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold transition-colors border border-rose-500/30 disabled:opacity-40 flex items-center gap-1.5"
              title="Clear all mistakes from bank"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex flex-col gap-3.5">
          {/* Top Row: Search & Source Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search question, concept, or topic..."
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Source Pills (Option 3 Filters) */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs font-semibold">
              <button
                onClick={() => setSourceFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  sourceFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🌐 All Sources
              </button>
              <button
                onClick={() => setSourceFilter('telegram_drill')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  sourceFilter === 'telegram_drill'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📱 Telegram Bot
              </button>
              <button
                onClick={() => setSourceFilter('website_mock')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  sourceFilter === 'website_mock'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                💻 Website Mocks
              </button>
            </div>
          </div>

          {/* Subject Row */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="text-slate-400 mr-1 flex items-center gap-1 font-semibold">
              <Filter className="w-3.5 h-3.5" /> Subject:
            </span>
            {[
              { id: 'all', label: 'All Subjects' },
              { id: 'english', label: '📖 English' },
              { id: 'mathematics', label: '📐 Mathematics' },
              { id: 'reasoning', label: '🧠 Reasoning' },
              { id: 'general_awareness', label: '🏛️ General Awareness' },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => {
                  setSelectedSubject(sub.id);
                  setSelectedTopic('all');
                }}
                className={`px-3 py-1.5 rounded-lg border transition-all ${
                  selectedSubject === sub.id
                    ? 'bg-slate-200 text-slate-900 border-slate-200 font-bold shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700/80 hover:bg-slate-750 hover:text-slate-200'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* Subtopics / Chapters Pills */}
          {availableTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 overflow-x-auto max-h-24 scrollbar-thin">
              <span className="text-xs text-slate-400 font-semibold mr-1">Topics:</span>
              <button
                onClick={() => setSelectedTopic('all')}
                className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                  selectedTopic === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 border border-slate-700/60 hover:text-slate-200'
                }`}
              >
                All Topics
              </button>
              {availableTopics.map((top) => (
                <button
                  key={top.slug}
                  onClick={() => setSelectedTopic(top.slug)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
                    selectedTopic === top.slug
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400 font-bold'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:bg-slate-750 hover:text-slate-200'
                  }`}
                >
                  <span>{top.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700/80 text-slate-300 font-mono">
                    {top.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Question Cards List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin">
          {loading && mistakes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-sm">Loading mistake notebook from Firebase & bot...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-rose-400 gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={fetchMistakes}
                className="mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 hover:bg-slate-700"
              >
                Retry Fetch
              </button>
            </div>
          ) : filteredMistakes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl">
                🎯
              </div>
              <h3 className="text-base font-bold text-slate-200">No Mistakes Found!</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                No mistakes recorded for this filter. As you drill questions in the Telegram bot or full mock tests, any missed question will automatically appear here!
              </p>
            </div>
          ) : (
            filteredMistakes.map((m, idx) => {
              const letters = ['A', 'B', 'C', 'D'];
              return (
                <div
                  key={m.id || idx}
                  className="p-5 bg-slate-950/70 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-all flex flex-col gap-3.5 shadow-sm"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        #{idx + 1}
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {m.subject.toUpperCase()}
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-medium rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        📌 {m.topic}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                          m.source === 'telegram_drill'
                            ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        }`}
                      >
                        {m.source === 'telegram_drill' ? '📱 Telegram Bot' : '💻 Website Mock'}
                      </span>
                    </div>

                    {/* Delete Action Button */}
                    <button
                      onClick={() => handleDelete(m)}
                      disabled={deletingId === m.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors disabled:opacity-50"
                      title="Permanently delete from Firebase & Telegram"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deletingId === m.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>

                  {/* Question Prompt */}
                  <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed whitespace-pre-wrap">
                    {m.question}
                  </p>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {m.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === m.correctOptionIndex;
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs transition-all border ${
                            isCorrect
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-semibold'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-500 text-slate-950 font-black'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {letters[optIdx] || optIdx + 1}
                          </span>
                          <span className="leading-tight pt-0.5">{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Solution Explanation */}
                  {m.explanation && (
                    <div className="mt-1 p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                      <span className="font-bold text-amber-400 block mb-1">
                        💡 Key Explanation & Concept:
                      </span>
                      <p className="whitespace-pre-wrap">{m.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div>
            Total Mistakes Loaded: <strong className="text-white">{mistakes.length}</strong> | Showing: <strong className="text-white">{filteredMistakes.length}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors border border-slate-700"
          >
            Done
          </button>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="absolute bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};
