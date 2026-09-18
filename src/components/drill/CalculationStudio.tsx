import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Maximize,
  Minimize,
  X,
  Sparkles,
  Zap,
  RotateCcw,
  Check,
  Flame,
  BookOpen,
  Volume2,
  VolumeX,
  Grid,
  ArrowRight,
  Target,
  AlertCircle,
  Repeat,
  Trophy,
  ChevronLeft,
} from 'lucide-react';
import {
  CALC_SECTIONS,
  SectionId,
  CalculationQuestion,
  generateExhaustiveDeckForSection,
} from '../../data/drills/calculationData';
import { CalculationCheatSheet } from './CalculationCheatSheet';
import { CalculationSummary, SectionStats } from './CalculationSummary';

interface Props {
  onClose?: () => void;
  initialMode?: 'routine' | 'free';
  initialSection?: SectionId;
}

interface RepeatItem {
  question: CalculationQuestion;
  remainingRepeats: number; // 3 to 1
  delay: number; // steps before re-asking
}

export const CalculationStudio: React.FC<Props> = ({
  onClose,
  initialMode = 'routine',
  initialSection = 'triplets',
}) => {
  // Mode: 'routine' (sequential 1 to 6) or 'free' (individual section)
  const [drillMode, setDrillMode] = useState<'routine' | 'free'>(initialMode);
  const [activeSectionId, setActiveSectionId] = useState<SectionId>(initialSection);
  const [routineSectionIndex, setRoutineSectionIndex] = useState<number>(0);

  // Decks & Repetition Queues
  const [deck, setDeck] = useState<CalculationQuestion[]>([]);
  const [initialDeckSize, setInitialDeckSize] = useState<number>(1);
  const [repeatQueue, setRepeatQueue] = useState<RepeatItem[]>([]);
  const [activeRepeatItem, setActiveRepeatItem] = useState<RepeatItem | null>(null);

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
    fractions: { correct: 0, total: 0 },
  });
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Question & input state
  const [currentQuestion, setCurrentQuestion] = useState<CalculationQuestion | null>(null);
  const [inputVal, setInputVal] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [wrongAttempts, setWrongAttempts] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Current active section metadata
  const currentSection =
    drillMode === 'routine' ? CALC_SECTIONS[routineSectionIndex] : CALC_SECTIONS.find((s) => s.id === activeSectionId)!;

  // Sound generator
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
        // Audio context may be restricted before interaction
      }
    },
    [soundEnabled]
  );

  const startTimeRef = useRef<number>(Date.now());

  // Initialize or transition section
  const initSection = useCallback((secId: SectionId) => {
    const fullDeck = generateExhaustiveDeckForSection(secId);
    setInitialDeckSize(fullDeck.length);
    setRepeatQueue([]);
    setActiveRepeatItem(null);
    setInputVal('');
    setFeedback(null);
    setRevealed(false);
    setWrongAttempts(0);
    setElapsedSeconds(0);
    startTimeRef.current = Date.now();

    // Pick first question
    const firstQ = fullDeck[0];
    const remainingDeck = fullDeck.slice(1);
    setDeck(remainingDeck);
    setCurrentQuestion(firstQ);
  }, []);

  // When section or drill mode changes, initialize section
  useEffect(() => {
    initSection(currentSection.id);
  }, [drillMode, routineSectionIndex, activeSectionId, initSection]);

  // Keep focus on input and ensure clean input state on question change
  useEffect(() => {
    if (!isFinished) {
      setInputVal('');
      setSelectedOption(null);
      setFeedback(null);
      if (inputRef.current) inputRef.current.value = '';
      inputRef.current?.focus();
    }
  }, [currentQuestion?.id, isFinished]);

  // Timer
  useEffect(() => {
    if (isFinished) return;
    startTimeRef.current = Date.now() - elapsedSeconds * 1000;
    const interval = setInterval(() => {
      const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(sec);
    }, 500);
    return () => clearInterval(interval);
  }, [isFinished]);

  // Fullscreen handling
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Pull next question considering exhaustive deck and 3x mistake repetition queue
  const nextQuestion = (
    currentDeck: CalculationQuestion[],
    currentQueue: RepeatItem[],
    prevAnswerWasCorrect: boolean,
    prevRepeatItem: RepeatItem | null,
    prevQuestion: CalculationQuestion
  ) => {
    setInputVal('');
    setSelectedOption(null);
    setFeedback(null);
    setRevealed(false);
    setWrongAttempts(0);
    if (inputRef.current) inputRef.current.value = '';

    let updatedQueue = [...currentQueue];

    // Decrement delay on pending repeats
    updatedQueue = updatedQueue.map((item) => ({
      ...item,
      delay: Math.max(0, item.delay - 1),
    }));

    if (prevAnswerWasCorrect) {
      if (prevRepeatItem) {
        // Decrement repeat count
        const newRem = prevRepeatItem.remainingRepeats - 1;
        if (newRem <= 0) {
          // Cleared from queue!
          updatedQueue = updatedQueue.filter((it) => it.question.rawKey !== prevRepeatItem.question.rawKey);
        } else {
          // Keep in queue with delay = 1
          updatedQueue = updatedQueue.map((it) =>
            it.question.rawKey === prevRepeatItem.question.rawKey
              ? { ...it, remainingRepeats: newRem, delay: 1 }
              : it
          );
        }
      }
    } else {
      // Prev answer was WRONG or revealed:
      // Must repeat 3 times!
      const existingIdx = updatedQueue.findIndex((it) => it.question.rawKey === prevQuestion.rawKey);
      if (existingIdx >= 0) {
        // Reset remaining repeats to 3
        updatedQueue[existingIdx] = {
          ...updatedQueue[existingIdx],
          remainingRepeats: 3,
          delay: 1,
        };
      } else {
        // Add new repeat entry
        updatedQueue.push({
          question: prevQuestion,
          remainingRepeats: 3,
          delay: 1,
        });
      }
    }

    setRepeatQueue(updatedQueue);

    // Now decide which question to present next:
    // 1. Ready repeat item (delay === 0)
    const readyRepeatIdx = updatedQueue.findIndex((it) => it.delay === 0);

    // If deck has items and there's a ready repeat item:
    // Interleave: show repeat item with 50% probability, or 100% if deck is empty
    if (readyRepeatIdx >= 0 && (currentDeck.length === 0 || Math.random() < 0.6)) {
      const chosenRepeat = updatedQueue[readyRepeatIdx];
      setActiveRepeatItem(chosenRepeat);
      setCurrentQuestion(chosenRepeat.question);
      return;
    }

    // 2. Next item from deck
    if (currentDeck.length > 0) {
      const [nextQ, ...restDeck] = currentDeck;
      setDeck(restDeck);
      setActiveRepeatItem(null);
      setCurrentQuestion(nextQ);
      return;
    }

    // 3. If deck is empty, check if any repeat items remain (even with delay > 0)
    if (updatedQueue.length > 0) {
      const chosenRepeat = updatedQueue[0];
      setActiveRepeatItem(chosenRepeat);
      setCurrentQuestion(chosenRepeat.question);
      return;
    }

    // 4. Deck is empty AND repeat queue is empty => SECTION COMPLETED!
    playAudioTone('complete');

    if (drillMode === 'routine') {
      const nextSecIdx = routineSectionIndex + 1;
      if (nextSecIdx >= CALC_SECTIONS.length) {
        // Completed all 6 steps!
        setIsFinished(true);
      } else {
        setRoutineSectionIndex(nextSecIdx);
      }
    } else {
      // In free mode, restart deck or offer review
      initSection(activeSectionId);
    }
  };

  // Correct submission
  const handleCorrect = () => {
    if (!currentQuestion || feedback !== null) return;
    playAudioTone('correct');
    setFeedback('correct');
    setWrongAttempts(0);

    setStatsBySection((prev) => ({
      ...prev,
      [currentQuestion.section]: {
        correct: prev[currentQuestion.section].correct + 1,
        total: prev[currentQuestion.section].total + 1,
      },
    }));

    setStreak((prev) => {
      const next = prev + 1;
      if (next > bestStreak) setBestStreak(next);
      return next;
    });

    const activeRepeatCopy = activeRepeatItem;
    const currentQCopy = currentQuestion;
    const currentDeckCopy = deck;
    const currentQueueCopy = repeatQueue;

    setTimeout(() => {
      nextQuestion(currentDeckCopy, currentQueueCopy, true, activeRepeatCopy, currentQCopy);
    }, 160);
  };

  // Wrong submission
  const handleWrong = () => {
    if (!currentQuestion || feedback === 'correct') return;
    playAudioTone('wrong');
    setFeedback('wrong');
    setStreak(0);

    setStatsBySection((prev) => ({
      ...prev,
      [currentQuestion.section]: {
        correct: prev[currentQuestion.section].correct,
        total: prev[currentQuestion.section].total + 1,
      },
    }));

    const nextAttempts = wrongAttempts + 1;
    setWrongAttempts(nextAttempts);

    if (nextAttempts >= 3) {
      // Show/reveal answer on 3rd wrong attempt
      handleReveal();
    } else {
      // Clear wrong input and remove wrong feedback so user can retry
      setTimeout(() => {
        setFeedback(null);
        setInputVal('');
        setSelectedOption(null);
        if (inputRef.current) {
          inputRef.current.value = '';
          inputRef.current.focus();
        }
      }, 400);
    }
  };

  // Skip or reveal answer
  const handleReveal = () => {
    if (!currentQuestion) return;
    setRevealed(true);
    setStreak(0);

    setStatsBySection((prev) => ({
      ...prev,
      [currentQuestion.section]: {
        correct: prev[currentQuestion.section].correct,
        total: prev[currentQuestion.section].total + 1,
      },
    }));
  };

  // Handle option selection for multiple-choice questions (e.g. fractions)
  const handleSelectOption = (chosen: string) => {
    if (!currentQuestion || revealed || feedback !== null) return;
    setSelectedOption(chosen);
    if (chosen === String(currentQuestion.answer)) {
      handleCorrect();
    } else {
      handleWrong();
    }
  };

  // Keyboard shortcut listener for option questions (1, 2, 3, 4)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (isFinished || revealed || feedback !== null) return;
      if (currentQuestion?.options && currentQuestion.options.length > 0) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          const idx = parseInt(e.key, 10) - 1;
          if (currentQuestion.options[idx]) {
            handleSelectOption(currentQuestion.options[idx]);
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [currentQuestion, isFinished, revealed, feedback]);

  const handleAdvanceAfterReveal = () => {
    if (!currentQuestion) return;
    const activeRepeatCopy = activeRepeatItem;
    const currentQCopy = currentQuestion;
    const currentDeckCopy = deck;
    const currentQueueCopy = repeatQueue;

    nextQuestion(currentDeckCopy, currentQueueCopy, false, activeRepeatCopy, currentQCopy);
  };

  const checkIsAnswerMatch = (input: string, target: number | string): boolean => {
    const clean = input.trim();
    if (!clean) return false;
    const targetStr = String(target).trim();
    if (clean.toLowerCase() === targetStr.toLowerCase()) return true;
    const num = parseInt(clean, 10);
    const targetNum = typeof target === 'number' ? target : Number(targetStr);
    return !isNaN(num) && !isNaN(targetNum) && num === targetNum;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (feedback === 'correct' || revealed) return;
    if (feedback === 'wrong') setFeedback(null);
    const val = e.target.value;
    setInputVal(val);

    if (!currentQuestion) return;
    if (checkIsAnswerMatch(val, currentQuestion.answer)) {
      handleCorrect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (feedback === 'correct' || revealed) return;
    if (feedback === 'wrong' && e.key !== 'Enter') setFeedback(null);
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!currentQuestion || inputVal.trim() === '') return;
      if (checkIsAnswerMatch(inputVal, currentQuestion.answer)) {
        handleCorrect();
      } else {
        handleWrong();
      }
    } else if (e.key === 'Escape') {
      if (showCheatSheet) {
        setShowCheatSheet(false);
      } else if (onClose) {
        onClose();
      }
    }
  };

  const handleNumpadPress = (char: string) => {
    if (feedback === 'correct' || revealed) return;
    if (feedback === 'wrong') setFeedback(null);
    if (char === 'clear') {
      setInputVal('');
      if (inputRef.current) inputRef.current.value = '';
      inputRef.current?.focus();
    } else if (char === 'backspace') {
      const nextVal = inputVal.slice(0, -1);
      setInputVal(nextVal);
      inputRef.current?.focus();
    } else {
      const nextVal = inputVal + char;
      setInputVal(nextVal);
      if (currentQuestion && checkIsAnswerMatch(nextVal, currentQuestion.answer)) {
        handleCorrect();
      }
      inputRef.current?.focus();
    }
  };

  const restartRoutine = () => {
    setRoutineSectionIndex(0);
    setElapsedSeconds(0);
    startTimeRef.current = Date.now();
    setStreak(0);
    setIsFinished(false);
    setStatsBySection({
      triplets: { correct: 0, total: 0 },
      tables: { correct: 0, total: 0 },
      squares: { correct: 0, total: 0 },
      cubes: { correct: 0, total: 0 },
      powers: { correct: 0, total: 0 },
      factorials: { correct: 0, total: 0 },
      fractions: { correct: 0, total: 0 },
    });
    setDrillMode('routine');
  };

  const switchToIndividualSection = (secId: SectionId) => {
    setDrillMode('free');
    setActiveSectionId(secId);
    setIsFinished(false);
  };

  // Progress metrics
  const answeredDeckCount = initialDeckSize - deck.length;
  const remainingInDeck = deck.length;
  const pendingMistakes = repeatQueue.length;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 bg-slate-50 text-slate-900 flex flex-col overflow-hidden select-none font-sans"
    >
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white/95 border-b border-slate-200/90 backdrop-blur-md shadow-2xs">
        {/* Left: Back Button, Branding & Mode Switcher */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {onClose && (
            <button
              onClick={onClose}
              type="button"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 bg-white transition text-xs font-semibold cursor-pointer shadow-2xs"
              title="Back to Drill Hub"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}

          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-xs">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-sm text-slate-900 tracking-tight">Calculation Studio</span>
              <span className="text-[10px] text-blue-600 font-semibold block uppercase tracking-wider">
                Full Screen Drill
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-200" />

          {/* Mode Pill Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => {
                setDrillMode('routine');
                setRoutineSectionIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                drillMode === 'routine'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Routine
            </button>
            <button
              onClick={() => {
                setDrillMode('free');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                drillMode === 'free'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Section Focus
            </button>
          </div>
        </div>

        {/* Center: Live Workout Metrics */}
        <div className="hidden md:flex items-center space-x-6 text-xs font-bold">
          <div className="flex items-center text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
            <Flame className="w-4 h-4 mr-1.5 fill-amber-500 text-amber-500" />
            <span>{streak} Streak</span>
          </div>

          <div className="text-slate-400 font-mono">
            Time: <span className="text-slate-900 font-bold">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Right: Controls & Exit */}
        <div className="flex items-center space-x-2">
          {/* Reference Cheat Sheet Button */}
          <button
            onClick={() => setShowCheatSheet(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 text-xs font-bold transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="Open Formula / Number Reference Sheet"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Cheat Sheet</span>
          </button>

          {/* Audio toggle */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
            }`}
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Numpad toggle */}
          <button
            onClick={() => setShowNumpad((prev) => !prev)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              showNumpad
                ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="Toggle On-Screen Numeric Keypad"
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Native Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title={isFullscreen ? 'Exit Native Fullscreen' : 'Enter Native Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Exit Calculation Studio */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors shadow-2xs cursor-pointer"
              title="Exit Workout Studio (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Routine Progress / Section Tabs Subheader */}
      <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between overflow-x-auto scrollbar-none gap-4 shadow-2xs">
        {drillMode === 'routine' ? (
          <div className="flex items-center space-x-2 sm:space-x-3">
            {CALC_SECTIONS.map((sec, idx) => {
              const isCurrent = idx === routineSectionIndex;
              const isCompleted = idx < routineSectionIndex;
              return (
                <div
                  key={sec.id}
                  className={`flex items-center whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'text-slate-400'
                  }`}
                >
                  <span className="mr-1.5 opacity-60">{sec.badge}</span>
                  <span>{sec.shortTitle}</span>
                  {isCompleted && <Check className="w-3 h-3 ml-1.5 text-emerald-600" />}
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
                  className={`flex items-center whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <span>{sec.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Section Live Counters */}
        <div className="flex items-center space-x-3 text-xs font-bold whitespace-nowrap">
          <span className="text-slate-500">
            Covered: <strong className="text-slate-900">{answeredDeckCount}</strong>/{initialDeckSize}
          </span>
          {pendingMistakes > 0 && (
            <span className="flex items-center text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
              <Repeat className="w-3 h-3 mr-1 text-amber-600" />
              {pendingMistakes} mistake{pendingMistakes > 1 ? 's' : ''} (repeating 3×)
            </span>
          )}
        </div>
      </div>

      {/* Main Studio Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-y-auto bg-slate-50">
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
            {/* Header info / mistake repetition notice */}
            {activeRepeatItem ? (
              <div className="mb-4 inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-black text-amber-800 animate-pulse shadow-2xs">
                <Repeat className="w-3.5 h-3.5 text-amber-600" />
                <span>Mistake Drill: Repeat ({activeRepeatItem.remainingRepeats} of 3 remaining)</span>
              </div>
            ) : (
              <div className="mb-4 inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>{currentSection.title}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">
                  {remainingInDeck} number{remainingInDeck !== 1 ? 's' : ''} remaining
                </span>
              </div>
            )}

            {/* Flashcard Box */}
            <div
              className={`w-full bg-white rounded-3xl p-6 sm:p-10 border transition-all duration-200 shadow-sm relative overflow-hidden flex flex-col items-center justify-center ${
                feedback === 'correct'
                  ? 'border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-50'
                  : feedback === 'wrong'
                  ? 'border-rose-400 bg-rose-50/50 ring-4 ring-rose-50 animate-shake'
                  : activeRepeatItem
                  ? 'border-amber-300 bg-amber-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Question Subtitle */}
              {currentQuestion?.subPrompt && (
                <div className="text-slate-400 text-xs sm:text-sm font-semibold tracking-wide uppercase mb-3">
                  {currentQuestion.subPrompt}
                </div>
              )}

              {/* Big Math Prompt */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestion?.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.12 }}
                  className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight mb-8 text-center"
                >
                  {currentQuestion?.prompt}
                </motion.div>
              </AnimatePresence>

              {/* Input Area or Option Selection Area */}
              {currentQuestion?.options && currentQuestion.options.length > 0 ? (
                <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOption === opt;
                    const isCorrectOpt = opt === String(currentQuestion.answer);
                    const showCorrectHighlight = revealed && isCorrectOpt;
                    const showWrongHighlight = isSelected && feedback === 'wrong';
                    const showSuccessHighlight = isSelected && feedback === 'correct';

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectOption(opt)}
                        disabled={revealed || feedback !== null}
                        className={`p-3.5 rounded-2xl border-2 text-left font-bold transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                          showSuccessHighlight || showCorrectHighlight
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100'
                            : showWrongHighlight
                            ? 'border-rose-400 bg-rose-50 text-rose-800 ring-2 ring-rose-100'
                            : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-800 hover:border-blue-500'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                              showSuccessHighlight || showCorrectHighlight
                                ? 'bg-emerald-500 text-white'
                                : showWrongHighlight
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-base sm:text-lg">{opt}</span>
                        </div>
                        {showSuccessHighlight || showCorrectHighlight ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
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
                    className={`w-full py-3.5 px-4 text-center text-2xl sm:text-3xl font-black rounded-2xl bg-white border-2 transition-all outline-none shadow-xs ${
                      feedback === 'correct'
                        ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                        : feedback === 'wrong'
                        ? 'border-rose-400 text-rose-700 bg-rose-50'
                        : 'border-slate-300 focus:border-blue-600 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              )}

              {/* Revealed Solution Card */}
              {revealed && currentQuestion && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-4 text-center shadow-xs"
                >
                  <div className="text-xs text-slate-500 font-bold uppercase mb-1">Correct Answer</div>
                  <div className="text-2xl font-black text-emerald-600 mb-1">{currentQuestion.answer}</div>
                  {currentQuestion.explanation && (
                    <div className="text-xs text-slate-600 font-medium">{currentQuestion.explanation}</div>
                  )}
                  <p className="text-[11px] text-amber-700 font-bold mt-2">
                    ⚠️ Marked for repetition: will be repeated 3 times until mastered.
                  </p>
                  <button
                    onClick={handleAdvanceAfterReveal}
                    className="mt-3 inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    <span>Next Problem</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}

              {/* Skip / Reveal / Enter Hint */}
              {!revealed && (
                <div className="flex items-center justify-between w-full text-xs text-slate-500 px-2 mt-2">
                  <span>
                    {currentQuestion?.options && currentQuestion.options.length > 0 ? (
                      <>
                        Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px]">1</kbd>–<kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px]">4</kbd> or click option
                      </>
                    ) : (
                      <>
                        Press{' '}
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px]">
                          Enter
                        </kbd>{' '}
                        to submit
                      </>
                    )}
                  </span>
                  <button
                    onClick={handleReveal}
                    className="text-slate-500 hover:text-amber-600 font-bold underline transition-colors cursor-pointer"
                  >
                    Reveal Answer (Repeat 3×)
                  </button>
                </div>
              )}
            </div>

            {/* Optional On-Screen Numeric Keypad */}
            {showNumpad && !currentQuestion?.options && (
              <div className="mt-6 w-full max-w-xs bg-white p-3 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleNumpadPress(btn)}
                    className="py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-lg active:scale-95 transition-all border border-slate-200 flex items-center justify-center cursor-pointer"
                  >
                    {btn === 'clear' ? (
                      <span className="text-xs text-slate-500">C</span>
                    ) : btn === 'backspace' ? (
                      <span className="text-xs text-slate-500">⌫</span>
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

      {/* Bottom Shortcut Hints Bar */}
      <footer className="px-4 sm:px-6 py-2.5 bg-white border-t border-slate-200 text-center text-xs text-slate-500 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <span>
            Press <span className="font-mono text-slate-700 font-bold">Enter ↵</span> to Submit
          </span>
          <span>•</span>
          <span>
            Press <span className="font-mono text-slate-700 font-bold">Esc</span> to Exit Studio
          </span>
        </div>
        <div className="hidden sm:block text-slate-400">
          Calculation Studio • Full Screen Training
        </div>
      </footer>
    </div>
  );
};
