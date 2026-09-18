import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Trophy, Lightbulb, ArrowRight, Play, Timer, Percent } from 'lucide-react';

type DivTrack = 'decimal_percentage' | 'ratio_compare';

interface DivDrillProps {
  autoStart?: boolean;
}

export const DivisionRatioDrill: React.FC<DivDrillProps> = ({ autoStart = false }) => {
  const [activeTrack, setActiveTrack] = useState<DivTrack>('decimal_percentage');
  const [isStarted, setIsStarted] = useState<boolean>(false);
  
  // Decimal estimation state (N / D)
  const [numerator, setNumerator] = useState<number>(53);
  const [denominator, setDenominator] = useState<number>(81);
  const [selectedBracket, setSelectedBracket] = useState<string | null>(null);
  const [bracketFeedback, setBracketFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // Ratio comparison state (N1/D1 vs N2/D2)
  const [r1, setR1] = useState<{ n: number; d: number }>({ n: 173, d: 212 });
  const [r2, setR2] = useState<{ n: number; d: number }>({ n: 181, d: 241 });
  const [selectedRatio, setSelectedRatio] = useState<'r1' | 'r2' | null>(null);
  const [ratioFeedback, setRatioFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

  const [showHelper, setShowHelper] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [roundCount, setRoundCount] = useState<number>(1);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [wrongAttempts, setWrongAttempts] = useState<number>(0);

  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  const trackBriefings = {
    decimal_percentage: {
      title: 'Decimal % Estimation',
      ruleName: '10% & 1% Mental Ladder',
      description: 'Estimate fraction N / D into instant percentage brackets without manual long division.',
      concept: 'Calculate 10% of the denominator. Scale up by multiples to bracket the numerator.',
      example: '53 / 81 ➔ 10% of 81 = 8.1 (60% = 48.6, 70% = 56.7) ➔ 60%–70%',
      benchmarkSec: 5,
    },
    ratio_compare: {
      title: 'Ratio Face-Off Comparison',
      ruleName: 'Relative % Growth Comparison',
      description: 'Quickly determine which of two 3-digit fractions is larger for Data Interpretation.',
      concept: 'Compare the relative growth in numerator vs denominator to spot the larger fraction.',
      example: '173/212 vs 181/241 ➔ Num grows ~4.6%, Denom grows ~13.6% ➔ Ratio 1 is larger!',
      benchmarkSec: 6,
    }
  };

  const generateProblem = (track: DivTrack = activeTrack) => {
    setShowHelper(false);
    setSelectedBracket(null);
    setBracketFeedback('idle');
    setSelectedRatio(null);
    setRatioFeedback('idle');
    setWrongAttempts(0);

    if (track === 'decimal_percentage') {
      const d = Math.floor(Math.random() * 60) + 40;
      const n = Math.floor(Math.random() * (d - 15)) + 12;
      setNumerator(n);
      setDenominator(d);
    } else {
      const baseD1 = Math.floor(Math.random() * 120) + 150;
      const baseN1 = Math.floor(baseD1 * (Math.random() * 0.4 + 0.45));
      const deltaN = Math.floor(Math.random() * 30) - 10;
      const deltaD = Math.floor(Math.random() * 45) + 10;

      setR1({ n: baseN1, d: baseD1 });
      setR2({ n: Math.max(20, baseN1 + deltaN), d: Math.max(40, baseD1 + deltaD) });
    }
  };

  const startDrill = (track: DivTrack = activeTrack) => {
    setActiveTrack(track);
    startTimeRef.current = Date.now();
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

  const handleSelectTrack = (track: DivTrack) => {
    setActiveTrack(track);
    setIsStarted(false);
    setIsFinished(false);
    setRoundCount(1);
    setScore(0);
    setElapsedTime(0);
    startTimeRef.current = 0;
    setShowHelper(false);
  };

  useEffect(() => {
    if (isStarted && !isFinished) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - startTimeRef.current) / 100) / 10);
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isStarted, isFinished]);

  const actualPercent = (numerator / denominator) * 100;
  const bracketOptions = [
    { label: '20% – 30%', min: 20, max: 30 },
    { label: '30% – 40%', min: 30, max: 40 },
    { label: '40% – 50%', min: 40, max: 50 },
    { label: '50% – 60%', min: 50, max: 60 },
    { label: '60% – 70%', min: 60, max: 70 },
    { label: '70% – 80%', min: 70, max: 80 },
    { label: '80% – 90%', min: 80, max: 90 },
  ];

  const handleBracketSelect = (opt: { label: string; min: number; max: number }) => {
    if (selectedBracket !== null) return;
    setSelectedBracket(opt.label);

    const isCorrect = actualPercent >= opt.min && actualPercent <= opt.max;
    if (isCorrect) {
      setBracketFeedback('correct');
      setScore(prev => prev + 1);
      setWrongAttempts(0);

      setTimeout(() => {
        if (roundCount >= 5) {
          setIsFinished(true);
        } else {
          setRoundCount(prev => prev + 1);
          generateProblem('decimal_percentage');
        }
      }, 250);
    } else {
      const nextAttempts = wrongAttempts + 1;
      setWrongAttempts(nextAttempts);
      setBracketFeedback('wrong');

      if (nextAttempts >= 3) {
        setShowHelper(true);
      } else {
        setTimeout(() => {
          setBracketFeedback('idle');
          setSelectedBracket(null);
        }, 400);
      }
    }
  };

  const v1 = r1.n / r1.d;
  const v2 = r2.n / r2.d;
  const correctRatio = v1 >= v2 ? 'r1' : 'r2';

  const handleRatioSelect = (choice: 'r1' | 'r2') => {
    if (selectedRatio !== null) return;
    setSelectedRatio(choice);

    const isCorrect = choice === correctRatio;
    if (isCorrect) {
      setRatioFeedback('correct');
      setScore(prev => prev + 1);
      setWrongAttempts(0);

      setTimeout(() => {
        if (roundCount >= 5) {
          setIsFinished(true);
        } else {
          setRoundCount(prev => prev + 1);
          generateProblem('ratio_compare');
        }
      }, 250);
    } else {
      const nextAttempts = wrongAttempts + 1;
      setWrongAttempts(nextAttempts);
      setRatioFeedback('wrong');

      if (nextAttempts >= 3) {
        setShowHelper(true);
      } else {
        setTimeout(() => {
          setRatioFeedback('idle');
          setSelectedRatio(null);
        }, 400);
      }
    }
  };

  const tracks: { id: DivTrack; label: string }[] = [
    { id: 'decimal_percentage', label: 'Decimal % Estimation' },
    { id: 'ratio_compare', label: 'Ratio Comparison' },
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
                {track.label}
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
              <Percent className="w-5 h-5" />
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
            <span>Target: ~{trackBriefings[activeTrack].benchmarkSec}s/problem</span>
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
            {/* Header: Track & Sleek Progress Indicator */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-blue-600 font-bold">
                    {trackBriefings[activeTrack].title}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                    10% Ladder
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-sans">
                  {trackBriefings[activeTrack].description}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  <Timer className="w-3.5 h-3.5 text-slate-500" />
                  {elapsedTime.toFixed(1)}s
                </span>
                <div className="text-right">
                  <span className="font-mono text-xs font-semibold text-slate-800">
                    Problem {roundCount} <span className="text-slate-400 font-normal">of 5</span>
                  </span>
                  <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1 ml-auto">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${(roundCount / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {activeTrack === 'decimal_percentage' ? (
              /* Track 1: Decimal Estimation via Percentages */
              <div className="space-y-5 text-center">
                <div className="py-2">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block mb-2">
                    Estimate Fraction Percentage
                  </span>
                  <div className="flex items-center justify-center gap-2 sm:gap-3 select-none">
                    <span className="inline-flex items-center justify-center min-w-[3.5rem] sm:min-w-[4.25rem] px-3.5 py-2.5 rounded-xl border bg-blue-50/80 text-blue-700 border-blue-200 font-mono font-bold text-3xl shadow-2xs">
                      {numerator}
                    </span>
                    <span className="text-slate-400 font-bold text-3xl px-1 font-mono">/</span>
                    <span className="inline-flex items-center justify-center min-w-[3.5rem] sm:min-w-[4.25rem] px-3.5 py-2.5 rounded-xl border bg-slate-50 text-slate-800 border-slate-200/90 font-mono font-bold text-3xl shadow-2xs">
                      {denominator}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">
                    Select matching percentage bracket:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-md mx-auto">
                    {bracketOptions.map(opt => {
                      const isSelected = selectedBracket === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => handleBracketSelect(opt)}
                          className={`p-2.5 rounded-xl border text-center font-mono font-semibold text-xs transition-all cursor-pointer ${
                            isSelected && bracketFeedback === 'correct'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs font-bold'
                              : isSelected && bracketFeedback === 'wrong'
                              ? 'bg-rose-500 text-white border-rose-600'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {showHelper && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs text-slate-700 text-left space-y-2 max-w-md mx-auto"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Exact: <strong className="text-emerald-700">{actualPercent.toFixed(1)}%</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHelper(false);
                          if (roundCount >= 5) {
                            setIsFinished(true);
                          } else {
                            setRoundCount(prev => prev + 1);
                            generateProblem('decimal_percentage');
                          }
                        }}
                        className="text-xs bg-slate-900 text-white font-semibold px-2.5 py-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Continue</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono space-y-0.5">
                      <div>Base {denominator}: 10% = {(denominator * 0.1).toFixed(1)}, 1% = {(denominator * 0.01).toFixed(2)}</div>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              /* Track 2: Ratio Comparison Face-Off */
              <div className="space-y-5 text-center">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">
                  Select the larger fraction
                </span>

                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                  <button
                    type="button"
                    onClick={() => handleRatioSelect('r1')}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center ${
                      selectedRatio === 'r1' && ratioFeedback === 'correct'
                        ? 'bg-emerald-50/80 border-emerald-500 text-emerald-900 shadow-xs'
                        : selectedRatio === 'r1' && ratioFeedback === 'wrong'
                        ? 'bg-rose-50 border-rose-500 text-rose-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ratio A</span>
                    <div className="font-mono font-bold text-2xl">
                      {r1.n} <span className="text-slate-300 font-light">/</span> {r1.d}
                    </div>
                    {showHelper && (
                      <span className="text-[11px] text-slate-500 font-mono mt-1">
                        ≈ {(v1 * 100).toFixed(1)}%
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRatioSelect('r2')}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center ${
                      selectedRatio === 'r2' && ratioFeedback === 'correct'
                        ? 'bg-emerald-50/80 border-emerald-500 text-emerald-900 shadow-xs'
                        : selectedRatio === 'r2' && ratioFeedback === 'wrong'
                        ? 'bg-rose-50 border-rose-500 text-rose-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ratio B</span>
                    <div className="font-mono font-bold text-2xl">
                      {r2.n} <span className="text-slate-300 font-light">/</span> {r2.d}
                    </div>
                    {showHelper && (
                      <span className="text-[11px] text-slate-500 font-mono mt-1">
                        ≈ {(v2 * 100).toFixed(1)}%
                      </span>
                    )}
                  </button>
                </div>

                {showHelper && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs text-slate-700 text-left space-y-2 max-w-sm mx-auto"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Larger: <strong className="text-emerald-700">{correctRatio === 'r1' ? `Ratio A (${r1.n}/${r1.d})` : `Ratio B (${r2.n}/${r2.d})`}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHelper(false);
                          if (roundCount >= 5) {
                            setIsFinished(true);
                          } else {
                            setRoundCount(prev => prev + 1);
                            generateProblem('ratio_compare');
                          }
                        }}
                        className="text-xs bg-slate-900 text-white font-semibold px-2.5 py-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Continue</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono">
                      Ratio A = {(v1 * 100).toFixed(2)}% vs Ratio B = {(v2 * 100).toFixed(2)}%
                    </div>
                  </motion.div>
                )}
              </div>
            )}

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
                const nextTrack: DivTrack = activeTrack === 'decimal_percentage' ? 'ratio_compare' : 'decimal_percentage';
                handleSelectTrack(nextTrack);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Switch Track</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
