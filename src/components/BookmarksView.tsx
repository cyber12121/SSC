import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bookmark as BookmarkIcon,
  Layers,
  Play,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Trash2,
  LogIn,
  Loader2
} from 'lucide-react';
import { Bookmark, Question } from '../types';
import { FormattedText } from './FormattedText';
import { SolutionViewer } from './SolutionViewer';
import { cleanSolutionText } from '../utils/cleanSolution';
import { normalizeAnswerKey } from '../utils/mathSanitizer';

interface BookmarksViewProps {
  user: any;
  loadingBookmarks: boolean;
  bookmarks: Bookmark[];
  bookmarksBySubjectAndChapter: Record<string, Record<string, Bookmark[]>>;
  selectedBookmarkSubject: string | null;
  setSelectedBookmarkSubject: (sub: string | null) => void;
  expandedChapters?: Record<string, boolean>;
  toggleChapterExpand?: (subject: string, chapterTitle: string) => void;
  toggleBookmark: (question: Question) => void;
  startSubjectBookmarkQuiz: (subject: string, bookmarks: Bookmark[]) => void;
  startChapterBookmarkQuiz: (subject: string, chapterTitle: string, bookmarks: Bookmark[]) => void;
  onLogin: () => void;
  onNavigateHome: () => void;
}

