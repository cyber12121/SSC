import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Percent, RotateCcw, Check, X, ArrowRightLeft, Trophy, ArrowRight, Sparkles } from 'lucide-react';
import fractionsData from '../../data/drills/fractions.json';

interface FractionItem {
  fraction: string;
  percentage: string;
  decimal: string;
}

const PARTS = [
  { id: 'part1', label: 'Part 1: 1/2–1/6' },
  { id: 'part2', label: 'Part 2: 1/7 & 1/8' },
  { id: 'part3', label: 'Part 3: 1/9–1/11' },
  { id: 'part4', label: 'Part 4: 1/12–1/16' },
  { id: 'part5', label: 'Part 5: 1/17–1/50' },
  { id: 'all', label: 'All' },
] as const;

export const FractionDrill: React.FC = () => {
  const [mode, setMode] = useState<'fracToPct' | 'pctToFrac'>('fracToPct');
  const [filterType, setFilterType] = useState<'part1' | 'part2' | 'part3' | 'part4' | 'part5' | 'all'>('part1');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Filter items into 5 progressive parts
  const items: FractionItem[] = React.useMemo(() => {
    if (filterType === 'part1') return (fractionsData as any).filter((item: any) => item.part === 1);
    if (filterType === 'part2') return (fractionsData as any).filter((item: any) => item.part === 2);
    if (filterType === 'part3') return (fractionsData as any).filter((item: any) => item.part === 3);
    if (filterType === 'part4') return (fractionsData as any).filter((item: any) => item.part === 4);
    if (filterType === 'part5') return (fractionsData as any).filter((item: any) => item.part === 5);
    return fractionsData;
  }, [filterType]);

  const currentItem = items[currentIndex] || items[0];

  // Generate 4 randomized options for the current question
  const generateOptions = useCallback((targetItem: FractionItem, currentMode: 'fracToPct' | 'pctToFrac') => {
    if (!targetItem) return;
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
    if (!isFinished && currentItem) {
      generateOptions(currentItem, mode);
      setSelectedAnswer(null);
      setFeedback(null);
    }
  }, [currentIndex, mode, filterType, currentItem, generateOptions, isFinished]);

  const handleSelectOption = (chosen: string) => {
    if (selectedAnswer !== null || isFinished) return; // already answered or finished

    setSelectedAnswer(chosen);
    const isCorrect = mode === 'fracToPct'
      ? chosen === currentItem.percentage
      : chosen === currentItem.fraction;

    const isLastQuestion = currentIndex + 1 >= items.length;

    if (isCorrect) {
      setFeedback('correct');
      setStats(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
      setTimeout(() => {
        if (isLastQuestion) {
          setIsFinished(true);
        } else {
          setCurrentIndex(prev => prev + 1);
        }
      }, 500);
    } else {
      setFeedback('wrong');
      setStats(prev => ({ ...prev, total: prev.total + 1 }));
      setTimeout(() => {
        if (isLastQuestion) {
          setIsFinished(true);
        } else {
          setCurrentIndex(prev => prev + 1);
        }
      }, 900);
    }
  };

  // Keyboard shortcut support (1, 2, 3, 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
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
  }, [options, selectedAnswer, isFinished]);

  const toggleMode = () => {
    setMode(prev => prev === 'fracToPct' ? 'pctToFrac' : 'fracToPct');
    setCurrentIndex(0);
    setStats({ correct: 0, total: 0 });
    setIsFinished(false);
  };

  const handleRestartPart = () => {
    setCurrentIndex(0);
    setStats({ correct: 0, total: 0 });
    setIsFinished(false);
  };

  const handleNextPart = () => {
    const currentIndexPart = PARTS.findIndex(p => p.id === filterType);
    if (currentIndexPart >= 0 && currentIndexPart < PARTS.length - 1) {
      setFilterType(PARTS[currentIndexPart + 1].id as any);
    } else {
      setFilterType('part1');
    }
    setCurrentIndex(0);
    setStats({ correct: 0, total: 0 });
    setIsFinished(false);
  };

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100;
  const currentPartObj = PARTS.find(p => p.id === filterType) || PARTS[0];

  return (
    <div className="max-w-xl mx-auto py-4">
      {/* Top control bar */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={toggleMode}
            className="flex items-center text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            {mode === 'fracToPct' ? 'Fraction → %' : '% → Fraction'}
          </button>

          <div className="text-xs font-medium text-slate-500">
            Progress: <span className="font-bold text-slate-800">{Math.min(currentIndex + 1, items.length)}/{items.length}</span> • Score: <span className="font-bold text-slate-800">{stats.correct}/{stats.total}</span> ({accuracy}%)
          </div>
        </div>

        {/* 5-Part Filter Tabs */}
        <div className="inline-flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          {PARTS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterType(tab.id as any);
                setCurrentIndex(0);
                setStats({ correct: 0, total: 0 });
                setIsFinished(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isFinished ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-sm text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-500 mb-4 shadow-xs">
            <Trophy className="w-8 h-8 fill-amber-500" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {currentPartObj.label} Completed!
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            You completed all {items.length} conversions in this set without any automatic restarts.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Score</span>
              <span className="text-2xl font-black text-slate-800">{stats.correct}/{stats.total}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Accuracy</span>
              <span className={`text-2xl font-black ${accuracy >= 90 ? 'text-emerald-600' : 'text-blue-600'}`}>{accuracy}%</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleRestartPart}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all text-sm cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Practice {currentPartObj.label.split(':')[0]} Again
            </button>
            {filterType !== 'all' && filterType !== 'part5' && (
              <button
                onClick={handleNextPart}
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all text-sm cursor-pointer shadow-xs"
              >
                <span>Next Part</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        <>

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
    </>
  )}
</div>
  );
};
