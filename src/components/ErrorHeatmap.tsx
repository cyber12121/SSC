import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Flame, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { SubjectData, Chapter } from '../types';

interface HeatmapCell {
  subject: string;
  chapterTitle: string;
  errorCount: number;
  totalQuestions: number;
  errorRate: number;
}

interface ErrorHeatmapProps {
  mockData: SubjectData;
}

const getErrorCount = (chapter: Chapter): number => {
  return chapter.questions.filter(q => q.answer === null).length;
};

const getErrorRate = (chapter: Chapter): number => {
  const total = chapter.questions.length;
  if (total === 0) return 0;
  return getErrorCount(chapter) / total;
};

const errorRateColor = (rate: number): string => {
  if (rate === 0) return '#22c55e';
  if (rate <= 0.1) return '#84cc16';
  if (rate <= 0.2) return '#eab308';
  if (rate <= 0.3) return '#f97316';
  if (rate <= 0.5) return '#ef4444';
  return '#dc2626';
};

const errorRateBg = (rate: number): string => {
  if (rate === 0) return 'bg-green-50 border-green-200';
  if (rate <= 0.1) return 'bg-lime-50 border-lime-200';
  if (rate <= 0.2) return 'bg-yellow-50 border-yellow-200';
  if (rate <= 0.3) return 'bg-orange-50 border-orange-200';
  if (rate <= 0.5) return 'bg-red-50 border-red-200';
  return 'bg-red-100 border-red-300';
};

const errorRateText = (rate: number): string => {
  if (rate === 0) return 'text-green-700';
  if (rate <= 0.1) return 'text-lime-700';
  if (rate <= 0.2) return 'text-yellow-700';
  if (rate <= 0.3) return 'text-orange-700';
  if (rate <= 0.5) return 'text-red-700';
  return 'text-red-800';
};

