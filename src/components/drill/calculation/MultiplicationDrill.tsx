import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Trophy, Lightbulb, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';

type MultTrack = 'base_100' | 'square_diff' | 'criss_cross' | 'percentage';

export const MultiplicationDrill: React.FC = () => {
  const [activeTrack, setActiveTrack] = useState<MultTrack>('base_100');
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
    setIsFinished(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    setRoundCount(1);
    setScore(0);
    setElapsedTime(0);
    generateProblem(activeTrack);
  }, [activeTrack]);

  useEffect(() => {
    if (!isFinished) {
      const startTime = Date.now() - elapsedTime * 1000;
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - startTime) / 100) / 10);
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isFinished]);

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

        <button
          onClick={() => { setRoundCount(1); setScore(0); generateProblem(); }}
          className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
          title="Restart Drill"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
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
              onClick={() => setActiveTrack(track.id)}
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

      {!isFinished ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Problem {roundCount} of 5</span>
            <span className="font-mono">Time: {elapsedTime.toFixed(1)}s</span>
          </div>

          {/* Math Expression */}
          <div className="flex items-center justify-center gap-4 font-mono font-black text-3xl sm:text-4xl text-slate-900">
            <span className="text-purple-800">{numA}</span>
            <span className="text-slate-400">×</span>
            <span className="text-indigo-800">{numB}</span>
            <span className="text-slate-400">=</span>
            <span className="text-slate-400">?</span>
          </div>

          {/* Input Box */}
          <div className="max-w-xs mx-auto">
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
      ) : (
        /* Finished */
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
            <div>Time: <strong className="text-indigo-700">{elapsedTime.toFixed(1)}s</strong></div>
          </div>

          <button
            onClick={() => { setRoundCount(1); setScore(0); generateProblem(); }}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Next Set
          </button>
        </motion.div>
      )}
    </div>
  );
};