export const BookmarksView: React.FC<BookmarksViewProps> = ({
  user,
  loadingBookmarks,
  bookmarks,
  bookmarksBySubjectAndChapter,
  selectedBookmarkSubject,
  setSelectedBookmarkSubject,
  expandedChapters: propExpandedChapters,
  toggleChapterExpand: propToggleChapterExpand,
  toggleBookmark,
  startSubjectBookmarkQuiz,
  startChapterBookmarkQuiz,
  onLogin,
  onNavigateHome
}) => {
  const [internalExpanded, setInternalExpanded] = useState<Record<string, boolean>>({});

  const expandedMap = propExpandedChapters || internalExpanded;
  const handleToggleChapter = (subject: string, chapterTitle: string) => {
    if (propToggleChapterExpand) {
      propToggleChapterExpand(subject, chapterTitle);
    } else {
      const key = `${subject}|${chapterTitle}`;
      setInternalExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  return (
    <motion.div
      key="bookmarks"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-xs mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <BookmarkIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Bookmarked Questions</h1>
            <p className="text-[11px] text-slate-500 font-medium">Review your saved questions across all subjects</p>
          </div>
        </div>
        {selectedBookmarkSubject === null && (
          <button
            onClick={onNavigateHome}
            className="self-start sm:self-auto flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
            Back to Practice
          </button>
        )}
      </div>

      {!user ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-xs border border-slate-200/90 max-w-md mx-auto">
          <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">Login to View Bookmarks</h2>
          <p className="text-slate-500 text-xs mb-3.5">Save tricky questions to cloud storage across devices</p>
          <button
            onClick={onLogin}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
          >
            Login with Google
          </button>
        </div>
      ) : loadingBookmarks ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
          <p className="text-slate-500 font-semibold text-xs">Loading bookmarks...</p>
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-xs border border-slate-200/90 max-w-md mx-auto">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3">
            <BookmarkIcon className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">No Bookmarks Yet</h2>
          <p className="text-slate-500 text-xs mb-3.5">Bookmark questions during practice to review them later.</p>
          <button
            onClick={onNavigateHome}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
          >
            Start Practicing
          </button>
        </div>
      ) : (
        <div>
          {selectedBookmarkSubject === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {(Object.entries(bookmarksBySubjectAndChapter) as [string, Record<string, Bookmark[]>][]).map(([subject, chaptersObj]) => {
                const allSubjectBookmarks = Object.values(chaptersObj).flat();
                const totalChapters = Object.keys(chaptersObj).length;
                return (
                  <motion.div
                    key={subject}
                    whileHover={{ y: -2 }}
                    className="bg-white rounded-xl p-3 shadow-xs border border-slate-200/80 group cursor-pointer flex flex-col justify-between hover:border-blue-300 transition-all"
                    onClick={() => setSelectedBookmarkSubject(subject)}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="px-1.5 py-0.2 bg-slate-50 text-slate-500 text-[9px] font-bold rounded border border-slate-100 uppercase tracking-wider">
                          {totalChapters} Ch
                        </span>
                      </div>
                      
                      <h3 className="text-xs font-bold text-slate-800 mb-0.5 group-hover:text-blue-600 transition-colors capitalize">
                        {subject}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium mb-3">
                        {allSubjectBookmarks.length} Bookmarked {allSubjectBookmarks.length === 1 ? 'Question' : 'Questions'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform text-[11px]">
                        View Chapters
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startSubjectBookmarkQuiz(subject, allSubjectBookmarks);
                        }}
                        className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg font-bold transition-all flex items-center justify-center cursor-pointer"
                        title={`Practice ${subject} Bookmarks`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            (() => {
              const subject = selectedBookmarkSubject as string;
              const chaptersObj: Record<string, Bookmark[]> = bookmarksBySubjectAndChapter[subject] || {};
              const allSubjectBookmarks: Bookmark[] = Object.values(chaptersObj).flat() as Bookmark[];
              return (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => setSelectedBookmarkSubject(null)}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Back to Bookmarked Subjects"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold text-slate-800 capitalize leading-tight">{subject} Bookmarks</h2>
                        <p className="text-[10px] text-slate-400 font-medium">{allSubjectBookmarks.length} bookmarked {allSubjectBookmarks.length === 1 ? 'question' : 'questions'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => startSubjectBookmarkQuiz(subject, allSubjectBookmarks)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center self-start sm:self-auto cursor-pointer"
                    >
                      <Play className="w-3 h-3 mr-1.5 fill-current" />
                      Practice All {subject}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {Object.entries(chaptersObj).map(([chapterTitle, chapterBookmarks]) => {
                      const key = `${subject}|${chapterTitle}`;
                      const isExpanded = expandedMap[key] === true;
                      return (
                        <div key={chapterTitle} className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs hover:border-slate-300 transition-all">
                          <div 
                            onClick={() => handleToggleChapter(subject, chapterTitle)}
                            className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                          >
                            <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
                                <BookOpen className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 text-xs leading-tight truncate">{chapterTitle}</h3>
                                <span className="inline-flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded mt-0.5">
                                  {chapterBookmarks.length} saved
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => startChapterBookmarkQuiz(subject, chapterTitle, chapterBookmarks)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                title={`Practice ${chapterTitle} Bookmarks`}
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>
                              
                              <button
                                onClick={() => handleToggleChapter(subject, chapterTitle)}
                                className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                              >
                                <ChevronRight className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            </div>
                          </div>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="border-t border-slate-100 p-3 bg-slate-50/20"
                              >
                                <div className="grid grid-cols-1 gap-2.5">
                                  {chapterBookmarks.map((bookmark) => (
                                    <motion.div
                                      key={bookmark.id}
                                      className="bg-white rounded-xl p-3 shadow-xs border border-slate-200/80 relative group"
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center space-x-2">
                                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${
                                            bookmark.category === 'mockErrors' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                                          }`}>
                                            {bookmark.category === 'mockErrors' ? 'Mock Error' : 'Chapter Bank'}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => bookmark.id && toggleBookmark(bookmark.question)}
                                          className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                                          title="Remove Bookmark"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      <div className="text-xs font-bold text-slate-800 mb-2.5 leading-relaxed">
                                        <FormattedText
                                          text={bookmark.question.question}
                                          as="div"
                                          isQuestion={true}
                                          subject={bookmark.question.subject || bookmark.question.section}
                                        />
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {Object.entries(bookmark.question.options).map(([key, value]) => {
                                          const isCorrect = normalizeAnswerKey(bookmark.question.answer) === key.toLowerCase();
                                          return (
                                            <div
                                              key={key}
                                              className={`p-2 rounded-lg border flex items-center ${
                                                isCorrect
                                                  ? 'border-emerald-500 bg-emerald-50/60'
                                                  : 'border-slate-200 bg-slate-50/40'
                                              }`}
                                            >
                                              <span className={`w-5 h-5 flex items-center justify-center rounded text-xs mr-2 font-bold ${
                                                isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                                              }`}>
                                                {key.toUpperCase()}
                                              </span>
                                              <FormattedText text={value} className="text-slate-700 text-xs font-medium" />
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {bookmark.question.solution && (
                                        <div className="mt-2.5 p-3 bg-white rounded-lg border border-slate-200 text-xs">
                                          <SolutionViewer
                                            solution={bookmark.question.solution}
                                            subject={bookmark.question.subject || bookmark.question.section}
                                          />
                                        </div>
                                      )}
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </motion.div>
  );
};

export default BookmarksView;
