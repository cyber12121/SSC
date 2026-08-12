import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, RotateCcw, History } from 'lucide-react';
import { QuizResult } from '../types';
import { QuestionCard } from './QuestionCard';

interface ReviewViewProps {
  result: QuizResult;
  onReattempt: () => void;
  onBack: () => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({ result, onReattempt, onBack }) => {
  const details = result.questionDetails;

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
          {result.subject} • {new Date(result.completedAt).toLocaleDateString()} • Last Attempt Review ({result.score}/{result.totalQuestions})
        </p>
      </div>

      <div className="space-y-6">
        {details.map((d, i) => d.question ? (
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
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <button
          onClick={onReattempt}
          className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center shadow-lg"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Reattempt
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center shadow-lg"
        >
          <History className="w-5 h-5 mr-2" />
          Back to Dashboard
        </button>
      </div>
    </motion.div>
  );
};
