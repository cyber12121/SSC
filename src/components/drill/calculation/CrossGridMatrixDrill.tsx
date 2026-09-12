import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Trophy, CheckCircle2, Zap, ArrowRight, Grid3X3, Layers } from 'lucide-react';

interface GridTier {
  size: number;
  label: string;
  range: [number, number];
}

const GRID_TIERS: GridTier[] = [
  { size: 3, label: '3x3 Mini Grid', range: [11, 30] },
  { size: 4, label: '4x4 Medium Grid', range: [20, 60] },
  { size: 5, label: '5x5 Standard Grid', range: [30, 80] },
  { size: 10, label: '10x10 Master Table', range: [11, 99] },
];

export const CrossGridMatrixDrill: React.FC = () => {
  const [selectedTierIdx, setSelectedTierIdx] = useState<number>(0);
  const [rowHeaders, setRowHeaders] = useState<number[]>([]);
  const [colHeaders, setColHeaders] = useState<number[]>([]);
  
  // Interactive cell sprint mode: random cell is highlighted
  const [activeCell, setActiveCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [solvedCells, setSolvedCells] = useState<Record<string, number>>({});
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [totalSolvedInRound, setTotalSolvedInRound] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  const currentTier = GRID_TIERS[selectedTierIdx];

  const targetSolveCount = currentTier.size * currentTier.size;

  const initGrid = () => {
    const { size, range } = currentTier;
    const [min, max] = range;

    const rows: number[] = [];
    const cols: number[] = [];

    for (let i = 0; i < size; i++) {
      rows.push(Math.floor(Math.random() * (max - min + 1)) + min);
      cols.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    setRowHeaders(rows);
    setColHeaders(cols);
    setActiveCell({ r: 0, c: 0 });
    setSolvedCells({});
    setUserInput('');
    setFeedback('idle');
    setTotalSolvedInRound(0);
    setElapsedTime(0);
    setIsFinished(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    initGrid();
  }, [selectedTierIdx]);

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

  const activeSum = (rowHeaders[activeCell.r] || 0) + (colHeaders[activeCell.c] || 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setUserInput(val);

    const expectedStr = activeSum.toString();
    if (val.length === expectedStr.length) {
      if (parseInt(val, 10) === activeSum) {
        setFeedback('correct');
        const key = `${activeCell.r}_${activeCell.c}`;
        const newSolved = { ...solvedCells, [key]: activeSum };
        setSolvedCells(newSolved);

        const newCount = totalSolvedInRound + 1;
        setTotalSolvedInRound(newCount);

        setTimeout(() => {
          setUserInput('');
          setFeedback('idle');

          if (newCount >= targetSolveCount) {
            setIsFinished(true);
          } else {
            // Pick next unsolved cell
            pickNextCell(newSolved);
          }
        }, 150);
      } else {
        setFeedback('wrong');
      }
    }
  };

  const pickNextCell = (solved: Record<string, number>) => {
    const { size } = currentTier;
    const candidates: { r: number; c: number }[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!solved[`${r}_${c}`]) {
          candidates.push({ r, c });
        }
      }
    }
    if (candidates.length > 0) {
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      setActiveCell(next);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="w-full bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
            Chapter 1: Arun Sharma Matrix Addition Table
          </span>
          <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
            Cross-Grid Cell Blitz ({currentTier.label})
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={initGrid}
            className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
            title="Reset Grid"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tier Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 custom-scrollbar">
        {GRID_TIERS.map((tier, idx) => (
          <button
            key={tier.size}
            onClick={() => setSelectedTierIdx(idx)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedTierIdx === idx
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tier.label}
          </button>
        ))}
      </div>

      {!isFinished ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Interactive Table */}
          <div className="lg:col-span-8 overflow-x-auto bg-white p-4 rounded-xl border border-slate-200 shadow-xs custom-scrollbar">
            <table className="border-collapse font-mono text-center mx-auto text-xs sm:text-sm">
              <thead>
                <tr>
                  <th className="p-2 border border-slate-200 bg-slate-100 text-slate-400 font-bold w-12">
                    +
                  </th>
                  {colHeaders.map((col, cIdx) => (
                    <th
                      key={cIdx}
                      className={`p-2 border border-slate-200 min-w-12 transition-colors ${
                        cIdx === activeCell.c
                          ? 'bg-amber-100 text-amber-900 font-black ring-2 ring-amber-400'
                          : 'bg-slate-50 text-slate-700 font-bold'
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowHeaders.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <th
                      className={`p-2 border border-slate-200 min-w-12 transition-colors ${
                        rIdx === activeCell.r
                          ? 'bg-amber-100 text-amber-900 font-black ring-2 ring-amber-400'
                          : 'bg-slate-50 text-slate-700 font-bold'
                      }`}
                    >
                      {row}
                    </th>
                    {colHeaders.map((col, cIdx) => {
                      const isCurrent = rIdx === activeCell.r && cIdx === activeCell.c;
                      const solvedVal = solvedCells[`${rIdx}_${cIdx}`];

                      return (
                        <td
                          key={cIdx}
                          onClick={() => {
                            setActiveCell({ r: rIdx, c: cIdx });
                            inputRef.current?.focus();
                          }}
                          className={`p-2 border border-slate-200 cursor-pointer font-bold transition-all min-w-12 ${
                            isCurrent
                              ? 'bg-blue-600 text-white font-black scale-105 z-10 shadow-md ring-2 ring-blue-400'
                              : solvedVal
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'hover:bg-slate-50 text-slate-300'
                          }`}
                        >
                          {solvedVal || (isCurrent ? '?' : '·')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: Active Cell Prompt & Input */}
          <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase">
              <span>Cell Blitz Target</span>
              <span className="font-mono text-slate-400">{elapsedTime.toFixed(1)}s</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center font-mono font-black text-2xl text-slate-800">
              <span className="text-amber-700">{rowHeaders[activeCell.r]}</span>
              <span className="text-slate-400 mx-2">+</span>
              <span className="text-blue-700">{colHeaders[activeCell.c]}</span>
              <span className="text-slate-400 mx-2">=</span>
              <span className="text-slate-400">?</span>
            </div>

            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={userInput}
              onChange={handleInputChange}
              placeholder="Sum..."
              className={`w-full text-center text-3xl font-black font-mono py-2.5 rounded-xl border-2 outline-none transition-all ${
                feedback === 'correct'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : feedback === 'wrong'
                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                  : 'border-slate-300 focus:border-indigo-600 text-slate-900'
              }`}
              autoFocus
            />

            <div className="text-xs text-slate-500 text-center font-medium">
              Progress: <strong className="text-slate-900">{totalSolvedInRound}</strong> / {targetSolveCount} cells
            </div>
          </div>
        </div>
      ) : (
        /* Round Finished */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center space-y-4 max-w-md mx-auto"
        >
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Trophy className="w-7 h-7" />
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            Grid Completed! 🎉
          </h3>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-mono text-slate-800">
            Time: <strong className="text-indigo-600">{elapsedTime.toFixed(1)}s</strong> for {targetSolveCount} cells
          </div>

          <button
            onClick={initGrid}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>
        </motion.div>
      )}
    </div>
  );
};
