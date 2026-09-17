import React from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { Chapter } from '../../types';
import { MockSection } from './QuizPaletteSidebar';

interface QuizSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  mode: 'practice' | 'mock';
  chapter: Chapter;
  totalQuestions: number;
  activeSection: MockSection;
  // Practice stats
  scorePractice: number;
  wrongPractice: number;
  unattemptedPractice: number;
  accuracyPractice: number;
  // Mock stats
  stats: {
    answered: number;
    marked: number;
    notAttempted: number;
  };
}

export const QuizSubmitModal: React.FC<QuizSubmitModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  mode,
  chapter,
  totalQuestions,
  activeSection,
  scorePractice,
  wrongPractice,
  unattemptedPractice,
  accuracyPractice,
  stats
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div
          className={`text-white px-5 py-3.5 flex items-center justify-between ${
            mode === 'practice' ? 'bg-emerald-700' : 'bg-[#2460b9]'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-white" />
            <h3 className="font-bold text-base">
              {mode === 'practice' ? 'Finish Practice Session' : 'Submit Test Confirmation'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="hover:bg-white/20 p-1 rounded text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            {mode === 'practice'
              ? 'Ready to wrap up your practice session? Here is your performance summary:'
              : 'Are you sure you want to submit your test? Here is your current attempt summary:'}
          </p>

          {mode === 'practice' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between font-bold border-b border-slate-200 pb-1.5 text-gray-700">
                <span>Chapter</span>
                <span className="text-gray-900 truncate max-w-[200px]">{chapter.chapter_title}</span>
              </div>
              <div className="flex justify-between py-0.5 text-gray-600">
                <span>Total Questions:</span>
                <span className="font-bold text-gray-900">{totalQuestions}</span>
              </div>
              <div className="flex justify-between py-0.5 text-emerald-700 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  Correct:
                </span>
                <span className="font-bold">{scorePractice}</span>
              </div>
              <div className="flex justify-between py-0.5 text-rose-700 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
                  Incorrect:
                </span>
                <span className="font-bold">{wrongPractice}</span>
              </div>
              <div className="flex justify-between py-0.5 text-gray-700 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" />
                  Unattempted:
                </span>
                <span className="font-bold">{unattemptedPractice}</span>
              </div>
              <div className="flex justify-between py-0.5 text-indigo-700 font-bold border-t border-slate-200 pt-1.5">
                <span>Accuracy:</span>
                <span>{accuracyPractice}%</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between font-bold border-b border-slate-200 pb-1.5 text-gray-700">
                <span>Current Section</span>
                <span className="text-gray-900">{activeSection.title}</span>
              </div>
              <div className="flex justify-between py-0.5 text-gray-600">
                <span>Total Questions:</span>
                <span className="font-bold text-gray-900">{totalQuestions}</span>
              </div>
              <div className="flex justify-between py-0.5 text-emerald-700 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  Answered:
                </span>
                <span className="font-bold">{stats.answered}</span>
              </div>
              <div className="flex justify-between py-0.5 text-amber-700 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  Not Attempted:
                </span>
                <span className="font-bold">{totalQuestions - stats.answered - stats.marked}</span>
              </div>
              <div className="flex justify-between py-0.5 text-purple-700 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                  Marked for Review:
                </span>
                <span className="font-bold">{stats.marked}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              {mode === 'practice' ? 'Continue Practicing' : 'Return to Test'}
            </button>
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting
                ? 'Saving...'
                : mode === 'practice'
                ? 'Finish & Save Summary'
                : 'Yes, Submit Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
