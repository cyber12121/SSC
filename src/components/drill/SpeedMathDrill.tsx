import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, RotateCcw, Check, X, Timer, Award } from 'lucide-react';
import { generateMathProblem, OperationType, MathProblem } from '../../utils/mathGenerator';

interface Props {
  onCompleteSession?: (stats: { count: number; accuracy: number; timeSec: number }) => void;
}

export const SpeedMathDrill: React.FC<Props> = ({ onCompleteSession }) => {
  const [operation, setOperation] = useState<OperationType>('mixed');
  const [problem, setProblem] = useState<MathProblem>(() => generateMathProblem('mixed'));
  const [inputVal, setInputVal] = useState<string>('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  
  // Session tracking
  const [isDrilling, setIsDrilling] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [solvedCount, setSolvedCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically
  useEffect(() => {
    if (isDrilling && !isFinished) {
      inputRef.current?.focus();
    }
  }, [isDrilling, isFinished, problem]);

  // Timer countdown
  useEffect(() => {
    let timer: any;
    if (isDrilling && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsDrilling(false);
            setIsFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isDrilling, timeRemaining]);

  const startDrill = (duration = selectedDuration) => {
    setSelectedDuration(duration);
    setTimeRemaining(duration);
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
      setFeedback('correct');
      setSolvedCount(prev => prev + 1);
      setTimeout(() => {
        handleNextProblem();
      }, 150);
    } else {
      // If user presses Enter on wrong answer
      setFeedback('wrong');
      setWrongCount(prev => prev + 1);
      setTimeout(() => {
        setFeedback(null);
        setInputVal('');
      }, 400);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow negative sign for subtraction if needed
    if (!/^-?\d*$/.test(val)) return;

    setInputVal(val);

    // Auto-check if exact match (instant reaction)
    const num = parseInt(val, 10);
    if (!isNaN(num) && num === problem.answer) {
      setFeedback('correct');
      setSolvedCount(prev => prev + 1);
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
  const cpm = selectedDuration > 0 ? Math.round((solvedCount / (selectedDuration - timeRemaining || 1)) * 60) : 0;

  if (isFinished) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Award className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Sprint Completed</h3>
        <p className="text-slate-500 text-sm mb-8">Great mental workout! Keep practicing daily to sharpen your reflexes.</p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Solved</div>
            <div className="text-2xl font-black text-slate-800">{solvedCount}</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Speed</div>
            <div className="text-2xl font-black text-blue-600">{cpm} <span className="text-xs text-slate-400 font-normal">CPM</span></div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Accuracy</div>
            <div className={`text-2xl font-black ${accuracy >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {accuracy}%
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => startDrill(selectedDuration)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all flex items-center shadow-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Play Again
          </button>
          <button
            onClick={() => setIsFinished(false)}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all"
          >
            Change Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Operation selector & config (hidden while sprinting) */}
      {!isDrilling ? (
        <div className="text-center py-6">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200/60">
            {[
              { id: 'mixed', label: 'All Operations' },
              { id: 'add', label: '+' },
              { id: 'sub', label: '−' },
              { id: 'mul', label: '×' },
              { id: 'div', label: '÷' },
            ].map(op => (
              <button
                key={op.id}
                onClick={() => {
                  setOperation(op.id as OperationType);
                  setProblem(generateMathProblem(op.id as OperationType));
                }}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  operation === op.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Duration:</span>
            {[30, 60, 120].map(sec => (
              <button
                key={sec}
                onClick={() => setSelectedDuration(sec)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedDuration === sec
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Quick preview card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-sm max-w-md mx-auto mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 py-1 px-3 rounded-full border border-blue-100">
                Sample Problem Preview
              </span>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 py-1 px-2.5 rounded-full">
                80% Multi-Digit
              </span>
            </div>
            <div className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-3">
              {problem.expression}
            </div>
            <p className="text-slate-500 text-xs leading-relaxed max-w-xs mx-auto">
              Click <strong>"Start Speed Drill"</strong> below to begin the {selectedDuration}s countdown and type answers with instant checking.
            </p>
          </div>

          <button
            onClick={() => startDrill()}
            className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 inline-flex items-center text-base"
          >
            <Zap className="w-4 h-4 mr-2" />
            Start Speed Drill
          </button>
        </div>
      ) : (
        /* Active sprint view */
        <div className="py-4">
          {/* Header stats bar */}
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Timer className="w-4 h-4 text-blue-600" />
              <span className={`font-mono text-lg font-bold ${timeRemaining <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                {timeRemaining}s
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm font-semibold">
              <span className="text-emerald-600 font-bold">✓ {solvedCount}</span>
              {wrongCount > 0 && <span className="text-red-500 font-bold">✗ {wrongCount}</span>}
              <button
                onClick={() => { setIsDrilling(false); setTimeRemaining(selectedDuration); }}
                className="text-slate-400 hover:text-slate-600 text-xs ml-2"
              >
                Quit
              </button>
            </div>
          </div>

          {/* Clean problem board */}
          <div className="relative bg-white border border-slate-200/80 rounded-3xl p-10 shadow-sm text-center">
            {problem.hint && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-semibold text-indigo-600 bg-indigo-50 py-0.5 px-2.5 rounded-full">
                {problem.hint}
              </div>
            )}

            <div className="text-6xl font-black text-slate-900 tracking-tight my-6">
              {problem.expression}
            </div>

            <div className="max-w-xs mx-auto relative">
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
                className={`w-full text-center text-4xl font-bold py-3 px-4 rounded-2xl border-2 outline-hidden transition-all ${
                  feedback === 'correct'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : feedback === 'wrong'
                    ? 'border-red-500 bg-red-50 text-red-800 animate-shake'
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
              Press <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md font-mono text-[11px] text-slate-600">Enter</kbd> to submit
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
