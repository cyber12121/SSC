import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Trophy, Lightbulb, ArrowRight, Play, Timer, Sparkles } from 'lucide-react';

type MultTrack = 'base_100' | 'square_diff' | 'criss_cross' | 'percentage';

interface MultDrillProps {
  autoStart?: boolean;
}

export const MultiplicationDrill: React.FC<MultDrillProps> = ({ autoStart = false }) => {
  const [activeTrack, setActiveTrack] = useState<MultTrack>('base_100');
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [numA, setNumA] = useState<number>(94);
  const [numB, setNumB] = useState<number>(96);
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
    base_100: {
      title: 'Base 100 Deviations',
      ruleName: 'Deviation Rule',
      description: 'Multiply numbers near 100 quickly by computing differences from 100.',
      concept: 'Left part = (Num1 + d2), Right part = (d1 × d2).',
      example: '94 × 96 ➔ (94 − 4) | (−6 × −4) = 9024',
      benchmarkSec: 6,
    },
    square_diff: {
      title: 'Difference of Squares (a² − b²)',
      ruleName: 'Equidistant Anchor Shortcut',
      description: 'Multiply numbers equidistant from a round number using anchor² − d².',
      concept: 'Identify the exact midpoint anchor, then compute anchor² − diff².',
      example: '18 × 22 ➔ 20² − 2² = 400 − 4 = 396',
      benchmarkSec: 5,
    },
    criss_cross: {
      title: 'Vedic Criss-Cross',
      ruleName: 'Single-Line 2-Digit Product',
      description: 'Compute 2-digit × 2-digit products in a single line right-to-left.',
      concept: '1. Units product. 2. Cross-multiplication sum + carry. 3. Tens product + carry.',
      example: '43 × 78 ➔ Units (24) | Cross (55) | Tens (33) ➔ 3354',
      benchmarkSec: 8,
    },
    percentage: {
      title: 'Percentage Decomposition',
      ruleName: 'Percentage Split Method',
      description: 'Convert multiplication into percentage splits of friendly round numbers.',
      concept: 'Multiply by treating one number as a percentage split of the other.',
      example: '24 × 65 ➔ 20% + 4% of 6500 = 1300 + 260 = 1560',
      benchmarkSec: 7,
    }
  };

  const generateProblem = (track: MultTrack = activeTrack) => {
    let a = 0;
    let b = 0;

    if (track === 'base_100') {
      const type = Math.random();
      if (type < 0.4) {
        a = 100 - (Math.floor(Math.random() * 8) + 2);
        b = 100 - (Math.floor(Math.random() * 8) + 2);
      } else if (type < 0.7) {
        a = 100 + (Math.floor(Math.random() * 8) + 2);
        b = 100 + (Math.floor(Math.random() * 8) + 2);
      } else {
        a = 100 + (Math.floor(Math.random() * 7) + 2);
        b = 100 - (Math.floor(Math.random() * 7) + 2);
      }
    } else if (track === 'square_diff') {
      const anchors = [20, 25, 30, 35, 40, 50, 60];
      const anchor = anchors[Math.floor(Math.random() * anchors.length)];
      const diff = Math.floor(Math.random() * 4) + 1;
      a = anchor - diff;
      b = anchor + diff;
    } else if (track === 'criss_cross') {
      a = Math.floor(Math.random() * 70) + 21;
      b = Math.floor(Math.random() * 70) + 21;
    } else {
      a = Math.floor(Math.random() * 40) + 15;
      b = (Math.floor(Math.random() * 15) + 3) * 5;
    }

    setNumA(a);
    setNumB(b);
    setUserInput('');
    setFeedback('idle');
    setShowHelper(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

  const startDrill = (track: MultTrack = activeTrack) => {
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

  const handleSelectTrack = (track: MultTrack) => {
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

  const expectedProduct = numA * numB;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setUserInput(val);

    const expectedStr = expectedProduct.toString();
    if (val.length === expectedStr.length) {
      if (parseInt(val, 10) === expectedProduct) {
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
    if (parseInt(userInput, 10) === expectedProduct) {
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

  const renderMentalThought = () => {
    if (activeTrack === 'base_100') {
      const devA = numA - 100;
      const devB = numB - 100;
      const initialPart = numA + devB;
      const productOfDevs = devA * devB;

      return (
        <div className="space-y-1 font-mono text-xs">
          <div>Deviations: ({devA >= 0 ? `+${devA}` : devA}) and ({devB >= 0 ? `+${devB}` : devB})</div>
          <div>Left: {numA} + ({devB >= 0 ? `+${devB}` : devB}) = <strong>{initialPart}</strong></div>
          <div>Right: ({devA}) × ({devB}) = <strong>{productOfDevs}</strong></div>
          <div className="font-bold text-emerald-700 font-sans">Product = {expectedProduct}</div>
        </div>
      );
    }

    if (activeTrack === 'square_diff') {
      const anchor = (numA + numB) / 2;
      const diff = Math.abs(numA - anchor);
      return (
        <div className="space-y-1 font-mono text-xs">
          <div>Anchor = <strong>{anchor}</strong> (Gap: ±{diff})</div>
          <div>Formula: {anchor}² − {diff}² = {anchor * anchor} − {diff * diff}</div>
          <div className="font-bold text-emerald-700 font-sans">Product = {expectedProduct}</div>
        </div>
      );
    }

    if (activeTrack === 'criss_cross') {
      const uA = numA % 10;
      const tA = Math.floor(numA / 10);
      const uB = numB % 10;
      const tB = Math.floor(numB / 10);

      const step1 = uA * uB;
      const carry1 = Math.floor(step1 / 10);
      const unitDigit = step1 % 10;
      const step2 = (tA * uB) + (tB * uA) + carry1;
      const carry2 = Math.floor(step2 / 10);
      const tensDigit = step2 % 10;
      const step3 = (tA * tB) + carry2;

      return (
        <div className="space-y-1 font-mono text-xs">
          <div>Units: {uA}×{uB} = {step1} (write {unitDigit}, carry {carry1})</div>
          <div>Cross: ({tA}×{uB} + {tB}×{uA}) + {carry1} = {step2} (write {tensDigit}, carry {carry2})</div>
          <div>Tens: ({tA}×{tB}) + {carry2} = {step3}</div>
          <div className="font-bold text-emerald-700 font-sans">Product = {step3}{tensDigit}{unitDigit}</div>
        </div>
      );
    }

    return (
      <div className="space-y-1 font-mono text-xs">
        <div>Decomposition: {numA}% of {numB * 100}</div>
        <div>10% chunk = {(numB * 0.1 * Math.floor(numA / 10)).toFixed(1)}</div>
        <div>1% chunk = {(numB * 0.01 * (numA % 10)).toFixed(2)}</div>
        <div className="font-bold text-emerald-700 font-sans">Product = {expectedProduct}</div>
      </div>
    );
  };

  const tracks: { id: MultTrack; label: string; short: string }[] = [
    { id: 'base_100', label: 'Base 100 Deviations', short: 'Base 100' },
    { id: 'square_diff', label: 'Midpoint a² − b²', short: 'a² − b²' },
    { id: 'criss_cross', label: 'Vedic Criss-Cross', short: 'Criss-Cross' },
    { id: 'percentage', label: 'Percentage Split', short: 'Percentage' },
  ];

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
      {/* Sleek Minimalist Track Selector */}
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
              <Sparkles className="w-5 h-5" />
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
                  {numA}
                </span>
                <span className="text-slate-400 font-bold text-2xl px-1 font-mono">×</span>
                <span className="inline-flex items-center justify-center min-w-[3.5rem] sm:min-w-[4.25rem] px-3.5 py-2.5 rounded-xl border bg-slate-50 text-slate-800 border-slate-200/90 font-mono font-bold text-2xl sm:text-3xl shadow-2xs">
                  {numB}
                </span>
                <span className="text-slate-400 font-bold text-2xl px-1 font-mono">=</span>
                <span className="text-blue-600 font-mono font-bold text-2xl sm:text-3xl px-1">?</span>
              </div>

              {/* Mental Hint / Vedic Shortcut Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowHelper((prev) => !prev)}
                  className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/60 px-3 py-1 rounded-full transition border border-slate-200/80 font-medium cursor-pointer shadow-2xs"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>{showHelper ? 'Hide Mental Shortcut' : 'Technique Hint (H)'}</span>
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
                          Mental Steps: <strong className="text-emerald-700 font-mono">{expectedProduct}</strong>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {trackBriefings[activeTrack].ruleName}
                        </span>
                      </div>
                      {renderMentalThought()}
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
                  placeholder="Enter product..."
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
                const trackList: MultTrack[] = ['base_100', 'square_diff', 'criss_cross', 'percentage'];
                const currIdx = trackList.indexOf(activeTrack);
                const nextTrack = trackList[(currIdx + 1) % trackList.length];
                handleSelectTrack(nextTrack);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Next Track</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
