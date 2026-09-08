import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Star, 
  Clock, 
  Bookmark, 
  BookmarkCheck, 
  Flag, 
  Check, 
  X, 
  Zap, 
  ChevronRight, 
  ChevronLeft, 
  Filter, 
  User, 
  RotateCcw, 
  Smile, 
  Frown, 
  AlertTriangle,
  BarChart3,
  FileText,
  HelpCircle,
  TrendingUp,
  XCircle,
  CheckCircle2
} from 'lucide-react';
import { QuizResult, Question } from '../types';

interface ReviewViewProps {
  result: QuizResult;
  onReattempt: () => void;
  onBack: () => void;
  userName?: string;
  bookmarkedIds?: Set<number>;
  onBookmarkToggle?: (question: Question) => void;
  onViewAnalytics?: () => void;
}

type FilterType = 'all' | 'correct' | 'incorrect' | 'unattempted';
type LanguageType = 'English' | 'Hindi' | 'Bilingual';

export const ReviewView: React.FC<ReviewViewProps> = ({ 
  result, 
  onReattempt, 
  onBack,
  userName = 'Vinay',
  bookmarkedIds = new Set(),
  onBookmarkToggle,
  onViewAnalytics
}) => {
  const items = result.questionDetails || [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [reattemptMode, setReattemptMode] = useState(false);
  const [reattemptAnswers, setReattemptAnswers] = useState<Record<number, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rating, setRating] = useState<number>(0);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [language, setLanguage] = useState<LanguageType>('English');
  const [showQuestionPaper, setShowQuestionPaper] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [localBookmarks, setLocalBookmarks] = useState<Set<number>>(new Set(bookmarkedIds));

  const current = items[currentIdx];
  const question = current?.question;

  // Question stats calculation
  const totalQuestions = items.length;
  const correctCount = items.filter(i => i.isCorrect).length;
  const wrongCount = items.filter(i => i.selectedAnswer && !i.isCorrect).length;
  const unattemptedCount = totalQuestions - correctCount - wrongCount;
  const partiallyCorrectCount = 0; // standard mock has single-correct

  const handleBookmarkClick = () => {
    if (!question) return;
    if (onBookmarkToggle) {
      onBookmarkToggle(question);
    }
    setLocalBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(question.q_num)) {
        next.delete(question.q_num);
      } else {
        next.add(question.q_num);
      }
      return next;
    });
  };

  const handleReattemptSelect = (optKey: string) => {
    if (!reattemptMode) return;
    setReattemptAnswers(prev => ({
      ...prev,
      [currentIdx]: optKey
    }));
  };

  const getQuestionStatus = (idx: number) => {
    const item = items[idx];
    if (reattemptMode && reattemptAnswers[idx]) {
      return reattemptAnswers[idx] === item.question?.answer ? 'correct' : 'wrong';
    }
    if (!item.selectedAnswer) return 'unattempted';
    return item.isCorrect ? 'correct' : 'wrong';
  };

  // Speed evaluation
  const getSpeedType = (timeSpent: number = 0, isCorrect: boolean) => {
    if (timeSpent <= 20 && isCorrect) return 'superfast';
    if (timeSpent <= 45 && isCorrect) return 'ontime';
    if (!isCorrect && timeSpent <= 45) return 'ontime_wrong';
    return 'slow';
  };

  const formatTime = (secs: number = 0) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Format text based on selected language
  const renderText = (text: string = '') => {
    if (!text) return '';
    if (language === 'Bilingual') return text;
    const lines = text.split(/\r?\n/);
    return lines.map(line => {
      const parts = line.split(/\s+\/\s+/);
      if (language === 'English') return parts[0]?.trim() || line;
      if (language === 'Hindi') return parts[1]?.trim() || parts[0]?.trim() || line;
      return line;
    }).join('\n').trim();
  };

  // Format solution text
  const formatSolutionText = (sol: string = '') => {
    if (!sol) return '';
    let text = sol;
    if (language === 'English') {
      const parts = text.split(/📖\s*हिंदी\s*स्पष्टीकरण\s*:/i);
      text = parts[0].replace(/📖\s*English\s*Explanation\s*:/gi, '').trim();
    } else if (language === 'Hindi') {
      const parts = text.split(/📖\s*हिंदी\s*स्पष्टीकरण\s*:/i);
      if (parts.length > 1) {
        text = parts[1].trim();
      }
    }
    return text;
  };

  // Filter questions for the palette
  const filteredIndices = items.map((_, idx) => idx).filter(idx => {
    if (selectedFilter === 'all') return true;
    const status = getQuestionStatus(idx);
    if (selectedFilter === 'correct') return status === 'correct';
    if (selectedFilter === 'incorrect') return status === 'wrong';
    if (selectedFilter === 'unattempted') return status === 'unattempted';
    return true;
  });

  const currentStatus = current ? getQuestionStatus(currentIdx) : 'unattempted';
  const isBookmarked = question ? localBookmarks.has(question.q_num) : false;

  // Average time for question (simulate realistic average if not stored)
  const avgSeconds = 23;
  // Percentage answered correctly (simulate realistic platform percentage ~35-65%)
  const accuracyPercent = question?.tags?.difficulty === 'easy' ? 68 : (question?.tags?.difficulty === 'hard' ? 24 : 40);

  // Marks logic (+2 for correct, -0.5 for incorrect, 0 for skipped)
  const currentMarks = currentStatus === 'correct' ? 2 : (currentStatus === 'wrong' ? -0.5 : 0);

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f7f9] overflow-hidden select-none font-sans text-gray-800">
      
      {/* 1. TOP NAVBAR (Teal Header) */}
      <header className="bg-[#0097a7] text-white h-14 px-4 flex items-center justify-between shrink-0 shadow z-30">
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors focus:outline-none"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-base font-bold leading-tight tracking-wide">Tests</h1>
            <span className="text-xs text-[#e0f7fa] font-medium leading-none truncate max-w-xs sm:max-w-md">
              {result.chapter_title || 'Quantitative Aptitude Sectional Test - 13'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Rate the Test */}
          <div className="hidden sm:flex items-center space-x-2 text-xs">
            <span className="text-white/90 font-medium">Rate the Test</span>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((starVal) => (
                <button
                  key={starVal}
                  onClick={() => setRating(starVal)}
                  className={`w-5 h-5 rounded-full border border-white/80 flex items-center justify-center transition-all ${
                    rating >= starVal ? 'bg-amber-400 border-amber-400 text-slate-900' : 'hover:bg-white/20 text-white'
                  }`}
                  title={`Rate ${starVal} Star`}
                >
                  <Star className={`w-3 h-3 ${rating >= starVal ? 'fill-current text-white' : 'text-white'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* ANALYTICS Button */}
          <button
            onClick={() => {
              if (onViewAnalytics) onViewAnalytics();
              else setShowSummaryModal(true);
            }}
            className="bg-[#0288d1] hover:bg-[#0277bd] text-white text-xs font-bold px-4 py-1.5 rounded tracking-wider uppercase shadow transition-all active:scale-95"
          >
            ANALYTICS
          </button>
        </div>
      </header>

      {/* 2. SECONDARY SUB-BAR (SECTIONS & Language) */}
      <div className="bg-white border-b border-gray-200 h-11 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200 pr-3">
            SECTIONS
          </span>
          <button className="bg-[#004d40] text-white text-xs font-semibold px-5 py-1.5 rounded shadow-sm hover:bg-[#003830] transition-colors">
            {result.subject || 'Test'}
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="font-medium text-gray-600">View In</span>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageType)}
            className="bg-white border border-gray-300 text-gray-800 rounded px-2.5 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-[#0097a7] cursor-pointer"
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
            <option value="Bilingual">Bilingual</option>
          </select>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE (Split Screen) */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* LEFT COLUMN: Question & Solution Pane */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">

          {/* Question Meta Header */}
          <div className="border-b border-gray-200 px-6 py-2.5 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center flex-wrap gap-2.5">
              <span className="text-[17px] font-bold text-gray-900">
                Question No.{currentIdx + 1}
              </span>

              {/* Status Badge: Skipped / Correct / Incorrect */}
              {currentStatus === 'correct' && (
                <span className="bg-[#2e7d32] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Correct
                </span>
              )}
              {currentStatus === 'wrong' && (
                <span className="bg-[#c62828] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Incorrect
                </span>
              )}
              {currentStatus === 'unattempted' && (
                <span className="bg-[#757575] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Skipped
                </span>
              )}

              {/* Stopwatch & Time: You: 00:05  Avg: 00:23 */}
              <div className="flex items-center space-x-1.5 text-xs text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-medium">You: {formatTime(current?.timeSpent || 5)}</span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">Avg: {formatTime(avgSeconds)}</span>
              </div>

              {/* Marks Badge */}
              <div className="flex items-center space-x-1 text-xs text-gray-700">
                <span>Marks</span>
                <span className="bg-[#616161] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {currentMarks}
                </span>
              </div>

              {/* Platform % Correct Badge */}
              <span className="bg-[#2e7d32] text-white text-xs font-medium px-2 py-0.5 rounded">
                {accuracyPercent}% answered correctly
              </span>
            </div>

            {/* Save & Report Actions */}
            <div className="flex items-center space-x-4 text-xs font-medium text-gray-600">
              <button 
                onClick={handleBookmarkClick}
                className={`flex items-center space-x-1 hover:text-[#0097a7] transition-colors ${
                  isBookmarked ? 'text-[#0288d1] font-bold' : ''
                }`}
                title="Bookmark Question"
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-4 h-4 fill-current" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
                <span>{isBookmarked ? 'Saved' : 'Save'}</span>
              </button>

              <button 
                onClick={() => setShowReportModal(true)}
                className="flex items-center space-x-1 hover:text-red-600 transition-colors"
                title="Report Question"
              >
                <Flag className="w-4 h-4" />
                <span>Report</span>
              </button>
            </div>
          </div>

          {/* Scrollable Question and Solution Content */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 custom-scrollbar">
            {question ? (
              <div className="max-w-4xl">
                {/* Question Body */}
                <div className="text-[15.5px] text-gray-900 leading-relaxed font-normal whitespace-pre-line mb-4">
                  {renderText(question.question)}
                </div>

                {/* Question Image if present */}
                {question.image && (
                  <div className="mb-5 border border-gray-200 rounded p-2 inline-block bg-white shadow-sm">
                    <img
                      src={question.image.src}
                      alt={question.image.caption || "Question diagram"}
                      className="max-w-full h-auto object-contain max-h-80"
                      referrerPolicy="no-referrer"
                    />
                    {question.image.caption && (
                      <p className="mt-1 text-xs text-gray-500 italic">{question.image.caption}</p>
                    )}
                  </div>
                )}

                {/* Options List */}
                <div className="space-y-3.5 my-5">
                  {(Object.entries(question.options) as [('a' | 'b' | 'c' | 'd'), string][]).map(([key, optText]) => {
                    const isCorrectAnswer = question.answer === key;
                    const userSelected = reattemptMode 
                      ? reattemptAnswers[currentIdx] === key 
                      : current.selectedAnswer === key;
                    const isReattemptSelected = reattemptMode && reattemptAnswers[currentIdx] !== undefined;

                    // When reattempt is OFF: normal analysis view matching the screenshot!
                    if (!reattemptMode) {
                      if (isCorrectAnswer) {
                        return (
                          <div 
                            key={key}
                            className="bg-[#2e7d32] text-white rounded px-4 py-3.5 flex items-center justify-between shadow-sm transition-all"
                          >
                            <div className="flex items-center space-x-3">
                              <Check className="w-5 h-5 text-white stroke-[2.5] shrink-0" />
                              <span className="text-[15px] font-medium leading-normal">
                                {renderText(optText)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0 ml-3">
                              {userSelected && (
                                <span className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-sm whitespace-nowrap">
                                  Your first attempt
                                </span>
                              )}
                              <span className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-sm whitespace-nowrap">
                                {accuracyPercent}% answered correctly
                              </span>
                            </div>
                          </div>
                        );
                      }

                      if (userSelected && !isCorrectAnswer) {
                        return (
                          <div 
                            key={key}
                            className="bg-[#c62828] text-white rounded px-4 py-3.5 flex items-center justify-between shadow-sm transition-all"
                          >
                            <div className="flex items-center space-x-3">
                              <RotateCcw className="w-4 h-4 text-white shrink-0" />
                              <span className="text-[15px] font-medium leading-normal">
                                {renderText(optText)}
                              </span>
                            </div>
                            <span className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-sm shrink-0 ml-3">
                              Your Answer
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={key}
                          className="px-4 py-3.5 text-[15px] text-gray-800 rounded hover:bg-gray-50 flex items-center transition-colors"
                        >
                          <span className="w-5 mr-3 shrink-0" />
                          <span className="leading-normal">{renderText(optText)}</span>
                        </div>
                      );
                    }

                    // When Reattempt mode is ON:
                    // If user has not chosen yet, show clickable options
                    if (!isReattemptSelected) {
                      return (
                        <div 
                          key={key}
                          onClick={() => handleReattemptSelect(key)}
                          className="px-4 py-3 text-[15px] text-gray-800 border border-gray-200 rounded hover:border-[#0097a7] hover:bg-cyan-50/50 cursor-pointer flex items-center transition-all group"
                        >
                          <span className="w-5 h-5 rounded-full border-2 border-gray-400 group-hover:border-[#0097a7] mr-3 flex items-center justify-center shrink-0">
                            <span className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-[#0097a7]/40" />
                          </span>
                          <span className="leading-normal">{renderText(optText)}</span>
                        </div>
                      );
                    }

                    // User reattempted and made a selection:
                    if (isCorrectAnswer) {
                      return (
                        <div 
                          key={key}
                          className="bg-[#2e7d32] text-white rounded px-4 py-3 flex items-center justify-between shadow-sm"
                        >
                          <div className="flex items-center space-x-3">
                            <Check className="w-5 h-5 text-white stroke-[2.5] shrink-0" />
                            <span className="text-[15px] font-medium">{renderText(optText)}</span>
                          </div>
                          <span className="bg-white/20 text-white text-xs font-medium px-2.5 py-0.5 rounded shrink-0">
                            {accuracyPercent}% answered correctly
                          </span>
                        </div>
                      );
                    }

                    if (userSelected) {
                      return (
                        <div 
                          key={key}
                          className="bg-[#c62828] text-white rounded px-4 py-3 flex items-center justify-between shadow-sm"
                        >
                          <div className="flex items-center space-x-3">
                            <X className="w-5 h-5 text-white stroke-[2.5] shrink-0" />
                            <span className="text-[15px] font-medium">{renderText(optText)}</span>
                          </div>
                          <span className="bg-white/20 text-white text-xs font-medium px-2.5 py-0.5 rounded shrink-0">
                            Your Attempt
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={key}
                        className="px-4 py-3 text-[15px] text-gray-700 opacity-70 flex items-center"
                      >
                        <span className="w-5 mr-3 shrink-0" />
                        <span>{renderText(optText)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Subtext notice matching screenshot */}
                <p className="text-xs text-gray-500 italic mt-2 mb-6">
                  {reattemptMode 
                    ? "Reattempt mode is On. Click an option to test yourself."
                    : "Reattempt mode is Off. Turn it on from bottom bar"}
                </p>

                {/* Solution Section */}
                {(!reattemptMode || reattemptAnswers[currentIdx] !== undefined) && (
                  <div className="mt-8 pt-4 border-t border-gray-200">
                    {/* Solution Header Tab */}
                    <div className="mb-4">
                      <span className="border-b-2 border-[#0097a7] text-[#0097a7] font-bold text-sm inline-block pb-1.5">
                        Solution
                      </span>
                    </div>

                    {/* Shortcut Trick / Solution Body */}
                    <div className="bg-white rounded-lg">
                      <div className="flex items-center space-x-1.5 text-amber-500 mb-3">
                        <Zap className="w-5 h-5 fill-amber-400 text-amber-500" />
                        <span className="text-base font-bold text-gray-900">Shortcut Trick</span>
                      </div>

                      <div className="text-[14.5px] text-gray-800 leading-relaxed font-normal whitespace-pre-line bg-gray-50/70 p-4 rounded-md border border-gray-100 font-mono">
                        {question.solution 
                          ? formatSolutionText(question.solution)
                          : "Solution details are available in the question paper bank."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 font-medium">
                No question data available.
              </div>
            )}
          </div>

          {/* Bottom Action Bar (Left Pane) */}
          <div className="bg-[#f5f5f5] border-t border-gray-200 h-13 px-6 flex items-center justify-between shrink-0 z-10">
            {/* Previous Button */}
            <button
              onClick={() => currentIdx > 0 && setCurrentIdx(currentIdx - 1)}
              disabled={currentIdx === 0}
              className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] font-medium text-xs px-5 py-2 rounded shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>

            {/* Re-attempt Questions Toggle Switch */}
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-gray-700">Re-attempt Questions</span>
              <button
                role="switch"
                aria-checked={reattemptMode}
                onClick={() => {
                  setReattemptMode(prev => !prev);
                  if (!reattemptMode) setReattemptAnswers({});
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
                  reattemptMode ? 'bg-[#0097a7]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    reattemptMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Next Button */}
            <button
              onClick={() => currentIdx < items.length - 1 && setCurrentIdx(currentIdx + 1)}
              disabled={currentIdx === items.length - 1}
              className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] font-medium text-xs px-5 py-2 rounded shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>

        {/* Vertical Sidebar Collapse/Expand Tab */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-[#37474f] hover:bg-black text-white py-3 px-1 rounded-l-md shadow-md cursor-pointer transition-all flex items-center justify-center"
          style={{ right: sidebarOpen ? '320px' : '0px' }}
          title={sidebarOpen ? "Hide Palette" : "Show Palette"}
        >
          {sidebarOpen ? (
            <ChevronRight className="w-4 h-4 text-white" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-white" />
          )}
        </button>

        {/* RIGHT COLUMN: Sidebar (Candidate Info, Legend, Speed Indicators, Question Palette) */}
        {sidebarOpen && (
          <aside className="w-80 bg-[#e1f5fe] border-l border-blue-200 flex flex-col shrink-0 h-full overflow-hidden transition-all select-none">
            
            {/* User Profile & Filter Header */}
            <div className="p-3.5 border-b border-blue-200/80 bg-white/70 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-[#00bcd4] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-gray-800 truncate max-w-[150px]">
                  {userName}
                </span>
              </div>

              {/* Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="flex items-center space-x-1 text-xs font-semibold text-gray-700 hover:text-[#0097a7] transition-colors p-1 rounded hover:bg-blue-100/50"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter</span>
                </button>

                {showFilterMenu && (
                  <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-xs z-40">
                    <button
                      onClick={() => { setSelectedFilter('all'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 ${selectedFilter === 'all' ? 'font-bold text-[#0097a7]' : 'text-gray-700'}`}
                    >
                      All ({totalQuestions})
                    </button>
                    <button
                      onClick={() => { setSelectedFilter('correct'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 ${selectedFilter === 'correct' ? 'font-bold text-green-700' : 'text-gray-700'}`}
                    >
                      Correct ({correctCount})
                    </button>
                    <button
                      onClick={() => { setSelectedFilter('incorrect'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 ${selectedFilter === 'incorrect' ? 'font-bold text-red-700' : 'text-gray-700'}`}
                    >
                      Incorrect ({wrongCount})
                    </button>
                    <button
                      onClick={() => { setSelectedFilter('unattempted'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 ${selectedFilter === 'unattempted' ? 'font-bold text-gray-700' : 'text-gray-700'}`}
                    >
                      Unattempted ({unattemptedCount})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Legend / Status Row */}
            <div className="px-3 py-2.5 border-b border-blue-200/80 bg-white/40 flex items-center gap-x-3 text-xs shrink-0 flex-wrap gap-y-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-6 h-6 rounded-full bg-[#2e7d32] text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
                  {correctCount}
                </span>
                <span className="text-gray-700 font-medium">Correct</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-6 h-6 rounded-full bg-white border-2 border-gray-500 text-gray-900 flex items-center justify-center font-bold text-[11px] shadow-sm">
                  {unattemptedCount}
                </span>
                <span className="text-gray-700 font-medium">Unattempted</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-6 h-6 rounded-full bg-[#c62828] text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
                  {wrongCount}
                </span>
                <span className="text-gray-700 font-medium">Incorrect</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-6 h-6 rounded-full bg-[#fbc02d] text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
                  {partiallyCorrectCount}
                </span>
                <span className="text-gray-700 font-medium">Partially Correct</span>
              </div>
            </div>

            {/* SPEED INDICATORS Section */}
            <div className="px-3 py-2.5 border-b border-blue-200/80 bg-white/40 shrink-0">
              <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                SPEED INDICATORS
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#2e7d32] flex items-center justify-center mb-0.5 shadow-xs">
                    <Smile className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9.5px] text-gray-600 leading-tight">Superfast</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-[#00838f] flex items-center justify-center mb-0.5 shadow-xs">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9.5px] text-gray-600 leading-tight">On Time</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-[#c62828] flex items-center justify-center mb-0.5 shadow-xs">
                    <Frown className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9.5px] text-gray-600 leading-tight">Slow</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-[#ef6c00] flex items-center justify-center mb-0.5 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9.5px] text-gray-600 leading-tight">On Time but not Correct</span>
                </div>
              </div>
            </div>

            {/* SECTION Title Bar */}
            <div className="px-4 py-2 text-xs font-bold text-gray-700 bg-[#b2ebf2]/60 shrink-0 tracking-wide">
              SECTION : <span className="text-gray-900">{result.subject || 'Test'}</span>
            </div>

            {/* Question Palette Grid */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              <div className="grid grid-cols-5 gap-2">
                {filteredIndices.map(idx => {
                  const status = getQuestionStatus(idx);
                  const isCurrent = currentIdx === idx;
                  
                  let badgeStyle = "bg-white border-2 border-gray-400 text-gray-800";
                  if (status === 'correct') {
                    badgeStyle = "bg-[#2e7d32] text-white border-transparent";
                  } else if (status === 'wrong') {
                    badgeStyle = "bg-[#c62828] text-white border-transparent";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentIdx(idx)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${badgeStyle} ${
                        isCurrent ? 'ring-2 ring-[#0097a7] ring-offset-1 scale-110 z-10 shadow-md' : 'hover:opacity-80 hover:scale-105'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions of Sidebar */}
            <div className="p-3 border-t border-blue-200/80 bg-white/70 grid grid-cols-2 gap-2 shrink-0">
              <button
                onClick={() => setShowQuestionPaper(true)}
                className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] text-xs font-bold py-2 rounded text-center transition-colors shadow-xs"
              >
                Question Paper
              </button>
              <button
                onClick={() => setShowSummaryModal(true)}
                className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] text-xs font-bold py-2 rounded text-center transition-colors shadow-xs"
              >
                Summary
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* 4. MODALS */}

      {/* Question Paper Modal */}
      {showQuestionPaper && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-[#0097a7] text-white px-6 py-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <h3 className="font-bold text-base">Question Paper - {result.chapter_title}</h3>
              </div>
              <button 
                onClick={() => setShowQuestionPaper(false)}
                className="hover:bg-white/20 p-1 rounded text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {items.map((it, idx) => (
                <div key={idx} className="border-b border-gray-200 pb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-[#0097a7]">Question {idx + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      it.isCorrect ? 'bg-green-100 text-green-800' : (it.selectedAnswer ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600')
                    }`}>
                      {it.isCorrect ? 'Correct' : (it.selectedAnswer ? 'Incorrect' : 'Unattempted')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 font-medium mb-3 whitespace-pre-line">
                    {renderText(it.question?.question)}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {it.question && (Object.entries(it.question.options) as [string, string][]).map(([k, val]) => (
                      <div 
                        key={k} 
                        className={`p-2 rounded border ${
                          k === it.question?.answer ? 'border-green-500 bg-green-50 font-bold text-green-900' : 'border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="uppercase mr-1.5 font-bold">{k}.</span>
                        {renderText(val)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowQuestionPaper(false)}
                className="px-5 py-2 bg-[#0097a7] text-white text-xs font-bold rounded hover:bg-[#00838f]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary / Analytics Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-[#0097a7] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <h3 className="font-bold text-base">Test Performance Summary</h3>
              </div>
              <button 
                onClick={() => setShowSummaryModal(false)}
                className="hover:bg-white/20 p-1 rounded text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Score & Accuracy Banner */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                  <span className="text-xs text-blue-700 font-semibold uppercase">Score</span>
                  <p className="text-2xl font-black text-blue-900 mt-1">
                    {(correctCount * 2 - wrongCount * 0.5).toFixed(1)}
                  </p>
                  <span className="text-[10px] text-blue-600">Max: {totalQuestions * 2}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <span className="text-xs text-emerald-700 font-semibold uppercase">Accuracy</span>
                  <p className="text-2xl font-black text-emerald-900 mt-1">
                    {totalQuestions > 0 && (correctCount + wrongCount) > 0 
                      ? `${Math.round((correctCount / (correctCount + wrongCount)) * 100)}%` 
                      : '0%'}
                  </p>
                  <span className="text-[10px] text-emerald-600">{correctCount}/{correctCount + wrongCount} attempted</span>
                </div>
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl">
                  <span className="text-xs text-purple-700 font-semibold uppercase">Time Spent</span>
                  <p className="text-2xl font-black text-purple-900 mt-1">
                    {formatTime(result.totalTime || 0)}
                  </p>
                  <span className="text-[10px] text-purple-600">Total duration</span>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-2.5 text-xs">
                <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider mb-2">Question Breakdown</h4>
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="flex items-center text-green-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Correct
                  </span>
                  <span className="font-bold text-green-800">{correctCount}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="flex items-center text-red-700 font-medium">
                    <XCircle className="w-4 h-4 mr-2" /> Incorrect
                  </span>
                  <span className="font-bold text-red-800">{wrongCount}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center text-gray-600 font-medium">
                    <HelpCircle className="w-4 h-4 mr-2" /> Unattempted
                  </span>
                  <span className="font-bold text-gray-700">{unattemptedCount}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                onClick={onReattempt}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 flex items-center"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reattempt Test
              </button>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="px-5 py-2 bg-[#0097a7] text-white text-xs font-bold rounded hover:bg-[#00838f]"
              >
                Back to Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Question Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-red-600 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Flag className="w-4 h-4" />
                <h3 className="font-bold text-sm">Report Question {currentIdx + 1}</h3>
              </div>
              <button 
                onClick={() => { setShowReportModal(false); setReportSubmitted(false); }}
                className="hover:bg-white/20 p-1 rounded text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 text-xs text-gray-700">
              {reportSubmitted ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-sm text-gray-800">Thank you!</p>
                  <p className="text-gray-500 mt-1">Your report has been submitted for review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-medium text-gray-800">What issue did you find in this question?</p>
                  <div className="space-y-2">
                    {['Wrong Question / Typing Error', 'Incorrect Answer Key', 'Incomplete Solution', 'Formatting / Diagram Issue'].map((issue, idx) => (
                      <label key={idx} className="flex items-center space-x-2.5 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                        <input type="radio" name="report_reason" defaultChecked={idx === 0} className="text-red-600 focus:ring-red-500" />
                        <span>{issue}</span>
                      </label>
                    ))}
                  </div>
                  <div className="pt-2">
                    <label className="block text-gray-600 mb-1">Additional details (optional):</label>
                    <textarea rows={2} className="w-full border border-gray-300 rounded p-2 focus:ring-1 focus:ring-red-500 outline-none text-xs" placeholder="Describe the issue..." />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3.5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-2">
              {reportSubmitted ? (
                <button
                  onClick={() => { setShowReportModal(false); setReportSubmitted(false); }}
                  className="px-4 py-1.5 bg-gray-800 text-white text-xs font-bold rounded"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setReportSubmitted(true)}
                    className="px-4 py-1.5 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700"
                  >
                    Submit Report
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
