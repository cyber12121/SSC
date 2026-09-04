import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Maximize,
  Minimize,
  X,
  Sparkles,
  Zap,
  HelpCircle,
  RotateCcw,
  Check,
  Flame,
  BookOpen,
  Volume2,
  VolumeX,
  Grid,
  ChevronRight,
  ArrowRight,
  Target,
  ArrowLeft,
} from 'lucide-react';
import {
  CALC_SECTIONS,
  SectionId,
  CalculationQuestion,
  generateQuestionForSection,
} from '../../data/drills/calculationData';
import { CalculationCheatSheet } from './CalculationCheatSheet';
import { CalculationSummary, SectionStats } from './CalculationSummary';

interface Props {
  onClose?: () => void;
  initialMode?: 'routine' | 'free';
  initialSection?: SectionId;
}

const QUESTIONS_PER_SECTION_ROUTINE = 6; // 6 questions per section = 36 questions total in marathon

export const CalculationStudio: React.FC<Props> = ({
  onClose,
  initialMode = 'routine',
  initialSection = 'triplets',
}) => {
  // Mode: 'routine' (sequential 1 to 6) or 'free' (individual section)
  const [drillMode, setDrillMode] = useState<'routine' | 'free'>(initialMode);
  const [activeSectionId, setActiveSectionId] = useState<SectionId>(initialSection);
  const [routineSectionIndex, setRoutineSectionIndex] = useState<number>(0);
  const [routineSectionQCount, setRoutineSectionQCount] = useState<number>(0);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Cheat Sheet Modal
  const [showCheatSheet, setShowCheatSheet] = useState<boolean>(false);

  // On-screen Numpad
  const [showNumpad, setShowNumpad] = useState<boolean>(false);

  // Sound effects
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Stats & timing
  const [statsBySection, setStatsBySection] = useState<Record<SectionId, SectionStats>>({
    triplets: { correct: 0, total: 0 },
    tables: { correct: 0, total: 0 },
    squares: { correct: 0, total: 0 },
    cubes: { correct: 0, total: 0 },
    powers: { correct: 0, total: 0 },
    factorials: { correct: 0, total: 0 },
  });
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Question & input state
  const [question, setQuestion] = useState<CalculationQuestion | null>(null);
  const [inputVal, setInputVal] = useState<string>('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [revealed, setRevealed] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine current active section depending on mode
  const currentSection =
    drillMode === 'routine' ? CALC_SECTIONS[routineSectionIndex] : CALC_SECTIONS.find((s) => s.id === activeSectionId)!;

  // Simple Web Audio API beeps
  const playAudioTone = useCallback(
    (type: 'correct' | 'wrong' | 'complete') => {
      if (!soundEnabled) return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === 'correct') {
          osc.frequency.setValueAtTime(587.33, now); // D5
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
        } else if (type === 'wrong') {
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.setValueAtTime(180, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
        } else if (type === 'complete') {
          osc.frequency.setValueAtTime(523.25, now); // C5
          osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
          osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        }
      } catch {
        // Ignore audio playback errors if user hasn't interacted
      }
    },
    [soundEnabled]
  );

  // Generate question for current section
  const loadNextQuestion = useCallback(
    (targetSection?: SectionId) => {
      const secId = targetSection || currentSection.id;
      const q = generateQuestionForSection(secId);
      setQuestion(q);
      setInputVal('');
      setFeedback(null);
      setRevealed(false);
    },
    [currentSection]
  );

  // Initialize first problem
  useEffect(() => {
    loadNextQuestion(currentSection.id);
  }, [drillMode, routineSectionIndex, activeSectionId]);

  // Keep focus on input
  useEffect(() => {
    if (!isFinished) {
      inputRef.current?.focus();
    }
  }, [question, isFinished]);

  // Elapsed timer
  useEffect(() => {
    if (isFinished) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isFinished]);

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Format timer
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Progression logic
  const handleCorrectSubmission = () => {
    if (!question) return;
    playAudioTone('correct');
    setFeedback('correct');

    // Update section stats
    setStatsBySection((prev) => ({
      ...prev,
      [question.section]: {
        correct: prev[question.section].correct + 1,
        total: prev[question.section].total + 1,
      },
    }));

    setStreak((prev) => {
      const next = prev + 1;
      if (next > bestStreak) setBestStreak(next);
      return next;
    });

    setTimeout(() => {
      if (drillMode === 'routine') {
        const nextQCount = routineSectionQCount + 1;
        if (nextQCount >= QUESTIONS_PER_SECTION_ROUTINE) {
          // Advance to next section in routine
          const nextSecIdx = routineSectionIndex + 1;
          if (nextSecIdx >= CALC_SECTIONS.length) {
            // Completed all 6 steps!
            playAudioTone('complete');
            setIsFinished(true);
          } else {
            setRoutineSectionIndex(nextSecIdx);
            setRoutineSectionQCount(0);
          }
        } else {
          setRoutineSectionQCount(nextQCount);
          loadNextQuestion(CALC_SECTIONS[routineSectionIndex].id);
        }
      } else {
        loadNextQuestion(activeSectionId);
      }
    }, 160);
  };

  const handleWrongSubmission = () => {
    if (!question) return;
    playAudioTone('wrong');
    setFeedback('wrong');
    setStreak(0);
    setStatsBySection((prev) => ({
      ...prev,
      [question.section]: {
        correct: prev[question.section].correct,
        total: prev[question.section].total + 1,
      },
    }));

    setTimeout(() => {
      setFeedback(null);
    }, 450);
  };

  const handleSkipOrReveal = () => {
    if (!question) return;
    setRevealed(true);
    setStreak(0);
    setStatsBySection((prev) => ({
      ...prev,
      [question.section]: {
        correct: prev[question.section].correct,
        total: prev[question.section].total + 1,
      },
    }));
  };

  const handleAdvanceAfterReveal = () => {
    if (drillMode === 'routine') {
      const nextQCount = routineSectionQCount + 1;
      if (nextQCount >= QUESTIONS_PER_SECTION_ROUTINE) {
        const nextSecIdx = routineSectionIndex + 1;
        if (nextSecIdx >= CALC_SECTIONS.length) {
          playAudioTone('complete');
          setIsFinished(true);
        } else {
          setRoutineSectionIndex(nextSecIdx);
          setRoutineSectionQCount(0);
        }
      } else {
        setRoutineSectionQCount(nextQCount);
        loadNextQuestion(CALC_SECTIONS[routineSectionIndex].id);
      }
    } else {
      loadNextQuestion(activeSectionId);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!/^\d*$/.test(val)) return;
    setInputVal(val);

    if (!question || val === '') return;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num === question.answer) {
      handleCorrectSubmission();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!question || inputVal.trim() === '') return;
      const num = parseInt(inputVal.trim(), 10);
      if (num === question.answer) {
        handleCorrectSubmission();
      } else {
        handleWrongSubmission();
      }
    } else if (e.key === 'Escape') {
      if (showCheatSheet) {
        setShowCheatSheet(false);
      } else if (onClose) {
        onClose();
      }
    }
  };

  // Numpad input helper
  const handleNumpadPress = (char: string) => {
    if (char === 'clear') {
      setInputVal('');
      inputRef.current?.focus();
    } else if (char === 'backspace') {
      const nextVal = inputVal.slice(0, -1);
      setInputVal(nextVal);
      inputRef.current?.focus();
    } else if (char === 'enter') {
      if (!question || inputVal === '') return;
      const num = parseInt(inputVal, 10);
      if (num === question.answer) {
        handleCorrectSubmission();
      } else {
        handleWrongSubmission();
      }
    } else {
      const nextVal = inputVal + char;
      setInputVal(nextVal);
      if (question) {
        const num = parseInt(nextVal, 10);
        if (num === question.answer) {
          handleCorrectSubmission();
        }
      }
      inputRef.current?.focus();
    }
  };

  const restartRoutine = () => {
    setRoutineSectionIndex(0);
    setRoutineSectionQCount(0);
    setElapsedSeconds(0);
    setStreak(0);
    setIsFinished(false);
    setStatsBySection({
      triplets: { correct: 0, total: 0 },
      tables: { correct: 0, total: 0 },
      squares: { correct: 0, total: 0 },
      cubes: { correct: 0, total: 0 },
      powers: { correct: 0, total: 0 },
      factorials: { correct: 0, total: 0 },
    });
    setDrillMode('routine');
    loadNextQuestion('triplets');
  };

  const switchToIndividualSection = (secId: SectionId) => {
    setDrillMode('free');
    setActiveSectionId(secId);
    setIsFinished(false);
    loadNextQuestion(secId);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 bg-slate-900 text-slate-100 flex flex-col overflow-hidden select-none font-sans"
    >
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md">
        {/* Left: Branding & Mode Switcher */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white shadow-md shadow-blue-500/20">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-black text-sm text-white tracking-tight">Calculation Studio</span>
              <span className="text-[10px] text-blue-400 font-bold block uppercase tracking-wider">Speed Workout</span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800" />

          {/* Mode Pill Toggle */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setDrillMode('routine');
                setRoutineSectionIndex(0);
                setRoutineSectionQCount(0);
                loadNextQuestion('triplets');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                drillMode === 'routine'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Daily Routine
            </button>
            <button
              onClick={() => {
                setDrillMode('free');
                loadNextQuestion(activeSectionId);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                drillMode === 'free'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Section Focus
            </button>
          </div>
        </div>

        {/* Center: Live Workout Metrics */}
        <div className="hidden md:flex items-center space-x-6 text-xs font-bold">
          <div className="flex items-center text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-xl border border-amber-400/20">
            <Flame className="w-4 h-4 mr-1.5 fill-amber-400" />
            <span>{streak} Streak</span>
          </div>
          <div className="text-slate-400 font-mono">
            Time: <span className="text-white font-bold">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Right: Controls & Exit */}
        <div className="flex items-center space-x-2">
          {/* Reference Cheat Sheet Button */}
          <button
            onClick={() => setShowCheatSheet(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors border border-slate-700/60"
            title="Open Formula / Number Reference Sheet"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Cheat Sheet</span>
          </button>

          {/* Audio toggle */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`p-2 rounded-xl border transition-colors ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-blue-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Numpad toggle */}
          <button
            onClick={() => setShowNumpad((prev) => !prev)}
            className={`p-2 rounded-xl border transition-colors ${
              showNumpad
                ? 'bg-slate-800 border-slate-700 text-blue-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle On-Screen Numeric Keypad"
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Native Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Native Fullscreen' : 'Enter Native Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Exit Calculation Studio */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
              title="Exit Workout Studio (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Routine Progress / Section Tabs Subheader */}
      <div className="px-4 sm:px-6 py-2.5 bg-slate-950 border-b border-slate-800/60 overflow-x-auto scrollbar-none">
        {drillMode === 'routine' ? (
          <div className="flex items-center space-x-2 sm:space-x-4">
            {CALC_SECTIONS.map((sec, idx) => {
              const isCurrent = idx === routineSectionIndex;
              const isCompleted = idx < routineSectionIndex;
              return (
                <div
                  key={sec.id}
                  className={`flex items-center whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                      : isCompleted
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-600'
                  }`}
                >
                  <span className="mr-1.5 opacity-60">{sec.badge}</span>
                  <span>{sec.shortTitle}</span>
                  {isCompleted && <Check className="w-3 h-3 ml-1.5 text-emerald-400" />}
                  {isCurrent && (
                    <span className="ml-2 text-[10px] bg-blue-500 text-white px-1.5 py-0.2 rounded-full">
                      {routineSectionQCount + 1}/{QUESTIONS_PER_SECTION_ROUTINE}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            {CALC_SECTIONS.map((sec) => {
              const isSelected = activeSectionId === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => switchToIndividualSection(sec.id)}
                  className={`flex items-center whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{sec.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Studio Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-y-auto">
        {isFinished ? (
          <CalculationSummary
            statsBySection={statsBySection}
            totalSeconds={elapsedSeconds}
            onRestartRoutine={restartRoutine}
            onPracticeSection={(secId) => switchToIndividualSection(secId)}
            onExit={() => (onClose ? onClose() : restartRoutine())}
          />
        ) : (
          <div className="w-full max-w-xl mx-auto flex flex-col items-center">
            {/* Section Tag Badge */}
            <div className="mb-4 inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-bold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>{currentSection.title}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{currentSection.description}</span>
            </div>

            {/* Flashcard Box */}
            <div
              className={`w-full bg-slate-950/90 rounded-3xl p-6 sm:p-10 border transition-all duration-200 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center ${
                feedback === 'correct'
                  ? 'border-emerald-500 bg-emerald-950/20 ring-4 ring-emerald-500/20'
                  : feedback === 'wrong'
                  ? 'border-rose-500 bg-rose-950/20 ring-4 ring-rose-500/20 animate-shake'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Question Subtitle / Prompt Info */}
              {question?.subPrompt && (
                <div className="text-slate-400 text-xs sm:text-sm font-semibold tracking-wide uppercase mb-3">
                  {question.subPrompt}
                </div>
              )}

              {/* Big Math Prompt */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={question?.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.12 }}
                  className="text-4xl sm:text-6xl font-black text-white tracking-tight mb-8 text-center"
                >
                  {question?.prompt}
                </motion.div>
              </AnimatePresence>

              {/* Input Area */}
              <div className="w-full max-w-xs relative mb-4">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inputVal}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type answer..."
                  autoFocus
                  disabled={revealed}
                  className={`w-full py-3.5 px-4 text-center text-2xl sm:text-3xl font-black rounded-2xl bg-slate-900 border-2 transition-all outline-none ${
                    feedback === 'correct'
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                      : feedback === 'wrong'
                      ? 'border-rose-500 text-rose-400 bg-rose-950/30'
                      : 'border-slate-700 focus:border-blue-500 text-white placeholder:text-slate-600'
                  }`}
                />
              </div>

              {/* Revealed Solution Card */}
              {revealed && question && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full p-4 rounded-2xl bg-slate-900/90 border border-slate-800 mb-4 text-center"
                >
                  <div className="text-xs text-slate-400 font-bold uppercase mb-1">Answer</div>
                  <div className="text-2xl font-black text-emerald-400 mb-1">{question.answer}</div>
                  {question.explanation && (
                    <div className="text-xs text-slate-300 font-medium">{question.explanation}</div>
                  )}
                  <button
                    onClick={handleAdvanceAfterReveal}
                    className="mt-3 inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <span>Next Problem</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}

              {/* Skip / Reveal / Enter Hint */}
              {!revealed && (
                <div className="flex items-center justify-between w-full text-xs text-slate-500 px-2 mt-2">
                  <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">Enter</kbd> to submit</span>
                  <button
                    onClick={handleSkipOrReveal}
                    className="text-slate-400 hover:text-amber-400 font-bold underline transition-colors"
                  >
                    Reveal Answer
                  </button>
                </div>
              )}
            </div>

            {/* Optional On-Screen Numeric Keypad */}
            {showNumpad && (
              <div className="mt-6 w-full max-w-xs bg-slate-950 p-3 rounded-2xl border border-slate-800 shadow-xl grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleNumpadPress(btn)}
                    className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-lg active:scale-95 transition-all border border-slate-800/80 flex items-center justify-center"
                  >
                    {btn === 'clear' ? (
                      <span className="text-xs text-slate-400">C</span>
                    ) : btn === 'backspace' ? (
                      <span className="text-xs text-slate-400">⌫</span>
                    ) : (
                      btn
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Quick Reference Modal */}
      <CalculationCheatSheet
        isOpen={showCheatSheet}
        onClose={() => setShowCheatSheet(false)}
        initialSection={currentSection.id}
      />
    </div>
  );
};
