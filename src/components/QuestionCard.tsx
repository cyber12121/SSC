import React from 'react';
import { Check, X, Bookmark, BookmarkCheck, Trash2, AlertTriangle, Clock, Zap } from 'lucide-react';
import { Question } from '../types';

const formatBilingualText = (text: string) => {
  if (!text) return '';
  return text
    .split(/\r?\n/)
    .map(line => {
      const parts = line.split(/\s+\/\s+/);
      return parts[0].trim();
    })
    .join('\n')
    .trim();
};

const formatSolution = (sol: string) => {
  if (!sol) return '';
  const parts = sol.split(/📖\s*हिंदी\s*स्पष्टीकरण\s*:/i);
  return parts[0].replace(/📖\s*English\s*Explanation\s*:/gi, '').trim();
};

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
      <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-5">
        <div className="flex items-center flex-wrap gap-2.5">
          <span className="text-[17px] font-bold text-gray-900">
            Question No.{question.q_num}
          </span>
          <div className="flex items-center space-x-1 text-xs text-gray-700">
            <span className="font-semibold text-gray-500">Marks</span>
            <span className="bg-[#616161] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              +2, -0.5
            </span>
          </div>
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
            <span className="flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-md">
              <Clock className="w-3.5 h-3.5 mr-1 text-gray-500" />
              You: {Math.floor(timeSpentSeconds / 60).toString().padStart(2, '0')}:{(timeSpentSeconds % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-4 text-xs font-medium text-gray-600">
          {isAdmin && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Are you sure you want to delete this question? It will be removed for everyone.")) {
                  onDelete();
                }
              }}
              className="flex items-center text-red-500 hover:text-red-700 transition-colors"
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
              className={`flex items-center space-x-1 hover:text-[#0097a7] transition-colors ${
                isBookmarked 
                  ? 'text-[#0288d1] font-bold' 
                  : 'text-gray-600'
              }`}
            >
              {isBookmarked ? (
                <>
                  <BookmarkCheck className="w-4 h-4 fill-current" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>Save</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={() => alert("Thank you. This question has been reported for review.")}
            className="flex items-center space-x-1 hover:text-red-600 transition-colors"
            title="Report Question"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Report</span>
          </button>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
        <div className="text-[16px] text-gray-900 mb-1 font-medium leading-relaxed whitespace-pre-line">
          {formatBilingualText(question.question)}
        </div>

        {question.image && (
          <div className="mb-4 border border-gray-200 p-2 inline-block">
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
        <div className="space-y-3.5 mb-6">
          {(Object.entries(question.options) as [('a' | 'b' | 'c' | 'd'), string][]).map(([key, value]) => {
            const isSelected = selectedAnswer === key;
            const isCorrect = question.answer === key;
            const showCorrect = showSolution && isCorrect;
            const showWrong = showSolution && isSelected && !isCorrect;

            if (showSolution) {
              if (showCorrect) {
                return (
                  <div
                    key={key}
                    className="bg-[#2e7d32] text-white rounded px-4 py-3 flex items-center justify-between shadow-sm transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <Check className="w-5 h-5 text-white stroke-[2.5] shrink-0" />
                      <span className="text-[15px] font-medium leading-normal">
                        {formatBilingualText(value)}
                      </span>
                    </div>
                    <span className="bg-white/20 text-white text-xs font-medium px-2.5 py-0.5 rounded shrink-0 ml-3">
                      40% answered correctly
                    </span>
                  </div>
                );
              }

              if (showWrong) {
                return (
                  <div
                    key={key}
                    className="bg-[#c62828] text-white rounded px-4 py-3 flex items-center justify-between shadow-sm transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <X className="w-5 h-5 text-white stroke-[2.5] shrink-0" />
                      <span className="text-[15px] font-medium leading-normal">
                        {formatBilingualText(value)}
                      </span>
                    </div>
                    <span className="bg-white/20 text-white text-xs font-medium px-2.5 py-0.5 rounded shrink-0 ml-3">
                      Your Answer
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={key}
                  className="px-4 py-3 text-[15px] text-gray-800 rounded hover:bg-gray-50 flex items-center transition-colors"
                >
                  <span className="w-5 mr-3 shrink-0" />
                  <span className="leading-normal">{formatBilingualText(value)}</span>
                </div>
              );
            }

            return (
              <label
                key={key}
                className={`flex items-start p-3.5 border rounded-lg transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'border-[#0097a7] bg-cyan-50/40 text-gray-900 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 text-gray-800'
                }`}
              >
                <div className="relative flex items-center justify-center mt-0.5 mr-3.5 shrink-0">
                  <input
                    type="radio"
                    name={`question-${question.q_num}`}
                    value={key}
                    checked={isSelected}
                    onChange={() => onAnswer(key)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected ? 'border-[#0097a7]' : 'border-gray-400'
                  }`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#0097a7]" />}
                  </div>
                </div>
                <div className="flex-1 text-[15px] font-medium leading-normal whitespace-pre-line">
                  {formatBilingualText(value)}
                </div>
              </label>
            );
          })}
        </div>

        {/* Subtext notice matching screenshot */}
        {showSolution && (
          <p className="text-xs text-gray-500 italic mt-1 mb-6">
            Reattempt mode is Off. Turn it on from bottom bar
          </p>
        )}

        {/* Solution Block */}
        {showSolution && question.solution && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="mb-3">
              <span className="border-b-2 border-[#0097a7] text-[#0097a7] font-bold text-sm inline-block pb-1">
                Solution
              </span>
            </div>

            <div className="bg-white rounded-lg">
              <div className="flex items-center space-x-1.5 text-amber-500 mb-2">
                <Zap className="w-4 h-4 fill-amber-400 text-amber-500" />
                <span className="text-sm font-bold text-gray-900">Shortcut Trick</span>
              </div>
              <div className="text-[14px] text-gray-800 leading-relaxed font-mono bg-gray-50 p-4 rounded-md border border-gray-100 whitespace-pre-line">
                {formatSolution(question.solution)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
