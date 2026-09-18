import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  RotateCcw,
  Check,
  X,
  Timer,
  Award,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  ChevronLeft,
} from 'lucide-react';
import { generateMathProblem, OperationType, MathProblem } from '../../utils/mathGenerator';

interface Props {
  onCompleteSession?: (stats: { count: number; accuracy: number; timeSec: number }) => void;
  onClose?: () => void;
  initialFullscreen?: boolean;
}

export const SpeedMathDrill: React.FC<Props> = ({
  onCompleteSession,
  onClose,
  initialFullscreen = false,
}) => {
  const [operation, setOperation] = useState<OperationType>('mixed');
  const [problem, setProblem] = useState<MathProblem>(() => generateMathProblem('mixed'));
  const [inputVal, setInputVal] = useState<string>('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(initialFullscreen);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Session tracking
  const [isDrilling, setIsDrilling] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [solvedCount, setSolvedCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        // Audio context may be restricted before user interaction
      }
    },
    [soundEnabled]
  );

  // Fullscreen handling
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isFullscreen]);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  // Global keydown listeners
  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [isFullscreen]);

  // Focus input automatically
  useEffect(() => {
    if (isDrilling && !isFinished) {
      inputRef.current?.focus();
    }
  }, [isDrilling, isFinished, problem, isFullscreen]);

  const endTimeRef = useRef<number>(0);

  // Timer countdown
  useEffect(() => {
    if (!isDrilling || isFinished) return;

    if (endTimeRef.current <= Date.now()) {
      endTimeRef.current = Date.now() + timeRemaining * 1000;
    }

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        playAudioTone('complete');
        setIsDrilling(false);
        setIsFinished(true);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [isDrilling, isFinished, playAudioTone]);

  // Completion notification
  useEffect(() => {
    if (isFinished && onCompleteSession) {
      const total = solvedCount + wrongCount;
      const acc = total > 0 ? Math.round((solvedCount / total) * 100) : 100;
      onCompleteSession({
        count: solvedCount,
        accuracy: acc,
        timeSec: selectedDuration - timeRemaining,
      });
    }
  }, [isFinished]);

  const startDrill = (duration = selectedDuration) => {
    setSelectedDuration(duration);
    setTimeRemaining(duration);
    endTimeRef.current = Date.now() + duration * 1000;
    setSolvedCount(0);
    setWrongCount(0);
    setIsFinished(false);
    setIsDrilling(true);
    setInputVal('');
    setFeedback(null);
    setProblem(generateMathProblem(operation));
  };

  const handleNextProblem = useCallback(() => {
    setInputVal('');
    setFeedback(null);
    setProblem(generateMathProblem(operation));
  }, [operation]);

  const checkAnswer = (val: string) => {
    const num = parseInt(val.trim(), 10);
    if (isNaN(num)) return;

    if (num === problem.answer) {
      playAudioTone('correct');
      setFeedback('correct');
      setSolvedCount((prev) => prev + 1);
      setTimeout(() => {
        handleNextProblem();
      }, 150);
    } else {
      playAudioTone('wrong');
      setFeedback('wrong');
      setWrongCount((prev) => prev + 1);
      setTimeout(() => {
        setFeedback(null);
        setInputVal('');
      }, 400);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!/^-?\d*$/.test(val)) return;

    setInputVal(val);

    const num = parseInt(val, 10);
    if (!isNaN(num) && num === problem.answer) {
      playAudioTone('correct');
      setFeedback('correct');
      setSolvedCount((prev) => prev + 1);
      setTimeout(() => {
        handleNextProblem();
      }, 120);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkAnswer(inputVal);
    }
  };

  const totalAttempts = solvedCount + wrongCount;
  const accuracy = totalAttempts > 0 ? Math.round((solvedCount / totalAttempts) * 100) : 100;
  const elapsedSec = selectedDuration - timeRemaining;
  const cpm = elapsedSec > 0 ? Math.round((solvedCount / elapsedSec) * 60) : 0;
  const avgPace = solvedCount > 0 ? (elapsedSec / solvedCount).toFixed(1) : '0.0';

  // ==========================================
  // 1. FULL SCREEN MODE (Active Question Cockpit)
  // Only active during questions drill or results
  // ==========================================
  if (isFullscreen && (isDrilling || isFinished)) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-slate-50 text-slate-900 flex flex-col justify-between overflow-y-auto select-none font-sans"
      >
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white/95 border-b border-slate-200/90 backdrop-blur-md shrink-0 shadow-2xs">
          {/* Left: Back Button & Branding */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (onClose) onClose();
                toggleFullscreen();
              }}
              type="button"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 bg-white transition text-xs font-semibold cursor-pointer shadow-2xs"
              title="Back"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-xs">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-slate-900 tracking-tight">Speed Math Sprint</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase font-semibold">
                  {operation}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Full Screen Studio</span>
            </div>
          </div>

          {/* Center Metrics (when drilling) */}
          {isDrilling && (
            <div className="flex items-center space-x-3 sm:space-x-5 text-xs font-semibold">
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 font-mono">
                <Timer
                  className={`w-3.5 h-3.5 ${
                    timeRemaining <= 10 ? 'text-rose-600 animate-spin' : 'text-blue-600'
                  }`}
                />
                <span
                  className={`font-bold ${
                    timeRemaining <= 10 ? 'text-rose-600 font-black' : 'text-slate-800'
                  }`}
                >
                  {timeRemaining}s
                </span>
              </div>
              <div className="hidden sm:flex items-center space-x-1.5 text-slate-600 font-mono">
                <span className="text-slate-400">Solved:</span>
                <span className="text-slate-900 font-bold">{solvedCount}</span>
              </div>
              <div className="hidden sm:flex items-center space-x-1.5 text-slate-600 font-mono">
                <span className="text-slate-400">Speed:</span>
                <span className="text-blue-600 font-bold">{cpm} CPM</span>
              </div>
              <div className="hidden md:flex items-center space-x-1.5 text-slate-600 font-mono">
                <span className="text-slate-400">Accuracy:</span>
                <span
                  className={`font-bold ${
                    accuracy >= 90 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {accuracy}%
                </span>
              </div>
            </div>
          )}

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2">
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

            {/* Native Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              title="Exit Full Screen (Esc)"
            >
              <Minimize className="w-4 h-4" />
            </button>

            {/* Exit/Close Button */}
            <button
              onClick={() => {
                if (onClose) onClose();
                toggleFullscreen();
              }}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
              title="Close Full Screen Studio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Center Canvas Area */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-4xl mx-auto w-full">
          {isFinished ? (
            /* Sprint Completed Fullscreen View */
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-sm"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-2xs">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                  Sprint Completed
                </h3>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Excellent high-speed workout! Reflexes and mental calculation honed.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Solved
                  </div>
                  <div className="text-3xl font-bold font-mono text-slate-900 mt-1">{solvedCount}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Speed
                  </div>
                  <div className="text-3xl font-bold font-mono text-blue-600 mt-1">
                    {cpm} <span className="text-xs text-slate-400 font-sans font-normal">CPM</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Accuracy
                  </div>
                  <div
                    className={`text-3xl font-bold font-mono mt-1 ${
                      accuracy >= 90 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {accuracy}%
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => startDrill(selectedDuration)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs transition-all flex items-center shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  <span>Play Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFinished(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs border border-slate-200 transition-all cursor-pointer"
                >
                  Change Mode
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="px-4 py-3 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-semibold text-xs border border-slate-200 transition-all cursor-pointer shadow-2xs"
                >
                  Exit Full Screen
                </button>
              </div>
            </motion.div>
          ) : !isDrilling ? (
            /* Setup View in Fullscreen (White Theme) */
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-xl bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-6 text-center shadow-sm"
            >
              <div className="border-b border-slate-100 pb-4">
                <span className="text-[11px] font-mono uppercase tracking-widest text-blue-600 font-bold">
                  Calculation Studio Sprint
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
                  Speed Math Drill
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Targeted rapid-fire arithmetic against the clock in full-screen immersion
                </p>
              </div>

              {/* Operation Selector */}
              <div className="space-y-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Choose Operation Focus
                </span>
                <div className="inline-flex bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/70 text-xs font-semibold flex-wrap justify-center gap-1.5">
                  {[
                    { id: 'mixed', label: 'All Operations' },
                    { id: 'add', label: 'Addition (+)' },
                    { id: 'sub', label: 'Subtraction (−)' },
                    { id: 'mul', label: 'Multiplication (×)' },
                    { id: 'div', label: 'Division (÷)' },
                  ].map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        setOperation(op.id as OperationType);
                        setProblem(generateMathProblem(op.id as OperationType));
                      }}
                      className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                        operation === op.id
                          ? 'bg-white text-blue-600 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selector */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                  Duration:
                </span>
                {[
                  { sec: 30, label: '30s Sprint' },
                  { sec: 60, label: '60s Standard' },
                  { sec: 120, label: '120s Endurance' },
                ].map(({ sec, label }) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSelectedDuration(sec)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                      selectedDuration === sec
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Sample Problem Preview */}
              <div className="py-4 px-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 max-w-sm mx-auto">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">
                  Sample Problem Preview
                </span>
                <div className="flex items-center justify-center gap-2 select-none">
                  <span className="inline-flex items-center justify-center min-w-[4rem] px-3.5 py-2 rounded-xl bg-blue-50/80 text-blue-700 border border-blue-200 font-mono font-bold text-2xl shadow-2xs">
                    {problem.num1}
                  </span>
                  <span className="text-slate-400 font-bold text-2xl px-1 font-mono">
                    {problem.operator}
                  </span>
                  <span className="inline-flex items-center justify-center min-w-[4rem] px-3.5 py-2 rounded-xl bg-white text-slate-800 border border-slate-200 font-mono font-bold text-2xl shadow-2xs">
                    {problem.num2}
                  </span>
                  <span className="text-slate-400 font-bold text-2xl px-1 font-mono">=</span>
                  <span className="text-blue-600 font-mono font-bold text-2xl px-1">?</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => startDrill()}
                className="w-full sm:w-auto px-10 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm rounded-2xl transition-all shadow-xs inline-flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Start Speed Drill ({selectedDuration}s)</span>
              </button>
            </motion.div>
          ) : (
            /* Active Drilling Cockpit in Fullscreen (White Theme) */
            <div className="w-full max-w-2xl space-y-8 text-center">
              {problem.hint && (
                <span className="inline-block text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                  {problem.hint}
                </span>
              )}

              {/* Large Arithmetic Canvas */}
              <div className="flex items-center justify-center gap-3 sm:gap-5 select-none py-4">
                <span className="inline-flex items-center justify-center min-w-[5rem] sm:min-w-[6.5rem] px-5 py-4 rounded-2xl border bg-white text-blue-700 border-slate-200/90 font-mono font-bold text-4xl sm:text-6xl shadow-sm">
                  {problem.num1}
                </span>
                <span className="text-slate-400 font-bold text-4xl sm:text-6xl px-2 font-mono">
                  {problem.operator}
                </span>
                <span className="inline-flex items-center justify-center min-w-[5rem] sm:min-w-[6.5rem] px-5 py-4 rounded-2xl border bg-white text-slate-800 border-slate-200/90 font-mono font-bold text-4xl sm:text-6xl shadow-sm">
                  {problem.num2}
                </span>
                <span className="text-slate-400 font-bold text-4xl sm:text-6xl px-2 font-mono">=</span>
                <span className="text-blue-600 font-mono font-bold text-4xl sm:text-6xl px-2">?</span>
              </div>

              {/* Large Input Box */}
              <div className="max-w-md mx-auto space-y-4">
                <div className="relative">
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
                    autoFocus
                    className={`w-full text-center font-mono font-bold text-3xl sm:text-4xl py-3 px-6 rounded-2xl border transition-all outline-none shadow-xs ${
                      feedback === 'correct'
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 ring-4 ring-emerald-50'
                        : feedback === 'wrong'
                        ? 'border-rose-400 bg-rose-50/80 text-rose-800 ring-4 ring-rose-50'
                        : 'border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 bg-white placeholder:text-slate-300'
                    }`}
                  />

                  <AnimatePresence>
                    {feedback === 'correct' && (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs"
                      >
                        <Check className="w-5 h-5" />
                      </motion.div>
                    )}
                    {feedback === 'wrong' && (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs"
                      >
                        <X className="w-5 h-5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Submit & Skip Actions */}
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => checkAnswer(inputVal)}
                    className="flex-1 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Submit</span>
                    <span className="font-mono text-[11px] opacity-75">(Enter ↵)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextProblem}
                    className="py-3 px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition cursor-pointer border border-slate-200 shadow-2xs"
                    title="Skip problem"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrilling(false);
                      setTimeRemaining(selectedDuration);
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition cursor-pointer"
                  >
                    Quit
                  </button>
                </div>
              </div>

              {/* Live 3-stat footer inside cockpit */}
              <div className="pt-4 border-t border-slate-200/80 grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] text-slate-400 font-medium">Avg Pace</div>
                  <div className="text-base font-bold font-mono text-slate-800 mt-0.5">
                    {avgPace}s <span className="text-[10px] text-slate-400 font-normal">/prob</span>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] text-slate-400 font-medium">Session Accuracy</div>
                  <div className="text-base font-bold font-mono text-emerald-600 mt-0.5">
                    {accuracy}%{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({solvedCount}/{totalAttempts})
                    </span>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] text-slate-400 font-medium">Live Speed</div>
                  <div className="text-base font-bold font-mono text-blue-600 mt-0.5">
                    {cpm} <span className="text-[10px] text-slate-400 font-normal">CPM</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Shortcut Hints Bar */}
        <footer className="px-4 sm:px-6 py-2.5 bg-white border-t border-slate-200 text-center text-xs text-slate-500 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span>
              Press <span className="font-mono text-slate-700 font-bold">Enter ↵</span> to Submit
            </span>
            <span>•</span>
            <span>
              Press <span className="font-mono text-slate-700 font-bold">Esc</span> to Exit Full Screen
            </span>
          </div>
          <div className="hidden sm:block text-slate-400">
            Speed Math Sprint • Distraction-Free Training
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // 2. INLINE MODE (Standard Clean White Theme)
  // ==========================================
  if (isFinished) {
    return (
      <div className="w-full max-w-md mx-auto py-8 text-center space-y-5">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-2xs">
          <Award className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold font-display text-slate-900">Sprint Completed</h3>
          <p className="text-slate-500 text-xs mt-1">
            Excellent high-speed workout! Reflexes and mental focus honed.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Solved
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{solvedCount}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Speed
            </div>
            <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
              {cpm} <span className="text-[10px] text-slate-400 font-sans font-normal">CPM</span>
            </div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Accuracy
            </div>
            <div
              className={`text-2xl font-bold font-mono mt-1 ${
                accuracy >= 90 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {accuracy}%
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 justify-center pt-2">
          <button
            type="button"
            onClick={() => startDrill(selectedDuration)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-semibold text-xs transition-all flex items-center shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Play Again</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFinished(false)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-all cursor-pointer"
          >
            Change Mode
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs border border-slate-200 transition-all flex items-center cursor-pointer shadow-2xs"
            title="Enter Full Screen Studio"
          >
            <Maximize className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            <span>Full Screen</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-1 space-y-4">
      {/* Operation selector & config (before starting) */}
      {!isDrilling ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 text-center">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-left">
              <span className="text-[11px] font-mono uppercase tracking-wider text-blue-600 font-bold">
                Speed Drill Sprint
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Targeted rapid-fire arithmetic against the clock
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                80% Multi-Digit
              </span>
            </div>
          </div>

          {/* Operation Selector Pills */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Choose Operation Focus
            </span>
            <div className="inline-flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 text-xs font-semibold flex-wrap justify-center gap-1">
              {[
                { id: 'mixed', label: 'All Operations' },
                { id: 'add', label: 'Addition (+)' },
                { id: 'sub', label: 'Subtraction (−)' },
                { id: 'mul', label: 'Multiplication (×)' },
                { id: 'div', label: 'Division (÷)' },
              ].map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => {
                    setOperation(op.id as OperationType);
                    setProblem(generateMathProblem(op.id as OperationType));
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    operation === op.id
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Selector */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Sprint Duration:
            </span>
            {[
              { sec: 30, label: '30s Sprint' },
              { sec: 60, label: '60s Standard' },
              { sec: 120, label: '120s Endurance' },
            ].map(({ sec, label }) => (
              <button
                key={sec}
                type="button"
                onClick={() => setSelectedDuration(sec)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  selectedDuration === sec
                    ? 'bg-slate-900 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sample Preview Tile */}
          <div className="py-4 px-2 bg-slate-50/70 border border-slate-200/70 rounded-xl space-y-2 max-w-md mx-auto">
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">
              Sample Problem Preview
            </span>
            <div className="flex items-center justify-center gap-2 select-none">
              <span className="inline-flex items-center justify-center min-w-[3.5rem] px-3 py-2 rounded-xl bg-blue-50/80 text-blue-700 border border-blue-200 font-mono font-bold text-2xl shadow-2xs">
                {problem.num1}
              </span>
              <span className="text-slate-400 font-bold text-2xl px-1 font-mono">
                {problem.operator}
              </span>
              <span className="inline-flex items-center justify-center min-w-[3.5rem] px-3 py-2 rounded-xl bg-white text-slate-800 border border-slate-200 font-mono font-bold text-2xl shadow-2xs">
                {problem.num2}
              </span>
              <span className="text-slate-400 font-bold text-2xl px-1 font-mono">=</span>
              <span className="text-blue-600 font-mono font-bold text-2xl px-1">?</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => startDrill()}
              className="w-full sm:w-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs inline-flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Start Speed Drill ({selectedDuration}s)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                toggleFullscreen();
                startDrill();
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-all inline-flex items-center justify-center space-x-2 cursor-pointer border border-slate-200 shadow-2xs"
            >
              <Maximize className="w-3.5 h-3.5 text-blue-600" />
              <span>Start in Full Screen</span>
            </button>
          </div>
        </div>
      ) : (
        /* Active sprint view (Stitch Minimalist Cockpit) */
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
          {/* Cockpit Status Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-blue-600 font-bold">
                  Speed Drill Sprint
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
                  {operation.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Type answer and press Enter or auto-check
              </div>
            </div>

            {/* Timer, sound, fullscreen, and quit */}
            <div className="flex items-center gap-2">
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 font-mono text-xs">
                <Timer
                  className={`w-3.5 h-3.5 ${
                    timeRemaining <= 10 ? 'text-rose-600 animate-spin' : 'text-blue-600'
                  }`}
                />
                <span
                  className={`font-bold ${
                    timeRemaining <= 10 ? 'text-rose-600 font-black' : 'text-slate-800'
                  }`}
                >
                  {timeRemaining}s
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                title="Enter Full Screen"
              >
                <Maximize className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDrilling(false);
                  setTimeRemaining(selectedDuration);
                }}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-1 cursor-pointer"
              >
                Quit
              </button>
            </div>
          </div>

          {/* Arithmetic Expression Canvas */}
          <div className="py-2 sm:py-3 text-center space-y-3">
            {problem.hint && (
              <span className="inline-block text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full mb-1">
                {problem.hint}
              </span>
            )}

            <div className="flex items-center justify-center gap-2 sm:gap-3 select-none">
              <span className="inline-flex items-center justify-center min-w-[3.75rem] sm:min-w-[4.5rem] px-3.5 py-2.5 rounded-xl border bg-blue-50/80 text-blue-700 border-blue-200 font-mono font-bold text-3xl sm:text-4xl shadow-2xs">
                {problem.num1}
              </span>
              <span className="text-slate-400 font-bold text-3xl px-1 font-mono">
                {problem.operator}
              </span>
              <span className="inline-flex items-center justify-center min-w-[3.75rem] sm:min-w-[4.5rem] px-3.5 py-2.5 rounded-xl border bg-slate-50 text-slate-800 border-slate-200/90 font-mono font-bold text-3xl sm:text-4xl shadow-2xs">
                {problem.num2}
              </span>
              <span className="text-slate-400 font-bold text-3xl px-1 font-mono">=</span>
              <span className="text-blue-600 font-mono font-bold text-3xl sm:text-4xl px-1">?</span>
            </div>
          </div>

          {/* Input Box & Controls */}
          <div className="max-w-sm mx-auto space-y-3">
            <div className="relative">
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
                autoFocus
                className={`w-full text-center font-mono font-bold text-2xl sm:text-3xl py-2.5 px-4 rounded-xl border transition-all outline-none ${
                  feedback === 'correct'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 ring-4 ring-emerald-50'
                    : feedback === 'wrong'
                    ? 'border-rose-400 bg-rose-50/70 text-rose-800 ring-4 ring-rose-50'
                    : 'border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 bg-slate-50/50 hover:bg-white placeholder:text-slate-300'
                }`}
              />

              <AnimatePresence>
                {feedback === 'correct' && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                  </motion.div>
                )}
                {feedback === 'wrong' && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs"
                  >
                    <X className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => checkAnswer(inputVal)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>Submit</span>
                <span className="font-mono text-[11px] opacity-75">(Enter ↵)</span>
              </button>
              <button
                type="button"
                onClick={handleNextProblem}
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
                {avgPace}s <span className="text-[11px] text-slate-400 font-normal">/ problem</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Session Accuracy</div>
              <div className="text-sm font-semibold font-mono text-emerald-600 mt-0.5">
                {accuracy}%{' '}
                <span className="text-[11px] text-slate-400 font-normal">
                  ({solvedCount}/{totalAttempts})
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Live Speed</div>
              <div className="text-sm font-semibold font-mono text-blue-600 mt-0.5">
                {cpm} <span className="text-[11px] text-slate-400 font-normal">CPM</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
