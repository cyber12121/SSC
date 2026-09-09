import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  Trash2,
  Upload,
  ChevronLeft,
  Layers,
  ArrowRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { MockScoreReport, SectionScore } from '../types/mockScore';
import initialMockReports from '../data/mock_reports.json';

const LOCAL_STORAGE_KEY = 'cgl_mock_score_reports';

export function computeMockScoreClientSide(rawList: any[], mockTitle?: string): MockScoreReport {
  const normalizeSubject = (raw: string) => {
    if (/quant|math|aptitude/i.test(raw)) return 'Mathematics';
    if (/reason|intel/i.test(raw)) return 'Reasoning';
    if (/eng/i.test(raw)) return 'English';
    if (/aware|gk|gs|ga|knowledge/i.test(raw)) return 'General Awareness';
    return 'Mathematics';
  };

  const subjectGroups: Record<string, any[]> = {
    Reasoning: [],
    'General Awareness': [],
    Mathematics: [],
    English: []
  };

  rawList.forEach(q => {
    const rawSubject = q.subject || q.section || 'Quantitative Aptitude';
    const name = normalizeSubject(rawSubject);
    if (subjectGroups[name]) {
      subjectGroups[name].push(q);
    }
  });

  const activeSubjects = Object.keys(subjectGroups).filter(k => subjectGroups[k].length > 0);
  const isFullMock = activeSubjects.length >= 2 || rawList.length >= 70;
  const mockType: 'full' | 'sectional' = isFullMock ? 'full' : 'sectional';

  const sections: {
    reasoning?: SectionScore;
    mathematics?: SectionScore;
    english?: SectionScore;
    generalAwareness?: SectionScore;
  } = {};

  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnattempted = 0;
  let totalScore = 0;

  const subjectsToProcess = isFullMock
    ? ['Reasoning', 'General Awareness', 'Mathematics', 'English']
    : activeSubjects;

  for (const sub of subjectsToProcess) {
    const qList = subjectGroups[sub] || [];
    let wrong = 0;
    let unattempted = 0;
    let correct = 0;
    let hasExplicitCorrect = false;

    qList.forEach(q => {
      const status = (q.status || '').toLowerCase();
      if (status.includes('correct') && !status.includes('incorrect')) {
        correct++;
        hasExplicitCorrect = true;
      } else if (status.includes('wrong') || status.includes('incorrect')) {
        wrong++;
      } else if (status.includes('unattempted') || status.includes('skipped')) {
        unattempted++;
      } else {
        wrong++;
      }
    });

    const standardTotal = 25;
    if (!hasExplicitCorrect || qList.length < standardTotal) {
      correct = Math.max(0, standardTotal - wrong - unattempted);
    }

    const sectionScore = Math.round(((correct * 2) - (wrong * 0.5)) * 10) / 10;
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;

    totalCorrect += correct;
    totalWrong += wrong;
    totalUnattempted += unattempted;
    totalScore += sectionScore;

    const key = sub === 'General Awareness' ? 'generalAwareness' : sub === 'Mathematics' ? 'mathematics' : (sub.toLowerCase() as 'reasoning' | 'english');
    sections[key] = {
      total: standardTotal,
      correct,
      wrong,
      unattempted,
      score: sectionScore,
      accuracy
    };
  }

  const totalQuestions = isFullMock ? 100 : (subjectsToProcess.length * 25);
  const maxMarks = totalQuestions * 2;
  const totalAttempted = totalCorrect + totalWrong;
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 1000) / 10 : 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const title = mockTitle || (isFullMock ? `Full Mock - ${dateStr}` : `${activeSubjects[0] || 'Sectional'} Mock - ${dateStr}`);

  return {
    id: 'mock_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title,
    type: mockType,
    subject: isFullMock ? undefined : (activeSubjects[0] || 'General'),
    date: now.toISOString(),
    totalQuestions,
    maxMarks,
    totalScore: Math.round(totalScore * 10) / 10,
    overallAccuracy,
    totalCorrect,
    totalWrong,
    totalUnattempted,
    sections
  };
}

