import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, ChevronRight, ChevronLeft, Bookmark, BookmarkCheck } from 'lucide-react';
import { Question } from '../types';

interface QuestionCardProps {
  question: Question;
  onAnswer: (answer: 'a' | 'b' | 'c' | 'd') => void;
  selectedAnswer: string | null;
  showSolution: boolean;
  isBookmarked?: boolean;
  onBookmark?: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onAnswer,
  selectedAnswer,
  showSolution,
  isBookmarked = false,
  onBookmark,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl p-6 md:p-8 max-w-3xl mx-auto border border-gray-100 relative"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-sm font-semibold rounded-full">
            Question {question.q_num}
          </span>
          {question.tags?.difficulty && (
            <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${
              question.tags.difficulty === 'easy' ? 'bg-green-50 text-green-600' :
              question.tags.difficulty === 'medium' ? 'bg-yellow-50 text-yellow-600' :
              'bg-red-50 text-red-600'
            }`}>
              {question.tags.difficulty}
            </span>
          )}
        </div>
        {onBookmark && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark();
            }}
            className={`p-2 rounded-xl transition-all ${
              isBookmarked 
                ? 'bg-blue-100 text-blue-600' 
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
            title={isBookmarked ? "Remove Bookmark" : "Bookmark Question"}
          >
            {isBookmarked ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}
          </button>
        )}
      </div>

      <h2 className="text-lg md:text-xl font-medium text-gray-800 mb-8 leading-tight">
        {question.question}
      </h2>

      {question.image && (
        <div className="mb-8 rounded-xl overflow-hidden border border-gray-200">
          <img
            src={question.image.src}
            alt={question.image.caption || "Question visual"}
            className="w-full h-auto object-cover"
            referrerPolicy="no-referrer"
          />
          {question.image.caption && (
            <p className="p-3 bg-gray-50 text-sm text-gray-500 italic text-center">
              {question.image.caption}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {(Object.entries(question.options) as [('a' | 'b' | 'c' | 'd'), string][]).map(([key, value]) => {
          const isSelected = selectedAnswer === key;
          const isCorrect = question.answer === key;
          const showCorrect = showSolution && isCorrect;
          const showWrong = showSolution && isSelected && !isCorrect;

          return (
            <button
              key={key}
              onClick={() => !showSolution && onAnswer(key)}
              disabled={showSolution}
              className={`flex items-center p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
              } ${showCorrect ? 'border-green-500 bg-green-50' : ''} ${
                showWrong ? 'border-red-500 bg-red-50' : ''
              }`}
            >
              <span className={`w-8 h-8 flex items-center justify-center rounded-lg mr-4 font-bold ${
                isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-500'
              } ${showCorrect ? 'bg-green-500 text-white' : ''} ${
                showWrong ? 'bg-red-500 text-white' : ''
              }`}>
                {key.toUpperCase()}
              </span>
              <span className="flex-1 text-gray-700 font-medium">{value}</span>
              {showCorrect && <Check className="w-6 h-6 text-green-500 ml-2" />}
              {showWrong && <X className="w-6 h-6 text-red-500 ml-2" />}
            </button>
          );
        })}
      </div>

      {showSolution && question.solution && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100"
        >
          <h3 className="text-blue-800 font-bold mb-2 flex items-center">
            <Check className="w-5 h-5 mr-2" />
            Solution & Explanation
          </h3>
          <p className="text-blue-700 leading-relaxed">
            {question.solution}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};