export const ErrorHeatmap: React.FC<ErrorHeatmapProps> = ({ mockData }) => {
  const { topChapters, heatmapData, subjectOrder } = useMemo(() => {
    // Collect all chapters with errors across all subjects
    const allChapters: HeatmapCell[] = [];

    Object.entries(mockData).forEach(([subject, chapters]) => {
      (chapters as Chapter[]).forEach(chapter => {
        const errors = getErrorCount(chapter);
        if (errors > 0) {
          allChapters.push({
            subject,
            chapterTitle: chapter.chapter_title,
            errorCount: errors,
            totalQuestions: chapter.questions.length,
            errorRate: errors / chapter.questions.length,
          });
        }
      });
    });

    // Sort by error count descending, take top 5
    allChapters.sort((a, b) => b.errorCount - a.errorCount || b.errorRate - a.errorRate);
    const topChapters = allChapters.slice(0, 5);

    // Get unique subjects
    const subjects = [...new Set(allChapters.map(c => c.subject))];

    // Build heatmap data: for each subject, get error rate for each top chapter
    const heatmapData = subjects.map(subject => {
      const chapterRates = topChapters.map(tc => {
        const match = allChapters.find(c => c.subject === subject && c.chapterTitle === tc.chapterTitle);
        return match || { subject, chapterTitle: tc.chapterTitle, errorCount: 0, totalQuestions: 0, errorRate: 0 };
      });
      return { subject, chapters: chapterRates };
    });

    return { topChapters, heatmapData, subjectOrder: subjects };
  }, [mockData]);

  const totalErrors = topChapters.reduce((sum, c) => sum + c.errorCount, 0);
  const totalQuestions = topChapters.reduce((sum, c) => sum + c.totalQuestions, 0);
  const overallRate = totalQuestions > 0 ? (totalErrors / totalQuestions * 100) : 0;

  if (topChapters.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-100">
        <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Flame className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-4">No Errors Found</h2>
        <p className="text-slate-500 mb-8">Your mock error data looks clean — no errors recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Error Heatmap</h2>
          <p className="text-lg text-slate-500 font-medium">
            Subject-wise error density across the top 5 error-prone chapters
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <div className="text-sm font-bold text-red-600">Total Errors</div>
              <div className="text-2xl font-black text-red-700">{totalErrors}</div>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-slate-600" />
            <div>
              <div className="text-sm font-bold text-slate-500">Overall Error Rate</div>
              <div className="text-2xl font-black text-slate-800">{overallRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm">
        <span className="text-sm font-bold text-slate-500 mr-2">Error Rate:</span>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-green-100 border border-green-300"></div>
          <span className="text-xs font-bold text-slate-500">0%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-yellow-100 border border-yellow-300"></div>
          <span className="text-xs font-bold text-slate-500">10-20%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-100 border border-orange-300"></div>
          <span className="text-xs font-bold text-slate-500">20-30%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-red-100 border border-red-300"></div>
          <span className="text-xs font-bold text-slate-500">30-50%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-red-200 border border-red-400"></div>
          <span className="text-xs font-bold text-slate-500">50%+</span>
        </div>
      </div>

      {/* Top 5 Chapters Summary */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-500" />
            Top 5 Error-Prone Chapters
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {topChapters.map((cell, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                  cell.errorRate >= 0.3 ? 'bg-red-100 text-red-700' :
                  cell.errorRate >= 0.2 ? 'bg-orange-100 text-orange-700' :
                  cell.errorRate >= 0.1 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {idx + 1}
                </div>
                <div>
                  <div className="font-extrabold text-slate-800">{cell.chapterTitle}</div>
                  <div className="text-sm text-slate-500 font-medium">{cell.subject}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Errors</div>
                  <div className={`text-xl font-black ${errorRateText(cell.errorRate)}`}>{cell.errorCount}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rate</div>
                  <div className={`text-xl font-black ${errorRateText(cell.errorRate)}`}>
                    {(cell.errorRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Qs</div>
                  <div className="text-xl font-black text-slate-700">{cell.totalQuestions}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900">Subject × Chapter Heatmap</h3>
          <p className="text-sm text-slate-500 mt-1">Color intensity shows error concentration per cell</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left p-4 text-sm font-bold text-slate-500 uppercase tracking-wider min-w-[140px]">Subject</th>
                {topChapters.map((tc, idx) => (
                  <th key={idx} className="text-center p-4 text-sm font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">
                    <div className="truncate" title={tc.chapterTitle}>
                      {tc.chapterTitle.length > 25 ? tc.chapterTitle.substring(0, 25) + '…' : tc.chapterTitle}
                    </div>
                    <div className="text-xs font-normal text-slate-400 mt-1">{tc.totalQuestions} Qs</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, rowIdx) => (
                <motion.tr
                  key={row.subject}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: rowIdx * 0.08 }}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="p-4 font-extrabold text-slate-800 text-sm">{row.subject}</td>
                  {row.chapters.map((cell, colIdx) => (
                    <td key={colIdx} className="p-3 text-center">
                      {cell.errorCount === 0 ? (
                        <div className="w-full py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 text-sm font-bold">
                          —
                        </div>
                      ) : (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2 + rowIdx * 0.05 + colIdx * 0.05 }}
                          className={`py-3 rounded-xl border-2 ${errorRateBg(cell.errorRate)}`}
                        >
                          <div className={`text-lg font-black ${errorRateText(cell.errorRate)}`}>
                            {(cell.errorRate * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs font-bold text-slate-500 mt-1">
                            {cell.errorCount}/{cell.totalQuestions}
                          </div>
                        </motion.div>
                      )}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subject Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {heatmapData.map((row, idx) => {
          const subjectErrors = row.chapters.reduce((s, c) => s + c.errorCount, 0);
          const subjectQs = row.chapters.reduce((s, c) => s + c.totalQuestions, 0);
          const subjectRate = subjectQs > 0 ? (subjectErrors / subjectQs * 100) : 0;
          return (
            <motion.div
              key={row.subject}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`rounded-2xl p-6 border-2 ${
                subjectRate >= 30 ? 'bg-red-50 border-red-200' :
                subjectRate >= 15 ? 'bg-orange-50 border-orange-200' :
                subjectRate > 0 ? 'bg-yellow-50 border-yellow-200' :
                'bg-green-50 border-green-200'
              }`}
            >
              <div className="font-extrabold text-slate-800 mb-2">{row.subject}</div>
              <div className="flex items-end gap-2">
                <span className={`text-3xl font-black ${
                  subjectRate >= 30 ? 'text-red-700' :
                  subjectRate >= 15 ? 'text-orange-700' :
                  subjectRate > 0 ? 'text-yellow-700' :
                  'text-green-700'
                }`}>
                  {subjectRate.toFixed(1)}%
                </span>
                <span className="text-sm font-bold text-slate-500 pb-1">error rate</span>
              </div>
              <div className="mt-3 text-sm font-bold text-slate-500">
                {subjectErrors} errors in {subjectQs} questions
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
