import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, RotateCcw, BarChart3 } from 'lucide-react';
import { QuizResult } from '../types';
import { QuestionCard } from './QuestionCard';

interface AnalysisViewProps {
  result: QuizResult;
  onReattempt: () => void;
  onBack: () => void;
}

type AnalysisTab = 'all' | 'correct' | 'incorrect' | 'skipped';

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, onReattempt, onBack }) => {
  const details = result.questionDetails;
  const correct = details.filter(d => d.isCorrect).length;
  const incorrect = details.filter(d => !d.isCorrect && d.selectedAnswer).length;
  const skipped = details.filter(d => !d.selectedAnswer).length;

  const [tab, setTab] = useState<AnalysisTab>('all');

  const filtered = details.filter(d => {
    if (tab === 'correct') return d.isCorrect;
    if (tab === 'incorrect') return !d.isCorrect && d.selectedAnswer;
    if (tab === 'skipped') return !d.selectedAnswer;
    return true;
  });

  const tabs: AnalysisTab[] = ['all', 'correct', 'incorrect', 'skipped'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto"
    >
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-black text-slate-900">{result.chapter_title}</h1>
        <p className="text-slate-500 mt-1">
          {result.subject} • {new Date(result.completedAt).toLocaleDateString()} • Previous Attempt Analysis
        </p>
      </div>

      <div className="space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
            <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Correct</div>
            <div className="text-3xl font-black text-green-600">{correct}/{result.totalQuestions}</div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
            <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Incorrect</div>
            <div className="text-3xl font-black text-red-600">{incorrect}/{result.totalQuestions}</div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
            <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Skipped</div>
            <div className="text-3xl font-black text-slate-600">{skipped}/{result.totalQuestions}</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center space-x-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-fit">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl shadow-sm border border-slate-100 text-slate-400 font-medium">
              No questions in this category.
            </div>
          ) : (
            filtered.map((d, i) => d.question ? (
              <div key={i} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <QuestionCard
                  question={d.question}
                  onAnswer={() => {}}
                  selectedAnswer={d.selectedAnswer || null}
                  showSolution={true}
                  isAdmin={false}
                  timeSpentSeconds={d.timeSpent}
                />
              </div>
            ) : (
              <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-slate-500">
                Question data unavailable (older attempt format).
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onReattempt}
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center shadow-lg"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Reattempt
          </button>
          <button
            onClick={() => onBack()}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center shadow-lg"
          >
            <BarChart3 className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    </motion.div>
  );
};
