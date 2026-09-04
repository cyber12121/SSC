import React from 'react';
import { Trophy, RotateCcw, Clock, Target, CheckCircle2, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { CALC_SECTIONS, SectionId } from '../../data/drills/calculationData';

export interface SectionStats {
  correct: number;
  total: number;
}

interface Props {
  statsBySection: Record<SectionId, SectionStats>;
  totalSeconds: number;
  onRestartRoutine: () => void;
  onPracticeSection: (sectionId: SectionId) => void;
  onExit: () => void;
}

export const CalculationSummary: React.FC<Props> = ({
  statsBySection,
  totalSeconds,
  onRestartRoutine,
  onPracticeSection,
  onExit,
}) => {
  const totalAttempted = Object.values(statsBySection).reduce((acc, curr) => acc + curr.total, 0);
  const totalCorrect = Object.values(statsBySection).reduce((acc, curr) => acc + curr.correct, 0);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const avgTimePerQ = totalAttempted > 0 ? (totalSeconds / totalAttempted).toFixed(1) : '0.0';

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs < 10 ? '0' : ''}${remSecs}s`;
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Trophy & Badge */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-500/10 text-amber-500 border border-amber-200 mb-4 shadow-sm animate-bounce">
          <Trophy className="w-10 h-10 fill-amber-500" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Calculation Routine Completed!
        </h1>
        <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">
          Awesome speed session! Consistent daily practice with these key numbers sharpens your instincts for SSC CGL Tier 1 & 2.
        </p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{overallAccuracy}%</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Accuracy</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalCorrect} / {totalAttempted}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Solved Correctly</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{formatTime(totalSeconds)}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{avgTimePerQ}s / question</div>
          </div>
        </div>
      </div>

      {/* Breakdown per section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs mb-8">
        <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center">
          <Zap className="w-4 h-4 mr-1.5 text-blue-600" />
          Section-by-Section Breakdown
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CALC_SECTIONS.map((sec) => {
            const stats = statsBySection[sec.id] || { correct: 0, total: 0 };
            const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            return (
              <div
                key={sec.id}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/60 transition-colors"
              >
                <div>
                  <div className="font-extrabold text-slate-800 text-sm">{sec.title}</div>
                  <div className="text-xs text-slate-400 font-medium">
                    {stats.correct} of {stats.total} correct
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                      acc >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {acc}%
                  </span>
                  <button
                    onClick={() => onPracticeSection(sec.id)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                    title={`Practice ${sec.title}`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onRestartRoutine}
          className="flex-1 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-200 flex items-center justify-center space-x-2 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Restart Daily Routine</span>
        </button>
        <button
          onClick={onExit}
          className="py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all"
        >
          Back to Hub
        </button>
      </div>
    </div>
  );
};
