import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  BookOpen,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  Filter
} from 'lucide-react';
import { Chapter } from '../../types';

interface CheatSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapter: Chapter | null;
  onStartPractice?: (chapter: Chapter) => void;
}

export const CheatSheetModal: React.FC<CheatSheetModalProps> = ({
  isOpen,
  onClose,
  chapter,
  onStartPractice
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'traps' | 'formulas'>('all');

  const cheatSheet = chapter?.cheat_sheet;
  const rules = cheatSheet?.rules || [];

  const filteredRules = useMemo(() => {
    let result = rules;

    if (activeTab === 'traps') {
      result = result.filter((r: any) => r.ssc_traps && r.ssc_traps.length > 0);
    } else if (activeTab === 'formulas') {
      result = result.filter((r: any) => !!r.formula);
    }

    if (!searchQuery.trim()) return result;

    const q = searchQuery.toLowerCase();
    return result.filter((r: any) => {
      const matchNum = String(r.rule_num).includes(q);
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchDesc = (r.description || '').toLowerCase().includes(q);
      const matchFormula = (r.formula || '').toLowerCase().includes(q);
      const matchWords = (r.words || []).some((w: string) => w.toLowerCase().includes(q));
      const matchTraps = (r.ssc_traps || []).some((t: any) =>
        (t.incorrect || '').toLowerCase().includes(q) || (t.correct || '').toLowerCase().includes(q)
      );
      return matchNum || matchTitle || matchDesc || matchFormula || matchWords || matchTraps;
    });
  }, [rules, searchQuery, activeTab]);

  if (!isOpen || !chapter || !cheatSheet) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative flex flex-col w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10"
        >
          {/* Header */}
          <div className="relative px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-100">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200/60">
                      Chapter {chapter.original_chapter_num || chapter.chapter_num || 1} • {chapter.chapter_title}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                      {rules.length} Rules
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      {chapter.questions?.length || 120} Practice Qs
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    {cheatSheet.title || `${chapter.chapter_title} Revision Cheat Sheet`}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {cheatSheet.subtitle || 'Complete rules, formulas, word lists and SSC traps'}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close Cheat Sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Controls: Search + Filter Tabs */}
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rules, keywords (e.g. hair, scissors, formula, trap)..."
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 self-start sm:self-auto bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    activeTab === 'all'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({rules.length})
                </button>
                <button
                  onClick={() => setActiveTab('traps')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    activeTab === 'traps'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Exam Traps ⚠️
                </button>
                <button
                  onClick={() => setActiveTab('formulas')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    activeTab === 'formulas'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Formulas ⚡
                </button>
              </div>
            </div>
          </div>

          {/* Rules Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
            {filteredRules.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold text-slate-600">No matching rules found</p>
                <p className="text-xs text-slate-400 mt-1">Try another keyword or reset the filter.</p>
              </div>
            ) : (
              filteredRules.map((rule: any) => (
                <div
                  key={rule.rule_num}
                  id={`rule-${rule.rule_num}`}
                  className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:border-indigo-200 transition-colors"
                >
                  {/* Rule Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white text-[11px] font-bold">
                        {rule.rule_num}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {rule.title}
                      </h3>
                    </div>
                  </div>

                  {/* Formula Box */}
                  {rule.formula && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                        Formula
                      </span>
                      <code className="text-xs font-mono font-semibold text-indigo-950">
                        {rule.formula}
                      </code>
                    </div>
                  )}

                  {/* Description */}
                  {rule.description && (
                    <p className="mt-2.5 text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                      {rule.description}
                    </p>
                  )}

                  {/* Categories / Word Lists */}
                  {rule.categories && (
                    <div className="mt-3 space-y-2">
                      {Object.entries(rule.categories).map(([cat, words]: [string, any]) => (
                        <div key={cat} className="text-xs">
                          <span className="font-semibold text-slate-700">{cat}: </span>
                          <div className="inline-flex flex-wrap gap-1 mt-1">
                            {Array.isArray(words) &&
                              words.map((w: string) => (
                                <span
                                  key={w}
                                  className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60"
                                >
                                  {w}
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Simple Word List */}
                  {rule.words && !rule.categories && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-1">
                        {rule.words.map((w: string) => (
                          <span
                            key={w}
                            className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub Rules (e.g. Rule 23 Apostrophe) */}
                  {rule.sub_rules && (
                    <div className="mt-3 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                      {rule.sub_rules.map((sr: string, idx: number) => (
                        <p key={idx} className="text-xs text-slate-700 leading-relaxed">
                          {sr}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Conversions Table (Foreign Plurals) */}
                  {rule.conversions && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {rule.conversions.map((c: any, idx: number) => (
                        <div
                          key={idx}
                          className="px-2.5 py-1 rounded bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-600">{c.singular}</span>
                          <span className="font-bold text-indigo-700">→ {c.plural}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Meaning Shifts Table (Rule 22) */}
                  {rule.pairs && rule.rule_num === 22 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                        <thead className="bg-slate-100 text-slate-700 text-[11px]">
                          <tr>
                            <th className="p-2">Singular</th>
                            <th className="p-2">Meaning</th>
                            <th className="p-2">Plural (-s)</th>
                            <th className="p-2">Shifted Meaning</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rule.pairs.map((p: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/70">
                              <td className="p-2 font-semibold text-slate-800">{p.word}</td>
                              <td className="p-2 text-slate-600">{p.singular_meaning}</td>
                              <td className="p-2 font-bold text-indigo-700">{p.plural}</td>
                              <td className="p-2 text-slate-700">{p.plural_meaning}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Superfluous Pairs (Rule 14) */}
                  {rule.pairs && rule.rule_num === 14 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rule.pairs.map((p: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs flex items-center justify-between"
                        >
                          <span className="text-rose-600 line-through">❌ {p.incorrect}</span>
                          <span className="font-bold text-emerald-700">✔️ {p.correct}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SSC Exam Traps */}
                  {rule.ssc_traps && rule.ssc_traps.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        <span>SSC Exam Traps (Spot The Error):</span>
                      </div>
                      {rule.ssc_traps.map((t: any, idx: number) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs bg-rose-50/40 p-2 rounded-lg border border-rose-100"
                        >
                          <div className="flex items-start gap-1 text-rose-700">
                            <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                            <span>{t.incorrect}</span>
                          </div>
                          <div className="flex items-start gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                            <span>{t.correct}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key Note / Special Exception */}
                  {rule.key_note && (
                    <div className="mt-2.5 px-3 py-2 rounded-lg bg-amber-50/80 border border-amber-200/80 flex items-start gap-2 text-xs text-amber-900">
                      <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                      <span>{rule.key_note}</span>
                    </div>
                  )}

                  {rule.special_exception && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-violet-50/80 border border-violet-200/80 flex items-start gap-2 text-xs text-violet-900">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-violet-600 mt-0.5" />
                      <span>{rule.special_exception}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 hidden sm:block">
              Tip: Read the rules thoroughly before attempting the chapter questions.
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              {onStartPractice && (
                <button
                  onClick={() => {
                    onClose();
                    onStartPractice(chapter);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-200 transition-all cursor-pointer"
                >
                  <span>Practice Questions ({chapter.questions?.length || 120})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
