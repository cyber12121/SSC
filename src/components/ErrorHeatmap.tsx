import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Search, 
  ChevronRight, 
  X, 
  BarChart2,
  BookOpen,
  Calculator,
  Languages,
  Compass,
  Globe2,
  TrendingDown,
  Zap,
  Target,
  AlertCircle,
  HelpCircle,
  BrainCircuit
} from 'lucide-react';
import { SubjectData, Chapter, Question, RCAClassification } from '../types';
import { detectTopic } from '../utils/topicDetector';

interface ErrorHeatmapProps {
  mockData: SubjectData;
}

interface QuestionWithError extends Question {
  errorType: 'wrong' | 'unattempted' | 'speed_issue';
  detectedTopic: string;
  parentSubject: string;
  rcaClassification?: RCAClassification;
}

interface ChapterHeatmapItem {
  topic: string;
  subject: string;
  totalErrors: number;
  wrongCount: number;
  unattemptedCount: number;
  speedIssueCount: number;
  negativeMarks: number;
  questions: QuestionWithError[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  rcaCounts: {
    C: number;
    A: number;
    T: number;
    G: number;
    unclassified: number;
  };
}

const SUBJECT_CONFIG: Record<string, { icon: any; gradient: string; accent: string; light: string; pill: string; ring: string }> = {
  'Mathematics': {
    icon: Calculator,
    gradient: 'from-violet-600 to-indigo-600',
    accent: '#6d28d9',
    light: 'bg-violet-50',
    pill: 'bg-violet-100 text-violet-800',
    ring: 'ring-violet-400',
  },
  'Reasoning': {
    icon: Compass,
    gradient: 'from-purple-600 to-fuchsia-600',
    accent: '#9333ea',
    light: 'bg-purple-50',
    pill: 'bg-purple-100 text-purple-800',
    ring: 'ring-purple-400',
  },
  'English': {
    icon: Languages,
    gradient: 'from-emerald-500 to-teal-600',
    accent: '#059669',
    light: 'bg-emerald-50',
    pill: 'bg-emerald-100 text-emerald-800',
    ring: 'ring-emerald-400',
  },
  'General Awareness': {
    icon: Globe2,
    gradient: 'from-amber-500 to-orange-500',
    accent: '#d97706',
    light: 'bg-amber-50',
    pill: 'bg-amber-100 text-amber-800',
    ring: 'ring-amber-400',
  }
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', dot: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-700 border-red-200' },
  high:     { label: 'High',     dot: 'bg-orange-500', bar: 'bg-orange-500', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium:   { label: 'Medium',   dot: 'bg-amber-400',  bar: 'bg-amber-400',  text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  low:      { label: 'Low',      dot: 'bg-slate-300',  bar: 'bg-slate-300',  text: 'text-slate-500', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const ErrorHeatmap: React.FC<ErrorHeatmapProps> = ({ mockData }) => {
  const [viewMode, setViewMode] = useState<'error_type' | 'rca'>('error_type');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDrillChapter, setActiveDrillChapter] = useState<ChapterHeatmapItem | null>(null);

  const { subjectGroups, allSubjects, totalOverallErrors } = useMemo(() => {
    // Read global RCA classifications saved from Mock Reviews
    const globalRcaStore: Record<string, any> = (() => {
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage?.getItem('cgl_rca_global_store');
          return raw ? JSON.parse(raw) : {};
        }
      } catch {}
      return {};
    })();

    const groups: Record<string, {
      subject: string;
      totalErrors: number;
      totalWrong: number;
      totalUnattempted: number;
      totalSpeed: number;
      negativeMarks: number;
      rcaTotals: {
        C: number;
        A: number;
        T: number;
        G: number;
        unclassified: number;
      };
      chapters: ChapterHeatmapItem[];
    }> = {};

    let totalOverallErrors = 0;

    (Object.entries(mockData) as [string, Chapter[]][]).forEach(([subject, chapterList]) => {
      if (!groups[subject]) {
        groups[subject] = {
          subject,
          totalErrors: 0,
          totalWrong: 0,
          totalUnattempted: 0,
          totalSpeed: 0,
          negativeMarks: 0,
          rcaTotals: { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
          chapters: []
        };
      }

      const topicMap: Record<string, ChapterHeatmapItem> = {};

      chapterList.forEach(chapter => {
        const chTitle = (chapter.chapter_title || '').toLowerCase();
        let errorType: 'wrong' | 'unattempted' | 'speed_issue' = 'wrong';

        if (chTitle.includes('unattempted') || chTitle.includes('skipped')) errorType = 'unattempted';
        else if (chTitle.includes('speed') || chTitle.includes('slow')) errorType = 'speed_issue';

        chapter.questions.forEach(q => {
          totalOverallErrors++;
          groups[subject].totalErrors++;

          if (errorType === 'wrong') { groups[subject].totalWrong++; groups[subject].negativeMarks += 0.5; }
          else if (errorType === 'unattempted') groups[subject].totalUnattempted++;
          else if (errorType === 'speed_issue') groups[subject].totalSpeed++;

          const topic = detectTopic(q, subject);

          if (!topicMap[topic]) {
            topicMap[topic] = {
              topic,
              subject,
              totalErrors: 0,
              wrongCount: 0,
              unattemptedCount: 0,
              speedIssueCount: 0,
              negativeMarks: 0,
              rcaCounts: { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
              questions: [],
              severity: 'low'
            };
          }

          // Ingest RCA tag if present on question or in global store
          const qRca: RCAClassification | undefined = q.rca || (q.id && globalRcaStore[q.id] ? globalRcaStore[q.id] : undefined);

          if (qRca?.tag && ['C', 'A', 'T', 'G'].includes(qRca.tag)) {
            const tagKey = qRca.tag as 'C' | 'A' | 'T' | 'G';
            groups[subject].rcaTotals[tagKey]++;
            topicMap[topic].rcaCounts[tagKey]++;
          } else {
            groups[subject].rcaTotals.unclassified++;
            topicMap[topic].rcaCounts.unclassified++;
          }

          const qEnriched: QuestionWithError = { ...q, errorType, detectedTopic: topic, parentSubject: subject, rcaClassification: qRca };
          topicMap[topic].totalErrors++;
          topicMap[topic].questions.push(qEnriched);

          if (errorType === 'wrong') { topicMap[topic].wrongCount++; topicMap[topic].negativeMarks += 0.5; }
          else if (errorType === 'unattempted') topicMap[topic].unattemptedCount++;
          else if (errorType === 'speed_issue') topicMap[topic].speedIssueCount++;
        });
      });

      const chapters = Object.values(topicMap).map(c => {
        let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (c.totalErrors >= 5 || c.wrongCount >= 4) severity = 'critical';
        else if (c.totalErrors >= 3 || c.wrongCount >= 2) severity = 'high';
        else if (c.totalErrors >= 2) severity = 'medium';
        return { ...c, severity };
      });

      chapters.sort((a, b) => (b.totalErrors - a.totalErrors) || (b.wrongCount - a.wrongCount));
      groups[subject].chapters = chapters;
    });

    const subjects = Object.keys(groups).filter(s => groups[s].totalErrors > 0);
    subjects.sort((a, b) => (groups[b]?.totalErrors || 0) - (groups[a]?.totalErrors || 0));

    return { subjectGroups: groups, allSubjects: subjects, totalOverallErrors };
  }, [mockData]);

  const [activeSubject, setActiveSubject] = useState<string>(() => allSubjects[0] || 'Mathematics');

  const currentSubjectName = useMemo(() => {
    if (allSubjects.includes(activeSubject)) return activeSubject;
    return allSubjects[0] || 'Mathematics';
  }, [activeSubject, allSubjects]);

  const currentSubjectData = subjectGroups[currentSubjectName] || {
    subject: currentSubjectName, totalErrors: 0, totalWrong: 0,
    totalUnattempted: 0, totalSpeed: 0, negativeMarks: 0,
    rcaTotals: { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
    chapters: []
  };

  const filteredChapters = useMemo(() => {
    return currentSubjectData.chapters.filter(item => {
      if (viewMode === 'error_type') {
        if (selectedTypeFilter === 'wrong' && item.wrongCount === 0) return false;
        if (selectedTypeFilter === 'unattempted' && item.unattemptedCount === 0) return false;
        if (selectedTypeFilter === 'speed' && item.speedIssueCount === 0) return false;
      } else {
        if (selectedTypeFilter === 'C' && item.rcaCounts.C === 0) return false;
        if (selectedTypeFilter === 'A' && item.rcaCounts.A === 0) return false;
        if (selectedTypeFilter === 'T' && item.rcaCounts.T === 0) return false;
        if (selectedTypeFilter === 'G' && item.rcaCounts.G === 0) return false;
        if (selectedTypeFilter === 'unclassified' && item.rcaCounts.unclassified === 0) return false;
      }
      if (searchQuery.trim()) return item.topic.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    });
  }, [currentSubjectData, selectedTypeFilter, searchQuery, viewMode]);

  const maxErrors = filteredChapters.length > 0 ? filteredChapters[0].totalErrors : 1;
  const subjectCfg = SUBJECT_CONFIG[currentSubjectName] || SUBJECT_CONFIG['Mathematics'];
  const SubjectIcon = subjectCfg.icon;

  // Empty state
  if (totalOverallErrors === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-20 text-center">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shadow-lg shadow-indigo-100">
            <BarChart2 className="w-12 h-12 text-indigo-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-sm">
            <span className="text-white text-[10px] font-black">0</span>
          </div>
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">No Errors Recorded Yet</h2>
        <p className="text-slate-500 text-base max-w-md leading-relaxed mb-2">
          Your subject-wise weakness heatmap populates automatically as you take mock tests.
        </p>
        <p className="text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
          Sync results from the Chrome Extension to see your breakdown here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-4">

      {/* ─── Subject Tab Strip (Ultra-Compact Sleek Bar) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
        {allSubjects.map(subj => {
          const cfg = SUBJECT_CONFIG[subj] || SUBJECT_CONFIG['Mathematics'];
          const Icon = cfg.icon;
          const stats = subjectGroups[subj];
          const isActive = subj === currentSubjectName;

          return (
            <button
              key={subj}
              onClick={() => { setActiveSubject(subj); setSelectedTypeFilter('all'); setSearchQuery(''); }}
              className={`relative overflow-hidden rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 border flex items-center justify-between gap-2 ${
                isActive
                  ? 'bg-slate-900 border-slate-900 shadow-xs ring-1 ring-slate-900'
                  : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              {isActive && (
                <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-[0.14]`} />
              )}
              <div className="relative flex items-center gap-2 min-w-0">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  isActive
                    ? `bg-gradient-to-br ${cfg.gradient} shadow-xs`
                    : `${cfg.light}`
                }`}>
                  <Icon className={`w-3 h-3 ${isActive ? 'text-white' : ''}`} style={!isActive ? { color: cfg.accent } : {}} />
                </div>
                <div className="min-w-0">
                  <div className={`font-bold text-xs leading-none truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>{subj}</div>
                  <div className={`text-[9px] font-medium leading-tight mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    {stats?.chapters.length || 0} weak topics
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                isActive ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600 border border-red-100'
              }`}>
                {stats?.totalErrors || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Mode Switcher Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-xl border border-slate-200/80 px-3.5 py-2 shadow-xs gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
            {viewMode === 'rca' ? <Target className="w-3.5 h-3.5" /> : <BarChart2 className="w-3.5 h-3.5" />}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              {viewMode === 'rca' ? 'Root Cause Analysis (4-Bucket RCA)' : 'Mock Error Heatmap'}
            </span>
            <span className="text-[10px] text-slate-500">
              {viewMode === 'rca' 
                ? 'Categorized by: [C] Conceptual Gap, [A] Silly Mistake, [T] Time Trap, [G] Guesswork' 
                : 'Categorized by: Wrong, Skipped, and Slow questions'}
            </span>
          </div>
        </div>

        {/* Segmented Control */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => { setViewMode('error_type'); setSelectedTypeFilter('all'); }}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'error_type'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Error Type
          </button>
          <button
            type="button"
            onClick={() => { setViewMode('rca'); setSelectedTypeFilter('all'); }}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'rca'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                : 'text-purple-700 hover:text-purple-900'
            }`}
          >
            <Target className="w-3 h-3" />
            <span>RCA Mode (4-Bucket)</span>
          </button>
        </div>
      </div>

      {/* ─── KPI Metric Bar (Compact Single-Row Cards) ─── */}
      {viewMode === 'error_type' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {/* Total Errors */}
          <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
              <AlertTriangle className="w-3 h-3 text-red-500" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 leading-none">{currentSubjectData.totalErrors}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Errors</div>
            </div>
          </div>

          {/* Negative Marks */}
          <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
              <TrendingDown className="w-3 h-3 text-rose-500" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-rose-600 leading-none">−{currentSubjectData.negativeMarks.toFixed(1)}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Neg. Marks</div>
            </div>
          </div>

          {/* Speed Issues */}
          <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
              <Clock className="w-3 h-3 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-amber-600 leading-none">{currentSubjectData.totalSpeed}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Speed Issues</div>
            </div>
          </div>

          {/* Skipped */}
          <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-orange-50 flex items-center justify-center shrink-0 border border-orange-100">
              <XCircle className="w-3 h-3 text-orange-500" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-orange-600 leading-none">{currentSubjectData.totalUnattempted}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Skipped</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {/* [C] Conceptual Gap */}
          <div className="bg-white rounded-lg border border-purple-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100">
              <span className="font-mono text-[11px] font-black text-purple-700">[C]</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-purple-700 leading-none">{currentSubjectData.rcaTotals.C}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Conceptual Gap</div>
            </div>
          </div>

          {/* [A] Silly Mistake */}
          <div className="bg-white rounded-lg border border-rose-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
              <span className="font-mono text-[11px] font-black text-rose-700">[A]</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-rose-700 leading-none">{currentSubjectData.rcaTotals.A}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Silly Mistake</div>
            </div>
          </div>

          {/* [T] Time Trap */}
          <div className="bg-white rounded-lg border border-amber-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
              <span className="font-mono text-[11px] font-black text-amber-700">[T]</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-amber-700 leading-none">{currentSubjectData.rcaTotals.T}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Time / Ego Trap</div>
            </div>
          </div>

          {/* [G] Guesswork */}
          <div className="bg-white rounded-lg border border-blue-200/80 px-2.5 py-1.5 shadow-xs flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
              <span className="font-mono text-[11px] font-black text-blue-700">[G]</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-blue-700 leading-none">{currentSubjectData.rcaTotals.G}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Guesswork Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Filters Row ─── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {viewMode === 'error_type' ? (
            [
              { id: 'all',         label: `All (${currentSubjectData.chapters.length})`, cls: 'bg-slate-900 text-white', idle: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { id: 'wrong',       label: 'Wrong',       cls: 'bg-red-600 text-white',    idle: 'bg-red-50 text-red-700 hover:bg-red-100' },
              { id: 'unattempted', label: 'Skipped',     cls: 'bg-orange-500 text-white', idle: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
              { id: 'speed',       label: 'Speed',       cls: 'bg-amber-500 text-white',  idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedTypeFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedTypeFilter === f.id ? f.cls + ' shadow-xs' : f.idle}`}
              >
                {f.label}
              </button>
            ))
          ) : (
            [
              { id: 'all',          label: `All (${currentSubjectData.chapters.length})`, cls: 'bg-slate-900 text-white', idle: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { id: 'C',            label: `[C] Concept (${currentSubjectData.rcaTotals.C})`, cls: 'bg-purple-600 text-white', idle: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200' },
              { id: 'A',            label: `[A] Silly (${currentSubjectData.rcaTotals.A})`, cls: 'bg-rose-600 text-white', idle: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' },
              { id: 'T',            label: `[T] Trap (${currentSubjectData.rcaTotals.T})`, cls: 'bg-amber-600 text-white', idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' },
              { id: 'G',            label: `[G] Guess (${currentSubjectData.rcaTotals.G})`, cls: 'bg-blue-600 text-white', idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' },
              { id: 'unclassified', label: `Unclassified (${currentSubjectData.rcaTotals.unclassified})`, cls: 'bg-slate-700 text-white', idle: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedTypeFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedTypeFilter === f.id ? f.cls + ' shadow-xs' : f.idle}`}
              >
                {f.label}
              </button>
            ))
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${currentSubjectName}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* ─── Heatmap Table ─── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Topic</div>
          <div className="col-span-3">Heat Bar</div>
          {viewMode === 'error_type' ? (
            <>
              <div className="col-span-1 text-center text-amber-600">Slow</div>
              <div className="col-span-1 text-center text-red-600">Wrong</div>
              <div className="col-span-1 text-center text-orange-500">Skip</div>
              <div className="col-span-1 text-right">Total</div>
            </>
          ) : (
            <>
              <div className="col-span-1 text-center text-purple-700 font-mono" title="[C] Conceptual Gap">[C]</div>
              <div className="col-span-1 text-center text-rose-700 font-mono" title="[A] Silly Mistake">[A]</div>
              <div className="col-span-1 text-center text-amber-700 font-mono" title="[T] Time / Ego Trap">[T]</div>
              <div className="col-span-1 text-center text-blue-700 font-mono" title="[G] Guesswork Failed">[G]</div>
            </>
          )}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {filteredChapters.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400 font-medium">
              No topics match the current filter.
            </div>
          )}

          {filteredChapters.map((item, idx) => {
            const sev = SEVERITY_CONFIG[item.severity];
            const barPct = Math.round((item.totalErrors / maxErrors) * 100);
            const isTop = idx < 3;

            return (
              <motion.div
                key={`${item.subject}-${item.topic}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                onClick={() => setActiveDrillChapter(item)}
                className="grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-slate-50/60 cursor-pointer transition-colors group"
              >
                {/* Rank */}
                <div className="col-span-1">
                  <span className={`w-4 h-4 rounded inline-flex items-center justify-center text-[10px] font-bold ${
                    isTop ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {idx + 1}
                  </span>
                </div>

                {/* Topic name + severity badge */}
                <div className="col-span-4 min-w-0 flex items-center gap-1.5">
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors truncate leading-tight">
                      {item.topic}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded border ${sev.badge}`}>
                        <span className={`w-1 h-1 rounded-full ${sev.dot}`} />
                        {sev.label}
                      </span>
                      {item.negativeMarks > 0 && (
                        <span className="text-[9px] font-bold text-rose-500">
                          −{item.negativeMarks.toFixed(1)}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Heat bar */}
                <div className="col-span-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.03 }}
                      className={`h-full rounded-full ${sev.bar}`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 w-6 text-right">{barPct}%</span>
                </div>

                {viewMode === 'error_type' ? (
                  <>
                    {/* Slow */}
                    <div className="col-span-1 flex justify-center">
                      {item.speedIssueCount > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{item.speedIssueCount}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>

                    {/* Wrong */}
                    <div className="col-span-1 flex justify-center">
                      {item.wrongCount > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">{item.wrongCount}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>

                    {/* Skipped */}
                    <div className="col-span-1 flex justify-center">
                      {item.unattemptedCount > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">{item.unattemptedCount}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>

                    {/* Total + arrow */}
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        item.severity === 'critical' ? 'bg-red-600 text-white' :
                        item.severity === 'high'     ? 'bg-orange-500 text-white' :
                        item.severity === 'medium'   ? 'bg-amber-500 text-white' :
                                                       'bg-slate-700 text-white'
                      }`}>
                        {item.totalErrors}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* [C] Concept */}
                    <div className="col-span-1 flex justify-center">
                      {item.rcaCounts.C > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">{item.rcaCounts.C}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>

                    {/* [A] Silly */}
                    <div className="col-span-1 flex justify-center">
                      {item.rcaCounts.A > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">{item.rcaCounts.A}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>

                    {/* [T] Trap */}
                    <div className="col-span-1 flex justify-center">
                      {item.rcaCounts.T > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{item.rcaCounts.T}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>

                    {/* [G] Guess */}
                    <div className="col-span-1 flex justify-center">
                      {item.rcaCounts.G > 0
                        ? <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{item.rcaCounts.G}</span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Footer legend */}
        {filteredChapters.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-semibold text-slate-400">
              Showing <strong className="text-slate-600">{filteredChapters.length}</strong> of {currentSubjectData.chapters.length} topics
            </span>
            <div className="flex items-center gap-4">
              {(['critical', 'high', 'medium'] as const).map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${SEVERITY_CONFIG[s].dot}`} />
                  <span className="text-[10px] font-semibold text-slate-500">{SEVERITY_CONFIG[s].label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Drill-down Modal ─── */}
      <AnimatePresence>
        {activeDrillChapter && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-slate-950/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setActiveDrillChapter(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="bg-white w-full sm:max-w-3xl max-h-[90vh] sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            >
              {/* Modal header */}
              <div className={`px-6 pt-6 pb-5 bg-gradient-to-br ${
                SUBJECT_CONFIG[activeDrillChapter.subject]?.gradient || 'from-indigo-600 to-violet-600'
              } rounded-t-3xl`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {activeDrillChapter.subject}
                      </span>
                      <span className="text-white/60 text-[10px] font-semibold">
                        {activeDrillChapter.questions.length} questions
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-white leading-tight">{activeDrillChapter.topic}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      {activeDrillChapter.wrongCount > 0 && (
                        <span className="text-white/80 text-xs font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> {activeDrillChapter.wrongCount} wrong
                        </span>
                      )}
                      {activeDrillChapter.unattemptedCount > 0 && (
                        <span className="text-white/80 text-xs font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {activeDrillChapter.unattemptedCount} skipped
                        </span>
                      )}
                      {activeDrillChapter.speedIssueCount > 0 && (
                        <span className="text-white/80 text-xs font-bold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" /> {activeDrillChapter.speedIssueCount} slow
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveDrillChapter(null)}
                    className="w-9 h-9 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Questions list */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeDrillChapter.questions.map((q, qIdx) => {
                  const isWrong = q.errorType === 'wrong';
                  const isSlow  = q.errorType === 'speed_issue';

                  return (
                    <div key={q.id || qIdx} className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                      {/* Question header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">Q{qIdx + 1}</span>
                          {q.rcaClassification && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                              q.rcaClassification.tag === 'C' ? 'bg-purple-100 text-purple-800' :
                              q.rcaClassification.tag === 'A' ? 'bg-rose-100 text-rose-800' :
                              q.rcaClassification.tag === 'T' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              <span className="font-mono font-black">[{q.rcaClassification.tag}]</span>
                              <span>{q.rcaClassification.tagName}</span>
                            </span>
                          )}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          isWrong ? 'bg-red-100 text-red-700' :
                          isSlow  ? 'bg-amber-100 text-amber-700' :
                                    'bg-orange-100 text-orange-700'
                        }`}>
                          {isWrong ? '✗ Wrong −0.5' : isSlow ? '⚡ Speed Issue' : '◯ Skipped'}
                        </span>
                      </div>

                      <div className="p-4 space-y-3">
                        {/* Silly Mistake Note if classified under A */}
                        {q.rcaClassification?.sillyMistakeNote && (
                          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-rose-700 block mb-0.5">
                              Recorded Silly Mistake:
                            </span>
                            <span className="italic font-medium">"{q.rcaClassification.sillyMistakeNote}"</span>
                          </div>
                        )}

                        {/* Question text */}
                        <p className="text-sm font-semibold text-slate-900 whitespace-pre-line leading-relaxed">{q.question}</p>

                        {/* Options */}
                        {q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(['a', 'b', 'c', 'd'] as const).map(optKey => {
                              const optText = q.options[optKey];
                              if (!optText) return null;
                              const isCorrect = q.answer === optKey;
                              return (
                                <div
                                  key={optKey}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <span className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center font-black text-[11px] uppercase ${
                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {optKey}
                                  </span>
                                  <span className="truncate">{optText}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Solution */}
                        {q.solution && (
                          <details className="group">
                            <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 select-none">
                              <BookOpen className="w-3.5 h-3.5" />
                              View Solution
                              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                            </summary>
                            <div className="mt-2 text-xs font-medium text-slate-700 whitespace-pre-line leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200">
                              {q.solution}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal footer */}
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex justify-end">
                <button
                  onClick={() => setActiveDrillChapter(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
