import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  LogIn,
  Loader2,
  Trophy,
  Flame,
  BookOpen,
  Target,
  ListChecks,
  Clock,
  Trash2,
  Search,
  RotateCcw
} from 'lucide-react';
import { QuizResult } from '../types';
import { getSubjectTheme, formatAttemptDate, computeDashboardStats } from '../utils/subjectThemes';

interface PerformanceDashboardProps {
  user: any;
  loadingResults: boolean;
  userResults: QuizResult[];
  onClearAllResults: () => Promise<void>;
  onDeleteResult: (id?: string) => void;
  onOpenReview: (result: QuizResult) => void;
  onReattempt: (result: QuizResult) => void;
  onLogin: () => void;
  onNavigateHome: () => void;
  onNavigateHeatmap: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  user,
  loadingResults,
  userResults,
  onClearAllResults,
  onDeleteResult,
  onOpenReview,
  onReattempt,
  onLogin,
  onNavigateHome,
  onNavigateHeatmap,
}) => {
  const [dashCategoryFilter, setDashCategoryFilter] = useState<'all' | 'chapterBank' | 'mockErrors'>('all');
  const [dashSubjectFilter, setDashSubjectFilter] = useState<string>('all');
  const [dashSearchQuery, setDashSearchQuery] = useState<string>('');
  const [dashSort, setDashSort] = useState<'newest' | 'accuracy-desc' | 'accuracy-asc'>('newest');

  const dashboardStats = useMemo(() => computeDashboardStats(userResults), [userResults]);

  const filteredUserResults = useMemo(() => {
    return userResults
      .filter(r => {
        if (dashCategoryFilter !== 'all' && r.category !== dashCategoryFilter) return false;
        if (dashSubjectFilter !== 'all') {
          const theme = getSubjectTheme(r.subject);
          if (theme.name !== dashSubjectFilter && r.subject !== dashSubjectFilter) return false;
        }
        if (dashSearchQuery.trim()) {
          const q = dashSearchQuery.toLowerCase();
          const matchTitle = (r.chapter_title || '').toLowerCase().includes(q);
          const matchSub = (r.subject || '').toLowerCase().includes(q);
          if (!matchTitle && !matchSub) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (dashSort === 'newest') {
          return new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime();
        }
        const accA = a.totalQuestions > 0 ? a.score / a.totalQuestions : 0;
        const accB = b.totalQuestions > 0 ? b.score / b.totalQuestions : 0;
        if (dashSort === 'accuracy-desc') return accB - accA;
        if (dashSort === 'accuracy-asc') return accA - accB;
        return 0;
      });
  }, [userResults, dashCategoryFilter, dashSubjectFilter, dashSearchQuery, dashSort]);

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-4"
    >
      {!user ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-100">
          <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <LogIn className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4">Login to Track Progress</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Sign in with Google to store your quiz attempts, view detailed performance metrics, and track your SSC CGL preparation journey.
          </p>
          <button
            onClick={onLogin}
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            Login with Google
          </button>
        </div>
      ) : loadingResults ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-500 font-bold text-lg">Fetching your performance analytics...</p>
        </div>
      ) : userResults.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Trophy className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-3">No Results Recorded Yet</h2>
          <p className="text-slate-500 mb-8 max-w-lg mx-auto">
            Complete a practice quiz or mock error drill to see your accuracy, speed breakdown, and subject-level insights here.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onNavigateHome}
              className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              Start Chapter Practice
            </button>
            <button
              onClick={onNavigateHeatmap}
              className="px-8 py-3.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl font-bold hover:bg-rose-100 transition-all"
            >
              View Error Heatmap
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Dashboard Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[9px] font-bold uppercase tracking-wider">SSC CGL Analytics</span>
                <h2 className="text-xs font-bold text-slate-900 leading-none">Performance Dashboard</h2>
              </div>
              <p className="text-slate-400 text-[10px] font-medium mt-0.5">
                Comprehensive overview of your accuracy, pacing, and subject strengths.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onNavigateHeatmap}
                className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition-colors flex items-center gap-1 border border-rose-100 shadow-xs"
              >
                <Flame className="w-3 h-3 text-rose-600" />
                Heatmap
              </button>
              <button
                onClick={onNavigateHome}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-[11px] transition-all shadow-xs flex items-center gap-1"
              >
                <BookOpen className="w-3 h-3" />
                Practice Hub
              </button>
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
            <div className="bg-white px-2.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Trophy className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 leading-none">{dashboardStats.totalQuizzes}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Quizzes</div>
              </div>
            </div>

            <div className="bg-white px-2.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80 flex items-center gap-2">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                dashboardStats.overallAccuracy >= 75 ? 'bg-emerald-50 text-emerald-600' :
                dashboardStats.overallAccuracy >= 50 ? 'bg-amber-50 text-amber-600' :
                'bg-rose-50 text-rose-600'
              }`}>
                <Target className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-bold leading-none ${
                  dashboardStats.overallAccuracy >= 75 ? 'text-emerald-600' :
                  dashboardStats.overallAccuracy >= 50 ? 'text-amber-600' :
                  'text-rose-600'
                }`}>
                  {dashboardStats.overallAccuracy}%
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Accuracy</div>
              </div>
            </div>

            <div className="bg-white px-2.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <ListChecks className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-purple-600 leading-none">{dashboardStats.totalQuestions}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Questions Solved</div>
              </div>
            </div>

            <div className="bg-white px-2.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <Clock className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-orange-600 leading-none">{dashboardStats.avgTimePerQ}s</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Avg Time / Q</div>
              </div>
            </div>
          </div>

          {/* Subject-Wise Performance Breakdown */}
          <div className="bg-white rounded-lg shadow-xs border border-slate-200/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 leading-none">Subject Breakdown</h3>
                <p className="text-slate-400 text-[10px] font-medium mt-0.5">Click any subject to filter recent attempts</p>
              </div>
              {dashSubjectFilter !== 'all' && (
                <button
                  onClick={() => setDashSubjectFilter('all')}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded transition-colors"
                >
                  Clear Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {['Mathematics', 'Reasoning', 'English', 'General Awareness'].map((subName) => {
                const theme = getSubjectTheme(subName);
                const Icon = theme.icon;
                const stat = dashboardStats.subjectStats[subName] || { totalQ: 0, correct: 0, quizzes: 0, accuracy: 0, avgTime: 0 };
                const isSelected = dashSubjectFilter === subName;

                return (
                  <div
                    key={subName}
                    onClick={() => setDashSubjectFilter(isSelected ? 'all' : subName)}
                    className={`cursor-pointer p-2.5 rounded-lg border transition-all duration-150 ${
                      isSelected
                        ? 'ring-1 ring-blue-500 shadow-xs bg-blue-50/20 border-blue-200'
                        : 'bg-slate-50/50 hover:bg-white hover:shadow-xs border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br ${theme.gradient} text-white shadow-xs`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        stat.accuracy >= 75 ? 'bg-emerald-100 text-emerald-800' :
                        stat.accuracy >= 50 ? 'bg-amber-100 text-amber-800' :
                        stat.totalQ > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {stat.totalQ > 0 ? `${stat.accuracy}% Acc` : 'No data'}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-xs mb-1 leading-none">{subName}</h4>

                    <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${theme.bar}`}
                        style={{ width: `${stat.accuracy}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div>
                        <span className="text-slate-400 block font-medium">Questions:</span>
                        <span className="font-bold text-slate-700">{stat.totalQ} ({stat.correct} ✓)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Avg Time:</span>
                        <span className="font-bold text-slate-700">{stat.avgTime}s/Q</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="p-3 sm:p-3.5 border-b border-slate-100 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900">Recent Activity</h3>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                    {filteredUserResults.length} {filteredUserResults.length === 1 ? 'Attempt' : 'Attempts'}
                  </span>
                  {userResults.length > 0 && (
                    <button
                      onClick={onClearAllResults}
                      disabled={loadingResults}
                      className="flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md text-[10px] font-bold transition-all disabled:opacity-50"
                      title="Clear all recent activity records"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear History</span>
                    </button>
                  )}
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={dashSearchQuery}
                    onChange={(e) => setDashSearchQuery(e.target.value)}
                    placeholder="Search chapter or topic..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Filter Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/70 text-[11px] font-semibold">
                  <button
                    onClick={() => setDashCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      dashCategoryFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Modes
                  </button>
                  <button
                    onClick={() => setDashCategoryFilter('chapterBank')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      dashCategoryFilter === 'chapterBank'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Chapter Bank
                  </button>
                  <button
                    onClick={() => setDashCategoryFilter('mockErrors')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      dashCategoryFilter === 'mockErrors'
                        ? 'bg-white text-rose-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Mock Errors
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={dashSubjectFilter}
                    onChange={(e) => setDashSubjectFilter(e.target.value)}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="all">All Subjects</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Reasoning">Reasoning</option>
                    <option value="English">English</option>
                    <option value="General Awareness">General Awareness</option>
                  </select>

                  <select
                    value={dashSort}
                    onChange={(e) => setDashSort(e.target.value as any)}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="accuracy-desc">Highest Accuracy</option>
                    <option value="accuracy-asc">Lowest Accuracy</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Results List */}
            {filteredUserResults.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 font-bold text-xs mb-2">No activity matching your current filter.</p>
                <button
                  onClick={() => {
                    setDashCategoryFilter('all');
                    setDashSubjectFilter('all');
                    setDashSearchQuery('');
                  }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-semibold text-xs hover:bg-blue-100 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredUserResults.map((result) => {
                  const theme = getSubjectTheme(result.subject);
                  const Icon = theme.icon;
                  const accuracyRate = result.totalQuestions > 0
                    ? Math.round((result.score / result.totalQuestions) * 100)
                    : 0;
                  const avgQ = result.totalQuestions > 0
                    ? Math.round(result.totalTime / result.totalQuestions)
                    : 0;

                  return (
                    <div
                      key={result.id || `${result.completedAt}|${result.chapter_title}`}
                      className="p-3 sm:p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs bg-gradient-to-br ${theme.gradient} text-white`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${theme.badge}`}>
                              {theme.name}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-semibold border ${
                              result.category === 'mockErrors'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {result.category === 'mockErrors' ? 'Mock Errors' : 'Chapter Bank'}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-semibold border ${
                              result.mode === 'mock'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {result.mode === 'mock' ? 'Mock Test' : 'Practice Drill'}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 truncate" title={result.chapter_title}>
                            {result.chapter_title}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {formatAttemptDate(result.completedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 sm:gap-4 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                        <div className="text-left sm:text-right min-w-[55px]">
                          <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Score</div>
                          <div className="text-xs font-bold text-slate-900">
                            {result.score}/{result.totalQuestions}
                          </div>
                        </div>

                        <div className="text-left sm:text-right min-w-[55px]">
                          <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Avg/Q</div>
                          <div className="text-xs font-bold text-orange-600">
                            {avgQ}s
                          </div>
                        </div>

                        <div className="text-left sm:text-right min-w-[65px]">
                          <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Time</div>
                          <div className="text-xs font-bold text-slate-700">
                            {Math.floor(result.totalTime / 60)}m {result.totalTime % 60}s
                          </div>
                        </div>

                        <div className="text-left sm:text-right min-w-[60px]">
                          <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Accuracy</div>
                          <div className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-xs font-bold border ${
                            accuracyRate >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            accuracyRate >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {accuracyRate}%
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onOpenReview(result)}
                            className="px-2.5 py-1.5 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Review questions & solutions"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                          <button
                            onClick={() => onReattempt(result)}
                            className="p-1.5 rounded-lg font-bold bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-all shadow-xs flex items-center justify-center cursor-pointer"
                            title="Reattempt this quiz"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          {result.id && (
                            <button
                              onClick={() => onDeleteResult(result.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-400 hover:text-white font-bold transition-all shadow-xs flex items-center justify-center"
                              title="Delete this attempt"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};
