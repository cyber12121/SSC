import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Percent, RotateCcw, Check, X, ArrowRightLeft, Shuffle } from 'lucide-react';
import fractionsData from '../../data/drills/fractions.json';

interface FractionItem {
  fraction: string;
  percentage: string;
  decimal: string;
}

export const FractionDrill: React.FC = () => {
  const [mode, setMode] = useState<'fracToPct' | 'pctToFrac'>('fracToPct');
  const [filterType, setFilterType] = useState<'all' | 'key_fractions'>('all');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  // Filter items
  const items: FractionItem[] = React.useMemo(() => {
    if (filterType === 'key_fractions') {
      const keys = ['1/3', '2/3', '1/6', '5/6', '1/7', '2/7', '3/7', '4/7', '5/7', '1/8', '3/8', '5/8', '7/8', '1/9', '1/11', '1/12', '5/12', '7/12', '1/14', '1/15', '1/16', '3/16', '1/19'];
      return fractionsData.filter(item => keys.includes(item.fraction));
    }
    return fractionsData;
  }, [filterType]);

  const currentItem = items[currentIndex % items.length] || items[0];

  // Generate 4 randomized options for the current question
  const generateOptions = useCallback((targetItem: FractionItem, currentMode: 'fracToPct' | 'pctToFrac') => {
    const correctAnswer = currentMode === 'fracToPct' ? targetItem.percentage : targetItem.fraction;
    const pool = items
      .map(item => currentMode === 'fracToPct' ? item.percentage : item.fraction)
      .filter(val => val !== correctAnswer);

    // Pick 3 random wrong options
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
    const wrongOptions = shuffledPool.slice(0, 3);
    const combined = [correctAnswer, ...wrongOptions].sort(() => Math.random() - 0.5);
    setOptions(combined);
  }, [items]);

  useEffect(() => {
    generateOptions(currentItem, mode);
    setSelectedAnswer(null);
    setFeedback(null);
  }, [currentIndex, mode, filterType, currentItem, generateOptions]);

  const handleSelectOption = (chosen: string) => {
    if (selectedAnswer !== null) return; // already answered

    setSelectedAnswer(chosen);
    const isCorrect = mode === 'fracToPct'
      ? chosen === currentItem.percentage
      : chosen === currentItem.fraction;

    if (isCorrect) {
      setFeedback('correct');
      setStats(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 500);
    } else {
      setFeedback('wrong');
      setStats(prev => ({ ...prev, total: prev.total + 1 }));
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 1000);
    }
  };

  // Keyboard shortcut support (1, 2, 3, 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (['1', '2', '3', '4'].includes(key)) {
        const idx = parseInt(key, 10) - 1;
        if (options[idx]) {
          handleSelectOption(options[idx]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, selectedAnswer]);

  const toggleMode = () => {
    setMode(prev => prev === 'fracToPct' ? 'pctToFrac' : 'fracToPct');
    setCurrentIndex(0);
    setStats({ correct: 0, total: 0 });
  };

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100;

  return (
    <div className="max-w-xl mx-auto py-4">
      {/* Top control bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMode}
            className="flex items-center text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-lg transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            {mode === 'fracToPct' ? 'Fraction → %' : '% → Fraction'}
          </button>
          <button
            onClick={() => {
              setFilterType(prev => prev === 'all' ? 'key_fractions' : 'all');
              setCurrentIndex(0);
            }}
            className={`text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors ${
              filterType === 'key_fractions'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {filterType === 'key_fractions' ? '★ High-Yield Only' : 'All 1/2 to 1/25'}
          </button>
        </div>

        <div className="text-xs font-medium text-slate-500">
          Score: <span className="font-bold text-slate-800">{stats.correct}/{stats.total}</span> ({accuracy}%)
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-10 shadow-sm text-center mb-6">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
          {mode === 'fracToPct' ? 'Convert to Percentage' : 'Convert to Fraction'}
        </span>

        <div className="text-5xl font-black text-slate-900 my-4 tracking-tight">
          {mode === 'fracToPct' ? currentItem.fraction : currentItem.percentage}
        </div>

        <div className="text-slate-400 text-xs mt-2">
          Decimal equivalent: <span className="font-mono text-slate-600 font-semibold">{currentItem.decimal}</span>
        </div>
      </div>

      {/* 4 Option Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {options.map((opt, idx) => {
          const isSelected = selectedAnswer === opt;
          const isCorrect = mode === 'fracToPct' ? opt === currentItem.percentage : opt === currentItem.fraction;

          let btnStyle = 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-800 hover:bg-slate-50';

          if (selectedAnswer !== null) {
            if (isCorrect) {
              btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold';
            } else if (isSelected && !isCorrect) {
              btnStyle = 'bg-red-50 border-red-500 text-red-800';
            } else {
              btnStyle = 'bg-white border-slate-200 opacity-40 text-slate-400';
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelectOption(opt)}
              disabled={selectedAnswer !== null}
              className={`p-4 rounded-2xl border-2 text-xl font-bold transition-all flex items-center justify-between ${btnStyle}`}
            >
              <span className="text-xs text-slate-400 font-normal mr-2">[{idx + 1}]</span>
              <span className="flex-1 text-center">{opt}</span>
              <span className="w-4">
                {selectedAnswer !== null && isCorrect && <Check className="w-4 h-4 text-emerald-600" />}
                {selectedAnswer === opt && !isCorrect && <X className="w-4 h-4 text-red-600" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-center text-slate-400 text-xs">
        Use keys <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">1</kbd>–<kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">4</kbd> on your keyboard for instant selection.
      </div>
    </div>
  );
};
