import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookMarked, Search, Eye, EyeOff, Check, X, RotateCcw, Sparkles } from 'lucide-react';
import formulasData from '../../data/drills/formulas.json';

type CategoryType = 'All' | 'Algebra' | 'Geometry' | 'Mensuration' | 'Trigonometry' | 'Arithmetic' | 'Banking';

export const FormulaVault: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('All');
  const [viewMode, setViewMode] = useState<'sheet' | 'flashcard'>('sheet');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Flashcard state
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [flashStats, setFlashStats] = useState({ remembered: 0, total: 0 });

  const categories: CategoryType[] = ['All', 'Algebra', 'Geometry', 'Mensuration', 'Trigonometry', 'Arithmetic', 'Banking'];

  const filteredFormulas = useMemo(() => {
    return formulasData.filter(item => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch = searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.formula.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.key_note && item.key_note.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const currentFlashcard = filteredFormulas[cardIndex % (filteredFormulas.length || 1)];

  const handleFlashScore = (remembered: boolean) => {
    setFlashStats(prev => ({
      remembered: prev.remembered + (remembered ? 1 : 0),
      total: prev.total + 1,
    }));
    setIsRevealed(false);
    setCardIndex(prev => prev + 1);
  };

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          <button
            onClick={() => { setViewMode('sheet'); setIsRevealed(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'sheet' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📋 Quick Reference
          </button>
          <button
            onClick={() => { setViewMode('flashcard'); setIsRevealed(false); setCardIndex(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'flashcard' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🎴 Active Recall Flashcards
          </button>
        </div>

        {viewMode === 'sheet' ? (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search formulas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-medium">
            Recall: <span className="font-bold text-slate-800">{flashStats.remembered}/{flashStats.total}</span>
          </div>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setCardIndex(0);
              setIsRevealed(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* View Mode: Flashcards */}
      {viewMode === 'flashcard' ? (
        filteredFormulas.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No formulas in this category.</div>
        ) : (
          <div className="max-w-xl mx-auto text-center">
            <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm mb-6 min-h-[260px] flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 py-0.5 px-2.5 rounded-full inline-block mb-3">
                  {currentFlashcard.category}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{currentFlashcard.title}</h3>
              </div>

              <div className="my-auto">
                <AnimatePresence mode="wait">
                  {isRevealed ? (
                    <motion.div
                      key="revealed"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-left"
                    >
                      <div className="font-mono text-sm font-semibold text-slate-800 whitespace-pre-line leading-relaxed mb-2">
                        {currentFlashcard.formula}
                      </div>
                      {currentFlashcard.alternate && (
                        <div className="font-mono text-xs text-indigo-600 mt-1 whitespace-pre-line">
                          {currentFlashcard.alternate}
                        </div>
                      )}
                      {currentFlashcard.key_note && (
                        <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-200/60">
                          💡 <span className="font-medium">{currentFlashcard.key_note}</span>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => setIsRevealed(true)}
                      className="py-8 w-full border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/30 transition-all font-semibold text-sm flex flex-col items-center justify-center gap-2"
                    >
                      <Eye className="w-5 h-5" />
                      Click to Reveal Formula
                    </button>
                  )}
                </AnimatePresence>
              </div>

              {isRevealed && (
                <div className="flex gap-3 justify-center mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleFlashScore(false)}
                    className="flex-1 py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl text-xs flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" /> Forgot / Needs Work
                  </button>
                  <button
                    onClick={() => handleFlashScore(true)}
                    className="flex-1 py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-xl text-xs flex items-center justify-center transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" /> Remembered!
                  </button>
                </div>
              )}
            </div>

            <div className="text-slate-400 text-xs">
              Card {((cardIndex) % filteredFormulas.length) + 1} of {filteredFormulas.length}
            </div>
          </div>
        )
      ) : (
        /* View Mode: Quick Reference Sheet */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFormulas.map((item, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {item.category}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mb-2">{item.title}</h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs font-semibold text-slate-800 whitespace-pre-line leading-relaxed mb-2">
                  {item.formula}
                  {item.alternate && (
                    <div className="text-indigo-600 mt-1 font-mono text-[11px]">
                      {item.alternate}
                    </div>
                  )}
                </div>
              </div>
              {item.key_note && (
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-600">Tip:</span> {item.key_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
