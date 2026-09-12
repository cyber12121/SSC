import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Zap,
  Lock,
  Unlock,
  Trophy,
  ArrowRight,
  Lightbulb,
  Check,
  X,
  Play,
  Target,
  Timer
} from 'lucide-react';
import {
  ADDITION_LEVELS,
  AdditionLevelConfig,
  loadAdditionProgress,
  saveAdditionProgress,
  ModuleProgress
} from './calculationLevelConfig';

export const ChainAdditionDrill: React.FC = () => {
  const [progress, setProgress] = useState<ModuleProgress>(loadAdditionProgress);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(1); // 1 to 10
  const [numbers, setNumbers] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  const [roundScore, setRoundScore] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  const activeLevelConfig: AdditionLevelConfig = useMemo(() => {
    return ADDITION_LEVELS.find(l => l.level === selectedLevel) || ADDITION_LEVELS[0];
  }, [selectedLevel]);

  // Generate numbers for a single addition problem
  const generateNumbers = (cfg: AdditionLevelConfig = activeLevelConfig) => {
    const { nodeCount, minVal, maxVal } = cfg;
    const list: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const val = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
      list.push(val);
    }
    setNumbers(list);
    setUserInput('');
    setFeedback('idle');
    setShowBreakdown(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  };

  const startNewSet = (level: number = selectedLevel) => {
    setIsStarted(true);
    setCurrentQuestionIdx(1);
    setRoundScore(0);
    setElapsedTime(0);
    setIsFinished(false);
    setIsTimerRunning(true);

    const cfg = ADDITION_LEVELS.find(l => l.level === level) || ADDITION_LEVELS[0];
    generateNumbers(cfg);
  };

  // Reset drill to briefing when changing levels
  const handleSelectLevel = (lvl: number) => {
    if (lvl > progress.unlockedLevel) return;
    setSelectedLevel(lvl);
    setIsStarted(false);
    setIsFinished(false);
    setIsTimerRunning(false);
    setElapsedTime(0);
  };

  // Stopwatch
  useEffect(() => {
    if (isTimerRunning && !isFinished) {
      const startTime = Date.now() - elapsedTime * 1000;
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - startTime) / 100) / 10);
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, isFinished]);

  const expectedSum = useMemo(() => {
    return numbers.reduce((acc, n) => acc + n, 0);
  }, [numbers]);

  // Intermediate running totals for the breakdown diagram
  const runningSteps = useMemo(() => {
    let running = 0;
    return numbers.map((n, idx) => {
      running += n;
      return { addend: n, currentTotal: running, isStart: idx === 0 };
    });
  }, [numbers]);

  const checkAnswer = () => {
    if (!userInput.trim()) return;
    const parsed = parseInt(userInput.trim(), 10);

    if (parsed === expectedSum) {
      setFeedback('correct');
      const newScore = roundScore + 1;
      setRoundScore(newScore);

      setTimeout(() => {
        advanceNextQuestion(newScore);
      }, 350);
    } else {
      setFeedback('wrong');
      setShowBreakdown(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (feedback === 'wrong') {
        // Press Enter while wrong to skip to next question
        advanceNextQuestion(roundScore);
      } else {
        checkAnswer();
      }
    }
  };

  const advanceNextQuestion = (finalScore: number) => {
    if (currentQuestionIdx >= 10) {
      // Completed all 10 questions!
      setIsFinished(true);
      setIsTimerRunning(false);

      const passed = finalScore >= activeLevelConfig.passingScore;
      let newUnlocked = progress.unlockedLevel;
      if (passed && selectedLevel === progress.unlockedLevel && selectedLevel < 10) {
        newUnlocked = selectedLevel + 1;
      }

      const prevBest = progress?.bestScores?.[selectedLevel] || 0;
      const updated: ModuleProgress = {
        unlockedLevel: newUnlocked,
        bestScores: { ...(progress?.bestScores || {}), [selectedLevel]: Math.max(prevBest, finalScore) },
        bestTimes: { ...(progress?.bestTimes || {}), [selectedLevel]: elapsedTime },
        streakCount: progress?.streakCount || {}
      };

      setProgress(updated);
      saveAdditionProgress(updated);
    } else {
      setCurrentQuestionIdx(prev => prev + 1);
      generateNumbers();
    }
  };

  const passedSet = roundScore >= activeLevelConfig.passingScore;

  return (
    <div className="w-full bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
      {/* 1. Top Level Selector Bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Chapter 1: Continuous Mental Addition
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              Level {activeLevelConfig.level}: {activeLevelConfig.title}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Range {activeLevelConfig.minVal}–{activeLevelConfig.maxVal}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-lg border border-slate-200">
              Pass Target: {activeLevelConfig.passingScore}/10
            </div>
            <button
              onClick={() => startNewSet(selectedLevel)}
              className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs cursor-pointer"
              title="Restart Set"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 10 Level Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {ADDITION_LEVELS.map(lvl => {
            const isUnlocked = lvl.level <= progress.unlockedLevel;
            const isCurrent = lvl.level === selectedLevel;
            const best = progress.bestScores[lvl.level];

            return (
              <button
              key={lvl.level}
              onClick={() => handleSelectLevel(lvl.level)}
              disabled={!isUnlocked}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                isCurrent
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30'
                  : isUnlocked
                  ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
              }`}
            >
              {!isUnlocked ? (
                <Lock className="w-3 h-3 text-slate-400" />
              ) : (
                <span>L{lvl.level}</span>
              )}
              <span className="text-[11px] font-medium opacity-90">
                ({lvl.nodeCount}N)
              </span>
              {best !== undefined && isUnlocked && (
                <span className={`text-[10px] px-1 rounded ${isCurrent ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {best}/10
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>

    {/* ── Screen 1: Mission Briefing (DO NOT start automatically) ── */}
    {!isStarted && !isFinished && (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 max-w-2xl mx-auto"
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-blue-100">
            <Target className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black text-slate-900">
            Level {activeLevelConfig.level}: {activeLevelConfig.title}
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {activeLevelConfig.description}
          </p>
        </div>

        {/* Arun Sharma Method Tip Box */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 space-y-2">
          <div className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-blue-600" />
            <span>Arun Sharma Continuous Addition Concept (Page 2)</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            Keep a running subtotal in memory. When adding each new number, add the units first to reach a friendly round number, then leap by the tens.
          </p>
          <div className="bg-white/90 border border-blue-100 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono font-bold text-blue-900">
            <span>Chain Sequence:</span>
            <span>{activeLevelConfig.nodeCount} Numbers in range [{activeLevelConfig.minVal} – {activeLevelConfig.maxVal}]</span>
            <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[11px] font-sans">Pass: {activeLevelConfig.passingScore}/10</span>
          </div>
        </div>

        {/* Drill Targets Grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Questions</span>
            <span className="text-base font-black text-slate-800">10 Problems</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Unlock Target</span>
            <span className="text-base font-black text-emerald-700">≥ {activeLevelConfig.passingScore} / 10</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Speed</span>
            <span className="text-base font-black text-blue-700">~{activeLevelConfig.targetBenchmarkSec}s / chain</span>
          </div>
        </div>

        {/* Start Drill Button */}
        <button
          onClick={() => startNewSet(selectedLevel)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-base rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Start Addition Drill</span>
        </button>
      </motion.div>
    )}

    {/* 2. Main Drill Area */}
    {isStarted && !isFinished && (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {/* Status Header */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider">
              Question <strong className="text-slate-900 text-sm">{currentQuestionIdx}</strong> of 10
            </span>
            <div className="flex items-center gap-4">
              <span className="font-medium">
                Current Score: <strong className="text-emerald-700 font-bold">{roundScore}</strong> / {currentQuestionIdx - 1}
              </span>
              <span className="font-mono text-slate-400">
                Time: {elapsedTime.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Continuous Addition Expression Card */}
          <div className="p-6 bg-slate-50/80 rounded-2xl border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
              Add mentally from left to right (No Paper)
            </span>

            {/* Expression */}
            <div className="flex items-center justify-center flex-wrap gap-2.5 font-mono font-black text-2xl sm:text-3xl text-slate-900">
              {numbers.map((num, idx) => (
                <React.Fragment key={idx}>
                  <span className="px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-xs text-blue-900">
                    {num}
                  </span>
                  {idx < numbers.length - 1 && (
                    <span className="text-slate-400 font-sans text-xl">+</span>
                  )}
                </React.Fragment>
              ))}
              <span className="text-slate-400 font-sans text-xl">=</span>
              <span className="text-slate-400">?</span>
            </div>
          </div>

          {/* User Input & Submit Button */}
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value.replace(/[^0-9]/g, ''));
                  if (feedback !== 'idle') setFeedback('idle');
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter final sum..."
                className={`flex-1 text-center text-3xl font-black font-mono py-3 rounded-xl border-2 transition-all outline-none ${
                  feedback === 'correct'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : feedback === 'wrong'
                    ? 'border-rose-500 bg-rose-50 text-rose-800'
                    : 'border-slate-300 focus:border-blue-600 text-slate-900'
                }`}
                autoFocus
              />

              <button
                onClick={checkAnswer}
                className="py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span>Check</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">
              Type the final sum and press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono text-[11px] text-slate-600">Enter</kbd>
            </p>
          </div>

          {/* Wrong Answer Breakdown */}
          {showBreakdown && (
            <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-4 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-rose-800 text-sm">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Correct Answer: {expectedSum} (You entered: {userInput || 'blank'})</span>
                </div>
                <button
                  onClick={() => advanceNextQuestion(roundScore)}
                  className="text-xs bg-rose-600 text-white font-bold px-3 py-1 rounded-lg hover:bg-rose-700 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Step by step mental accumulation trail */}
              <div>
                <span className="font-semibold text-rose-900 block mb-1.5">
                  Mental Left-to-Right Accumulator Trail:
                </span>
                <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                  {runningSteps.map((step, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && (
                        <span className="text-slate-400 font-sans">
                          ──(+{step.addend})──➔
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded border font-bold ${
                        idx === runningSteps.length - 1
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-800 border-slate-200'
                      }`}>
                        {step.currentTotal}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. 10-Question Scorecard */}
      {isFinished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center space-y-5 max-w-lg mx-auto"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-sm ${
            passedSet ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-2xl font-black text-slate-900">
              {passedSet ? 'Set Passed! 🎉' : 'Set Completed'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Level {activeLevelConfig.level}: {activeLevelConfig.title}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Final Score</span>
              <div className="text-2xl font-mono font-black text-slate-900 mt-0.5">
                {roundScore} / 10
              </div>
              <span className={`text-[10px] font-bold ${passedSet ? 'text-emerald-600' : 'text-rose-500'}`}>
                {passedSet ? 'Pass threshold met (≥8)' : 'Need ≥8 to unlock next level'}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Total Duration</span>
              <div className="text-2xl font-mono font-black text-slate-900 mt-0.5">
                {elapsedTime.toFixed(1)}s
              </div>
              <span className="text-[10px] text-slate-400">
                Avg: {(elapsedTime / 10).toFixed(1)}s per question
              </span>
            </div>
          </div>

          {passedSet && selectedLevel < 10 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
              <Unlock className="w-4 h-4 text-emerald-600" />
              <span>Level {selectedLevel + 1} Unlocked Permanently!</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => startNewSet(selectedLevel)}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Set
            </button>

            {passedSet && selectedLevel < 10 && (
              <button
                onClick={() => setSelectedLevel(selectedLevel + 1)}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Proceed to Level {selectedLevel + 1}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
