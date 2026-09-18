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
  Check,
  Timer,
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

interface SubtractionDrillProps {
  autoStart?: boolean;
}

export const NumberLineHopDrill: React.FC<SubtractionDrillProps> = ({ autoStart = false }) => {
  const [progress, setProgress] = useState<ModuleProgress>(loadSubtractionProgress);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(1); // 1 to 10
  const [roundScore, setRoundScore] = useState<number>(0);
  const [wrongAttempts, setWrongAttempts] = useState<number>(0);
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

  const generateNewProblem = (levelConfig: SubtractionLevelConfig = activeLevelConfig) => {
    const { type, level } = levelConfig;
    let a = 0;
    let b = 0;

    if (type === 'same_decade') {
      const tensA = Math.floor(Math.random() * 3) + 2;
      const tensB = Math.floor(Math.random() * tensA) + 1;
      const unitA = Math.floor(Math.random() * 5) + 5;
      const unitB = Math.floor(Math.random() * Math.max(1, unitA - 1)) + 1;
      a = tensA * 10 + unitA;
      b = tensB * 10 + unitB;
      if (a <= b) a = b + 15;
    } else if (type === 'unit_match') {
      const tensB = Math.floor(Math.random() * 3) + 2;
      const unitB = Math.floor(Math.random() * 5) + 5;
      b = tensB * 10 + unitB;
      const unitA = Math.floor(Math.random() * (unitB - 1)) + 1;
      const tensA = tensB + Math.floor(Math.random() * 3) + 2;
      a = Math.min(79, tensA * 10 + unitA);
      if (a <= b) a = b + 24;
    } else if (level === 3) {
      b = Math.floor(Math.random() * 25) + 30;
      const diff = Math.floor(Math.random() * 26) + 18;
      a = b + diff;
      if (a > 99) a = 97;
    } else if (level === 4) {
      b = Math.floor(Math.random() * 30) + 65;
      a = Math.floor(Math.random() * 50) + 115;
    } else if (type === 'three_digit_match') {
      b = Math.floor(Math.random() * 280) + 160;
      const leapH = Math.floor(Math.random() * 4) + 2;
      const endHop = Math.floor(Math.random() * 35) + 12;
      a = Math.min(980, b + leapH * 100 + endHop);
    } else {
      b = Math.floor(Math.random() * 280) + 280;
      const diff = Math.floor(Math.random() * 240) + 140;
      a = Math.min(995, b + diff);
    }

    setMinuend(a);
    setSubtrahend(b);
    setUserInput('');
    setFeedback('idle');
    setShowHelper(false);
    setWrongAttempts(0);
    if (inputRef.current) inputRef.current.value = '';

    setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

  const startTimeRef = useRef<number>(0);

  const startDrill = (level: number = selectedLevel) => {
    setIsStarted(true);
    setCurrentQuestionIdx(1);
    setRoundScore(0);
    setQuestionHistory(Array(10).fill('pending'));
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    setIsFinished(false);
    setIsTimerRunning(true);

    const cfg = SUBTRACTION_LEVELS.find(l => l.level === level) || SUBTRACTION_LEVELS[0];
    generateNewProblem(cfg);
  };

  useEffect(() => {
    if (autoStart && !isStarted && !isFinished) {
      startDrill(selectedLevel);
    }
  }, [autoStart]);

  const handleSelectLevel = (lvl: number) => {
    if (lvl > progress.unlockedLevel) return;
    setSelectedLevel(lvl);
    setIsStarted(false);
    setIsFinished(false);
    setIsTimerRunning(false);
    setElapsedTime(0);
    startTimeRef.current = 0;
    setShowHelper(false);
  };

  useEffect(() => {
    if (isTimerRunning && !isFinished) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - startTimeRef.current) / 100) / 10);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, isFinished]);

  const expectedDiff = useMemo(() => {
    return minuend - subtrahend;
  }, [minuend, subtrahend]);

  const handleWrongAttempt = () => {
    const nextAttempts = wrongAttempts + 1;
    setWrongAttempts(nextAttempts);
    setFeedback('wrong');

    if (nextAttempts >= 3) {
      setShowHelper(true);
      setQuestionHistory(prev => {
        const copy = [...prev];
        copy[currentQuestionIdx - 1] = 'wrong';
        return copy;
      });
    } else {
      setTimeout(() => {
        setFeedback('idle');
        setUserInput('');
        if (inputRef.current) {
          inputRef.current.value = '';
          inputRef.current.focus();
        }
      }, 400);
    }
  };

  const checkAnswer = () => {
    if (!userInput.trim() || feedback === 'correct') return;
    const parsed = parseInt(userInput.trim(), 10);

    if (parsed === expectedDiff) {
      setFeedback('correct');
      setWrongAttempts(0);
      const newScore = roundScore + 1;
      setRoundScore(newScore);

      setQuestionHistory(prev => {
        const copy = [...prev];
        copy[currentQuestionIdx - 1] = 'correct';
        return copy;
      });

      setTimeout(() => {
        advanceNextQuestion(newScore);
      }, 150);
    } else {
      handleWrongAttempt();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (feedback === 'correct') return;
    if (feedback === 'wrong' && e.key !== 'Enter') setFeedback('idle');
    if (e.key === 'Enter') {
      e.preventDefault();
      if (feedback === 'wrong' && wrongAttempts >= 3) {
        advanceNextQuestion(roundScore);
      } else {
        checkAnswer();
      }
    }
  };

  const advanceNextQuestion = (finalScore: number) => {
    if (currentQuestionIdx >= 10) {
      setIsFinished(true);
      setIsTimerRunning(false);

      const passed = finalScore >= activeLevelConfig.passingScore;
      let newUnlocked = progress.unlockedLevel;

      if (passed && selectedLevel === progress.unlockedLevel && selectedLevel < 6) {
        newUnlocked = selectedLevel + 1;
      }

      const currentStreak = passed ? ((progress?.streakCount?.[selectedLevel] || 0) + 1) : 0;
      const best = progress?.bestTimes?.[selectedLevel];
      const newBest = best ? Math.min(best, elapsedTime) : elapsedTime;

      const updated: ModuleProgress = {
        unlockedLevel: newUnlocked,
        bestScores: progress?.bestScores || {},
        streakCount: { ...(progress?.streakCount || {}), [selectedLevel]: currentStreak },
        bestTimes: { ...(progress?.bestTimes || {}), [selectedLevel]: newBest }
      };

      setProgress(updated);
      saveSubtractionProgress(updated);
    } else {
      setCurrentQuestionIdx(prev => prev + 1);
      generateNewProblem();
    }
  };

  const streakForActiveLevel = progress?.streakCount?.[selectedLevel] || 0;
  const passedSet = roundScore >= activeLevelConfig.passingScore;

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
      {/* Sleek Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900">
            Level {activeLevelConfig.level}: {activeLevelConfig.title.split('(')[0].trim()}
          </span>
          {streakForActiveLevel > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.2 rounded-full border border-amber-200/60">
              <Flame className="w-2.5 h-2.5 fill-current" />
              {streakForActiveLevel} streak
            </span>
          )}
        </div>

        {/* Level Selector Pills */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
          {SUBTRACTION_LEVELS.map(lvl => {
            const isUnlocked = lvl.level <= progress.unlockedLevel;
            const isCurrent = lvl.level === selectedLevel;

            return (
              <button
                key={lvl.level}
                onClick={() => handleSelectLevel(lvl.level)}
                disabled={!isUnlocked}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : isUnlocked
                    ? 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
              >
                {!isUnlocked ? <Lock className="w-2.5 h-2.5" /> : <span>L{lvl.level}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Screen 1: Minimalist Briefing */}
      {!isStarted && !isFinished && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto py-6 sm:py-8 text-center space-y-5"
        >
          <div className="space-y-1.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto mb-2">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Level {activeLevelConfig.level}: {activeLevelConfig.title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              {activeLevelConfig.description}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-600 py-2 border-y border-slate-100">
            <span>10 Problems</span>
            <span className="text-slate-300">•</span>
            <span>Pass: ≥ 8/10</span>
            <span className="text-slate-300">•</span>
            <span>Target: ~{activeLevelConfig.targetBenchmarkSec}s/hop</span>
          </div>

          <button
            onClick={() => startDrill(selectedLevel)}
            className="w-full sm:w-auto px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Practice</span>
          </button>
        </motion.div>
      )}

      {/* Screen 2: Stitch Minimalist Practice Cockpit Arena */}
      {isStarted && !isFinished && (
        <div className="w-full max-w-2xl mx-auto py-1 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
            {/* Header: Topic, Level & Sleek Progress Indicator */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-blue-600 font-bold">
                    Number Line Subtraction
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                    Level {selectedLevel}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-sans">
                  Forward hops • {activeLevelConfig.title}
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-800">
                    Problem {currentQuestionIdx} <span className="text-slate-400 font-normal">of 10</span>
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                    ⏱️ {elapsedTime.toFixed(1)}s
                  </span>
                </div>
                <div className="w-28 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1 ml-auto">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(currentQuestionIdx / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Arithmetic Expression Canvas with Distinct Slate Operand Tiles */}
            <div className="py-2 sm:py-3 text-center space-y-4">
              <div className="flex items-center justify-center gap-2 sm:gap-3 select-none">
                <span className="inline-flex items-center justify-center min-w-[3.5rem] sm:min-w-[4.25rem] px-3.5 py-2.5 rounded-xl border bg-blue-50/80 text-blue-700 border-blue-200 font-mono font-bold text-2xl sm:text-3xl shadow-2xs">
                  {minuend}
                </span>
                <span className="text-slate-400 font-bold text-2xl px-1 font-mono">−</span>
                <span className="inline-flex items-center justify-center min-w-[3.5rem] sm:min-w-[4.25rem] px-3.5 py-2.5 rounded-xl border bg-slate-50 text-slate-800 border-slate-200/90 font-mono font-bold text-2xl sm:text-3xl shadow-2xs">
                  {subtrahend}
                </span>
                <span className="text-slate-400 font-bold text-2xl px-1 font-mono">=</span>
                <span className="text-blue-600 font-mono font-bold text-2xl sm:text-3xl px-1">?</span>
              </div>

              {/* Mental Hint / Hop Ladder Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowHelper((prev) => !prev)}
                  className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/60 px-3 py-1 rounded-full transition border border-slate-200/80 font-medium cursor-pointer shadow-2xs"
                >
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>{showHelper ? 'Hide Thought Hops' : 'Forward Hops Guide (H)'}</span>
                </button>

                <AnimatePresence>
                  {showHelper && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="mt-2.5 max-w-lg mx-auto p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 shadow-2xs text-left"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                        <span className="font-bold text-slate-900">
                          Hop Route: <strong className="text-emerald-700 font-mono">{expectedDiff}</strong>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {subtrahend} ➔ {minuend}
                        </span>
                      </div>
                      <ThoughtHopVisualizer
                        type="subtraction"
                        minuend={minuend}
                        subtrahend={subtrahend}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Input and Next/Skip Controls */}
            <div className="max-w-sm mx-auto space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={userInput}
                  onChange={(e) => {
                    if (feedback === 'correct') return;
                    if (feedback === 'wrong') setFeedback('idle');
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setUserInput(val);
                    if (val && parseInt(val, 10) === expectedDiff) {
                      setFeedback('correct');
                      setWrongAttempts(0);
                      const newScore = roundScore + 1;
                      setRoundScore(newScore);
                      setQuestionHistory(prev => {
                        const copy = [...prev];
                        copy[currentQuestionIdx - 1] = 'correct';
                        return copy;
                      });
                      setTimeout(() => {
                        advanceNextQuestion(newScore);
                      }, 150);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (feedback === 'correct') return;
                    if (feedback === 'wrong' && e.key !== 'Enter') setFeedback('idle');
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      checkAnswer();
                    } else if (e.key.toLowerCase() === 'h' && !userInput) {
                      e.preventDefault();
                      setShowHelper((prev) => !prev);
                    }
                  }}
                  placeholder="Enter difference..."
                  autoFocus
                  className={`w-full text-center font-mono font-bold text-xl sm:text-2xl py-2.5 px-4 rounded-xl border transition-all outline-none ${
                    feedback === 'correct'
                      ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 ring-4 ring-emerald-50'
                      : feedback === 'wrong'
                      ? 'border-rose-400 bg-rose-50/70 text-rose-800 ring-4 ring-rose-50'
                      : 'border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 bg-slate-50/50 hover:bg-white placeholder:text-slate-300'
                  }`}
                />
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={checkAnswer}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <span>Next</span>
                  <span className="font-mono text-[11px] opacity-75">(Enter ↵)</span>
                </button>
                <button
                  type="button"
                  onClick={() => advanceNextQuestion(roundScore)}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition cursor-pointer"
                  title="Skip problem"
                >
                  Skip
                </button>
              </div>
            </div>

            {/* 3-Column Performance Stats Footer */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Avg Pace</div>
                <div className="text-sm font-semibold font-mono text-slate-800 mt-0.5">
                  {currentQuestionIdx > 1 ? (elapsedTime / (currentQuestionIdx - 1)).toFixed(1) : elapsedTime.toFixed(1)}s{' '}
                  <span className="text-[11px] text-slate-400 font-normal">/ problem</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Session Accuracy</div>
                <div className="text-sm font-semibold font-mono text-emerald-600 mt-0.5">
                  {currentQuestionIdx > 1
                    ? `${Math.round((roundScore / (currentQuestionIdx - 1)) * 100)}%`
                    : '100%'}{' '}
                  <span className="text-[11px] text-slate-400 font-normal">
                    ({roundScore}/{Math.max(1, currentQuestionIdx - 1)})
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Target Pace</div>
                <div className="text-sm font-semibold font-mono text-slate-800 mt-0.5">
                  ~{activeLevelConfig.targetBenchmarkSec}s
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen 3: Summary Scorecard */}
      {isFinished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm mx-auto py-8 text-center space-y-5"
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center mx-auto">
            <Trophy className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {passedSet ? 'Level Completed' : 'Session Finished'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Level {activeLevelConfig.level}: {activeLevelConfig.title}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center py-1">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Score</span>
              <span className="text-xl font-mono font-bold text-slate-900">{roundScore}/10</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Time</span>
              <span className="text-xl font-mono font-bold text-slate-900">{elapsedTime.toFixed(1)}s</span>
            </div>
          </div>

          {passedSet && selectedLevel < 6 && (
            <div className="text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1">
              <Unlock className="w-3.5 h-3.5" />
              <span>Level {selectedLevel + 1} Unlocked</span>
            </div>
          )}

          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => startDrill(selectedLevel)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>

            {passedSet && selectedLevel < 6 && (
              <button
                onClick={() => {
                  setSelectedLevel(selectedLevel + 1);
                  startDrill(selectedLevel + 1);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next Level</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
