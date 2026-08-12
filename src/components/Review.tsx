import React, { useState } from 'react';
import { RotateCcw, History, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { QuizResult } from '../types';
import { QuestionCard } from './QuestionCard';

interface ReviewViewProps {
  result: QuizResult;
  onReattempt: () => void;
  onBack: () => void;
}

type Status = 'correct' | 'wrong' | 'skipped';

const getStatus = (selectedAnswer: string, isCorrect: boolean): Status => {
  if (selectedAnswer) return isCorrect ? 'correct' : 'wrong';
  return 'skipped';
};

export const ReviewView: React.FC<ReviewViewProps> = ({ result, onReattempt, onBack }) => {
  const items = result.questionDetails;
  const [currentIdx, setCurrentIdx] = useState(0);

  const current = items[currentIdx];
  const totalTime = result.totalTime || 0;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] bg-gray-100 border-t border-gray-200">
      {/* LEFT COLUMN: Question area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="bg-slate-700 text-white px-6 py-3 flex items-center justify-between shadow-sm z-10">
          <div className="font-bold text-lg flex items-center gap-3 truncate">
            Review Mode: {result.chapter_title}
            <span className="text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-md">
              Time: {Math.floor(totalTime / 60)}m {totalTime % 60}s
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onReattempt}
              className="flex items-center bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reattempt
            </button>
            <button
              onClick={onBack}
              className="flex items-center bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors"
            >
              <History className="w-3.5 h-3.5 mr-1.5" />
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Question content */}
        <div className="flex-1 overflow-hidden relative">
          {current?.question ? (
            <QuestionCard
              question={current.question}
              onAnswer={() => {}}
              selectedAnswer={current.selectedAnswer || null}
              showSolution={true}
              isAdmin={false}
              timeSpentSeconds={current.timeSpent}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 font-medium p-8 text-center">
              Question data unavailable (older attempt format).
            </div>
          )}
        </div>

        {/* Action bar (mirrors the in-quiz review bar) */}
        <div className="flex items-center justify-center space-x-2 py-3 border-t border-gray-200 bg-white">
          <button
            onClick={() => currentIdx > 0 && setCurrentIdx(currentIdx - 1)}
            disabled={currentIdx === 0}
            className={`px-5 py-1.5 rounded text-sm font-medium transition-colors ${
              currentIdx === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-700 text-white hover:bg-slate-800'
            }`}
          >
            Previous
          </button>
          <button
            onClick={() => currentIdx < items.length - 1 && setCurrentIdx(currentIdx + 1)}
            disabled={currentIdx === items.length - 1}
            className={`px-5 py-1.5 rounded text-sm font-medium transition-colors ${
              currentIdx === items.length - 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-700 text-white hover:bg-slate-800'
            }`}
          >
            Next
          </button>
          <button
            onClick={onBack}
            className="px-5 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Palette */}
      <div className="w-full lg:w-80 bg-blue-50/30 flex flex-col border-l border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              <img src="https://ui-avatars.com/api/?name=Candidate&background=0D8ABC&color=fff" alt="User" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800">Review Mode</div>
              <div className="text-xs text-gray-500">{result.subject}</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 grid grid-cols-3 gap-2 border-b border-gray-200 bg-white text-xs font-medium text-gray-700">
          <div className="flex items-center">
            <span className="w-5 h-5 rounded-tl-full rounded-tr-full rounded-br-full flex items-center justify-center bg-green-500 text-white mr-2 text-[10px]">
              <CheckCircle2 className="w-3 h-3" />
            </span>
            Correct
          </div>
          <div className="flex items-center">
            <span className="w-5 h-5 rounded-bl-full rounded-tr-full rounded-br-full flex items-center justify-center bg-red-500 text-white mr-2 text-[10px]"></span>
            Wrong
          </div>
          <div className="flex items-center">
            <span className="w-5 h-5 rounded-md flex items-center justify-center bg-gray-200 text-gray-700 mr-2 text-[10px]"></span>
            Skipped
          </div>
        </div>

        <div className="p-4 bg-blue-50/20 flex-1 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Choose a Question</div>
          <div className="grid grid-cols-4 gap-3">
            {items.map((d, idx) => {
              const status = getStatus(d.selectedAnswer, d.isCorrect);
              const isActive = currentIdx === idx;

              let bgClass = 'bg-gray-200 text-gray-700 hover:bg-gray-300';
              let shapeClass = 'rounded-md';
              if (status === 'correct') {
                bgClass = 'bg-green-500 text-white hover:bg-green-600';
                shapeClass = 'rounded-tl-full rounded-tr-full rounded-br-full';
              } else if (status === 'wrong') {
                bgClass = 'bg-red-500 text-white hover:bg-red-600';
                shapeClass = 'rounded-bl-full rounded-tr-full rounded-br-full';
              }

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-10 h-10 flex items-center justify-center text-sm font-semibold transition-colors relative mx-auto
                    ${bgClass} ${shapeClass} ${isActive ? 'ring-2 ring-blue-400 ring-offset-2' : ''} ${d.marked ? 'ring-2 ring-purple-400 ring-offset-1' : ''}
                  `}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
