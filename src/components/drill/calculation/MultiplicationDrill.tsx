import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Trophy, Lightbulb, Zap, ArrowRight, CheckCircle2, Play, Target, Timer, Sparkles } from 'lucide-react';

type MultTrack = 'base_100' | 'square_diff' | 'criss_cross' | 'percentage';

export const MultiplicationDrill: React.FC = () => {
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
      title: 'Base 100 Deviations Sprint',
      ruleName: 'Base 100 Deviation Rule (Ch. 2, Page 5)',
      description: 'Multiply numbers near 100 in seconds by computing differences from 100.',
      concept: 'For numbers near 100, calculate deviations d1 and d2. Left part = (Num1 + d2), Right part = (d1 × d2). (e.g. 94 × 96: d1 = -6, d2 = -4. Left = 94 + (-4) = 90, Right = (-6)×(-4) = 24 ➔ 9024).',
      example: '94 × 96 ➔ (94 − 4) | (−6 × −4) = 9024',
      benchmarkSec: 6,
    },
    square_diff: {
      title: 'Difference of Squares (a² - b²)',
      ruleName: 'Equidistant Anchor Shortcut (Ch. 2, Page 6)',
      description: 'Multiply numbers equidistant from a round number using (anchor - d)(anchor + d) = anchor² - d².',
      concept: 'Identify the exact midpoint anchor. Square the anchor and subtract the square of the difference. (e.g. 18 × 22: Anchor is 20, difference is 2. Result = 20² - 2² = 400 - 4 = 396).',
      example: '18 × 22 ➔ 20² − 2² = 400 − 4 = 396',
      benchmarkSec: 5,
    },
    criss_cross: {
      title: 'Vedic Criss-Cross Multiplication',
      ruleName: 'Single-Line 2-Digit Product (Ch. 2, Page 8)',
      description: 'Compute any 2-digit × 2-digit product in a single line from right to left.',
      concept: 'Step 1: Multiply units digits (write unit, carry tens). Step 2: Cross-multiply and sum with carry (write unit, carry tens). Step 3: Multiply tens digits + carry.',
      example: '43 × 78 ➔ Units (3×8=24) | Cross (32+21+2=55) | Tens (28+5=33) ➔ 3354',
      benchmarkSec: 8,
    },
    percentage: {
      title: 'Percentage Decomposition Multiplication',
      ruleName: 'Percentage Split Multiplication (Ch. 2, Page 9)',
      description: 'Convert multiplication into percentage splits of friendly round numbers.',
      concept: 'Multiply by treating one number as a percentage: e.g. 24 × 65 is equivalent to 24% of 6500 = (20% of 6500) + (4% of 6500) = 1300 + 260 = 1560.',
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
        // Both below 100 (e.g. 91..98)
        a = 100 - (Math.floor(Math.random() * 8) + 2);
        b = 100 - (Math.floor(Math.random() * 8) + 2);
      } else if (type < 0.7) {
        // Both above 100 (e.g. 102..108)
        a = 100 + (Math.floor(Math.random() * 8) + 2);
        b = 100 + (Math.floor(Math.random() * 8) + 2);
      } else {
        // One above, one below (e.g. 104 * 96)
        a = 100 + (Math.floor(Math.random() * 7) + 2);
        b = 100 - (Math.floor(Math.random() * 7) + 2);
      }
    } else if (track === 'square_diff') {
      // (a-b)(a+b) = a^2 - b^2
      // Anchor round number e.g. 20, 30, 40, 50, 60, 25, 35, 45
      const anchors = [20, 25, 30, 35, 40, 50, 60];
      const anchor = anchors[Math.floor(Math.random() * anchors.length)];
      const diff = Math.floor(Math.random() * 4) + 1; // 1..4
      a = anchor - diff;
      b = anchor + diff;
    } else if (track === 'criss_cross') {
      // General 2-digit * 2-digit
      a = Math.floor(Math.random() * 70) + 21;
      b = Math.floor(Math.random() * 70) + 21;
    } else {
      // Percentage multiplication (e.g. 43 * 78 or 24 * 65)
      a = Math.floor(Math.random() * 40) + 15;
      b = (Math.floor(Math.random() * 15) + 3) * 5; // multiple of 5 makes percentage clean
    }

    setNumA(a);
    setNumB(b);
    setUserInput('');
    setFeedback('idle');
    setShowHelper(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const startDrill = (track: MultTrack = activeTrack) => {
    setActiveTrack(track);
    setIsStarted(true);
    setIsFinished(false);
    setRoundCount(1);
    setScore(0);
    setElapsedTime(0);
    generateProblem(track);
  };

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
        }, 200);
      } else {
        setFeedback('wrong');
        setShowHelper(true);
      }
    }
  };

  // Helper breakdown text based on track
  const renderMentalThought = () => {
    if (activeTrack === 'base_100') {
      const devA = numA - 100;
      const devB = numB - 100;
      const initialPart = numA + devB;
      const productOfDevs = devA * devB;

      if (devA * devB >= 0) {
        return (
          <div className="space-y-1">
            <div className="font-bold text-indigo-900">Base 100 Deviation Rule:</div>
            <div>• Deviations: ({devA >= 0 ? `+${devA}` : devA}) and ({devB >= 0 ? `+${devB}` : devB})</div>
            <div>• Left Digits = {numA} + ({devB >= 0 ? `+${devB}` : devB}) = <strong>{initialPart}</strong></div>
            <div>• Right Digits = ({devA}) × ({devB}) = <strong>{productOfDevs.toString().padStart(2, '0')}</strong></div>
            <div className="font-bold text-emerald-800">Result = {initialPart}{productOfDevs.toString().padStart(2, '0')}</div>
          </div>
        );
      } else {
        return (
          <div className="space-y-1">
            <div className="font-bold text-indigo-900">Base 100 Mixed Sign Rule:</div>
            <div>• Deviations: ({devA >= 0 ? `+${devA}` : devA}) and ({devB >= 0 ? `+${devB}` : devB})</div>
            <div>• Intermediate Base = {numA} + ({devB}) = {initialPart}00</div>
            <div>• Subtract product = {initialPart}00 - {Math.abs(productOfDevs)} = <strong>{expectedProduct}</strong></div>
          </div>
        );
      }
    }

    if (activeTrack === 'square_diff') {
      const anchor = (numA + numB) / 2;
      const diff = Math.abs(numA - anchor);
      return (
        <div className="space-y-1">
          <div className="font-bold text-purple-900">Difference of Squares Rule: (a - b)(a + b) = a² - b²</div>
          <div>• Anchor center = ({numA} + {numB}) / 2 = <strong>{anchor}</strong> (Gap: ±{diff})</div>
          <div>• Calculation: {anchor}² - {diff}² = {anchor * anchor} - {diff * diff} = <strong>{expectedProduct}</strong></div>
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
          <div className="font-bold text-slate-900 font-sans">Vedic Criss-Cross Single-Line Method:</div>
          <div>1. Units: {uA} × {uB} = {step1} ➔ write <strong>{unitDigit}</strong>, carry {carry1}</div>
          <div>2. Cross: ({tA}×{uB} + {tB}×{uA}) + {carry1} = {step2} ➔ write <strong>{tensDigit}</strong>, carry {carry2}</div>
          <div>3. Tens: ({tA}×{tB}) + {carry2} = <strong>{step3}</strong></div>
          <div className="font-bold text-emerald-800 font-sans">Final = {step3}{tensDigit}{unitDigit}</div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="font-bold text-blue-900">Percentage Decomposition Method:</div>
        <div>• Treat {numA} × {numB} as {numA}% of {numB} × 100:</div>
        <div>• 10% of {numB} = {(numB * 0.1).toFixed(1)} ➔ {(numB * 0.1 * Math.floor(numA / 10)).toFixed(1)}</div>
        <div>• 1% of {numB} = {(numB * 0.01).toFixed(2)} ➔ {(numB * 0.01 * (numA % 10)).toFixed(2)}</div>
        <div className="font-bold text-emerald-800">Total = {expectedProduct}</div>
      </div>
    );
  };

  return (
    <div className="w-full bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
            Chapter 2: Mental Multiplications
          </span>
          <h2 className="text-lg font-black text-slate-900 mt-1">
            Speed Multiplication Lab
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

      {/* Track Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[
          { id: 'base_100' as MultTrack, label: 'Base 100 Deviations', tag: '94 × 96' },
          { id: 'square_diff' as MultTrack, label: 'Square Diff (a² - b²)', tag: '18 × 22' },
          { id: 'criss_cross' as MultTrack, label: 'Vedic Criss-Cross', tag: '43 × 78' },
          { id: 'percentage' as MultTrack, label: 'Percentage Multiply', tag: 'DI Shortcut' },
        ].map(track => {
          const isActive = activeTrack === track.id;
          return (
            <button
              key={track.id}
              onClick={() => handleSelectTrack(track.id)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-500/30'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-bold leading-tight">{track.label}</div>
              <div className={`text-[10px] font-mono mt-0.5 ${isActive ? 'text-purple-200' : 'text-slate-400'}`}>
                {track.tag}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Screen 1: Mission Briefing (DO NOT start automatically) ── */}
      {!isStarted && !isFinished && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 max-w-2xl mx-auto"
        >
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-purple-100">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              {trackBriefings[activeTrack].title}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {trackBriefings[activeTrack].description}
            </p>
          </div>

          {/* Arun Sharma Method Tip Box */}
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-purple-600" />
              <span>{trackBriefings[activeTrack].ruleName}</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {trackBriefings[activeTrack].concept}
            </p>
            <div className="bg-white/90 border border-purple-100 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono font-bold text-purple-900">
              <span>Technique Example:</span>
              <span>{trackBriefings[activeTrack].example}</span>
              <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-[11px] font-sans font-bold">5 Problems</span>
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
              <span className="text-base font-black text-purple-700">~{trackBriefings[activeTrack].benchmarkSec}s / problem</span>
            </div>
          </div>

          {/* Start Drill Button */}
          <button
            onClick={() => startDrill(activeTrack)}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-black text-base rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Multiplication Drill</span>
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
                Score: <strong className="text-purple-700 font-bold">{score}</strong> / {roundCount - 1}
              </span>
              <span className="font-mono text-slate-400 flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 text-purple-600" />
                {elapsedTime.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Math Expression */}
          <div className="p-6 bg-slate-50/80 rounded-2xl border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
              Calculate Mentally using {trackBriefings[activeTrack].title}
            </span>
            <div className="flex items-center justify-center gap-4 font-mono font-black text-3xl sm:text-4xl text-slate-900">
              <span className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-xs text-purple-800">{numA}</span>
              <span className="text-slate-400 font-sans text-2xl">×</span>
              <span className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-xs text-indigo-800">{numB}</span>
              <span className="text-slate-400 font-sans text-2xl">=</span>
              <span className="text-slate-400">?</span>
            </div>
          </div>

          {/* Input Box */}
          <div className="max-w-xs mx-auto space-y-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={userInput}
              onChange={handleInputChange}
              placeholder="Product..."
              className={`w-full text-center text-3xl font-black font-mono py-3 rounded-xl border-2 transition-all outline-none ${
                feedback === 'correct'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : feedback === 'wrong'
                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                  : 'border-slate-300 focus:border-purple-600 text-slate-900'
              }`}
              autoFocus
            />
            <p className="text-center text-xs text-slate-400">Auto-checks when complete digits are entered</p>
          </div>

          {/* Show Thought Process / Helper */}
          {showHelper && (
            <div className="bg-purple-50/80 border border-purple-200 p-4 rounded-xl text-xs text-purple-900">
              <div className="flex items-center gap-1.5 font-bold mb-2 text-purple-900">
                <Lightbulb className="w-4 h-4 fill-purple-400 text-purple-600" />
                <span>Arun Sharma Mental Thought Process:</span>
              </div>
              {renderMentalThought()}
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
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Trophy className="w-7 h-7" />
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            Set Complete! 🎉
          </h3>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-sm font-mono text-slate-800">
            <div>Score: <strong className="text-purple-700">{score}/5</strong> correct</div>
            <div>Total Time: <strong className="text-indigo-700">{elapsedTime.toFixed(1)}s</strong></div>
            <div className="text-xs text-slate-500">Pace: <strong className="text-slate-800">{(elapsedTime / 5).toFixed(1)}s</strong> per problem</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => startDrill(activeTrack)}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
            <button
              onClick={() => {
                const tracks: MultTrack[] = ['base_100', 'square_diff', 'criss_cross', 'percentage'];
                const currIdx = tracks.indexOf(activeTrack);
                const nextTrack = tracks[(currIdx + 1) % tracks.length];
                handleSelectTrack(nextTrack);
              }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Next Technique</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
