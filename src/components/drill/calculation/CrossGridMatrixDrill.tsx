import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Trophy, ArrowRight, Grid3X3, Play, Timer } from 'lucide-react';

interface GridTier {
  size: number;
  label: string;
  shortLabel: string;
  range: [number, number];
  targetSecPerCell: number;
}

const GRID_TIERS: GridTier[] = [
  { size: 3, label: '3×3 Mini Grid', shortLabel: '3×3', range: [11, 30], targetSecPerCell: 2.0 },
  { size: 4, label: '4×4 Medium Grid', shortLabel: '4×4', range: [20, 60], targetSecPerCell: 2.5 },
  { size: 5, label: '5×5 Standard Grid', shortLabel: '5×5', range: [30, 80], targetSecPerCell: 2.5 },
  { size: 10, label: '10×10 Master Table', shortLabel: '10×10', range: [11, 99], targetSecPerCell: 3.0 },
];

interface MatrixDrillProps {
  autoStart?: boolean;
}

export const CrossGridMatrixDrill: React.FC<MatrixDrillProps> = ({ autoStart = false }) => {
  const [selectedTierIdx, setSelectedTierIdx] = useState<number>(0);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [rowHeaders, setRowHeaders] = useState<number[]>([]);
  const [colHeaders, setColHeaders] = useState<number[]>([]);
  
  const [activeCell, setActiveCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [solvedCells, setSolvedCells] = useState<Record<string, number>>({});
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [totalSolvedInRound, setTotalSolvedInRound] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

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
    }, 60);
  };

  const startBlitz = (tierIdx: number = selectedTierIdx) => {
    setSelectedTierIdx(tierIdx);
    startTimeRef.current = Date.now();
    setIsStarted(true);
    setIsFinished(false);
    initGrid();
  };

  useEffect(() => {
    if (autoStart && !isStarted && !isFinished) {
      startBlitz(selectedTierIdx);
    }
  }, [autoStart]);

  const handleSelectTier = (idx: number) => {
    setSelectedTierIdx(idx);
    setIsStarted(false);
    setIsFinished(false);
    setElapsedTime(0);
    startTimeRef.current = 0;
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

  const activeSum = (rowHeaders[activeCell.r] || 0) + (colHeaders[activeCell.c] || 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (feedback === 'correct') return;
    if (feedback === 'wrong') setFeedback('idle');
    const val = e.target.value.replace(/[^0-9]/g, '');
    setUserInput(val);

    const expectedStr = activeSum.toString();
    if (val === expectedStr || parseInt(val, 10) === activeSum) {
      setFeedback('correct');
      const cellKey = `${activeCell.r}_${activeCell.c}`;
      const newSolved = { ...solvedCells, [cellKey]: activeSum };
      setSolvedCells(newSolved);

      const newTotal = totalSolvedInRound + 1;
      setTotalSolvedInRound(newTotal);

      setTimeout(() => {
        if (newTotal >= targetSolveCount) {
          setIsFinished(true);
        } else {
          let nextC = activeCell.c + 1;
          let nextR = activeCell.r;
          if (nextC >= currentTier.size) {
            nextC = 0;
            nextR = (nextR + 1) % currentTier.size;
          }
          setActiveCell({ r: nextR, c: nextC });
          setUserInput('');
          setFeedback('idle');
          if (inputRef.current) inputRef.current.value = '';
          inputRef.current?.focus();
        }
      }, 120);
    } else if (val.length >= expectedStr.length) {
      setFeedback('wrong');
      setTimeout(() => {
        setFeedback('idle');
        setUserInput('');
        if (inputRef.current) inputRef.current.value = '';
      }, 350);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
      {/* Sleek Minimalist Tier Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 mb-4">
        <span className="text-xs font-bold text-slate-900">
          {currentTier.label} ({targetSolveCount} Cells)
        </span>

        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
          {GRID_TIERS.map((tier, idx) => {
            const isCurrent = selectedTierIdx === idx;
            return (
              <button
                key={tier.size}
                onClick={() => handleSelectTier(idx)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                }`}
              >
                {tier.shortLabel}
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
              <Grid3X3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {currentTier.label} Sprint
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Rapid row and column coordinate addition to sharpen table scanning for Data Interpretation.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-600 py-2 border-y border-slate-100">
            <span>{targetSolveCount} Cells</span>
            <span className="text-slate-300">•</span>
            <span>Range [{currentTier.range[0]}–{currentTier.range[1]}]</span>
            <span className="text-slate-300">•</span>
            <span>Target: ~{currentTier.targetSecPerCell}s/cell</span>
          </div>

          <button
            onClick={() => startBlitz(selectedTierIdx)}
            className="w-full sm:w-auto px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Grid Blitz</span>
          </button>
        </motion.div>
      )}

      {/* Screen 2: Zen Matrix Arena */}
      {isStarted && !isFinished && (
        <div className="space-y-5">
          {/* Subtle HUD */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">
                {totalSolvedInRound} <span className="text-slate-400 font-normal">/ {targetSolveCount} cells</span>
              </span>
              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-900 transition-all duration-300 rounded-full"
                  style={{ width: `${(totalSolvedInRound / targetSolveCount) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 font-mono text-slate-500">
                <Timer className="w-3.5 h-3.5 text-slate-400" />
                <span>{elapsedTime.toFixed(1)}s</span>
              </div>
              <button
                onClick={() => {
                  setIsStarted(false);
                  setElapsedTime(0);
                  startTimeRef.current = 0;
                }}
                className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Quit
              </button>
            </div>
          </div>

          {/* Prompt & Input Bar (Stitch Operand Tiles) */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs select-none">
            <span className="inline-flex items-center justify-center min-w-[3.5rem] px-3 py-2 rounded-xl border bg-blue-50/80 text-blue-700 border-blue-200 font-mono font-bold text-2xl shadow-2xs">
              {rowHeaders[activeCell.r]}
            </span>
            <span className="text-slate-400 font-bold text-2xl font-mono px-0.5">+</span>
            <span className="inline-flex items-center justify-center min-w-[3.5rem] px-3 py-2 rounded-xl border bg-slate-50 text-slate-800 border-slate-200/90 font-mono font-bold text-2xl shadow-2xs">
              {colHeaders[activeCell.c]}
            </span>
            <span className="text-slate-400 font-bold text-2xl font-mono px-0.5">=</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={userInput}
              onChange={handleInputChange}
              placeholder="?"
              className={`w-28 text-center text-2xl font-bold font-mono py-1.5 px-3 rounded-xl border transition-all outline-none ${
                feedback === 'correct'
                  ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 ring-4 ring-emerald-50'
                  : feedback === 'wrong'
                  ? 'border-rose-400 bg-rose-50/70 text-rose-800 ring-4 ring-rose-50'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 bg-slate-50/50 hover:bg-white placeholder:text-slate-300'
              }`}
              autoFocus
            />
          </div>

          {/* Interactive Matrix Grid */}
          <div className="overflow-x-auto custom-scrollbar flex justify-center py-1">
            <table className="border-collapse font-mono text-center text-xs sm:text-sm">
              <thead>
                <tr>
                  <th className="p-2 border border-slate-200 bg-slate-100 text-slate-400 font-bold w-11">
                    +
                  </th>
                  {colHeaders.map((col, cIdx) => (
                    <th
                      key={cIdx}
                      className={`p-2 border border-slate-200 min-w-11 transition-colors ${
                        cIdx === activeCell.c
                          ? 'bg-slate-800 text-white font-bold'
                          : 'bg-slate-50 text-slate-600 font-semibold'
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
                      className={`p-2 border border-slate-200 min-w-11 transition-colors ${
                        rIdx === activeCell.r
                          ? 'bg-slate-800 text-white font-bold'
                          : 'bg-slate-50 text-slate-600 font-semibold'
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
                          className={`p-2 border border-slate-200 cursor-pointer font-bold transition-all min-w-11 ${
                            isCurrent
                              ? 'bg-blue-600 text-white font-bold shadow-xs'
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

          {/* 3-Column Performance Stats Footer */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Avg Pace</div>
              <div className="text-sm font-semibold font-mono text-slate-800 mt-0.5">
                {totalSolvedInRound > 0 ? (elapsedTime / totalSolvedInRound).toFixed(1) : '0.0'}s{' '}
                <span className="text-[11px] text-slate-400 font-normal">/ cell</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Progress</div>
              <div className="text-sm font-semibold font-mono text-emerald-600 mt-0.5">
                {Math.round((totalSolvedInRound / targetSolveCount) * 100)}%{' '}
                <span className="text-[11px] text-slate-400 font-normal">
                  ({totalSolvedInRound}/{targetSolveCount})
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Target Pace</div>
              <div className="text-sm font-semibold font-mono text-slate-800 mt-0.5">
                ~{currentTier.targetSecPerCell}s
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen 3: Finished Scorecard */}
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
              Grid Completed!
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentTier.label} ({targetSolveCount} Cells)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center py-1">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Time</span>
              <span className="text-xl font-mono font-bold text-slate-900">{elapsedTime.toFixed(1)}s</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Pace</span>
              <span className="text-xl font-mono font-bold text-slate-900">
                {(elapsedTime / targetSolveCount).toFixed(2)}s
              </span>
            </div>
          </div>

          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => startBlitz(selectedTierIdx)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Grid</span>
            </button>

            {selectedTierIdx < GRID_TIERS.length - 1 && (
              <button
                onClick={() => handleSelectTier(selectedTierIdx + 1)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next Tier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
