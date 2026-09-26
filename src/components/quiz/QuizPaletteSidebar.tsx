import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { Question } from '../../types';

export interface MockSection {
  id: string;
  label: string;
  title: string;
  startIndex: number;
  endIndex: number;
  count: number;
}

interface QuizPaletteSidebarProps {
  mode: 'practice' | 'mock';
  activeSection: MockSection;
  sectionQuestions: Question[];
  answers: Record<number, string>;
  markedForReview: Set<number>;
  currentIdx: number;
  isQuestionCorrect: (idx: number) => boolean;
  jumpToQuestion: (idx: number) => void;
  totalQuestions: number;
  answeredPractice: number;
  scorePractice: number;
  wrongPractice: number;
  unattemptedPractice: number;
  accuracyPractice: number;
  sectionAnswered: number;
  sectionNotAnswered: number;
  sectionMarked: number;
  onClose?: () => void;
  className?: string;
  sections?: MockSection[];
  activeSectionIdx?: number;
  onSelectSection?: (idx: number) => void;
}

export const QuizPaletteSidebar: React.FC<QuizPaletteSidebarProps> = React.memo(({
  mode,
  activeSection,
  sectionQuestions,
  answers,
  markedForReview,
  currentIdx,
  isQuestionCorrect,
  jumpToQuestion,
  totalQuestions,
  answeredPractice,
  scorePractice,
  wrongPractice,
  unattemptedPractice,
  accuracyPractice,
  sectionAnswered,
  sectionNotAnswered,
  sectionMarked,
  onClose,
  className = '',
  sections,
  activeSectionIdx,
  onSelectSection
}) => {
  const handleQuestionClick = (idx: number) => {
    jumpToQuestion(idx);
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className={`w-full lg:w-[320px] shrink-0 min-h-0 border-l border-gray-300 bg-white p-4 flex flex-col h-full overflow-y-auto pb-8 custom-scrollbar ${className}`}>
      {/* Header */}
      {mode === 'practice' ? (
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
          <div className="flex items-center gap-1.5 text-gray-900 font-bold text-sm">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Practice Palette</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-500">
              {answeredPractice}/{totalQuestions} Attempted
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Close Palette"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-800 font-bold text-sm sm:text-base min-w-0 pr-2">
            <span className="text-[#00baf2] text-base leading-none shrink-0">▶</span>
            <span className="font-bold text-gray-900 text-sm truncate">
              {activeSection.title || 'General Intelligence'}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              title="Close Palette"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Section Switcher in Drawer mode if sections provided */}
      {sections && sections.length > 1 && onSelectSection && (
        <div className="flex items-center gap-1.5 mb-3 pb-2 overflow-x-auto no-scrollbar shrink-0">
          {sections.map((sec, idx) => {
            const isActive = idx === activeSectionIdx;
            const hasQuestions = sec.count > 0;
            return (
              <button
                key={sec.id}
                onClick={() => onSelectSection(idx)}
                disabled={!hasQuestions}
                className={`px-2.5 py-1 text-xs font-bold rounded transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#008000] text-white shadow-2xs'
                    : hasQuestions
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                    : 'bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                }`}
              >
                {sec.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Question Palette Grid */}
      <div className="grid grid-cols-6 gap-x-2 gap-y-2.5 mb-4">
        {sectionQuestions.map((_, localIdx) => {
          const globalIdx = activeSection.startIndex + localIdx;
          const isAnswered = answers[globalIdx] !== undefined;
          const isCorrect = isQuestionCorrect(globalIdx);
          const isMarked = markedForReview.has(globalIdx);
          const isCurrent = globalIdx === currentIdx;

          if (mode === 'practice') {
            let btnColor = 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200';
            if (isAnswered) {
              btnColor = isCorrect
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                : 'bg-rose-600 text-white hover:bg-rose-700 shadow-2xs';
            }

            return (
              <button
                key={globalIdx}
                onClick={() => handleQuestionClick(globalIdx)}
                className={`w-9 h-8 sm:w-10 sm:h-8 rounded-[3px] font-bold text-xs sm:text-sm flex items-center justify-center cursor-pointer transition-all ${btnColor} ${
                  isCurrent ? 'ring-2 ring-indigo-600 ring-offset-1 scale-105 z-10 font-black shadow-xs' : ''
                }`}
                title={`Question ${localIdx + 1}: ${isAnswered ? (isCorrect ? 'Correct' : 'Incorrect') : 'Not Attempted'}`}
              >
                <span className="leading-none">{localIdx + 1}</span>
              </button>
            );
          }

          // Official Testbook Symbol & Color Coding for Mock Mode:
          let btnColor = 'bg-[#0000ff] text-white';
          let showArrow = false;

          if (isAnswered && isMarked) {
            btnColor = 'bg-[#ffff00] text-black font-bold border border-yellow-400';
            showArrow = true;
          } else if (isMarked) {
            btnColor = 'bg-[#cc0000] text-white';
            showArrow = true;
          } else if (isAnswered) {
            btnColor = 'bg-[#008000] text-white';
            showArrow = false;
          } else {
            btnColor = 'bg-[#0000ff] text-white';
            showArrow = false;
          }

          return (
            <div key={globalIdx} className="flex flex-col items-center justify-start relative">
              <button
                onClick={() => handleQuestionClick(globalIdx)}
                className={`w-9 h-8 sm:w-10 sm:h-8 rounded-[2px] font-bold text-xs sm:text-sm flex items-center justify-center cursor-pointer transition-colors shadow-2xs ${btnColor} hover:opacity-90`}
                title={`Question ${localIdx + 1}`}
              >
                <span className="leading-none">{localIdx + 1}</span>
              </button>
              {showArrow && (
                <span className="text-[8px] text-black font-black leading-none mt-0.5 select-none">
                  ▲
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Practice Mode Legend */}
      {mode === 'practice' && (
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-semibold text-slate-700 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-[2px] bg-emerald-600 shrink-0" />
            <span>Correct</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-[2px] bg-rose-600 shrink-0" />
            <span>Wrong</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-[2px] bg-slate-200 border border-slate-300 shrink-0" />
            <span>Unattempted</span>
          </div>
        </div>
      )}

      {/* Performance / Analysis Table */}
      {mode === 'practice' ? (
        <div className="mt-auto border border-emerald-300 rounded-md overflow-hidden shadow-2xs">
          <div className="bg-emerald-700 py-1.5 text-center font-bold text-xs text-white tracking-wide">
            Practice Performance
          </div>
          <table className="w-full text-xs border-collapse bg-white">
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="p-2 font-medium text-emerald-800 bg-emerald-50/50 pl-3">Correct</td>
                <td className="p-2 font-bold text-emerald-700 bg-emerald-50/80 text-center w-16">
                  {scorePractice}
                </td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-rose-800 bg-rose-50/50 pl-3">Incorrect</td>
                <td className="p-2 font-bold text-rose-700 bg-rose-50/80 text-center w-16">
                  {wrongPractice}
                </td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-gray-700 pl-3">Unattempted</td>
                <td className="p-2 font-bold text-gray-700 text-center w-16">
                  {unattemptedPractice}
                </td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-indigo-800 bg-indigo-50/50 pl-3">Accuracy</td>
                <td className="p-2 font-bold text-indigo-700 bg-indigo-50/80 text-center w-16">
                  {accuracyPractice}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-auto border border-gray-400 rounded-none overflow-hidden shadow-2xs">
          <div className="bg-[#b8b8b8] border-b border-gray-400 py-1 text-center font-bold text-xs sm:text-sm text-gray-900 tracking-wide">
            {activeSection.label} Analysis
          </div>

          <table className="w-full text-xs sm:text-sm border-collapse">
            <tbody>
              <tr className="border-b border-gray-400">
                <td className="p-1.5 font-medium text-gray-800 bg-white pl-2.5">
                  Answered
                </td>
                <td className="p-1.5 font-bold text-red-600 bg-[#ffff00] text-center w-14 border-l border-gray-400">
                  {sectionAnswered}
                </td>
              </tr>
              <tr className="border-b border-gray-400">
                <td className="p-1.5 font-medium text-gray-800 bg-white pl-2.5">
                  Not Answered
                </td>
                <td className="p-1.5 font-bold text-red-600 bg-[#ffff00] text-center w-14 border-l border-gray-400">
                  {sectionNotAnswered}
                </td>
              </tr>
              <tr>
                <td className="p-1.5 font-medium text-gray-800 bg-white pl-2.5">
                  Mark for Review
                </td>
                <td className="p-1.5 font-bold text-red-600 bg-[#ffff00] text-center w-14 border-l border-gray-400">
                  {sectionMarked}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </aside>
  );
});
QuizPaletteSidebar.displayName = 'QuizPaletteSidebar';
