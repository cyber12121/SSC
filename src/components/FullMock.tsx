import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Layers, Play } from 'lucide-react';
import { SubjectData } from '../types';

interface FullMockProps {
  bankData: SubjectData;
  onUpload?: never;
  onStart: (counts: Record<string, number>) => void;
}

const SECTIONS = ['Reasoning', 'Mathematics', 'English', 'General Awareness'];
const PER_QUESTION_SEC = 36;

export const FullMock: React.FC<FullMockProps> = ({ bankData, onStart }) => {
  const available: Record<string, number> = {};
  SECTIONS.forEach(s => {
    available[s] = (bankData[s] || []).reduce((acc, ch) => acc + ch.questions.length, 0);
  });

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    SECTIONS.forEach(s => { init[s] = Math.min(25, available[s]); });
    return init;
  });

  const totalSelected = SECTIONS.reduce((acc, s) => acc + (counts[s] || 0), 0);
  const totalTimeMin = Math.round((totalSelected * PER_QUESTION_SEC) / 60);

  const update = (s: string, v: number) => {
    const max = available[s];
    const val = Math.max(0, Math.min(max, Number.isNaN(v) ? 0 : v));
    setCounts(prev => ({ ...prev, [s]: val }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-900 mb-4">Full-Length Mock Test</h1>
        <p className="text-xl text-slate-500">
          Build a custom full mock by choosing how many questions to pull from each section. Questions are drawn randomly from your chapter bank.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Sections
          </h3>
          <span className="text-sm font-bold text-slate-500">
            {totalSelected} questions - ~{totalTimeMin} min
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {SECTIONS.map(s => {
            const avail = available[s];
            const has = avail > 0;
            return (
              <div key={s} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-800">{s}</div>
                  <div className="text-sm text-slate-500">{avail} questions available</div>
                </div>
                {has ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => update(s, (counts[s] || 0) - 5)}
                      className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={avail}
                      value={counts[s] || 0}
                      onChange={e => update(s, parseInt(e.target.value || '0', 10))}
                      className="w-20 text-center px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button
                      onClick={() => update(s, (counts[s] || 0) + 5)}
                      className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition-colors"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="px-3 py-1 bg-slate-100 text-slate-400 text-xs font-bold rounded-full">No questions</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-6 bg-slate-50 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Total: <span className="font-bold text-slate-800">{totalSelected}</span> questions
            {totalTimeMin > 0 && <span className="ml-1">- ~{totalTimeMin} min</span>}
          </span>
          <button
            onClick={() => onStart(counts)}
            disabled={totalSelected === 0}
            className={
              'px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center shadow-lg ' +
              (totalSelected === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-xl hover:-translate-y-0.5')
            }
          >
            <Play className="w-4 h-4 mr-2 fill-current" />
            Start Mock
          </button>
        </div>
      </div>

      {totalSelected === 0 && (
        <div className="text-center py-10 text-slate-400 font-medium">
          Select at least one question from a section to begin.
        </div>
      )}
    </motion.div>
  );
};
