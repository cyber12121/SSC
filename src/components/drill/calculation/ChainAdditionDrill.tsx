import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  Lock,
  Unlock,
  Trophy,
  ChevronRight,
  Flame,
  ArrowRight
} from 'lucide-react';
import {
  ADDITION_LEVELS,
  AdditionLevelConfig,
  loadAdditionProgress,
  saveAdditionProgress,
  ModuleProgress
} from './calculationLevelConfig';
import { ThoughtHopVisualizer } from './ThoughtHopVisualizer';

export const ChainAdditionDrill: React.FC = () => {
  const [progress, setProgress] = useState<ModuleProgress>(loadAdditionProgress);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [nodes, setNodes] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0 = start at node 0, step 1 = add node 1, etc.
  const [runningSum, setRunningSum] = useState<number>(0);
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showThoughtHop, setShowThoughtHop] = useState<boolean>(false);
  const [roundMistakes, setRoundMistakes] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  const activeLevelConfig: AdditionLevelConfig = useMemo(() => {
    return ADDITION_LEVELS.find(l => l.level === selectedLevel) || ADDITION_LEVELS[0];
  }, [selectedLevel]);

  // Generate random integers within level range
  const generateNewRound = () => {
    const { nodeCount, minVal, maxVal } = activeLevelConfig;
    const newNodes: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const val = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
      newNodes.push(val);
    }
    setNodes(newNodes);
    setCurrentStep(1); // step 1 is adding nodes[1] to nodes[0]
    setRunningSum(newNodes[0]);
    setUserInput('');
    setFeedback('idle');
    setShowThoughtHop(false);
    setRoundMistakes(0);
    setIsFinished(false);
    setElapsedTime(0);
    setIsRunning(true);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    generateNewRound();
  }, [selectedLevel]);

  // Timer logic (quiet stopwatch, no pressure)
  useEffect(() => {
    if (isRunning && !isFinished) {
      const startTime = Date.now() - elapsedTime * 1000;
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - startTime) / 100) / 10);
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, isFinished]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setUserInput(val);

    if (nodes.length === 0 || currentStep >= nodes.length) return;

    const expectedNextSum = runningSum + nodes[currentStep];
    const expectedStr = expectedNextSum.toString();

    // Check once the entered length matches the expected answer length
    if (val.length === expectedStr.length) {
      if (parseInt(val, 10) === expectedNextSum) {
        // Correct step!
        setFeedback('correct');
        const nextRunning = expectedNextSum;
        const nextStep = currentStep + 1;

        setTimeout(() => {
          setRunningSum(nextRunning);
          setUserInput('');
          setFeedback('idle');
          setShowThoughtHop(false);

          if (nextStep >= nodes.length) {
            // Round finished!
            setIsFinished(true);
            setIsRunning(false);

            // Handle progress & unlock
            handleRoundComplete(roundMistakes === 0);
          } else {
            setCurrentStep(nextStep);
          }
        }, 180);
      } else {
        // Incorrect step
        setFeedback('wrong');
        setRoundMistakes(prev => prev + 1);
        setShowThoughtHop(true);
      }
    }
  };

  const handleRoundComplete = (isFlawless: boolean) => {
    const currentStreak = isFlawless ? (progress.streakCount[selectedLevel] || 0) + 1 : 0;
    const bestTime = progress.bestTimes[selectedLevel]
      ? Math.min(progress.bestTimes[selectedLevel], elapsedTime)
      : elapsedTime;

    let newUnlocked = progress.unlockedLevel;
    // 3 flawless runs in a row unlocks next level
    if (currentStreak >= 3 && selectedLevel === progress.unlockedLevel && selectedLevel < 10) {
      newUnlocked = selectedLevel + 1;
    }

    const updated: ModuleProgress = {
      unlockedLevel: newUnlocked,
      streakCount: { ...progress.streakCount, [selectedLevel]: currentStreak },
      bestTimes: { ...progress.bestTimes, [selectedLevel]: bestTime }
    };

    setProgress(updated);
    saveAdditionProgress(updated);
  };

  const streakForActiveLevel = progress.streakCount[selectedLevel] || 0;

  // Trigonometric coordinate calculation for circular node positioning
  const radius = 120; // px
  const center = 150; // px

  return (
    <div className="w-full bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
      {/* 1. Level Navigation Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Chapter 1: Arun Sharma Chain Addition
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              Level {activeLevelConfig.level}: {activeLevelConfig.title}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {activeLevelConfig.nodeCount} Nodes
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-lg border border-amber-200 shadow-xs">
              <Flame className="w-4 h-4 fill-amber-500 text-amber-600" />
              <span>Streak: {streakForActiveLevel}/3</span>
            </div>
            <button
              onClick={generateNewRound}
              className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
              title="Reset Round"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Level Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {ADDITION_LEVELS.map(lvl => {
            const isUnlocked = lvl.level <= progress.unlockedLevel;
            const isCurrent = lvl.level === selectedLevel;
            return (
              <button
                key={lvl.level}
                onClick={() => isUnlocked && setSelectedLevel(lvl.level)}
                disabled={!isUnlocked}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
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
                <span className="hidden sm:inline text-[11px] font-medium opacity-90">
                  ({lvl.nodeCount}N)
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Drill Arena (Circular Ring & Input) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Circular Wheel View (Page 2 Diagram) */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs relative min-h-[340px]">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Running Accumulator Chain
          </div>

          <div className="relative w-[300px] h-[300px] flex items-center justify-center">
            {/* Center Hub: Current Running Total */}
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 flex flex-col items-center justify-center shadow-inner z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Running Sum
              </span>
              <span className="text-3xl font-black text-indigo-900 tracking-tight font-mono">
                {runningSum}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600">
                Step {currentStep} of {nodes.length - 1}
              </span>
            </div>

            {/* Circular Nodes */}
            {nodes.map((val, idx) => {
              const angle = (idx / nodes.length) * 2 * Math.PI - Math.PI / 2;
              const x = center + radius * Math.cos(angle) - 22;
              const y = center + radius * Math.sin(angle) - 22;

              const isStart = idx === 0;
              const isTarget = idx === currentStep;
              const isPassed = idx < currentStep;

              return (
                <div
                  key={idx}
                  style={{ left: `${x}px`, top: `${y}px` }}
                  className={`absolute w-11 h-11 rounded-full flex flex-col items-center justify-center text-xs font-black transition-all font-mono shadow-sm ${
                    isTarget
                      ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-300/60 scale-110 z-20 animate-pulse'
                      : isPassed
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : isStart
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white border-2 border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="leading-none">{val}</span>
                  {isTarget && (
                    <span className="text-[8px] uppercase tracking-tighter text-amber-900 font-bold leading-none mt-0.5">
                      +NEXT
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 text-center mt-3">
            Sequence: Add each clockwise node to your mental accumulator.
          </div>
        </div>

        {/* Right Pane: Interactive Input & Feedback */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          {!isFinished ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Next Calculation
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Stopwatch: {elapsedTime.toFixed(1)}s
                </span>
              </div>

              {/* Math Prompt Display */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-center gap-3 font-mono font-black text-2xl text-slate-800">
                <span className="text-blue-600">{runningSum}</span>
                <span className="text-slate-400">+</span>
                <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {nodes[currentStep]}
                </span>
                <span className="text-slate-400">=</span>
                <span className="text-slate-400">?</span>
              </div>

              {/* Big Clean Input */}
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={userInput}
                  onChange={handleInputChange}
                  placeholder="Type new total..."
                  className={`w-full text-center text-3xl font-black font-mono py-3 rounded-xl border-2 transition-all outline-none ${
                    feedback === 'correct'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800'
                      : feedback === 'wrong'
                      ? 'border-rose-500 bg-rose-50/50 text-rose-800'
                      : 'border-slate-300 focus:border-blue-600 text-slate-900'
                  }`}
                  autoFocus
                />
              </div>

              {/* On-screen Quick Numpad for Mobile / Click */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
                  <button
                    key={num}
                    onClick={() => {
                      const synthetic = {
                        target: { value: userInput + num.toString() }
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleInputChange(synthetic);
                    }}
                    className={`py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-bold text-base transition-colors shadow-xs ${
                      num === 0 ? 'col-span-3' : ''
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Expandable Ghost Thought Visualizer */}
              {showThoughtHop && (
                <div className="pt-2">
                  <ThoughtHopVisualizer
                    type="addition"
                    base={runningSum}
                    addend={nodes[currentStep]}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Round Completion Banner */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center space-y-4"
            >
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Trophy className="w-7 h-7" />
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                Round Finished! 🎉
              </h3>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Your Time</span>
                  <div className="text-xl font-mono font-bold text-slate-900 mt-0.5">
                    {elapsedTime.toFixed(1)}s
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Target: ≤ {activeLevelConfig.targetBenchmarkSec}s
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Accuracy</span>
                  <div className="text-xl font-mono font-bold text-slate-900 mt-0.5">
                    {roundMistakes === 0 ? '100% Flawless' : `${roundMistakes} Mistakes`}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {roundMistakes === 0 ? '+1 toward next level' : 'Streak reset'}
                  </span>
                </div>
              </div>

              {streakForActiveLevel >= 3 && selectedLevel < 10 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
                  <Unlock className="w-4 h-4 text-emerald-600" />
                  <span>Level {selectedLevel + 1} Unlocked! Awesome reflex mastery!</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={generateNewRound}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Next Round
                </button>
                {selectedLevel < progress.unlockedLevel && (
                  <button
                    onClick={() => setSelectedLevel(selectedLevel + 1)}
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
      </div>
    </div>
  );
};
