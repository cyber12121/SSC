import React, { useState, useMemo } from 'react';
import {
  BookOpen, Sparkles, Layers, ChevronRight, CheckCircle2,
  Folder, ArrowRight, Zap, Target, Search, Download, ExternalLink,
  Flame, Clock
} from 'lucide-react';
import { SRSCard } from '../../types/srs';
import {
  computeSubjectChapterGroups,
  SubjectDeckGroup,
  ChapterDeckSummary
} from '../../utils/srsEngine';

interface SrsChapterDecksSectionProps {
  cards: SRSCard[]; // ankiCards or testCards
  deckMode: 'anki' | 'test_srs';
  onStartReviewChapter: (subject: string, chapter: string) => void;
  onStartReviewSubject: (subject: string) => void;
  onOpenExplorerChapter: (subject: string, chapter: string) => void;
  onOpenAiCreator?: () => void;
  onBatchImportAyush?: () => void;
  onBatchImportStaticGk?: () => void;
  onBatchImportMockErrors?: (subject?: string) => void;
}

export const SrsChapterDecksSection: React.FC<SrsChapterDecksSectionProps> = ({
  cards,
  deckMode,
  onStartReviewChapter,
  onStartReviewSubject,
  onOpenExplorerChapter,
  onOpenAiCreator,
  onBatchImportAyush,
  onBatchImportStaticGk,
  onBatchImportMockErrors
}) => {
  const [selectedSubjectTab, setSelectedSubjectTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const subjectGroups = useMemo(() => computeSubjectChapterGroups(cards), [cards]);

  const getSubjectColorConfig = (subjectKey: string) => {
    switch (subjectKey) {
      case 'English':
        return {
          themeName: 'English Vocab',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          borderHover: 'hover:border-emerald-300',
          buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          lightBg: 'bg-emerald-50/60',
          progressBar: 'bg-emerald-500',
          emoji: '📖'
        };
      case 'General Awareness':
        return {
          themeName: 'General Knowledge (GK/GS)',
          badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
          borderHover: 'hover:border-sky-300',
          buttonClass: 'bg-sky-600 hover:bg-sky-700 text-white',
          lightBg: 'bg-sky-50/60',
          progressBar: 'bg-sky-500',
          emoji: '🏛️'
        };
      case 'Mathematics':
        return {
          themeName: 'Quantitative Aptitude (Math)',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          borderHover: 'hover:border-amber-300',
          buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
          lightBg: 'bg-amber-50/60',
          progressBar: 'bg-amber-500',
          emoji: '📐'
        };
      case 'Reasoning':
        return {
          themeName: 'General Intelligence & Reasoning',
          badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
          borderHover: 'hover:border-purple-300',
          buttonClass: 'bg-purple-600 hover:bg-purple-700 text-white',
          lightBg: 'bg-purple-50/60',
          progressBar: 'bg-purple-500',
          emoji: '🧩'
        };
      default:
        return {
          themeName: 'General',
          badgeClass: 'bg-slate-50 text-slate-800 border-slate-200',
          borderHover: 'hover:border-slate-300',
          buttonClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
          lightBg: 'bg-slate-50/60',
          progressBar: 'bg-indigo-500',
          emoji: '📚'
        };
    }
  };

  const filteredGroups = useMemo(() => {
    return subjectGroups
      .filter(g => {
        if (selectedSubjectTab !== 'all' && g.subject !== selectedSubjectTab) {
          return false;
        }
        return true;
      })
      .map(g => {
        if (!searchQuery.trim()) return g;
        const q = searchQuery.toLowerCase().trim();
        const matchedChapters = g.chapters.filter(ch =>
          ch.chapterName.toLowerCase().includes(q)
        );
        return {
          ...g,
          chapters: matchedChapters
        };
      });
  }, [subjectGroups, selectedSubjectTab, searchQuery]);

  const totalDueAcrossDeck = useMemo(() => {
    return subjectGroups.reduce((sum, g) => sum + g.dueToday, 0);
  }, [subjectGroups]);

  return (
    <div className="space-y-6 select-none">
      {/* Section Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{deckMode === 'anki' ? '🎴 Chapter-Wise Anki Decks' : '🎯 Chapter-Wise Test Question Revision'}</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                Organized
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {deckMode === 'anki'
              ? 'Study specific chapters or whole subjects with associative mnemonics & active recall'
              : 'Targeted error revision grouped by chapters from mocks, sectionals, and quizzes'}
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search chapters & topics..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Subject Filter Pills Bar */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedSubjectTab('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
            selectedSubjectTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>🎯 All Subjects ({cards.length})</span>
          {totalDueAcrossDeck > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              selectedSubjectTab === 'all' ? 'bg-indigo-800 text-white' : 'bg-amber-100 text-amber-900'
            }`}>
              {totalDueAcrossDeck} Due
            </span>
          )}
        </button>

        {subjectGroups.map(group => {
          const cfg = getSubjectColorConfig(group.subject);
          const isSelected = selectedSubjectTab === group.subject;
          return (
            <button
              key={group.subject}
              type="button"
              onClick={() => setSelectedSubjectTab(group.subject)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{cfg.emoji} {cfg.themeName.split(' ')[0]}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {group.totalCards}
              </span>
              {group.dueToday > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-100 text-amber-900">
                  {group.dueToday} Due
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Subject Groups & Chapter Decks Container */}
      <div className="space-y-6">
        {filteredGroups.map(group => {
          const cfg = getSubjectColorConfig(group.subject);
          const retentionRate = group.totalCards > 0 ? Math.round((group.mastered / group.totalCards) * 100) : 0;

          return (
            <div
              key={group.subject}
              className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden transition-shadow hover:shadow-md"
            >
              {/* Subject Group Header */}
              <div className={`p-5 sm:px-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${cfg.lightBg}`}>
                <div className="flex items-center space-x-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-xl shrink-0">
                    {cfg.emoji}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h4 className="text-base sm:text-lg font-black text-slate-900">
                        {cfg.themeName}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.badgeClass}`}>
                        {group.chapters.length} {group.chapters.length === 1 ? 'Chapter' : 'Chapters'}
                      </span>
                      {group.dueToday > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                          ⚡ {group.dueToday} Due Today
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ✓ All Caught Up
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
                      <span><strong>{group.totalCards}</strong> total cards</span>
                      <span>•</span>
                      <span><strong>{group.mastered}</strong> mastered ({retentionRate}%)</span>
                    </div>
                  </div>
                </div>

                {/* Subject-Level Action */}
                <div className="flex items-center space-x-2 shrink-0">
                  {group.totalCards > 0 ? (
                    <button
                      onClick={() => onStartReviewSubject(group.subject)}
                      className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer ${cfg.buttonClass}`}
                    >
                      <span>{group.dueToday > 0 ? `Review All ${group.subject} (${group.dueToday} Due)` : `Practice All ${group.subject}`}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Chapters Grid */}
              <div className="p-5 sm:p-6">
                {group.chapters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.chapters.map(chapter => {
                      const chPercent = chapter.totalCards > 0 ? Math.round((chapter.mastered / chapter.totalCards) * 100) : 0;

                      return (
                        <div
                          key={chapter.chapterName}
                          className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200 p-4 transition-all duration-200 hover:shadow-md hover:border-indigo-300 flex flex-col justify-between space-y-3.5 group"
                        >
                          <div>
                            {/* Top row: Chapter name & Due Badge */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 group-hover:border-indigo-300 group-hover:text-indigo-600 transition-colors">
                                  <Folder className="w-3.5 h-3.5" />
                                </div>
                                <h5 className="font-extrabold text-slate-900 text-xs truncate" title={chapter.chapterName}>
                                  {chapter.chapterName}
                                </h5>
                              </div>
                            </div>

                            {/* Status badge */}
                            <div className="flex items-center justify-between text-[11px] mb-2.5">
                              <span className="font-semibold text-slate-500">
                                {chapter.totalCards} {chapter.totalCards === 1 ? 'card' : 'cards'}
                              </span>
                              {chapter.dueToday > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  ⚡ {chapter.dueToday} Due
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                  ✓ Up to date
                                </span>
                              )}
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[10px] font-medium text-slate-400">
                                <span>Mastery</span>
                                <span>{chapter.mastered}/{chapter.totalCards} ({chPercent}%)</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${cfg.progressBar} rounded-full transition-all duration-300`}
                                  style={{ width: `${chPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
                            <button
                              onClick={() => onOpenExplorerChapter(group.subject, chapter.chapterName)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title={`View ${chapter.chapterName} in Explorer`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onStartReviewChapter(group.subject, chapter.chapterName)}
                              className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                                chapter.dueToday > 0
                                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              <span>{chapter.dueToday > 0 ? `Review (${chapter.dueToday})` : 'Practice'}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty state for subject */
                  <div className="text-center py-8 px-4 max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                      {cfg.emoji}
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 text-sm">No {cfg.themeName} Cards Yet</h5>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {deckMode === 'anki'
                          ? `Start building your ${group.subject} conceptual deck using AI generation or pre-curated sets.`
                          : `Complete mock tests or chapter quizzes to automatically capture your ${group.subject} mistake questions.`}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                      {deckMode === 'anki' && group.subject === 'English' && onBatchImportAyush && (
                        <button
                          onClick={onBatchImportAyush}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Load Ayush Vocab
                        </button>
                      )}
                      {deckMode === 'anki' && group.subject === 'General Awareness' && onBatchImportStaticGk && (
                        <button
                          onClick={onBatchImportStaticGk}
                          className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Load Classical Dance GK
                        </button>
                      )}
                      {deckMode === 'anki' && onOpenAiCreator && (
                        <button
                          onClick={onOpenAiCreator}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          <span>Generate with AI</span>
                        </button>
                      )}
                      {deckMode === 'test_srs' && onBatchImportMockErrors && (
                        <button
                          onClick={() => onBatchImportMockErrors(group.subject)}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Download className="w-3 h-3 text-amber-700" />
                          <span>Import {group.subject} Errors</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
