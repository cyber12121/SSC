import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Triangle, Sparkles } from 'lucide-react';
import tripletsData from '../../data/drills/triplets.json';

interface TripletQuestion {
  sideA: number | '?';
  sideB: number | '?';
  hypotenuse: number | '?';
  missingSide: 'a' | 'b' | 'c';
  answer: number;
  label: string;
}

export const TripletDrill: React.FC = () => {
  const [filterType, setFilterType] = useState<'all' | 'primitive' | 'scaled'>('all');
  const [question, setQuestion] = useState<TripletQuestion | null>(null);
  const [inputVal, setInputVal] = useState<string>('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  const inputRef = useRef<HTMLInputElement>(null);

  const availableTriplets = React.useMemo(() => {
    if (filterType === 'primitive') return tripletsData.filter(t => t.type === 'primitive');
    if (filterType === 'scaled') return tripletsData.filter(t => t.type === 'scaled');
    return tripletsData;
  }, [filterType]);

  const generateTripletQuestion = useCallback((): TripletQuestion => {
    const triplet = availableTriplets[Math.floor(Math.random() * availableTriplets.length)];
    
    // Choose which side to hide: a, b, or c (hypotenuse)
    const sides: ('a' | 'b' | 'c')[] = ['a', 'b', 'c'];
    // 50% chance missing hypotenuse, 50% missing leg
    const missing: 'a' | 'b' | 'c' = Math.random() < 0.5 ? 'c' : (Math.random() < 0.5 ? 'a' : 'b');

    let sideA: number | '?' = triplet.a;
    let sideB: number | '?' = triplet.b;
    let hypotenuse: number | '?' = triplet.c;
    let answer = triplet.c;

    if (missing === 'a') {
      sideA = '?';
      answer = triplet.a;
    } else if (missing === 'b') {
      sideB = '?';
      answer = triplet.b;
    } else {
      hypotenuse = '?';
      answer = triplet.c;
    }

    return {
      sideA,
      sideB,
      hypotenuse,
      missingSide: missing,
      answer,
      label: missing === 'c' ? 'Find Hypotenuse' : 'Find Missing Leg',
    };
  }, [availableTriplets]);

  const nextProblem = useCallback(() => {
    setInputVal('');
    setFeedback(null);
    setQuestion(generateTripletQuestion());
  }, [generateTripletQuestion]);

  useEffect(() => {
    nextProblem();
  }, [filterType, nextProblem]);

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
      {/* Control bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          {[
            { id: 'all', label: 'All Triplets' },
            { id: 'primitive', label: 'Base Triplets' },
            { id: 'scaled', label: 'Scaled Multiples' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterType(tab.id as any);
                setStats({ correct: 0, total: 0 });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-medium text-slate-500">
          Score: <span className="font-bold text-slate-800">{stats.correct}/{stats.total}</span> ({accuracy}%)
        </div>
      </div>

      {/* Triplet Visual Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm text-center mb-6">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4">
          Pythagorean Triplet Drill • {question?.label}
        </span>

        {/* Minimalist Triangle Diagram */}
        <div className="relative w-48 h-36 mx-auto my-6 flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 160 120" fill="none">
            {/* Triangle shape */}
            <polygon points="30,100 130,100 30,20" className="stroke-slate-300 stroke-2 fill-slate-50" />
            {/* Right angle marker */}
            <polyline points="30,88 42,88 42,100" className="stroke-slate-300 stroke-1" fill="none" />
          </svg>

          {/* Side A label (Height) */}
          <span className={`absolute left-0 top-1/2 -translate-y-1/2 font-mono font-bold text-base ${question?.sideA === '?' ? 'text-blue-600 text-xl animate-pulse' : 'text-slate-700'}`}>
            {question?.sideA}
          </span>

          {/* Side B label (Base) */}
          <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 font-mono font-bold text-base ${question?.sideB === '?' ? 'text-blue-600 text-xl animate-pulse' : 'text-slate-700'}`}>
            {question?.sideB}
          </span>

          {/* Hypotenuse label */}
          <span className={`absolute right-3 top-6 font-mono font-bold text-base ${question?.hypotenuse === '?' ? 'text-blue-600 text-xl animate-pulse' : 'text-slate-700'}`}>
            {question?.hypotenuse}
          </span>
        </div>

        {/* Input box */}
        <div className="max-w-xs mx-auto relative mt-6">
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
          Type missing side & hit <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">Enter</kbd>
        </div>
      </div>
    </div>
  );
};
