import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Trophy, Lightbulb, Zap, ArrowRight, Play, Target, Timer, Superscript } from 'lucide-react';

type PowerTrack = 'base_50_upper' | 'base_50_lower' | 'base_100' | 'ending_in_5' | 'gp_cube';

export const SquaresCubesDrill: React.FC = () => {
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
      ruleName: 'Base 50 Addition Formula (Ch. 4, Page 12)',
      description: 'Calculate squares of numbers between 51 and 79 with instant mental splitting.',
      concept: 'Formula: (50 + x)² = (25 + x) × 100 + x². The left two digits are always (25 + difference), and right two digits are difference squared.',
      example: '54²: x = 4 ➔ (25 + 4) | 4² = 29 | 16 = 2916',
      benchmarkSec: 4,
    },
    base_50_lower: {
      title: 'Base 50 Lower Squares (31–49)',
      ruleName: 'Base 50 Subtraction Formula (Ch. 4, Page 12)',
      description: 'Calculate squares of numbers between 31 and 49 using base 50 deficit.',
      concept: 'Formula: (50 - x)² = (25 - x) × 100 + x². The left two digits are always (25 - deficit), and right two digits are deficit squared.',
      example: '47²: x = 3 ➔ (25 − 3) | 3² = 22 | 09 = 2209',
      benchmarkSec: 4,
    },
    base_100: {
      title: 'Base 100 Squares (81–99)',
      ruleName: 'Base 100 Deficit Formula (Ch. 4, Page 12)',
      description: 'Square numbers between 81 and 99 using distance from 100.',
      concept: 'Formula: (100 - x)² = (100 - 2x) × 100 + x² or (Num - x) | x². Subtract the deficit from the number itself, then append the square of the deficit.',
      example: '96²: x = 4 ➔ (96 − 4) | 4² = 92 | 16 = 9216',
      benchmarkSec: 5,
    },
    ending_in_5: {
      title: 'Squares of Numbers Ending in 5',
      ruleName: 'Ekadhikena Purvena Rule (Ch. 4, Page 12)',
      description: 'Square any number ending in 5 (15 to 125) in 2 seconds.',
      concept: 'Formula: For (N5)², multiply the tens part N by (N + 1) and append 25 to the end.',
      example: '65² ➔ (6 × 7) | 25 = 42 | 25 = 4225',
      benchmarkSec: 3,
    },
    gp_cube: {
      title: 'GP 2-Digit Cubes (11–32)',
      ruleName: "Arun Sharma's GP Cube Method (Ch. 4, Page 13)",
      description: 'Compute cubes of 2-digit numbers using 4-term geometric progressions.',
      concept: 'Write 4 terms in ratio of the digits: a³, a²b, ab², b³. Double the middle two terms, write them below, and sum with column carries from right to left.',
      example: '12³ ➔ Row 1: (1, 2, 4, 8) + Row 2: (_, 4, 8, _) ➔ 1 | 7 | 2 | 8 = 1728',
      benchmarkSec: 8,
    }
  };

  const generateProblem = (track: PowerTrack = activeTrack) => {
    let n = 0;
    if (track === 'base_50_upper') {
      // 51 to 79
      n = Math.floor(Math.random() * 28) + 51;
    } else if (track === 'base_50_lower') {
      // 31 to 49
      n = Math.floor(Math.random() * 18) + 31;
    } else if (track === 'base_100') {
      // 81 to 99
      n = Math.floor(Math.random() * 18) + 81;
    } else if (track === 'ending_in_5') {
      // 15, 25, 35 ... 125
      const tens = Math.floor(Math.random() * 11) + 1;
      n = tens * 10 + 5;
    } else {
      // GP 2-digit cubes (e.g. 12, 13, 21, 23, 24, 28)
      const candidates = [12, 13, 14, 15, 21, 22, 23, 24, 25, 28, 31, 32];
      n = candidates[Math.floor(Math.random() * candidates.length)];
    }

    setNumberPrompt(n);
    setUserInput('');
    setFeedback('idle');
    setShowHelper(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const startDrill = (track: PowerTrack = activeTrack) => {
    setActiveTrack(track);
    setIsStarted(true);
    setIsFinished(false);
    setRoundCount(1);
    setScore(0);
    setElapsedTime(0);
    generateProblem(track);
  };

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

  const isCube = activeTrack === 'gp_cube';
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

  const renderMentalBreakdown = () => {
    if (activeTrack === 'base_50_upper') {
      const x = numberPrompt - 50;
      const leftPart = 25 + x;
      const rightPart = x * x;
      const carry = Math.floor(rightPart / 100);
      const right2Digits = (rightPart % 100).toString().padStart(2, '0');

      return (
        <div className="space-y-1">
          <div className="font-bold text-rose-900">Base 50 (51–80) Method:</div>
          <div>• Distance from 50 = {numberPrompt} - 50 = <strong>{x}</strong></div>
          <div>• First 2 digits = 25 + {x} {carry > 0 ? `+ carry ${carry}` : ''} = <strong>{leftPart + carry}</strong></div>
          <div>• Last 2 digits = {x}² = {rightPart} ➔ <strong>{right2Digits}</strong></div>
          <div className="font-bold text-emerald-800">Result = {expectedAnswer}</div>
        </div>
      );
    }

    if (activeTrack === 'base_50_lower') {
      const x = 50 - numberPrompt;
      const leftPart = 25 - x;
      const rightPart = x * x;
      const carry = Math.floor(rightPart / 100);
      const right2Digits = (rightPart % 100).toString().padStart(2, '0');

      return (
        <div className="space-y-1">
          <div className="font-bold text-rose-900">Base 50 (31–50) Method:</div>
          <div>• Distance below 50 = 50 - {numberPrompt} = <strong>{x}</strong></div>
          <div>• First 2 digits = 25 - {x} {carry > 0 ? `+ carry ${carry}` : ''} = <strong>{leftPart + carry}</strong></div>
          <div>• Last 2 digits = ({x})² = {rightPart} ➔ <strong>{right2Digits}</strong></div>
          <div className="font-bold text-emerald-800">Result = {expectedAnswer}</div>
        </div>
      );
    }

    if (activeTrack === 'base_100') {
      const x = 100 - numberPrompt;
      const leftPart = numberPrompt - x;
      const rightPart = x * x;
      const carry = Math.floor(rightPart / 100);
      const right2Digits = (rightPart % 100).toString().padStart(2, '0');

      return (
        <div className="space-y-1">
          <div className="font-bold text-rose-900">Base 100 (81–100) Method:</div>
          <div>• Deficiency from 100 = 100 - {numberPrompt} = <strong>{x}</strong></div>
          <div>• First 2 digits = {numberPrompt} - {x} {carry > 0 ? `+ carry ${carry}` : ''} = <strong>{leftPart + carry}</strong></div>
          <div>• Last 2 digits = {x}² = {rightPart} ➔ <strong>{right2Digits}</strong></div>
          <div className="font-bold text-emerald-800">Result = {expectedAnswer}</div>
        </div>
      );
    }

    if (activeTrack === 'ending_in_5') {
      const d = Math.floor(numberPrompt / 10);
      const leftPart = d * (d + 1);
      return (
        <div className="space-y-1">
          <div className="font-bold text-rose-900">Ending in 5 Shortcut: N5² = N(N+1) | 25</div>
          <div>• Left side = {d} × ({d} + 1) = {d} × {d + 1} = <strong>{leftPart}</strong></div>
          <div>• Right side = <strong>25</strong></div>
          <div className="font-bold text-emerald-800">Result = {leftPart}25 = {expectedAnswer}</div>
        </div>
      );
    }

    // GP Cubes
    const tens = Math.floor(numberPrompt / 10);
    const units = numberPrompt % 10;
    const r = units / tens;
    const t1 = Math.pow(tens, 3);
    const t2 = t1 * r;
    const t3 = t2 * r;
    const t4 = t3 * r;

    return (
      <div className="space-y-1">
        <div className="font-bold text-rose-900">Arun Sharma 4-Term GP Method (Page 14):</div>
        <div>• Digits: {tens} and {units} (Ratio = {units}/{tens} = {r.toFixed(2)})</div>
        <div>• 4 Terms: [{t1}, {t2}, {t3}, {t4}]</div>
        <div>• Double middle: [+ {t2 * 2}, + {t3 * 2}]</div>
        <div className="font-bold text-emerald-800">Add with carries = {expectedAnswer}</div>
      </div>
    );
  };

  return (
    <div className="w-full bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
            Chapter 4: Squares & Cubes Shortcuts
          </span>
          <h2 className="text-lg font-black text-slate-900 mt-1">
            Mental Powers & Bases Lab
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

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
        {[
          { id: 'base_50_upper' as PowerTrack, label: 'Base 50 (51–80)', tag: '(25 + x) | x²' },
          { id: 'base_50_lower' as PowerTrack, label: 'Base 50 (31–50)', tag: '(25 - x) | x²' },
          { id: 'base_100' as PowerTrack, label: 'Base 100 (81–100)', tag: '(N - x) | x²' },
          { id: 'ending_in_5' as PowerTrack, label: 'Ending in 5', tag: 'N(N+1) | 25' },
          { id: 'gp_cube' as PowerTrack, label: 'GP 2-Digit Cubes', tag: 'a³ | a²b | ab² | b³' },
        ].map(track => {
          const isActive = activeTrack === track.id;
          return (
            <button
              key={track.id}
              onClick={() => handleSelectTrack(track.id)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/30'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-bold leading-tight truncate">{track.label}</div>
              <div className={`text-[10px] font-mono mt-0.5 truncate ${isActive ? 'text-rose-200' : 'text-slate-400'}`}>
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
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-rose-100">
              <Superscript className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              {trackBriefings[activeTrack].title}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {trackBriefings[activeTrack].description}
            </p>
          </div>

          {/* Arun Sharma Method Tip Box */}
          <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-rose-600" />
              <span>{trackBriefings[activeTrack].ruleName}</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {trackBriefings[activeTrack].concept}
            </p>
            <div className="bg-white/90 border border-rose-100 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono font-bold text-rose-900">
              <span>Technique Example:</span>
              <span>{trackBriefings[activeTrack].example}</span>
              <span className="bg-rose-600 text-white px-2 py-0.5 rounded text-[11px] font-sans font-bold">5 Problems</span>
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
              <span className="text-base font-black text-rose-700">~{trackBriefings[activeTrack].benchmarkSec}s / square</span>
            </div>
          </div>

          {/* Start Drill Button */}
          <button
            onClick={() => startDrill(activeTrack)}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-black text-base rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Squares & Cubes Drill</span>
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
                Score: <strong className="text-rose-700 font-bold">{score}</strong> / {roundCount - 1}
              </span>
              <span className="font-mono text-slate-400 flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 text-rose-600" />
                {elapsedTime.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Math Prompt */}
          <div className="p-6 bg-slate-50/80 rounded-2xl border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
              Calculate Mentally using {trackBriefings[activeTrack].title}
            </span>
            <div className="flex items-center justify-center gap-3 font-mono font-black text-4xl text-slate-900">
              <span className="px-5 py-2.5 bg-white rounded-2xl border border-slate-200 shadow-xs text-rose-800">{numberPrompt}</span>
              <sup className="text-2xl text-slate-400 font-bold">{isCube ? '3' : '2'}</sup>
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
              placeholder={isCube ? 'Cube...' : 'Square...'}
              className={`w-full text-center text-3xl font-black font-mono py-3 rounded-xl border-2 transition-all outline-none ${
                feedback === 'correct'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : feedback === 'wrong'
                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                  : 'border-slate-300 focus:border-rose-600 text-slate-900'
              }`}
              autoFocus
            />
            <p className="text-center text-xs text-slate-400">Auto-checks when complete digits are entered</p>
          </div>

          {showHelper && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-900">
              <div className="flex items-center gap-1.5 font-bold mb-2 text-rose-900">
                <Lightbulb className="w-4 h-4 fill-rose-400 text-rose-600" />
                <span>Mental Shortcut Breakdown:</span>
              </div>
              {renderMentalBreakdown()}
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
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Trophy className="w-7 h-7" />
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            Set Complete! 🎉
          </h3>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-sm font-mono text-slate-800">
            <div>Score: <strong className="text-rose-700">{score}/5</strong> correct</div>
            <div>Total Time: <strong className="text-indigo-700">{elapsedTime.toFixed(1)}s</strong></div>
            <div className="text-xs text-slate-500">Pace: <strong className="text-slate-800">{(elapsedTime / 5).toFixed(1)}s</strong> per calculation</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => startDrill(activeTrack)}
              className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
            <button
              onClick={() => {
                const tracks: PowerTrack[] = ['base_50_upper', 'base_50_lower', 'base_100', 'ending_in_5', 'gp_cube'];
                const currIdx = tracks.indexOf(activeTrack);
                const nextTrack = tracks[(currIdx + 1) % tracks.length];
                handleSelectTrack(nextTrack);
              }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Next Shortcut</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
