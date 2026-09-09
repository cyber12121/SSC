import React from 'react';
import { Check, RotateCcw, Bookmark, BookmarkCheck, Trash2, Flag, Clock, Zap } from 'lucide-react';
import { Question } from '../types';

import { cleanSolutionText } from '../utils/cleanSolution';

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
  return cleanSolutionText(sol);
};

const fmt = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

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
  avgTimeSeconds?: number;
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
  avgTimeSeconds,
}) => {
  const optionKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
  const correctAnswerKey = (question.answer || (question as any).correct_answer || (question as any).correctOption || '')?.toString().toLowerCase().trim();
  const normalizedSelected = selectedAnswer?.toLowerCase().trim() || null;
  const isCorrect = normalizedSelected !== null && normalizedSelected === correctAnswerKey;
  const isAttempted = !!normalizedSelected;

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Testbook-style Question Meta Header */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-gray-200 shrink-0 min-h-[44px] bg-white">
        <div className="flex items-center flex-wrap gap-2.5">
          <span className="text-[16px] font-bold text-gray-900 tracking-tight">
            Question No.{question.q_num}
          </span>

          {question.tags?.topic && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
              {question.tags.topic}
            </span>
          )}

          {showSolution ? (
            <>
              {isAttempted ? (
                isCorrect ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#2e7d32] text-white">
                    Correct
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#c62828] text-white">
                    Incorrect
                  </span>
                )
              ) : (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-500 text-white">
                  Unattempted
                </span>
              )}

              {timeSpentSeconds !== undefined && (
                <span className="flex items-center text-xs font-medium text-gray-600 gap-1 ml-1">
                  <Clock className="w-3.5 h-3.5 text-[#0097a7]" />
                  <span>You: {fmt(timeSpentSeconds)}</span>
                  {avgTimeSeconds !== undefined && (
                    <span className="text-gray-400 ml-1">| Avg: {fmt(avgTimeSeconds)}</span>
                  )}
                </span>
              )}

              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 ml-1">
                Marks +2, -0.5
              </span>
            </>
          ) : (
            <>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#616161] text-white">
                Marks +2, -0.5
              </span>
              {timeSpentSeconds !== undefined && (
                <span className="flex items-center text-xs font-medium text-gray-600 gap-1 ml-1">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span>You: {fmt(timeSpentSeconds)}</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Action icons right */}
        <div className="flex items-center gap-4 text-xs font-medium text-gray-600 shrink-0">
          {isAdmin && onDelete && (
            <button
              onClick={e => {
                e.stopPropagation();
                if (window.confirm('Delete this question for everyone?')) onDelete();
              }}
              className="flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}
          {onBookmark && (
            <button
              onClick={e => { e.stopPropagation(); onBookmark(); }}
              className={`flex items-center gap-1 transition-colors ${
                isBookmarked ? 'text-[#0097a7] font-semibold' : 'hover:text-[#0097a7]'
              }`}
            >
              {isBookmarked ? (
                <>
                  <BookmarkCheck className="w-4 h-4 fill-[#0097a7]" />
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
            onClick={() => alert('Thank you. This question has been reported for review.')}
            className="flex items-center gap-1 hover:text-orange-600 transition-colors"
          >
            <Flag className="w-4 h-4" />
            <span>Report</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Question Text */}
        <div className="mb-6">
          <p className="text-[15.5px] font-medium text-gray-900 leading-relaxed whitespace-pre-line select-text">
            {formatBilingualText(question.question)}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {optionKeys.map(key => {
            const value = question.options[key];
            if (!value) return null;

            const isSelected = normalizedSelected === key;
            const isCorrectOption = correctAnswerKey === key;

            // In solution mode:
            if (showSolution) {
              if (isCorrectOption) {
                // Testbook green correct banner
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-md bg-[#2e7d32] text-white shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 shrink-0 stroke-[3]" />
                      <span className="text-[15px] font-medium leading-snug">
                        {formatBilingualText(value)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected ? (
                        <span className="text-[11px] font-semibold bg-white/20 text-white px-2.5 py-0.5 rounded border border-white/30">
                          Your Attempt (Correct)
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold bg-white/20 text-white px-2.5 py-0.5 rounded border border-white/30">
                          Correct Answer
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              if (isSelected && !isCorrectOption) {
                // Testbook red wrong attempt banner
                return (
                  <div
                    key={key}
                    className="flex items-center w-full px-4 py-3 rounded-md bg-[#c62828] text-white shadow-sm transition-all"
                  >
                    <RotateCcw className="w-4 h-4 mr-3 shrink-0 stroke-[2.5]" />
                    <span className="text-[15px] font-medium leading-snug">
                      {formatBilingualText(value)}
                    </span>
                  </div>
                );
              }

              // Normal unselected option in solution mode
              return (
                <div
                  key={key}
                  className="flex items-center w-full px-4 py-3 rounded-md border border-gray-200 bg-white text-gray-800"
                >
                  <span className="w-5 mr-3 shrink-0" />
                  <span className="text-[15px] font-medium leading-snug">
                    {formatBilingualText(value)}
                  </span>
                </div>
              );
            }

            // Live Test / Practice Mode: Testbook rounded option cards
            return (
              <label
                key={key}
                onClick={() => onAnswer(key)}
                className={`flex items-center w-full px-4 py-3.5 border rounded-xl cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'border-[#0097a7] bg-[#e0f7fa]/30 ring-1 ring-[#0097a7] shadow-sm'
                    : 'border-gray-200 bg-white hover:border-[#0fa4a5] hover:bg-gray-50/60'
                }`}
              >
                <input
                  type="radio"
                  name={`q-${question.q_num}`}
                  value={key}
                  checked={isSelected}
                  onChange={() => onAnswer(key)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3.5 shrink-0 transition-colors ${
                    isSelected ? 'border-[#0097a7]' : 'border-gray-400'
                  }`}
                >
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#0097a7]" />}
                </div>
                <span className="text-[15px] font-medium text-gray-800 leading-snug whitespace-pre-line flex-1">
                  {formatBilingualText(value)}
                </span>
              </label>
            );
          })}
        </div>

        {question.tags?.difficulty && (
          <span
            className={`inline-block mb-4 px-2.5 py-0.5 text-[11px] font-semibold uppercase rounded tracking-wide ${
              question.tags.difficulty === 'hard'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : question.tags.difficulty === 'medium'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {question.tags.difficulty}
          </span>
        )}

        {/* Testbook Solution Block */}
        {showSolution && question.solution && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="mb-3">
              <span className="border-b-2 border-[#0097a7] text-[#0097a7] font-bold text-sm inline-block pb-1">
                Solution
              </span>
            </div>
            <div className="bg-white rounded-lg">
              <div className="flex items-center gap-1.5 text-amber-600 mb-2">
                <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span className="text-sm font-bold text-gray-900 underline decoration-amber-400 decoration-2 underline-offset-2">
                  {/shortcut trick/i.test(question.solution) ? 'Shortcut Trick & Detailed Solution' : 'Detailed Explanation'}
                </span>
              </div>
              <div className="text-[13.5px] text-gray-800 leading-relaxed font-mono bg-gray-50 p-4 rounded-md border border-gray-100 whitespace-pre-line">
                {formatSolution(question.solution)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
