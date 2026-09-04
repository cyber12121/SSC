import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, RotateCcw, Sparkles } from 'lucide-react';
import powersData from '../../data/drills/powers.json';

type PowerMode = 'squares_1_30' | 'squares_31_50' | 'squares_all' | 'cubes' | 'roots';

interface PowerQuestion {
  prompt: string;
  answer: number;
  label: string;
}

export const PowerDrill: React.FC = () => {
  const [mode, setMode] = useState<PowerMode>('squares_all');
  const [question, setQuestion] = useState<PowerQuestion | null>(null);
  const [inputVal, setInputVal] = useState<string>('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  const inputRef = useRef<HTMLInputElement>(null);

  const generateQuestion = useCallback((selectedMode: PowerMode): PowerQuestion => {
    if (selectedMode === 'squares_1_30') {
      const item = powersData.squares.slice(0, 30)[Math.floor(Math.random() * 30)];
      return {
        prompt: `${item.n}²`,
        answer: item.val,
        label: `Square of ${item.n}`,
      };
    } else if (selectedMode === 'squares_31_50') {
      const subset = powersData.squares.slice(30, 50);
      const item = subset[Math.floor(Math.random() * subset.length)];
      return {
        prompt: `${item.n}²`,
        answer: item.val,
        label: `Square of ${item.n}`,
      };
    } else if (selectedMode === 'cubes') {
      const item = powersData.cubes[Math.floor(Math.random() * powersData.cubes.length)];
      return {
        prompt: `${item.n}³`,
        answer: item.val,
        label: `Cube of ${item.n}`,
      };
    } else if (selectedMode === 'roots') {
      // Mixed square root or cube root
      const isCube = Math.random() < 0.35;
      if (isCube) {
        const item = powersData.cubes.slice(1, 20)[Math.floor(Math.random() * 19)];
        return {
          prompt: `∛${item.val}`,
          answer: item.n,
          label: `Cube root of ${item.val}`,
        };
      } else {
        const item = powersData.squares.slice(1, 40)[Math.floor(Math.random() * 39)];
        return {
          prompt: `√${item.val}`,
          answer: item.n,
          label: `Square root of ${item.val}`,
        };
      }
    } else {
      // squares_all
      const item = powersData.squares[Math.floor(Math.random() * powersData.squares.length)];
      return {
        prompt: `${item.n}²`,
        answer: item.val,
        label: `Square of ${item.n}`,
      };
    }
  }, []);

  const nextProblem = useCallback(() => {
    setInputVal('');
    setFeedback(null);
    setQuestion(generateQuestion(mode));
  }, [mode, generateQuestion]);

  useEffect(() => {
    nextProblem();
  }, [mode, nextProblem]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [question]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!/^\d*$/.test(val)) return;
    setInputVal(val);

    if (!question) return;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num === question.answer) {
      setFeedback('correct');
      setStats(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
      setTimeout(() => {
        nextProblem();
      }, 150);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!question) return;
      const num = parseInt(inputVal.trim(), 10);
      if (num === question.answer) {
        setFeedback('correct');
        setStats(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
        setTimeout(() => {
          nextProblem();
        }, 150);
      } else {
        setFeedback('wrong');
        setStats(prev => ({ ...prev, total: prev.total + 1 }));
        setTimeout(() => {
          setFeedback(null);
          setInputVal('');
        }, 400);
      }
    }
  };

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100;

  return (
    <div className="max-w-xl mx-auto py-4">
      {/* Category Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          {[
            { id: 'squares_all', label: 'x² (1–50)' },
            { id: 'squares_1_30', label: 'x² (1–30)' },
            { id: 'squares_31_50', label: 'x² (31–50)' },
            { id: 'cubes', label: 'x³ (1–30)' },
            { id: 'roots', label: '√ / ∛ Roots' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => {
                setMode(btn.id as PowerMode);
                setStats({ correct: 0, total: 0 });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === btn.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-medium text-slate-500">
          Score: <span className="font-bold text-slate-800">{stats.correct}/{stats.total}</span> ({accuracy}%)
        </div>
      </div>

      {/* Main Flash Question Box */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-10 shadow-sm text-center">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
          {question?.label}
        </span>

        <div className="text-6xl font-black text-slate-900 tracking-tight my-6 font-mono">
          {question?.prompt}
        </div>

        <div className="max-w-xs mx-auto relative">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="?"
            value={inputVal}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className={`w-full text-center text-4xl font-bold py-3 px-4 rounded-2xl border-2 outline-hidden transition-all font-mono ${
              feedback === 'correct'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : feedback === 'wrong'
                ? 'border-red-500 bg-red-50 text-red-800'
                : 'border-slate-200 focus:border-blue-500 bg-slate-50 focus:bg-white text-slate-800'
            }`}
          />

          <AnimatePresence>
            {feedback === 'correct' && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center"
              >
                <Check className="w-5 h-5" />
              </motion.div>
            )}
            {feedback === 'wrong' && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-slate-400 text-xs mt-6">
          Auto-validates on match or press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">Enter</kbd>
        </div>
      </div>
    </div>
  );
};
