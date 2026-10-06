import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Trophy, RotateCcw, ArrowRight } from 'lucide-react';
import tripletsData from '../../data/drills/triplets.json';

interface TripletQuestion {
  sideA: number | '?';
  sideB: number | '?';
  hypotenuse: number | '?';
  missingSide: 'a' | 'b' | 'c';
  answer: number;
  label: string;
}

const TRIPLET_TABS = [
  { id: 'set1', label: 'Set 1: Core (8)' },
  { id: 'set2', label: 'Set 2: Advanced (8)' },
  { id: 'primitive', label: 'All Base (16)' },
  { id: 'scaled', label: 'Scaled (11)' },
  { id: 'all', label: 'All (27)' },
] as const;

export const TripletDrill: React.FC = () => {
  const [filterType, setFilterType] = useState<'set1' | 'set2' | 'primitive' | 'scaled' | 'all'>('set1');
  const [deck, setDeck] = useState<any[]>([]);
  const [deckIndex, setDeckIndex] = useState<number>(0);
  const [question, setQuestion] = useState<TripletQuestion | null>(null);
  const [inputVal, setInputVal] = useState<string>('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const availableTriplets = React.useMemo(() => {
    if (filterType === 'set1') return tripletsData.filter((t: any) => t.set === 1 || t.tags?.includes('set1'));
    if (filterType === 'set2') return tripletsData.filter((t: any) => t.set === 2 || t.tags?.includes('set2'));
    if (filterType === 'primitive') return tripletsData.filter((t) => t.type === 'primitive');
    if (filterType === 'scaled') return tripletsData.filter((t) => t.type === 'scaled');
    return tripletsData;
  }, [filterType]);

  const createQuestionForTriplet = useCallback((triplet: any): TripletQuestion => {
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
  }, []);

  const initSet = useCallback(() => {
    const shuffled = [...availableTriplets].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setDeckIndex(0);
    setStats({ correct: 0, total: 0 });
    setIsFinished(false);
    setInputVal('');
    setFeedback(null);
    if (shuffled.length > 0) {
      setQuestion(createQuestionForTriplet(shuffled[0]));
    }
  }, [availableTriplets, createQuestionForTriplet]);

  useEffect(() => {
    initSet();
  }, [filterType, initSet]);

  useEffect(() => {
    if (!isFinished) {
      inputRef.current?.focus();
    }
  }, [question, isFinished]);

  const handleCorrect = () => {
    if (feedback !== null || isFinished) return;
    setFeedback('correct');
    setStats(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));

    setTimeout(() => {
      if (deckIndex + 1 >= deck.length) {
        setIsFinished(true);
      } else {
        const nextIdx = deckIndex + 1;
        setDeckIndex(nextIdx);
        setInputVal('');
        setFeedback(null);
        setQuestion(createQuestionForTriplet(deck[nextIdx]));
      }
    }, 250);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!/^\d*$/.test(val)) return;
    setInputVal(val);

    if (!question || isFinished || feedback !== null) return;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num === question.answer) {
      handleCorrect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!question || isFinished || feedback !== null) return;
      const num = parseInt(inputVal.trim(), 10);
      if (num === question.answer) {
        handleCorrect();
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
  const currentTabObj = TRIPLET_TABS.find(t => t.id === filterType) || TRIPLET_TABS[0];

  return (
    <div className="max-w-xl mx-auto py-4">
      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="inline-flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          {TRIPLET_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterType(tab.id as any);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-medium text-slate-500">
          Progress: <span className="font-bold text-slate-800">{Math.min(deckIndex + 1, deck.length)}/{deck.length}</span> • Score: <span className="font-bold text-slate-800">{stats.correct}/{stats.total}</span> ({accuracy}%)
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
            {currentTabObj.label} Completed!
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            You completed all {deck.length} questions in this set without any automatic restarts.
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
              onClick={initSet}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all text-sm cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Practice {currentTabObj.label.split(':')[0]} Again
            </button>
            {filterType === 'set1' && (
              <button
                onClick={() => setFilterType('set2')}
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all text-sm cursor-pointer shadow-xs"
              >
                <span>Try Set 2: Advanced</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            )}
            {filterType === 'set2' && (
              <button
                onClick={() => setFilterType('set1')}
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all text-sm cursor-pointer shadow-xs"
              >
                <span>Back to Set 1: Core</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        /* Triplet Visual Card */
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
      )}
    </div>
  );
};