interface MockScoreDashboardProps {
  onBack?: () => void;
}

export const MockScoreDashboard: React.FC<MockScoreDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'full' | 'sectional'>('full');
  const [reports, setReports] = useState<MockScoreReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch reports on mount
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      let loaded: MockScoreReport[] = [];
      try {
        const res = await fetch('/api/mock-reports');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            loaded = data;
          }
        }
      } catch (err) {
        console.warn('Backend mock reports unavailable, using local store:', err);
      }

      if (loaded.length === 0) {
        try {
          const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (saved) {
            loaded = JSON.parse(saved);
          } else if (Array.isArray(initialMockReports) && initialMockReports.length > 0) {
            loaded = initialMockReports as MockScoreReport[];
          }
        } catch {}
      }

      setReports(loaded);
      setLoading(false);
    };

    fetchReports();
  }, []);

  const saveReports = (newReports: MockScoreReport[]) => {
    setReports(newReports);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newReports));
    } catch {}
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => r.type === activeTab);
  }, [reports, activeTab]);

  const latestReport = filteredReports[0] || null;

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    if (filteredReports.length === 0) {
      return {
        bestScore: 0,
        avgScore: 0,
        avgAccuracy: 0,
        totalMocks: 0,
        maxMarks: activeTab === 'full' ? 200 : 50
      };
    }

    const scores = filteredReports.map(r => r.totalScore);
    const bestScore = Math.max(...scores);
    const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const avgAccuracy = Math.round((filteredReports.reduce((a, b) => a + b.overallAccuracy, 0) / filteredReports.length) * 10) / 10;

    return {
      bestScore,
      avgScore,
      avgAccuracy,
      totalMocks: filteredReports.length,
      maxMarks: filteredReports[0]?.maxMarks || (activeTab === 'full' ? 200 : 50)
    };
  }, [filteredReports, activeTab]);

  // Handle JSON file upload
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let rawQuestions: any[] = [];

      if (Array.isArray(parsed)) {
        rawQuestions = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.data)) rawQuestions = parsed.data;
        else if (Array.isArray(parsed.questions)) rawQuestions = parsed.questions;
        else {
          const values = Object.values(parsed);
          if (values.length > 0 && values.every(v => Array.isArray(v))) {
            rawQuestions = values.flat();
          }
        }
      }

      if (rawQuestions.length === 0) {
        alert('No valid questions found in this JSON file.');
        return;
      }

      const fileNameClean = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      const report = computeMockScoreClientSide(rawQuestions, fileNameClean);

      // Try persisting to backend API
      try {
        await fetch('/api/mock-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
      } catch {}

      const updated = [report, ...reports];
      saveReports(updated);
      setActiveTab(report.type);
    } catch (err: any) {
      console.error('Failed to parse mock JSON:', err);
      alert('Failed to parse mock JSON file: ' + (err.message || 'Invalid format'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteMock = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this mock score record?')) return;
    try {
      await fetch(`/api/mock-reports/${id}`, { method: 'DELETE' });
    } catch {}
    const updated = reports.filter(r => r.id !== id);
    saveReports(updated);
  };

  const handleClearAll = async () => {
    if (filteredReports.length === 0) return;
    if (!window.confirm(`Are you sure you want to clear all ${filteredReports.length} ${activeTab === 'full' ? 'Full' : 'Sectional'} Mock records?`)) return;
    try {
      await fetch('/api/mock-reports', { method: 'DELETE' });
    } catch {}
    const updated = reports.filter(r => r.type !== activeTab);
    saveReports(updated);
  };

  return (
    <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Mock Score Dashboard</h1>
              <p className="text-xs text-slate-500 font-medium">Real exam score calculation, negative marking &amp; subject accuracy</p>
            </div>
          </div>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 px-3 py-2 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </button>
          )}
          {/* Tabs: Full Mock vs Sectional */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
            <button
              onClick={() => setActiveTab('full')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'full'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full Mock (100 Qs)</span>
            </button>
            <button
              onClick={() => setActiveTab('sectional')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'sectional'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Sectional (25 Qs)</span>
            </button>
          </div>

          {/* Upload JSON Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
            title="Import Oliveboard/Testbook JSON to view scores"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Processing...' : 'Upload Mock'}</span>
          </button>
        </div>
      </div>

      {filteredReports.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">No {activeTab === 'full' ? 'Full Mock' : 'Sectional'} Scores Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload your Oliveboard or Testbook JSON mock capture to instantly see your total marks, accuracy, and subject breakdowns.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Select Mock JSON File</span>
          </button>
        </div>
      ) : (
        <>
          {/* ─── 3 HERO METRICS (Compact & Sleek) ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Latest / Total Score */}
            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Latest Score</span>
                <Trophy className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">
                  {latestReport ? latestReport.totalScore : 0}
                </span>
                <span className="text-xs font-bold text-slate-400">/ {aggregateStats.maxMarks}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">
                {latestReport
                  ? `${latestReport.totalCorrect} Correct • ${latestReport.totalWrong} Wrong • ${latestReport.totalUnattempted} Skipped`
                  : 'No attempts'}
              </p>
            </div>

            {/* 2. Overall Accuracy */}
            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Overall Accuracy</span>
                <Target className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-black ${
                  (latestReport?.overallAccuracy || 0) >= 85 ? 'text-emerald-600' :
                  (latestReport?.overallAccuracy || 0) >= 70 ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {latestReport ? latestReport.overallAccuracy : 0}%
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  (Avg: {aggregateStats.avgAccuracy}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">
                {(latestReport?.overallAccuracy || 0) >= 85 ? 'Target achieved (≥85% accuracy) ✅' : 'Aim for ≥85% accuracy to maximize rank'}
              </p>
            </div>

            {/* 3. Best Score */}
            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Best Score</span>
                <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{aggregateStats.bestScore}</span>
                <span className="text-xs font-bold text-slate-400">/ {aggregateStats.maxMarks}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">
                Across {aggregateStats.totalMocks} {activeTab === 'full' ? 'Full Mocks' : 'Sectional Mocks'} recorded
              </p>
            </div>
          </div>

          {/* ─── PAST MOCKS LIST (Clean & Direct) ─── */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-black text-slate-900">
                  {activeTab === 'full' ? 'Full Mock Attempts' : 'Sectional Mock Attempts'}
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {filteredReports.length}
                </span>
              </div>

              {filteredReports.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              )}
            </div>

            {/* Fixed Header Row Above Mocks */}
            <div className="hidden xl:flex items-stretch border-b border-slate-200/90 bg-slate-100/75 divide-x divide-slate-200/90 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <div className="w-[260px] 2xl:w-[280px] shrink-0 px-4 py-2.5 flex items-center">
                Mock Test &amp; Activity
              </div>
              <div className="flex-1 grid grid-cols-4 divide-x divide-slate-200/90">
                <div className="px-3.5 py-2.5 flex items-center justify-between text-indigo-700">
                  <span>Reasoning</span>
                  <span className="text-[10px] text-slate-400 font-bold lowercase tracking-normal">score / acc</span>
                </div>
                <div className="px-3.5 py-2.5 flex items-center justify-between text-amber-700">
                  <span>GA / GK</span>
                  <span className="text-[10px] text-slate-400 font-bold lowercase tracking-normal">score / acc</span>
                </div>
                <div className="px-3.5 py-2.5 flex items-center justify-between text-blue-700">
                  <span>Quantitative</span>
                  <span className="text-[10px] text-slate-400 font-bold lowercase tracking-normal">score / acc</span>
                </div>
                <div className="px-3.5 py-2.5 flex items-center justify-between text-emerald-700">
                  <span>English</span>
                  <span className="text-[10px] text-slate-400 font-bold lowercase tracking-normal">score / acc</span>
                </div>
              </div>
              <div className="w-[180px] shrink-0 px-4 py-2.5 flex items-center justify-between text-slate-700">
                <span>Total Score</span>
                <span className="text-[10px] text-slate-400 font-bold lowercase tracking-normal">overall acc</span>
              </div>
            </div>

            {/* List Rows */}
            <div className="divide-y divide-slate-200/80">
              {filteredReports.map((report) => {
                const dateClean = new Date(report.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <div
                    key={report.id}
                    className="flex flex-col xl:flex-row items-stretch divide-y xl:divide-y-0 xl:divide-x divide-slate-200/90 hover:bg-slate-50/40 transition-colors"
                  >
                    {/* 1. Left: Mock Details & Stats */}
                    <div className="w-full xl:w-[260px] 2xl:w-[280px] shrink-0 px-4 py-2.5 bg-slate-50/30 flex flex-col justify-center">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900 truncate">
                          {report.title}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200/80 text-slate-500">
                          {dateClean}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1.5 flex-wrap">
                        <span className="text-emerald-600 font-semibold">{report.totalCorrect}c</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-rose-500 font-semibold">{report.totalWrong}w</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400 font-semibold">{report.totalUnattempted}s</span>
                      </div>
                    </div>

                    {/* 2. Middle: Four Subjects (Score & Acc Only) */}
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/90">
                      {[
                        { key: 'reasoning', label: 'Reasoning', color: 'text-indigo-700', bg: 'bg-indigo-50/20 hover:bg-indigo-50/50' },
                        { key: 'generalAwareness', label: 'GA / GK', color: 'text-amber-700', bg: 'bg-amber-50/20 hover:bg-amber-50/50' },
                        { key: 'mathematics', label: 'Quantitative', color: 'text-blue-700', bg: 'bg-blue-50/20 hover:bg-blue-50/50' },
                        { key: 'english', label: 'English', color: 'text-emerald-700', bg: 'bg-emerald-50/20 hover:bg-emerald-50/50' },
                      ].map((sub) => {
                        const sData = report.sections?.[sub.key as keyof typeof report.sections];
                        if (!sData && report.type === 'sectional') return null;
                        const score = sData ? sData.score : 0;
                        const acc = sData ? sData.accuracy : 0;

                        return (
                          <div
                            key={sub.key}
                            className={`px-3.5 sm:px-4 py-2 flex items-center justify-between gap-2 transition-all ${sub.bg}`}
                            title={`${sub.label}: ${score}/50 marks • ${acc}% accuracy (${sData?.correct || 0} Correct, ${sData?.wrong || 0} Wrong, ${sData?.unattempted || 0} Skipped)`}
                          >
                            <div>
                              {/* Show subject label only on smaller screens where table header is hidden */}
                              <span className={`text-[10px] font-bold ${sub.color} block xl:hidden leading-tight`}>
                                {sub.label}
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-black text-slate-900 leading-none">{score}</span>
                                <span className="text-[10px] font-bold text-slate-400">/ 50</span>
                              </div>
                            </div>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shadow-2xs ${
                              acc >= 85 ? 'bg-emerald-100 text-emerald-800' :
                              acc >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {acc}%
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 3. Right: Total Score & Action */}
                    <div className="w-full xl:w-[180px] shrink-0 px-4 py-2 bg-slate-50/30 flex items-center justify-between gap-3">
                      <div className="text-left">
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-black text-slate-900 leading-none">
                            {report.totalScore}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">/ {report.maxMarks}</span>
                        </div>
                        <span className={`inline-block text-[10px] font-black mt-0.5 ${
                          report.overallAccuracy >= 85 ? 'text-emerald-600' :
                          report.overallAccuracy >= 70 ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {report.overallAccuracy}% Acc
                        </span>
                      </div>

                      {/* Delete Single Mock */}
                      <button
                        onClick={() => handleDeleteMock(report.id)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                        title="Delete this record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
