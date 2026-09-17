import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Trophy, Lightbulb, ArrowRight, CheckCircle2, Percent, Scale, Play, Target, Timer } from 'lucide-react';

type DivTrack = 'decimal_percentage' | 'ratio_compare';

export const DivisionRatioDrill: React.FC = () => {
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

  const timerRef = useRef<any>(null);

  const trackBriefings = {
    decimal_percentage: {
      title: 'Decimal Percentage Estimation',
      ruleName: '10% & 1% Mental Ladder Method (Ch. 3, Page 10)',
      description: 'Estimate fraction N / D into instant percentage brackets without long division.',
      concept: 'Calculate 10% of the denominator. Scale up by integer multiples to bracket the numerator, then fine-tune with 1% chunks to nail the percentage range in seconds.',
      example: '53 / 81 ➔ 10% of 81 = 8.1. (8.1 × 6 = 48.6 = 60%, 8.1 × 7 = 56.7 = 70%) ➔ Bracket: 60% – 70%',
      benchmarkSec: 5,
    },
    ratio_compare: {
      title: 'Ratio Face-Off Comparison',
      ruleName: 'Relative % Change Comparison (Ch. 3, Page 11)',
      description: 'Quickly determine which of two 3-digit fractions is larger (N1/D1 vs N2/D2) for DI.',
      concept: 'Compare the approximate % change in numerator vs denominator: if Numerator grows by a higher percentage than the denominator, the second fraction is larger!',
      example: '173/212 vs 181/241 ➔ Numerator increases ~4.6%, Denominator increases ~13.6% ➔ Ratio 1 is larger!',
      benchmarkSec: 6,
    }
  };

  const generateProblem = (track: DivTrack = activeTrack) => {
    setShowHelper(false);
    setSelectedBracket(null);
    setBracketFeedback('idle');
    setSelectedRatio(null);
    setRatioFeedback('idle');

    if (track === 'decimal_percentage') {
      const d = Math.floor(Math.random() * 60) + 40; // 40..100
      const n = Math.floor(Math.random() * (d - 15)) + 12; // proper fraction
      setNumerator(n);
      setDenominator(d);
    } else {
      // Ratio comparison e.g. 173/212 vs 181/241
      const d1 = Math.floor(Math.random() * 150) + 150;
      const n1 = Math.floor(d1 * (Math.random() * 0.3 + 0.6));
      const d2 = d1 + (Math.floor(Math.random() * 40) - 20);
      const n2 = Math.floor(d2 * (Math.random() * 0.3 + 0.6));
      setR1({ n: n1, d: d1 });
      setR2({ n: n2, d: d2 });
    }
  };

  const startDrill = (track: DivTrack = activeTrack) => {
    setActiveTrack(track);
    setIsStarted(true);
    setIsFinished(false);
    setRoundCount(1);
    setScore(0);
    setElapsedTime(0);
    generateProblem(track);
  };

  const handleSelectTrack = (track: DivTrack) => {
    setActiveTrack(track);
    setIsStarted(false);
    setIsFinished(false);
    setRoundCount(1);
    setScore(0);
    setElapsedTime(0);
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

  // Decimal percentage brackets
  const actualPercent = (numerator / denominator) * 100;
  const bracketOptions = [
    { label: '30% – 40%', min: 30, max: 40 },
    { label: '40% – 50%', min: 40, max: 50 },
    { label: '50% – 60%', min: 50, max: 60 },
    { label: '60% – 70%', min: 60, max: 70 },
    { label: '70% – 80%', min: 70, max: 80 },
    { label: '80% – 90%', min: 80, max: 90 },
  ];

  const handleBracketSelect = (opt: { label: string; min: number; max: number }) => {
    setSelectedBracket(opt.label);
    const isCorrect = actualPercent >= opt.min && actualPercent < opt.max;
    if (isCorrect) {
      setBracketFeedback('correct');
      setScore(prev => prev + 1);
      setTimeout(() => advanceRound(), 400);
    } else {
      setBracketFeedback('wrong');
      setShowHelper(true);
    }
  };

  // Ratio comparison logic
  const v1 = r1.n / r1.d;
  const v2 = r2.n / r2.d;
  const correctLarger = v1 >= v2 ? 'r1' : 'r2';

  const handleRatioSelect = (choice: 'r1' | 'r2') => {
    setSelectedRatio(choice);
    const isCorrect = choice === correctLarger;
    if (isCorrect) {
      setRatioFeedback('correct');
      setScore(prev => prev + 1);
      setTimeout(() => advanceRound(), 400);
    } else {
      setRatioFeedback('wrong');
      setShowHelper(true);
    }
  };

  const advanceRound = () => {
    if (roundCount >= 5) {
      setIsFinished(true);
    } else {
      setRoundCount(prev => prev + 1);
      generateProblem();
    }
  };

  return (
    <div className="w-full bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            Chapter 3: Divisions, Percentages & Ratios
          </span>
          <h2 className="text-lg font-black text-slate-900 mt-1">
            Division & Ratio Comparison Lab
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {isStarted && !isFinished && (
            <button
              onClick={() => {
                setIsStarted(false);
                setElapsedTime(0);
                setShowHelper(false);
              }}
              className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs cursor-pointer"
              title="Return to Briefing"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Track Tabs */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => handleSelectTrack('decimal_percentage')}
          className={`flex-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeTrack === 'decimal_percentage'
              ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-bold flex items-center gap-1.5">
            <Percent className="w-4 h-4" />
            <span>Decimal Estimation via % Additions</span>
          </div>
          <div className={`text-[10px] mt-0.5 ${activeTrack === 'decimal_percentage' ? 'text-amber-100' : 'text-slate-400'}`}>
            Page 10: 53/81 ➔ 50% + 10% bracket estimation
          </div>
        </button>

        <button
          onClick={() => handleSelectTrack('ratio_compare')}
          className={`flex-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeTrack === 'ratio_compare'
              ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-bold flex items-center gap-1.5">
            <Scale className="w-4 h-4" />
            <span>Ratio Comparison Face-Off</span>
          </div>
          <div className={`text-[10px] mt-0.5 ${activeTrack === 'ratio_compare' ? 'text-amber-100' : 'text-slate-400'}`}>
            Page 11: Compare 3-digit fractions without long division
          </div>
        </button>
      </div>

      {/* ── Screen 1: Mission Briefing (DO NOT start automatically) ── */}
      {!isStarted && !isFinished && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 max-w-2xl mx-auto"
        >
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-amber-100">
              {activeTrack === 'decimal_percentage' ? (
                <Percent className="w-7 h-7" />
              ) : (
                <Scale className="w-7 h-7" />
              )}
            </div>
            <h3 className="text-xl font-black text-slate-900">
              {trackBriefings[activeTrack].title}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {trackBriefings[activeTrack].description}
            </p>
          </div>

          {/* Arun Sharma Method Tip Box */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span>{trackBriefings[activeTrack].ruleName}</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {trackBriefings[activeTrack].concept}
            </p>
            <div className="bg-white/90 border border-amber-100 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono font-bold text-amber-900">
              <span>Technique Example:</span>
              <span>{trackBriefings[activeTrack].example}</span>
              <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-[11px] font-sans font-bold">5 Problems</span>
            </div>
          </div>

          {/* Drill Targets Grid */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Questions</span>
              <span className="text-base font-black text-slate-800">5 Problems</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Unlock Target</span>
              <span className="text-base font-black text-emerald-700">≥ 4 / 5 Correct</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Speed</span>
              <span className="text-base font-black text-amber-700">~{trackBriefings[activeTrack].benchmarkSec}s / problem</span>
            </div>
          </div>

          {/* Start Drill Button */}
          <button
            onClick={() => startDrill(activeTrack)}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-black text-base rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Division Drill</span>
          </button>
        </motion.div>
      )}

      {/* ── Screen 2: Active Problem Arena ── */}
      {isStarted && !isFinished && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider">
              Problem <strong className="text-slate-900 text-sm">{roundCount}</strong> of 5
            </span>
            <div className="flex items-center gap-4">
              <span className="font-medium">
                Score: <strong className="text-amber-700 font-bold">{score}</strong> / {roundCount - 1}
              </span>
              <span className="font-mono text-slate-400 flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 text-amber-600" />
                {elapsedTime.toFixed(1)}s
              </span>
            </div>
          </div>

          {activeTrack === 'decimal_percentage' ? (
            /* Track 1: Decimal Estimation via Percentages */
            <div className="space-y-6 text-center">
              <div className="inline-block p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Fraction Value to Estimate
                </span>
                <div className="font-mono font-black text-4xl text-slate-900 flex items-center justify-center gap-1">
                  <span className="text-blue-700">{numerator}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-amber-700">{denominator}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-3">
                  Pick the correct 10% percentage bracket:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto">
                  {bracketOptions.map(opt => {
                    const isSelected = selectedBracket === opt.label;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => handleBracketSelect(opt)}
                        className={`p-3 rounded-xl border text-center font-mono font-bold text-sm transition-all cursor-pointer ${
                          isSelected && bracketFeedback === 'correct'
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : isSelected && bracketFeedback === 'wrong'
                            ? 'bg-rose-500 text-white border-rose-600'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {showHelper && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-left text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span>Arun Sharma Percentage Addition Breakdown:</span>
                  </div>
                  <div>• Denominator = {denominator}</div>
                  <div>• 50% = {(denominator * 0.5).toFixed(1)}</div>
                  <div>• 10% = {(denominator * 0.1).toFixed(1)}</div>
                  <div>• 1% = {(denominator * 0.01).toFixed(2)}</div>
                  <div className="font-bold text-emerald-800">
                    Actual Value = {actualPercent.toFixed(2)}% (or {(numerator / denominator).toFixed(4)})
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Track 2: Ratio Comparison Face-Off */
            <div className="space-y-6 text-center">
              <p className="text-xs font-semibold text-slate-600">
                Which ratio has the larger value? (No long division)
              </p>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <button
                  onClick={() => handleRatioSelect('r1')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center ${
                    selectedRatio === 'r1' && ratioFeedback === 'correct'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-md'
                      : selectedRatio === 'r1' && ratioFeedback === 'wrong'
                      ? 'bg-rose-50 border-rose-500 text-rose-800'
                      : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-400 uppercase mb-1">Ratio 1</span>
                  <div className="font-mono font-black text-3xl text-blue-700">
                    {r1.n} / {r1.d}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">
                    {showHelper && `≈ ${(v1 * 100).toFixed(1)}%`}
                  </span>
                </button>

                <button
                  onClick={() => handleRatioSelect('r2')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center ${
                    selectedRatio === 'r2' && ratioFeedback === 'correct'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-md'
                      : selectedRatio === 'r2' && ratioFeedback === 'wrong'
                      ? 'bg-rose-50 border-rose-500 text-rose-800'
                      : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-400 uppercase mb-1">Ratio 2</span>
                  <div className="font-mono font-black text-3xl text-purple-700">
                    {r2.n} / {r2.d}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">
                    {showHelper && `≈ ${(v2 * 100).toFixed(1)}%`}
                  </span>
                </button>
              </div>

              {showHelper && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-left text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span>Arun Sharma Ratio Comparison Logic:</span>
                  </div>
                  <div>• Ratio 1: {r1.n}/{r1.d} = {(v1 * 100).toFixed(2)}%</div>
                  <div>• Ratio 2: {r2.n}/{r2.d} = {(v2 * 100).toFixed(2)}%</div>
                  <div className="font-bold text-emerald-800">
                    Larger Ratio: {v1 >= v2 ? `Ratio 1 (${r1.n}/${r1.d})` : `Ratio 2 (${r2.n}/${r2.d})`}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Screen 3: Finished Scorecard ── */}
      {isFinished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center space-y-4 max-w-md mx-auto"
        >
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Trophy className="w-7 h-7" />
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            Set Complete! 🎉
          </h3>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-sm font-mono text-slate-800">
            <div>Score: <strong className="text-amber-700">{score}/5</strong> correct</div>
            <div>Total Time: <strong className="text-indigo-700">{elapsedTime.toFixed(1)}s</strong></div>
            <div className="text-xs text-slate-500">Pace: <strong className="text-slate-800">{(elapsedTime / 5).toFixed(1)}s</strong> per question</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => startDrill(activeTrack)}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
            <button
              onClick={() => {
                const nextTrack: DivTrack = activeTrack === 'decimal_percentage' ? 'ratio_compare' : 'decimal_percentage';
                handleSelectTrack(nextTrack);
              }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Switch Technique</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
