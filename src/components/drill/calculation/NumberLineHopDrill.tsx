import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCcw,
  Trophy,
  Lock,
  Unlock,
  Flame,
  ArrowRight,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Check,
  X,
  Target,
  Timer
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
  
  // Drill active state - DO NOT start automatically
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(1); // 1 to 10
  const [roundScore, setRoundScore] = useState<number>(0);
  const [questionHistory, setQuestionHistory] = useState<Array<'correct' | 'wrong' | 'pending'>>(
    Array(10).fill('pending')
  );

  const [minuend, setMinuend] = useState<number>(72);
  const [subtrahend, setSubtrahend] = useState<number>(38);
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showHelper, setShowHelper] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  const activeLevelConfig: SubtractionLevelConfig = useMemo(() => {
    return SUBTRACTION_LEVELS.find(l => l.level === selectedLevel) || SUBTRACTION_LEVELS[0];
  }, [selectedLevel]);

  // Robust, pedagogically sound problem generation
  const generateNewProblem = (levelConfig: SubtractionLevelConfig = activeLevelConfig) => {
    const { type, level } = levelConfig;
    let a = 0;
    let b = 0;

    if (type === 'same_decade') {
      // Level 1: Friendly Decade Hop. Unit of A >= Unit of B (No unit borrowing stress)
      const tensA = Math.floor(Math.random() * 3) + 2; // 20s, 30s, 40s
      const tensB = Math.floor(Math.random() * tensA) + 1; // 10s .. tensA
      const unitA = Math.floor(Math.random() * 5) + 5; // 5..9
      const unitB = Math.floor(Math.random() * Math.max(1, unitA - 1)) + 1; // 1..unitA-1
      a = tensA * 10 + unitA;
      b = tensB * 10 + unitB;
      if (a <= b) a = b + 15;
    } else if (type === 'unit_match') {
      // Level 2: Unit-Match Hop. Unit of A < Unit of B (Crossing unit boundary)
      // e.g. 72 - 38 = 34
      const tensB = Math.floor(Math.random() * 3) + 2; // 2, 3, 4 (20..49)
      const unitB = Math.floor(Math.random() * 5) + 5; // 5, 6, 7, 8, 9
      b = tensB * 10 + unitB;
      const unitA = Math.floor(Math.random() * (unitB - 1)) + 1; // 1 .. unitB - 1
      const tensA = tensB + Math.floor(Math.random() * 3) + 2; // tensB + 2 .. tensB + 4
      a = Math.min(79, tensA * 10 + unitA);
      if (a <= b) a = b + 24;
    } else if (level === 3) {
      // Level 3: Decade Bridge Hop (40..100)
      b = Math.floor(Math.random() * 25) + 30; // 30..55
      const diff = Math.floor(Math.random() * 26) + 18; // 18..43
      a = b + diff;
      if (a > 99) a = 97;
    } else if (level === 4) {
      // Level 4: Century Crossing (70..190)
      // Subtrahend below 100, Minuend above 100 (Hop to 100 then jump to target)
      b = Math.floor(Math.random() * 30) + 65; // 65..95
      a = Math.floor(Math.random() * 50) + 115; // 115..165
    } else if (type === 'three_digit_match') {
      // Level 5: 3-Digit Matching Milestone (200..999)
      b = Math.floor(Math.random() * 280) + 160; // 160..440
      const leapH = Math.floor(Math.random() * 4) + 2; // 200..500
      const endHop = Math.floor(Math.random() * 35) + 12;
      a = Math.min(980, b + leapH * 100 + endHop);
    } else {
      // Level 6: 3-Digit Complex Leap (300..999)
      b = Math.floor(Math.random() * 280) + 280; // 280..560
      const diff = Math.floor(Math.random() * 240) + 140;
      a = Math.min(995, b + diff);
    }

    setMinuend(a);
    setSubtrahend(b);
    setUserInput('');
    setFeedback('idle');
    setShowHelper(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  };

  const startDrill = (level: number = selectedLevel) => {
    setIsStarted(true);
    setCurrentQuestionIdx(1);
    setRoundScore(0);
    setQuestionHistory(Array(10).fill('pending'));
    setElapsedTime(0);
    setIsFinished(false);
    setIsTimerRunning(true);

    const cfg = SUBTRACTION_LEVELS.find(l => l.level === level) || SUBTRACTION_LEVELS[0];
    generateNewProblem(cfg);
  };

  // When changing levels, return to briefing screen
  const handleSelectLevel = (lvl: number) => {
    if (lvl > progress.unlockedLevel) return;
    setSelectedLevel(lvl);
    setIsStarted(false);
    setIsFinished(false);
    setIsTimerRunning(false);
    setElapsedTime(0);
    setShowHelper(false);
  };

  // Stopwatch timer
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

  const expectedDiff = useMemo(() => {
    return minuend - subtrahend;
  }, [minuend, subtrahend]);

  // Evaluate user submission
  const checkAnswer = () => {
    if (!userInput.trim()) return;
    const parsed = parseInt(userInput.trim(), 10);

    if (parsed === expectedDiff) {
      setFeedback('correct');
      const newScore = roundScore + 1;
      setRoundScore(newScore);

      setQuestionHistory(prev => {
        const copy = [...prev];
        copy[currentQuestionIdx - 1] = 'correct';
        return copy;
      });

      setTimeout(() => {
        advanceNextQuestion(newScore);
      }, 350);
    } else {
      setFeedback('wrong');
      setShowHelper(true);

      setQuestionHistory(prev => {
        const copy = [...prev];
        copy[currentQuestionIdx - 1] = 'wrong';
        return copy;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (feedback === 'wrong') {
        // Press enter while in breakdown to continue to next question
        advanceNextQuestion(roundScore);
      } else {
        checkAnswer();
      }
    }
  };

  const advanceNextQuestion = (finalScore: number) => {
    if (currentQuestionIdx >= 10) {
      // Completed all 10 questions
      setIsFinished(true);
      setIsTimerRunning(false);

      const passed = finalScore >= activeLevelConfig.passingScore;
      let newUnlocked = progress.unlockedLevel;

      if (passed && selectedLevel === progress.unlockedLevel && selectedLevel < 6) {
        newUnlocked = selectedLevel + 1;
      }

      const currentStreak = passed ? (progress.streakCount[selectedLevel] || 0) + 1 : 0;
      const best = progress.bestTimes[selectedLevel];
      const newBest = best ? Math.min(best, elapsedTime) : elapsedTime;

      const updated: ModuleProgress = {
        unlockedLevel: newUnlocked,
        streakCount: { ...progress.streakCount, [selectedLevel]: currentStreak },
        bestTimes: { ...progress.bestTimes, [selectedLevel]: newBest }
      };

      setProgress(updated);
      saveSubtractionProgress(updated);
    } else {
      setCurrentQuestionIdx(prev => prev + 1);
      generateNewProblem();
    }
  };

  const streakForActiveLevel = progress.streakCount[selectedLevel] || 0;

  return (
    <div className="w-full bg-slate-50/70 rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-5">
      {/* ── Level Navigation Header ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
              Quantitative Aptitude • Chapter 1: Speed Subtraction
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              Level {activeLevelConfig.level}: {activeLevelConfig.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-lg border border-amber-200 shadow-2xs">
              <Flame className="w-4 h-4 fill-amber-500 text-amber-600" />
              <span>Streak: {streakForActiveLevel} Sets</span>
            </div>
            {isStarted && !isFinished && (
              <button
                onClick={() => startDrill(selectedLevel)}
                className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                title="Restart Set"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Level Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {SUBTRACTION_LEVELS.map(lvl => {
            const isUnlocked = lvl.level <= progress.unlockedLevel;
            const isCurrent = lvl.level === selectedLevel;
            return (
              <button
                key={lvl.level}
                onClick={() => handleSelectLevel(lvl.level)}
                disabled={!isUnlocked}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-500/30'
                    : isUnlocked
                    ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                }`}
              >
                {!isUnlocked ? <Lock className="w-3 h-3 text-slate-400" /> : <span>L{lvl.level}</span>}
                <span className="text-[11px] font-medium opacity-90 truncate max-w-[140px]">
                  {lvl.title.split('(')[0].trim()}
                </span>
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
            <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-sky-100">
              <Target className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              Level {activeLevelConfig.level}: {activeLevelConfig.title}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {activeLevelConfig.description}
            </p>
          </div>

          {/* Arun Sharma Concept Card */}
          <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-sky-600" />
              <span>Arun Sharma Forward Distance Technique (Page 4)</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Instead of borrowing across columns, stand at the smaller number and jump forward on the mental number line to the target. Subtraction becomes friendly forward addition!
            </p>
            <div className="bg-white/90 border border-sky-100 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono font-bold text-sky-900">
              <span>e.g. 72 − 38:</span>
              <span>38 ➔ (+4) ➔ 42 ➔ (+30) ➔ 72</span>
              <span className="bg-sky-600 text-white px-2 py-0.5 rounded text-[11px] font-sans">Diff: 34</span>
            </div>
          </div>

          {/* Drill Targets */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Questions</span>
              <span className="text-base font-black text-slate-800">10 Problems</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Unlock Target</span>
              <span className="text-base font-black text-emerald-700">≥ 8 / 10 Correct</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Speed</span>
              <span className="text-base font-black text-sky-700">~{activeLevelConfig.targetBenchmarkSec}s / hop</span>
            </div>
          </div>

          {/* Start Drill Button */}
          <button
            onClick={() => startDrill(selectedLevel)}
            className="w-full py-4 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-black text-base rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Subtraction Drill</span>
          </button>
        </motion.div>
      )}

      {/* ── Screen 2: Active Drill Arena ── */}
      {isStarted && !isFinished && (
        <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {/* Top Drill Status Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Question {currentQuestionIdx} of 10
              </span>
              <div className="flex items-center gap-1 ml-2">
                {questionHistory.map((status, idx) => (
                  <span
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx === currentQuestionIdx - 1
                        ? 'ring-2 ring-sky-500 ring-offset-1 bg-sky-400'
                        : status === 'correct'
                        ? 'bg-emerald-500'
                        : status === 'wrong'
                        ? 'bg-rose-500'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <Timer className="w-3.5 h-3.5 text-sky-600" />
                <span className="font-mono">{elapsedTime.toFixed(1)}s</span>
              </div>
              <div className="text-xs font-bold text-slate-700">
                Score: <span className="text-sky-600 font-mono font-black">{roundScore}</span>/10
              </div>
            </div>
          </div>

          {/* Forward Distance Model Visualizer */}
          <div className="p-4 bg-gradient-to-r from-sky-50/50 via-slate-50 to-emerald-50/50 rounded-xl border border-slate-200/90 space-y-3">
            <div className="text-xs font-bold text-slate-600 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                Forward Mental Hop:
              </span>
              <span className="text-sky-800 font-mono font-bold text-[13px]">
                Stand at <strong className="text-blue-700">{subtrahend}</strong> ➔ Leap to <strong className="text-emerald-700">{minuend}</strong>
              </span>
            </div>

            {/* Visual Hop Track */}
            <div className="relative h-14 flex items-center px-8">
              <div className="absolute inset-x-8 h-1.5 bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400 rounded-full" />
              
              {/* Start (Subtrahend) */}
              <div className="absolute left-8 -translate-x-1/2 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-sm flex items-center justify-center text-[9px] text-white font-bold">
                  S
                </div>
                <span className="text-xs font-black font-mono text-blue-900 mt-1">{subtrahend}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Start</span>
              </div>

              {/* Center directional indicator */}
              <div className="mx-auto bg-white/90 border border-slate-200 px-3 py-0.5 rounded-full shadow-2xs text-[10px] font-bold text-slate-600 flex items-center gap-1 z-10">
                <span>Forward Hop Direction</span>
                <ArrowRight className="w-3 h-3 text-sky-600" />
              </div>

              {/* Target (Minuend) */}
              <div className="absolute right-8 translate-x-1/2 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-emerald-600 border-2 border-white shadow-sm flex items-center justify-center text-[9px] text-white font-bold">
                  T
                </div>
                <span className="text-xs font-black font-mono text-emerald-900 mt-1">{minuend}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Target</span>
              </div>
            </div>
          </div>

          {/* Equation Display */}
          <div className="text-center py-2">
            <div className="inline-flex items-center gap-3 sm:gap-4 font-mono font-black text-3xl sm:text-4xl text-slate-900 bg-slate-50/80 px-6 py-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-slate-900">{minuend}</span>
              <span className="text-slate-400">−</span>
              <span className="text-sky-600">{subtrahend}</span>
              <span className="text-slate-400">=</span>
              <span className="text-sky-700">?</span>
            </div>
          </div>

          {/* Input & Action Area (Explicit Check, No auto-eval on typing) */}
          <div className="max-w-sm mx-auto space-y-3">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={userInput}
                onChange={e => setUserInput(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={handleKeyDown}
                placeholder="Enter difference..."
                disabled={feedback === 'correct'}
                className={`w-full text-center text-3xl font-black font-mono py-3.5 px-4 rounded-xl border-2 transition-all outline-none shadow-2xs ${
                  feedback === 'correct'
                    ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-400/30'
                    : feedback === 'wrong'
                    ? 'border-rose-500 bg-rose-50/60 text-rose-900 ring-2 ring-rose-400/30'
                    : 'border-slate-300 focus:border-sky-600 text-slate-900 bg-white'
                }`}
                autoFocus
              />
            </div>

            {/* Check Button */}
            {feedback !== 'wrong' ? (
              <button
                onClick={checkAnswer}
                disabled={!userInput.trim() || feedback === 'correct'}
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Check Answer (or press Enter)</span>
              </button>
            ) : (
              <button
                onClick={() => advanceNextQuestion(roundScore)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Understand &amp; Next Question ➔</span>
              </button>
            )}
          </div>

          {/* Thought Process Helper Visualizer (shown on wrong answer or request) */}
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
      )}

      {/* ── Screen 3: Round Finished Summary ── */}
      {isFinished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-md text-center space-y-6 max-w-lg mx-auto"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-xs ${
            roundScore >= activeLevelConfig.passingScore
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : 'bg-amber-50 text-amber-600 border border-amber-200'
          }`}>
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-2xl font-black text-slate-900">
              {roundScore >= activeLevelConfig.passingScore
                ? 'Level Cleared! 🎉'
                : 'Drill Completed!'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {roundScore >= activeLevelConfig.passingScore
                ? `Passed with ${roundScore}/10! Next level unlocked.`
                : `You scored ${roundScore}/10. Need ≥ 8 to unlock the next level.`}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Score</span>
              <div className="text-2xl font-mono font-black text-slate-900 mt-0.5">
                {roundScore} / 10
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {Math.round((roundScore / 10) * 100)}% Accuracy
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Time</span>
              <div className="text-2xl font-mono font-black text-slate-900 mt-0.5">
                {elapsedTime.toFixed(1)}s
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {(elapsedTime / 10).toFixed(1)}s / hop avg
              </span>
            </div>
          </div>

          {roundScore >= activeLevelConfig.passingScore && selectedLevel < 6 && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
              <Unlock className="w-4 h-4 text-emerald-600" />
              <span>Level {selectedLevel + 1} Unlocked! Ready for the next leap.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5 pt-2">
            <button
              onClick={() => startDrill(selectedLevel)}
              className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Level {selectedLevel}</span>
            </button>

            {selectedLevel < progress.unlockedLevel && (
              <button
                onClick={() => {
                  setSelectedLevel(selectedLevel + 1);
                  setIsStarted(false);
                  setIsFinished(false);
                }}
                className="py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Level {selectedLevel + 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
