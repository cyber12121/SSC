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
          </div>
        </div>
      ) : (
        <div className="space-y-3">

          {/* ========================================================= */}
          {/* COMPACT TOP METRIC CARDS                                  */}
          {/* ========================================================= */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            {/* Card 1: Total Attempts */}
            <article className="bg-white rounded-xl border border-slate-200/90 px-3 py-2 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Total Attempts</span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
                  {dashboardStats.totalQuizzes}
                </span>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">{dashboardStats.totalQuizzes} completed</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700">
                  DRILL LOG
                </span>
              </div>
            </article>

            {/* Card 2: Overall Accuracy */}
            <article className="bg-white rounded-xl border border-slate-200/90 px-3 py-2 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Overall Accuracy</span>
                <span className={`text-base sm:text-lg font-black tracking-tight leading-none ${
                  dashboardStats.overallAccuracy >= 75
                    ? 'text-emerald-600'
                    : dashboardStats.overallAccuracy >= 50
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}>
                  {dashboardStats.overallAccuracy}%
                </span>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">Target: ≥85%</span>
                <span className={`font-bold text-[9px] px-1.5 py-0.5 rounded ${
                  dashboardStats.overallAccuracy >= 75 ? 'bg-emerald-50 text-emerald-700' :
                  dashboardStats.overallAccuracy >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {dashboardStats.overallAccuracy >= 75 ? 'Target Pace' : dashboardStats.overallAccuracy >= 50 ? 'Needs Polish' : 'Low Accuracy'}
                </span>
              </div>
            </article>

            {/* Card 3: Questions Solved */}
            <article className="bg-white rounded-xl border border-slate-200/90 px-3 py-2 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Questions Solved</span>
                <span className="text-base sm:text-lg font-black tracking-tight text-purple-700 leading-none">
                  {dashboardStats.totalQuestions}
                </span>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-mono truncate">
                  <strong className="text-emerald-600 font-semibold">{dashboardStats.totalCorrect}</strong> Correct • {dashboardStats.totalQuestions - dashboardStats.totalCorrect} Inaccurate
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 shrink-0 ml-1">
                  TOTAL BANK
                </span>
              </div>
            </article>

            {/* Card 4: Avg Speed */}
            <article className="bg-white rounded-xl border border-slate-200/90 px-3 py-2 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-slate-500">Avg Speed</span>
                <span className="text-base sm:text-lg font-black tracking-tight text-orange-600 leading-none">
                  {dashboardStats.avgTimePerQ}s
                </span>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-mono">Benchmark: &lt;50s</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  dashboardStats.avgTimePerQ <= 45 ? 'bg-emerald-50 text-emerald-700' :
                  dashboardStats.avgTimePerQ <= 65 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {dashboardStats.avgTimePerQ <= 45 ? 'FAST' : dashboardStats.avgTimePerQ <= 65 ? 'OPTIMAL' : 'SLOW'}
                </span>
              </div>
            </article>
          </div>

          {/* ========================================================= */}
          {/* SUBJECT-WISE PERFORMANCE BREAKDOWN                        */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 leading-none">Subject Mastery Breakdown</h3>
                <p className="text-slate-400 text-[10px] font-medium mt-1">Select a subject card to isolate recent attempts</p>
              </div>
              {dashSubjectFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setDashSubjectFilter('all')}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg transition-colors border border-blue-100 cursor-pointer"
                >
                  Clear Subject Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
              {['Mathematics', 'Reasoning', 'English', 'General Awareness'].map((subName) => {
                const theme = getSubjectTheme(subName);
                const Icon = theme.icon;
                const stat = dashboardStats.subjectStats[subName] || { totalQ: 0, correct: 0, quizzes: 0, accuracy: 0, avgTime: 0 };
                const isSelected = dashSubjectFilter === subName;

                return (
                  <div
                    key={subName}
                    onClick={() => setDashSubjectFilter(isSelected ? 'all' : subName)}
                    className={`cursor-pointer p-2.5 rounded-xl border transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? 'ring-2 ring-blue-500 shadow-xs bg-blue-50/20 border-blue-300'
                        : 'bg-white hover:bg-slate-50/50 hover:shadow-xs border-slate-200/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center bg-gradient-to-br ${theme.gradient} text-white shadow-2xs shrink-0`}>
                            <Icon className="w-3 h-3" />
                          </div>
                          <h4 className="font-bold text-slate-900 text-xs truncate leading-tight">{subName}</h4>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                          stat.accuracy >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          stat.accuracy >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          stat.totalQ > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {stat.totalQ > 0 ? `${stat.accuracy}% Acc` : 'No data'}
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden my-1">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${theme.bar}`}
                          style={{ width: `${stat.accuracy}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-mono">
                        <strong className="text-slate-800 font-semibold">{stat.totalQ}</strong> Qs ({stat.correct} ✓)
                      </span>
                      <span className="text-slate-500 font-mono font-medium">
                        {stat.avgTime}s/Q
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* CLASSIFICATION FILTER BAR (ROUNDED-2XL STANDARD)          */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-2.5">
            {/* Left Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setDashCategoryFilter('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  dashCategoryFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Modes ({userResults.length})
              </button>
              <button
                type="button"
                onClick={() => setDashCategoryFilter('chapterBank')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  dashCategoryFilter === 'chapterBank'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                    : 'bg-blue-50/70 text-blue-800 border-blue-100 hover:bg-blue-100'
                }`}
              >
                Chapter Bank <span className="ml-1 opacity-85 font-mono">{userResults.filter(r => r.category === 'chapterBank').length}</span>
              </button>
              <button
                type="button"
                onClick={() => setDashCategoryFilter('mockErrors')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  dashCategoryFilter === 'mockErrors'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold'
                    : 'bg-rose-50/70 text-rose-800 border-rose-100 hover:bg-rose-100'
                }`}
              >
                Mock Errors <span className="ml-1 opacity-85 font-mono">{userResults.filter(r => r.category === 'mockErrors').length}</span>
              </button>
            </div>

            {/* Right Controls: Subject select, Sort select, Search, and Clear */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-56 md:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={dashSearchQuery}
                  onChange={(e) => setDashSearchQuery(e.target.value)}
                  placeholder="Filter by topic or chapter..."
                  className="w-full pl-8 pr-7 py-1 text-xs font-medium bg-slate-50 border border-slate-200/90 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                />
                {dashSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDashSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              <select
                value={dashSubjectFilter}
                onChange={(e) => setDashSubjectFilter(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200/90 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
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
                className="px-2.5 py-1 bg-slate-50 border border-slate-200/90 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="accuracy-desc">Highest Accuracy</option>
                <option value="accuracy-asc">Lowest Accuracy</option>
              </select>

              {userResults.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllResults}
                  disabled={loadingResults}
                  className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  title="Clear all recent activity records"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* ATTEMPT RESULTS LIST (CARD TABLE STANDARD)                */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
            {filteredUserResults.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-slate-500 font-bold text-xs">No attempt records matching your current filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setDashCategoryFilter('all');
                    setDashSubjectFilter('all');
                    setDashSearchQuery('');
                  }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors border border-blue-100 cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredUserResults.map((result, idx) => {
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
                      key={result.id || `${result.completedAt}|${result.chapter_title}|${idx}`}
                      className="p-3 sm:p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Subject Icon / Badge */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-gradient-to-br ${theme.gradient} text-white`}>
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${theme.badge}`}>
                              {theme.name}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              result.category === 'mockErrors'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {result.category === 'mockErrors' ? 'Mock Errors' : 'Chapter Bank'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
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
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 font-mono">
                            {formatAttemptDate(result.completedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Stat Numbers & Actions */}
                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 sm:gap-4 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                        <div className="text-left sm:text-right min-w-[55px]">
                          <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider font-mono">Score</div>
                          <div className="text-xs font-bold text-slate-900 font-mono">
                            {result.score}/{result.totalQuestions}
                          </div>
                        </div>

                        <div className="text-left sm:text-right min-w-[55px]">
                          <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider font-mono">Pacing</div>
                          <div className="text-xs font-bold text-orange-600 font-mono">
                            {avgQ}s/Q
                          </div>
                        </div>

                        <div className="text-left sm:text-right min-w-[65px]">
                          <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider font-mono">Duration</div>
                          <div className="text-xs font-bold text-slate-700 font-mono">
                            {Math.floor(result.totalTime / 60)}m {result.totalTime % 60}s
                          </div>
                        </div>

                        <div className="text-left sm:text-right min-w-[60px]">
                          <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider font-mono">Accuracy</div>
                          <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border font-mono ${
                            accuracyRate >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            accuracyRate >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {accuracyRate}%
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenReview(result)}
                            className="px-2.5 py-1 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Review questions & solutions"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Review</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onReattempt(result)}
                            className="p-1.5 rounded-lg font-bold bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-all shadow-xs border border-emerald-200 flex items-center justify-center cursor-pointer"
                            title="Reattempt this quiz"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          {result.id && (
                            <button
                              type="button"
                              onClick={() => onDeleteResult(result.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-400 hover:text-white font-bold transition-all shadow-xs flex items-center justify-center cursor-pointer"
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

          {/* ========================================================= */}
          {/* ADVISORY FOOTER STRIP                                     */}
          {/* ========================================================= */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs flex items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
              <span className="leading-snug">
                <strong className="text-slate-800">SSC CGL Benchmark:</strong> Aim for ≥80% accuracy with an average pace under 50 seconds per question to maximize Tier-1 qualification rank.
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 shrink-0 hidden sm:inline">
              {filteredUserResults.length} records indexed
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
