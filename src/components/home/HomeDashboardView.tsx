import React from 'react';
import { motion } from 'motion/react';
import {
  ListChecks,
  AlertCircle,
  Layers,
  Sparkles,
  ChevronRight,
  Zap,
  Flame,
  Bookmark as BookmarkIcon,
  History,
  Trash2,
  Calculator,
  Compass,
  Globe2,
  Target,
  LayoutDashboard
} from 'lucide-react';
import { Chapter, SubjectData, QuizResult } from '../../types';
import { GK_SUBJECT_LIST } from '../../utils/gkSubjectHelper';

interface HomeDashboardViewProps {
  category: 'chapterBank' | 'mockErrors';
  setCategory: (cat: 'chapterBank' | 'mockErrors') => void;
  dataLoading: boolean;
  currentData: SubjectData;
  bankData: SubjectData;
  userResults: QuizResult[];
  loadingResults: boolean;
  dashboardStats: {
    totalQuestions: number;
    overallAccuracy: number;
    totalQuizzes: number;
    avgTimePerQ: number;
  };
  setSelectedSubject: (subject: string | null) => void;
  setSelectedGKSubject: (subject: any) => void;
  setSelectedGKSubTopic: (subtopic: string) => void;
  setSelectedMathSection: (sec: any) => void;
  setSelectedEnglishSection: (sec: any) => void;
  setSelectedTopic: (topic: string | null) => void;
  setView: (view: 'home' | 'dashboard' | 'bookmarks' | 'mockScores' | 'heatmap' | 'drill') => void;
  handleClearAllResults: () => void;
  openReview: (result: QuizResult, fromView: string) => void;
  handleAskAiSubject: (subject: string) => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  category,
  setCategory,
  dataLoading,
  currentData,
  bankData,
  userResults,
  loadingResults,
  dashboardStats,
  setSelectedSubject,
  setSelectedGKSubject,
  setSelectedGKSubTopic,
  setSelectedMathSection,
  setSelectedEnglishSection,
  setSelectedTopic,
  setView,
  handleClearAllResults,
  openReview,
  handleAskAiSubject
}) => {
  return (
    <>
      {/* Hero */}
      <section className="relative mb-3.5 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 px-4 py-3 sm:px-5 sm:py-3.5 shadow-xs">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-24 left-8 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.2 text-[10px] font-bold text-white ring-1 ring-white/20">
              SSC CGL Prep
            </span>
            <h1 className="mt-1 text-base sm:text-lg font-bold tracking-tight text-white">
              Practice smart. Beat the competition.
            </h1>
            <p className="mt-0.5 text-xs text-indigo-100">
              Curated chapter banks and focused mock-error drills — pick a subject and start solving.
            </p>
          </div>
          <div className="inline-flex shrink-0 rounded-lg border border-white/20 bg-white/10 p-0.5 backdrop-blur">
            <button
              onClick={() => {
                setCategory('chapterBank');
                setSelectedMathSection(null);
                setSelectedEnglishSection(null);
                setSelectedGKSubject(null);
                setSelectedGKSubTopic('all');
                setSelectedTopic(null);
              }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors flex items-center cursor-pointer ${
                category === 'chapterBank' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-white hover:bg-white/10'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5 mr-1" />
              Chapter Bank
            </button>
            <button
              onClick={() => {
                setCategory('mockErrors');
                setSelectedMathSection(null);
                setSelectedEnglishSection(null);
                setSelectedGKSubject(null);
                setSelectedGKSubTopic('all');
                setSelectedTopic(null);
              }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors flex items-center cursor-pointer ${
                category === 'mockErrors' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-white hover:bg-white/10'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 mr-1" />
              Mock Errors
            </button>
          </div>
        </div>
      </section>

      {/* Subjects: 4 Columns on desktop for perfect balance */}
      {dataLoading ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-slate-100" />
                <div className="h-4 w-12 rounded bg-slate-100" />
              </div>
              <div className="mt-3 h-4 w-24 rounded bg-slate-100" />
              <div className="mt-1.5 h-3 w-16 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.keys(currentData)
            .filter(s => s !== 'GK Full Tests')
            .map((subject) => {
            const chip = (
              {
                Mathematics: 'from-blue-500 to-indigo-600',
                Reasoning: 'from-violet-500 to-purple-600',
                English: 'from-emerald-500 to-teal-600',
                'General Awareness': 'from-amber-500 to-orange-600',
                'GK/GS': 'from-pink-500 to-rose-600',
              } as Record<string, string>
            )[subject] || 'from-slate-500 to-slate-600';
            return (
              <motion.div
                key={subject}
                whileHover={{ y: -2 }}
                onClick={() => {
                  setSelectedSubject(subject);
                  if (subject === 'General Awareness') {
                    setSelectedGKSubject(null);
                    setSelectedGKSubTopic('all');
                  }
                  if (subject === 'Mathematics') {
                    setSelectedMathSection(null);
                  }
                  if (subject === 'English') {
                    setSelectedEnglishSection(null);
                  }
                  setSelectedTopic(null);
                }}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:border-indigo-300 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${chip} text-white shadow-xs`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAskAiSubject(subject);
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 hover:bg-violet-600 hover:text-white text-violet-700 border border-violet-200 transition-all cursor-pointer shadow-2xs"
                        title={`Ask Tommy AI to analyze ${subject} weaknesses and mistakes`}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Ask AI</span>
                      </button>
                      <span className="rounded bg-slate-50 px-1.5 py-0.2 text-[10px] font-bold text-slate-500 border border-slate-100">
                        {currentData[subject]?.length || 0} Ch
                      </span>
                    </div>
                  </div>
                  <h3 className="mt-2 text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{subject}</h3>
                  <div className="mt-1 flex items-center text-[11px] font-semibold text-indigo-600">
                    View Chapters
                    <ChevronRight className="w-3 h-3 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>

                {subject === 'General Awareness' && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    {GK_SUBJECT_LIST.filter(s => s.id !== 'full_tests').map((sub) => (
                      <button
                        key={sub.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubject('General Awareness');
                          setSelectedGKSubject(sub.id);
                          setSelectedGKSubTopic('all');
                        }}
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-100 transition-colors cursor-pointer"
                        title={`Open ${sub.title}`}
                      >
                        {sub.shortTitle}
                      </button>
                    ))}
                  </div>
                )}

                {subject === 'English' && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSubject('English');
                        setSelectedEnglishSection('ayush_vocab');
                        setSelectedTopic(null);
                      }}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 transition-colors cursor-pointer"
                      title="Open SSC 2025 Vocabs by Ayush"
                    >
                      Vocab 2025 ({(bankData['English'] || []).filter(ch => ch.section === 'ayush_vocab').reduce((sum, ch) => sum + (ch.questions?.length || 0), 0)} Qs)
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSubject('English');
                        setSelectedEnglishSection('general');
                        setSelectedTopic(null);
                      }}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-100 transition-colors cursor-pointer"
                      title="Open Grammar & Practice"
                    >
                      Grammar
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── High-Yield Practice Hub & Feature Cards ─── */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Speed Drill */}
        <div 
          onClick={() => setView('drill')}
          className="group bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-105 transition-transform">
              <Zap className="w-3.5 h-3.5 fill-amber-500/20 text-amber-600" />
            </div>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
              Speed Studio
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">Calculation & Speed Drill</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Powers, cubes, fraction conversions, and Pythagorean triplets calculation drill.
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-amber-600">
            <span>Open Studio</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Error Heatmap */}
        <div 
          onClick={() => setView('heatmap')}
          className="group bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs hover:border-red-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100 group-hover:scale-105 transition-transform">
              <Flame className="w-3.5 h-3.5 fill-red-500/20 text-red-600" />
            </div>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
              Weak Spot Matrix
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-red-700 transition-colors">Error Pattern Heatmap</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Analyze wrong answers, negative marks, and speed bottlenecks across mock tests.
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-red-600">
            <span>Analyze Errors</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Bookmarks */}
        <div 
          onClick={() => setView('bookmarks')}
          className="group bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition-transform">
              <BookmarkIcon className="w-3.5 h-3.5 fill-blue-500/20 text-blue-600" />
            </div>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Saved Vault
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">Bookmarked Questions</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Quick-revision bank of tricky questions, formula tricks, and flagged problems.
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-blue-600">
            <span>Review Vault</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* ─── Recent Activity & Prep Readiness ─── */}
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        {/* Left: Recent Activity or Starter Chapters (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <History className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">
                {userResults.length > 0 ? 'Recent Practice Activity' : 'Recommended Starting Chapters'}
              </h4>
            </div>
            {userResults.length > 0 && (
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={handleClearAllResults}
                  disabled={loadingResults}
                  className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  title="Clear all recent activity"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear History
                </button>
                <button 
                  onClick={() => setView('dashboard')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  View All ({userResults.length}) →
                </button>
              </div>
            )}
          </div>

          {userResults.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {userResults.slice(0, 4).map((r, idx) => {
                const acc = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
                return (
                  <div key={idx} className="py-2 flex items-center justify-between gap-2.5">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
                        {r.subject}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{r.chapter_title}</p>
                        <p className="text-[10px] text-slate-400">
                          {r.score}/{r.totalQuestions} correct • {r.mode === 'mock' ? 'Mock Mode' : 'Practice'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                        acc >= 75 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        acc >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {acc}%
                      </span>
                      <button
                        onClick={() => openReview(r, 'home')}
                        className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-2 py-0.5 bg-slate-50 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { sub: 'Mathematics', title: 'Percentage & Profit Loss', count: 'High Yield', icon: Calculator, color: 'text-blue-600 bg-blue-50' },
                { sub: 'Reasoning', title: 'Coding-Decoding & Analogy', count: 'High Yield', icon: Compass, color: 'text-purple-600 bg-purple-50' },
                { sub: 'English', title: 'SSC 2025 Vocabs (by Ayush)', count: '914 High-Yield Qs', icon: Sparkles, color: 'text-emerald-600 bg-emerald-50' },
                { sub: 'General Awareness', title: 'Indian Polity & Constitution', count: 'Frequent', icon: Globe2, color: 'text-amber-600 bg-amber-50' },
              ].map((s, idx) => {
                const SIcon = s.icon;
                return (
                  <div 
                    key={idx}
                    onClick={() => setSelectedSubject(s.sub)}
                    className="p-2 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                        <SIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{s.title}</p>
                        <span className="text-[10px] text-slate-400 font-medium">{s.sub} • {s.count}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Prep Readiness Summary (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">Exam Readiness</h4>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                SSC CGL
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <div className="bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Solved</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{dashboardStats.totalQuestions}</p>
              </div>
              <div className="bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Accuracy</span>
                <p className="text-base font-bold text-emerald-600 mt-0.5">{dashboardStats.overallAccuracy}%</p>
              </div>
              <div className="bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Quizzes</span>
                <p className="text-base font-bold text-indigo-600 mt-0.5">{dashboardStats.totalQuizzes}</p>
              </div>
              <div className="bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Avg Time</span>
                <p className="text-base font-bold text-amber-600 mt-0.5">{dashboardStats.avgTimePerQ}s</p>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100">
            <button
              onClick={() => setView('dashboard')}
              className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <LayoutDashboard className="w-3 h-3" />
              Open Detailed Analytics
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
export default HomeDashboardView;
