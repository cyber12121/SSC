import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Trophy, Lightbulb, ArrowRight, Play, Timer, Superscript } from 'lucide-react';

type PowerTrack = 'base_50_upper' | 'base_50_lower' | 'base_100' | 'ending_in_5' | 'gp_cube';

interface PowerDrillProps {
  autoStart?: boolean;
}

export const SquaresCubesDrill: React.FC<PowerDrillProps> = ({ autoStart = false }) => {
  const [activeTrack, setActiveTrack] = useState<PowerTrack>('base_50_upper');
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [numberPrompt, setNumberPrompt] = useState<number>(67);
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showHelper, setShowHelper] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [roundCount, setRoundCount] = useState<number>(1);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  const trackBriefings = {
    base_50_upper: {
      title: 'Base 50 Upper Squares (51–79)',
      ruleName: 'Base 50 Addition Formula',
      description: 'Square numbers between 51 and 79 with instant mental splitting.',
      concept: 'Formula: (50 + x)² = (25 + x) × 100 + x².',
      example: '54²: x = 4 ➔ (25 + 4) | 4² = 2916',
      benchmarkSec: 4,
    },
    base_50_lower: {
      title: 'Base 50 Lower Squares (31–49)',
      ruleName: 'Base 50 Subtraction Formula',
      description: 'Square numbers between 31 and 49 using base 50 deficit.',
      concept: 'Formula: (50 − x)² = (25 − x) × 100 + x².',
      example: '47²: x = 3 ➔ (25 − 3) | 3² = 2209',
      benchmarkSec: 4,
    },
    base_100: {
      title: 'Base 100 Squares (81–99)',
      ruleName: 'Base 100 Deficit Formula',
      description: 'Square numbers between 81 and 99 using distance from 100.',
      concept: 'Formula: (100 − x)² = (Num − x) | x².',
      example: '96²: x = 4 ➔ (96 − 4) | 4² = 9216',
      benchmarkSec: 5,
    },
    ending_in_5: {
      title: 'Squares of Numbers Ending in 5',
      ruleName: 'Ekadhikena Purvena Rule',
      description: 'Square any number ending in 5 (15 to 125) in seconds.',
      concept: 'Formula: N5² = N × (N + 1) | 25.',
      example: '65² ➔ (6 × 7) | 25 = 4225',
      benchmarkSec: 3,
    },
    gp_cube: {
      title: 'GP 2-Digit Cubes (11–32)',
      ruleName: "GP Cube Method",
      description: 'Compute cubes of 2-digit numbers using 4-term geometric progressions.',
      concept: 'Four terms: a³, a²b, ab², b³. Double the middle two terms, sum with carries.',
      example: '12³ ➔ (1, 2, 4, 8) + (_, 4, 8, _) = 1728',
      benchmarkSec: 8,
    }
  };

  const isCube = activeTrack === 'gp_cube';

  const generateProblem = (track: PowerTrack = activeTrack) => {
    let num = 0;

    if (track === 'base_50_upper') {
      num = Math.floor(Math.random() * 25) + 51;
    } else if (track === 'base_50_lower') {
      num = Math.floor(Math.random() * 19) + 31;
    } else if (track === 'base_100') {
      num = Math.floor(Math.random() * 18) + 81;
    } else if (track === 'ending_in_5') {
      const candidates = [15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 115];
      num = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      num = Math.floor(Math.random() * 15) + 11;
    }

    setNumberPrompt(num);
    setUserInput('');
    setFeedback('idle');
    setShowHelper(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

  const startDrill = (track: PowerTrack = activeTrack) => {
    setActiveTrack(track);
    setIsStarted(true);
    setRoundCount(1);
    setScore(0);
    setElapsedTime(0);
    setIsFinished(false);
    generateProblem(track);
  };

  useEffect(() => {
    if (autoStart && !isStarted && !isFinished) {
      startDrill(activeTrack);
    }
  }, [autoStart]);

  const handleSelectTrack = (track: PowerTrack) => {
    setActiveTrack(track);
    setIsStarted(false);
    setIsFinished(false);
    setRoundCount(1);
    setScore(0);
    setElapsedTime(0);
    setShowHelper(false);
  };

  useEffect(() => {
    if (isStarted && !isFinished) {
      const startTime = Date.now() - elapsedTime * 1000;
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - startTime) / 100) / 10);
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isStarted, isFinished]);

  const expectedAnswer = isCube ? Math.pow(numberPrompt, 3) : Math.pow(numberPrompt, 2);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setUserInput(val);

    const expectedStr = expectedAnswer.toString();
    if (val.length === expectedStr.length) {
      if (parseInt(val, 10) === expectedAnswer) {
        setFeedback('correct');
        setScore(prev => prev + 1);

        setTimeout(() => {
          if (roundCount >= 5) {
            setIsFinished(true);
          } else {
            setRoundCount(prev => prev + 1);
            generateProblem();
          }
        }, 220);
      } else {
        setFeedback('wrong');
        setShowHelper(true);
      }
    }
  };

  const checkAnswer = () => {
    if (!userInput) return;
    if (parseInt(userInput, 10) === expectedAnswer) {
      setFeedback('correct');
      setScore(prev => prev + 1);
      setTimeout(() => {
        if (roundCount >= 5) {
          setIsFinished(true);
        } else {
          setRoundCount(prev => prev + 1);
          generateProblem();
        }
      }, 220);
    } else {
      setFeedback('wrong');
      setShowHelper(true);
    }
  };

  const renderMentalBreakdown = () => {
    if (activeTrack === 'base_50_upper') {
      const x = numberPrompt - 50;
      const leftPart = 25 + x;
      const rightPart = (x * x).toString().padStart(2, '0');
      return (
        <div className="space-y-1 font-mono text-xs">
          <div>Excess x = {numberPrompt} − 50 = {x}</div>
          <div>Left digits = 25 + {x} = <strong>{leftPart}</strong></div>
          <div>Right digits = {x}² = <strong>{rightPart}</strong></div>
          <div className="font-bold text-emerald-700 font-sans">Square = {leftPart}{rightPart}</div>
        </div>
      );
    }

    if (activeTrack === 'base_50_lower') {
      const x = 50 - numberPrompt;
      const leftPart = 25 - x;
      const rightPart = (x * x).toString().padStart(2, '0');
      return (
        <div className="space-y-1 font-mono text-xs">
          <div>Deficit x = 50 − {numberPrompt} = {x}</div>
          <div>Left digits = 25 − {x} = <strong>{leftPart}</strong></div>
          <div>Right digits = {x}² = <strong>{rightPart}</strong></div>
          <div className="font-bold text-emerald-700 font-sans">Square = {leftPart}{rightPart}</div>
        </div>
      );
    }

    if (activeTrack === 'base_100') {
      const x = 100 - numberPrompt;
      const leftPart = numberPrompt - x;
      const rightPart = (x * x).toString().padStart(2, '0');
      return (
        <div className="space-y-1 font-mono text-xs">
          <div>Deficit from 100 = {x}</div>
          <div>Left = {numberPrompt} − {x} = <strong>{leftPart}</strong></div>
          <div>Right = {x}² = <strong>{rightPart}</strong></div>
          <div className="font-bold text-emerald-700 font-sans">Square = {leftPart}{rightPart}</div>
        </div>
      );
    }

    if (activeTrack === 'ending_in_5') {
      const tens = Math.floor(numberPrompt / 10);
      const leftPart = tens * (tens + 1);
      return (
        <div className="space-y-1 font-mono text-xs">
          <div>Prefix: {tens} × ({tens} + 1) = <strong>{leftPart}</strong></div>
          <div>Suffix: always <strong>25</strong></div>
          <div className="font-bold text-emerald-700 font-sans">Square = {leftPart}25</div>
        </div>
      );
    }

    const a = Math.floor(numberPrompt / 10);
    const b = numberPrompt % 10;
    const t1 = Math.pow(a, 3);
    const t2 = Math.pow(a, 2) * b;
    const t3 = a * Math.pow(b, 2);
    const t4 = Math.pow(b, 3);

    return (
      <div className="space-y-1 font-mono text-xs">
        <div>Row 1 (a³, a²b, ab², b³): {t1}, {t2}, {t3}, {t4}</div>
        <div>Row 2 (2× middle): _, {t2 * 2}, {t3 * 2}, _</div>
        <div className="font-bold text-emerald-700 font-sans">Cube = {expectedAnswer}</div>
      </div>
    );
  };

  const tracks: { id: PowerTrack; label: string; short: string }[] = [
    { id: 'base_50_upper', label: 'Base 50 (51–79)', short: 'Base 50 (+)' },
    { id: 'base_50_lower', label: 'Base 50 (31–49)', short: 'Base 50 (−)' },
    { id: 'base_100', label: 'Base 100 (81–99)', short: 'Base 100' },
    { id: 'ending_in_5', label: 'Ending in 5', short: 'Ending in 5' },
    { id: 'gp_cube', label: 'GP Cubes (11–32)', short: 'GP Cubes' },
  ];

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
      {/* Sleek Minimalist Track Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 mb-4">
        <span className="text-xs font-bold text-slate-900">
          {trackBriefings[activeTrack].title}
        </span>

        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
          {tracks.map(track => {
            const isCurrent = activeTrack === track.id;
            return (
              <button
                key={track.id}
                onClick={() => handleSelectTrack(track.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                }`}
              >
                {track.short}
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
              <Superscript className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {trackBriefings[activeTrack].title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              {trackBriefings[activeTrack].description}
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-left text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Lightbulb className="w-3.5 h-3.5 text-blue-600" />
              <span>Core Technique:</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              {trackBriefings[activeTrack].concept}
            </p>
            <div className="font-mono text-[11px] text-slate-800 pt-1 font-semibold">
              Example: {trackBriefings[activeTrack].example}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-600 py-1">
            <span>5 Problems</span>
            <span className="text-slate-300">•</span>
            <span>Target: ~{trackBriefings[activeTrack].benchmarkSec}s/sum</span>
          </div>

          <button
            onClick={() => startDrill(activeTrack)}
            className="w-full sm:w-auto px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Practice</span>
          </button>
        </motion.div>
      )}

      {/* Screen 2: Stitch Minimalist Problem Arena */}
      {isStarted && !isFinished && (
        <div className="w-full max-w-2xl mx-auto py-1 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
            {/* Header: Track Title & Sleek Progress Indicator */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-blue-600 font-bold">
                    {trackBriefings[activeTrack].title}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                    {trackBriefings[activeTrack].ruleName}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-sans">
                  {trackBriefings[activeTrack].description}
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-semibold text-slate-800">
                  Problem {roundCount} <span className="text-slate-400 font-normal">of 5</span>
                </span>
                <div className="w-28 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1 ml-auto">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(roundCount / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Arithmetic Expression Canvas with Distinct Slate Operand Tiles */}
            <div className="py-2 sm:py-3 text-center space-y-4">
              <div className="flex items-center justify-center gap-2 sm:gap-3 select-none">
                <span className="inline-flex items-center justify-center min-w-[3.5rem] sm:min-w-[4.25rem] px-3.5 py-2.5 rounded-xl border bg-blue-50/80 text-blue-700 border-blue-200 font-mono font-bold text-2xl sm:text-3xl shadow-2xs">
                  {numberPrompt}
                  <sup className="text-sm font-bold text-blue-500 ml-0.5">{isCube ? '3' : '2'}</sup>
                </span>
                <span className="text-slate-400 font-bold text-2xl px-1 font-mono">=</span>
                <span className="text-blue-600 font-mono font-bold text-2xl sm:text-3xl px-1">?</span>
              </div>

              {/* Mental Hint / Shortcut Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowHelper((prev) => !prev)}
                  className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/60 px-3 py-1 rounded-full transition border border-slate-200/80 font-medium cursor-pointer shadow-2xs"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>{showHelper ? 'Hide Power Breakdown' : 'Technique Hint (H)'}</span>
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
                          Mental Steps: <strong className="text-emerald-700 font-mono">{expectedAnswer}</strong>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {trackBriefings[activeTrack].ruleName}
                        </span>
                      </div>
                      {renderMentalBreakdown()}
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
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      checkAnswer();
                    } else if (e.key.toLowerCase() === 'h' && !userInput) {
                      e.preventDefault();
                      setShowHelper((prev) => !prev);
                    }
                  }}
                  placeholder="Enter answer..."
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
                  onClick={() => {
                    if (roundCount >= 5) {
                      setIsFinished(true);
                    } else {
                      setRoundCount(prev => prev + 1);
                      generateProblem();
                    }
                  }}
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
                  {roundCount > 1 ? (elapsedTime / (roundCount - 1)).toFixed(1) : elapsedTime.toFixed(1)}s{' '}
                  <span className="text-[11px] text-slate-400 font-normal">/ problem</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Session Accuracy</div>
                <div className="text-sm font-semibold font-mono text-emerald-600 mt-0.5">
                  {roundCount > 1
                    ? `${Math.round((score / (roundCount - 1)) * 100)}%`
                    : '100%'}{' '}
                  <span className="text-[11px] text-slate-400 font-normal">
                    ({score}/{Math.max(1, roundCount - 1)})
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Target Pace</div>
                <div className="text-sm font-semibold font-mono text-slate-800 mt-0.5">
                  ~{trackBriefings[activeTrack].benchmarkSec}s
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
              Set Completed
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {trackBriefings[activeTrack].title}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center py-1">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Score</span>
              <span className="text-xl font-mono font-bold text-slate-900">{score}/5</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Time</span>
              <span className="text-xl font-mono font-bold text-slate-900">{elapsedTime.toFixed(1)}s</span>
            </div>
          </div>

          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => startDrill(activeTrack)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Track</span>
            </button>

            <button
              onClick={() => {
                const trackList: PowerTrack[] = ['base_50_upper', 'base_50_lower', 'base_100', 'ending_in_5', 'gp_cube'];
                const currIdx = trackList.indexOf(activeTrack);
                const nextTrack = trackList[(currIdx + 1) % trackList.length];
                handleSelectTrack(nextTrack);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Next Shortcut</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
