import React from 'react';
import { Check, X, Bookmark, BookmarkCheck, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { Question } from '../types';

interface QuestionCardProps {
  question: Question;
  onAnswer: (answer: 'a' | 'b' | 'c' | 'd') => void;
  selectedAnswer: string | null;
  showSolution: boolean;
  isBookmarked?: boolean;
  onBookmark?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
  timeSpentSeconds?: number;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onAnswer,
  selectedAnswer,
  showSolution,
  isBookmarked = false,
  onBookmark,
  onDelete,
  isAdmin = false,
  timeSpentSeconds,
}) => {
  return (
    <div className="bg-white h-full flex flex-col px-8 py-6">
      {/* Question Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-lg font-bold text-gray-800">
            Question No. {question.q_num}
          </span>
          {question.tags?.difficulty && (
            <span className={`px-2 py-0.5 text-xs font-semibold uppercase rounded ${
              question.tags.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
              question.tags.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {question.tags.difficulty}
            </span>
          )}
          {timeSpentSeconds !== undefined && (
            <span className="flex items-center text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Time Taken: {Math.floor(timeSpentSeconds / 60)}m {timeSpentSeconds % 60}s
            </span>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {isAdmin && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Are you sure you want to delete this question? It will be removed for everyone.")) {
                  onDelete();
                }
              }}
              className="flex items-center text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
              title="Delete Question"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </button>
          )}
          {onBookmark && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBookmark();
              }}
              className={`flex items-center text-sm font-medium transition-colors ${
                isBookmarked 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {isBookmarked ? (
                <>
                  <BookmarkCheck className="w-4 h-4 mr-1 fill-current" />
                  Saved
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4 mr-1" />
                  Save
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
        <div className="text-[16px] text-gray-900 mb-8 font-medium leading-relaxed">
          {question.question}
        </div>

        {question.image && (
          <div className="mb-8 border border-gray-200 p-2 inline-block">
            <img
              src={question.image.src}
              alt={question.image.caption || "Question visual"}
              className="max-w-full h-auto object-contain max-h-96"
              referrerPolicy="no-referrer"
            />
            {question.image.caption && (
              <p className="mt-2 text-sm text-gray-500 italic">
                {question.image.caption}
              </p>
            )}
          </div>
        )}

        {/* Options */}
        <div className="space-y-4 mb-8">
          {(Object.entries(question.options) as [('a' | 'b' | 'c' | 'd'), string][]).map(([key, value]) => {
            const isSelected = selectedAnswer === key;
            const isCorrect = question.answer === key;
            const showCorrect = showSolution && isCorrect;
            const showWrong = showSolution && isSelected && !isCorrect;

            return (
              <label
                key={key}
                className={`flex items-start p-3 border rounded transition-all duration-150 ${
                  showSolution ? 'cursor-default' : 'cursor-pointer hover:bg-blue-50'
                } ${
                  isSelected && !showSolution ? 'bg-blue-50 border-blue-300' : 'border-transparent'
                } ${showCorrect ? 'bg-green-50 border-green-300' : ''} ${
                  showWrong ? 'bg-red-50 border-red-300' : ''
                }`}
              >
                <div className="relative flex items-center justify-center mt-0.5 mr-4">
                  <input
                    type="radio"
                    name={`question-${question.q_num}`}
                    value={key}
                    checked={isSelected}
                    onChange={() => !showSolution && onAnswer(key)}
                    disabled={showSolution}
                    className="sr-only" // Hide default radio
                  />
                  {/* Custom Radio Button */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-blue-600' : 'border-gray-400'
                  } ${showCorrect ? 'border-green-600 bg-green-600 text-white' : ''} ${
                    showWrong ? 'border-red-600 bg-red-600 text-white' : ''
                  }`}>
                    {isSelected && !showSolution && <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>}
                    {showCorrect && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    {showWrong && <X className="w-3.5 h-3.5" strokeWidth={3} />}
                  </div>
                </div>
                <div className={`flex-1 text-[15px] ${showCorrect ? 'text-green-800 font-semibold' : ''} ${showWrong ? 'text-red-800 font-semibold' : 'text-gray-800'}`}>
                  {value}
                </div>
              </label>
            );
          })}
        </div>

        {/* Solution Block */}
        {showSolution && question.solution && (
          <div className="mt-8 p-5 bg-green-50 rounded border border-green-200">
            <h3 className="text-green-800 font-bold mb-3 flex items-center text-sm uppercase tracking-wide">
              <Check className="w-4 h-4 mr-2" />
              Solution
            </h3>
            <div className="text-green-900 leading-relaxed text-[15px]">
              {question.solution}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
