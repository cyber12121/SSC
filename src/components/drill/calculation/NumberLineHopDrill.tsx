import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCcw,
  Trophy,
  Lock,
  Unlock,
  Flame,
  ArrowRight,
  Lightbulb,
  Compass
} from 'lucide-react';
import {
  SUBTRACTION_LEVELS,
  SubtractionLevelConfig,
  loadSubtractionProgress,
  saveSubtractionProgress,
  ModuleProgress
} from './calculationLevelConfig';
import { ThoughtHopVisualizer } from './ThoughtHopVisualizer';

export const NumberLineHopDrill: React.FC = () => {
  const [progress, setProgress] = useState<ModuleProgress>(loadSubtractionProgress);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [minuend, setMinuend] = useState<number>(72);
  const [subtrahend, setSubtrahend] = useState<number>(38);
  const [mode, setMode] = useState<'reflex' | 'guided'>('reflex');
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showHelper, setShowHelper] = useState<boolean>(false);
  const [roundMistakes, setRoundMistakes] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [roundCount, setRoundCount] = useState<number>(1);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  const activeLevelConfig: SubtractionLevelConfig = useMemo(() => {
    return SUBTRACTION_LEVELS.find(l => l.level === selectedLevel) || SUBTRACTION_LEVELS[0];
  }, [selectedLevel]);

  const generateNewProblem = () => {
    const { minVal, maxVal, type } = activeLevelConfig;

    let a = 0;
    let b = 0;

    if (type === 'same_decade') {
      const tens = Math.floor(Math.random() * 3) + 2; // 20s, 30s, 40s
      const u1 = Math.floor(Math.random() * 5) + 5;   // 5..9
      const u2 = Math.floor(Math.random() * 4) + 1;   // 1..4
      a = tens * 10 + u1;
      b = (tens - 1) * 10 + u2;
    } else if (type === 'unit_match') {
      b = Math.floor(Math.random() * (55 - minVal)) + minVal; // e.g. 38
      const gapTens = (Math.floor(Math.random() * 3) + 2) * 10;
      const targetUnit = (b % 10 + Math.floor(Math.random() * 5) + 3) % 10;
      a = Math.min(maxVal, b + gapTens + (targetUnit < b % 10 ? 10 : 0));
      if (a <= b) a = b + 24;
    } else if (type === 'century_bridge') {
      b = Math.floor(Math.random() * 25) + 75; // 75..100
      a = Math.floor(Math.random() * 40) + 110; // 110..150
    } else if (type === 'three_digit_match') {
      // 738 - 211
      b = Math.floor(Math.random() * 300) + 200;
      const endDigits = b % 100 + Math.floor(Math.random() * 30) + 15;
      const hundreds = Math.floor(Math.random() * 4) + 5; // 500..800
      a = hundreds * 100 + endDigits;
    } else {
      // 813 - 478
      b = Math.floor(Math.random() * 350) + 350;
      a = b + Math.floor(Math.random() * 350) + 120;
    }

    setMinuend(a);
    setSubtrahend(b);
    setUserInput('');
    setFeedback('idle');
    setShowHelper(false);
    setIsFinished(false);
    setElapsedTime(0);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    generateNewProblem();
  }, [selectedLevel]);

  // Timer
  useEffect(() => {
    if (!isFinished) {
      const startTime = Date.now() - elapsedTime * 1000;
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - startTime) / 100) / 10);
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isFinished]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setUserInput(val);

    const expectedDiff = minuend - subtrahend;
    const expectedStr = expectedDiff.toString();

    if (val.length === expectedStr.length) {
      if (parseInt(val, 10) === expectedDiff) {
        setFeedback('correct');
        setTimeout(() => {
          handleCorrectAnswer();
        }, 220);
      } else {
        setFeedback('wrong');
        setRoundMistakes(prev => prev + 1);
        setShowHelper(true);
      }
    }
  };

  const handleCorrectAnswer = () => {
    if (roundCount >= 5) {
      // Finished set of 5 problems!
      setIsFinished(true);
      const isFlawless = roundMistakes === 0;
      const currentStreak = isFlawless ? (progress.streakCount[selectedLevel] || 0) + 1 : 0;
      let newUnlocked = progress.unlockedLevel;

      if (currentStreak >= 3 && selectedLevel === progress.unlockedLevel && selectedLevel < 6) {
        newUnlocked = selectedLevel + 1;
      }

      const updated: ModuleProgress = {
        unlockedLevel: newUnlocked,
        streakCount: { ...progress.streakCount, [selectedLevel]: currentStreak },
        bestTimes: { ...progress.bestTimes, [selectedLevel]: elapsedTime }
      };

      setProgress(updated);
      saveSubtractionProgress(updated);
    } else {
      setRoundCount(prev => prev + 1);
      generateNewProblem();
    }
  };

  const streakForActiveLevel = progress.streakCount[selectedLevel] || 0;

  return (
    <div className="w-full bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
      {/* Level Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
              Chapter 1: Forward Distance Subtraction
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              Level {activeLevelConfig.level}: {activeLevelConfig.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-lg border border-amber-200 shadow-xs">
              <Flame className="w-4 h-4 fill-amber-500 text-amber-600" />
              <span>Streak: {streakForActiveLevel}/3 Sets</span>
            </div>
            <button
              onClick={() => { setRoundCount(1); setRoundMistakes(0); generateNewProblem(); }}
              className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
              title="Restart Set"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Level Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {SUBTRACTION_LEVELS.map(lvl => {
            const isUnlocked = lvl.level <= progress.unlockedLevel;
            const isCurrent = lvl.level === selectedLevel;
            return (
              <button
                key={lvl.level}
                onClick={() => {
                  if (isUnlocked) {
                    setSelectedLevel(lvl.level);
                    setRoundCount(1);
                    setRoundMistakes(0);
                  }
                }}
                disabled={!isUnlocked}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-500/30'
                    : isUnlocked
                    ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                }`}
              >
                {!isUnlocked ? <Lock className="w-3 h-3 text-slate-400" /> : <span>L{lvl.level}</span>}
                <span className="text-[11px] font-medium opacity-90 truncate max-w-[120px]">
                  {lvl.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Arena */}
      {!isFinished ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Question {roundCount} of 5
            </span>
            <span className="text-xs font-mono text-slate-400">
              Time: {elapsedTime.toFixed(1)}s
            </span>
          </div>

          {/* Number Line Representation (Page 4 Illustration) */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-600 flex items-center justify-between">
              <span>Forward Distance Model:</span>
              <span className="text-sky-700 font-mono font-bold">
                Stand at {subtrahend} ➔ Jump to {minuend}
              </span>
            </div>

            {/* Horizontal Line with milestones */}
            <div className="relative h-12 flex items-center px-6">
              <div className="absolute inset-x-6 h-1 bg-slate-300 rounded-full" />
              
              {/* Start Point */}
              <div className="absolute left-6 -translate-x-1/2 flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
                <span className="text-xs font-black font-mono text-blue-800 mt-1">{subtrahend}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Start</span>
              </div>

              {/* End Point */}
              <div className="absolute right-6 translate-x-1/2 flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-sm" />
                <span className="text-xs font-black font-mono text-emerald-800 mt-1">{minuend}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Target</span>
              </div>
            </div>
          </div>

          {/* Problem Display */}
          <div className="flex items-center justify-center gap-3 font-mono font-black text-3xl text-slate-900">
            <span className="text-slate-800">{minuend}</span>
            <span className="text-slate-400">-</span>
            <span className="text-sky-600">{subtrahend}</span>
            <span className="text-slate-400">=</span>
            <span className="text-slate-400">?</span>
          </div>

          {/* Input Box */}
          <div className="max-w-xs mx-auto">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={userInput}
              onChange={handleInputChange}
              placeholder="Difference..."
              className={`w-full text-center text-3xl font-black font-mono py-3 rounded-xl border-2 transition-all outline-none ${
                feedback === 'correct'
                  ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800'
                  : feedback === 'wrong'
                  ? 'border-rose-500 bg-rose-50/50 text-rose-800'
                  : 'border-slate-300 focus:border-sky-600 text-slate-900'
              }`}
              autoFocus
            />
          </div>

          {/* Thought process breakdown */}
          {showHelper && (
            <div className="pt-2">
              <ThoughtHopVisualizer
                type="subtraction"
                minuend={minuend}
                subtrahend={subtrahend}
              />
            </div>
          )}
        </div>
      ) : (
        /* Round Finished */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center space-y-4 max-w-lg mx-auto"
        >
          <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Trophy className="w-7 h-7" />
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            Set Complete! 🎉
          </h3>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Duration</span>
              <div className="text-xl font-mono font-bold text-slate-900 mt-0.5">
                {elapsedTime.toFixed(1)}s
              </div>
              <span className="text-[10px] text-slate-400">5 Forward Jumps</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Result</span>
              <div className="text-xl font-mono font-bold text-slate-900 mt-0.5">
                {roundMistakes === 0 ? 'Flawless' : `${roundMistakes} Mistakes`}
              </div>
              <span className="text-[10px] text-slate-400">
                {roundMistakes === 0 ? '+1 toward next level' : 'Streak reset'}
              </span>
            </div>
          </div>

          {streakForActiveLevel >= 3 && selectedLevel < 6 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
              <Unlock className="w-4 h-4 text-emerald-600" />
              <span>Level {selectedLevel + 1} Unlocked!</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setRoundCount(1); setRoundMistakes(0); generateNewProblem(); }}
              className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Next Set
            </button>
            {selectedLevel < progress.unlockedLevel && (
              <button
                onClick={() => { setSelectedLevel(selectedLevel + 1); setRoundCount(1); setRoundMistakes(0); }}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                Level {selectedLevel + 1}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
