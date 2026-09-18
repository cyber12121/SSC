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
  Play,
  Timer
} from 'lucide-react';
import {
  ADDITION_LEVELS,
  AdditionLevelConfig,
  loadAdditionProgress,
  saveAdditionProgress,
  ModuleProgress
} from './calculationLevelConfig';

interface ChainAdditionProps {
  autoStart?: boolean;
}

export const ChainAdditionDrill: React.FC<ChainAdditionProps> = ({ autoStart = false }) => {
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
    if (inputRef.current) inputRef.current.value = '';

    setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

  const startTimeRef = useRef<number>(0);

  const startNewSet = (level: number = selectedLevel) => {
    setIsStarted(true);
    setCurrentQuestionIdx(1);
    setRoundScore(0);
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    setIsFinished(false);
    setIsTimerRunning(true);

    const cfg = ADDITION_LEVELS.find(l => l.level === level) || ADDITION_LEVELS[0];
    generateNumbers(cfg);
  };

  useEffect(() => {
    if (autoStart && !isStarted && !isFinished) {
      startNewSet(selectedLevel);
    }
  }, [autoStart]);

  // Reset drill to briefing when changing levels
  const handleSelectLevel = (lvl: number) => {
    if (lvl > progress.unlockedLevel) return;
    setSelectedLevel(lvl);
    setIsStarted(false);
    setIsFinished(false);
    setIsTimerRunning(false);
    setElapsedTime(0);
    startTimeRef.current = 0;
  };

  // Stopwatch
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
      }, 250);
    } else {
      setFeedback('wrong');
      setShowBreakdown(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (feedback === 'wrong') {
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
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
      {/* Sleek Minimalist Level Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900">
            Level {activeLevelConfig.level}: {activeLevelConfig.title}
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            [{activeLevelConfig.minVal}–{activeLevelConfig.maxVal}]
          </span>
        </div>

        {/* Level Pills Track */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
          {ADDITION_LEVELS.map(lvl => {
            const isUnlocked = lvl.level <= progress.unlockedLevel;
            const isCurrent = lvl.level === selectedLevel;
            const best = progress.bestScores[lvl.level];

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
                {!isUnlocked ? (
                  <Lock className="w-2.5 h-2.5" />
                ) : (
                  <span>L{lvl.level}</span>
                )}
                {best !== undefined && isUnlocked && (
                  <span className={`text-[9px] ${isCurrent ? 'text-slate-300' : 'text-slate-400'}`}>
                    {best}
                  </span>
                )}
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
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Level {activeLevelConfig.level}: {activeLevelConfig.title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              {activeLevelConfig.description}
            </p>
          </div>

          {/* Minimal Key Targets */}
          <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-600 py-2 border-y border-slate-100">
            <span>10 Problems</span>
            <span className="text-slate-300">•</span>
            <span>Pass: {activeLevelConfig.passingScore}/10</span>
            <span className="text-slate-300">•</span>
            <span>Target: ~{activeLevelConfig.targetBenchmarkSec}s/sum</span>
          </div>

          <button
            onClick={() => startNewSet(selectedLevel)}
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
            {/* Header: Topic, Nodes & Sleek Progress Indicator */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-blue-600 font-bold">
                    Continuous Addition
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                    Level {selectedLevel}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-sans">
                  {activeLevelConfig.nodeCount} Consecutive Nodes • Range {activeLevelConfig.minVal}–{activeLevelConfig.maxVal}
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
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 select-none">
                {numbers.map((num, idx) => (
                  <React.Fragment key={idx}>
                    <span
                      className={`inline-flex items-center justify-center min-w-[3.25rem] sm:min-w-[3.75rem] px-3 py-2 rounded-xl border font-mono font-bold text-2xl sm:text-3xl shadow-2xs transition-all ${
                        idx === 0
                          ? 'bg-blue-50/80 text-blue-700 border-blue-200'
                          : 'bg-slate-50 text-slate-800 border-slate-200/90'
                      }`}
                    >
                      {num}
                    </span>
                    {idx < numbers.length - 1 && (
                      <span className="text-slate-400 font-bold text-2xl px-0.5 select-none font-mono">+</span>
                    )}
                  </React.Fragment>
                ))}
                <span className="text-slate-400 font-bold text-2xl px-0.5 select-none font-mono">=</span>
                <span className="text-blue-600 font-mono font-bold text-2xl sm:text-3xl px-1">?</span>
              </div>

              {/* Mental Hint / Running Flow Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowBreakdown((prev) => !prev)}
                  className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/60 px-3 py-1 rounded-full transition border border-slate-200/80 font-medium cursor-pointer shadow-2xs"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>{showBreakdown ? 'Hide Mental Flow' : 'Running Flow (H)'}</span>
                </button>

                <AnimatePresence>
                  {showBreakdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="mt-2.5 max-w-lg mx-auto p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-mono leading-relaxed shadow-2xs"
                    >
                      <span className="text-blue-600 font-bold">Running Flow: </span>
                      {runningSteps.map((step, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-slate-400"> → </span>}
                          {idx === 0 ? (
                            <span className="font-semibold text-slate-800">{step.addend}</span>
                          ) : idx === runningSteps.length - 1 ? (
                            <strong className="text-emerald-700 font-bold underline">
                              +{step.addend} = {step.currentTotal}
                            </strong>
                          ) : (
                            <span>
                              +{step.addend} = <span className="font-semibold text-slate-800">{step.currentTotal}</span>
                            </span>
                          )}
                        </React.Fragment>
                      ))}
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
                    if (feedback !== 'idle') return;
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setUserInput(val);
                    if (val && parseInt(val, 10) === expectedSum) {
                      setFeedback('correct');
                      const newScore = roundScore + 1;
                      setRoundScore(newScore);
                      setTimeout(() => {
                        advanceNextQuestion(newScore);
                      }, 150);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (feedback !== 'idle') return;
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      checkAnswer();
                    } else if (e.key.toLowerCase() === 'h' && !userInput) {
                      e.preventDefault();
                      setShowBreakdown(prev => !prev);
                    }
                  }}
                  placeholder="Enter sum..."
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

      {/* Screen 3: Minimalist Scorecard */}
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

          {passedSet && selectedLevel < 10 && (
            <div className="text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1">
              <Unlock className="w-3.5 h-3.5" />
              <span>Level {selectedLevel + 1} Unlocked</span>
            </div>
          )}

          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => startNewSet(selectedLevel)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>

            {passedSet && selectedLevel < 10 && (
              <button
                onClick={() => {
                  setSelectedLevel(selectedLevel + 1);
                  startNewSet(selectedLevel + 1);
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
