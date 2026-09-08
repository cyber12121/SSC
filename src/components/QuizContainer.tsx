import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Clock, 
  CheckCircle2, 
  CornerDownLeft, 
  RotateCcw, 
  Pause, 
  Play, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  FileText, 
  User, 
  ArrowLeft 
} from 'lucide-react';
import { Question, Chapter, QuizResult } from '../types';
import { QuestionCard } from './QuestionCard';

interface QuizContainerProps {
  chapter: Chapter;
  category: 'mockErrors' | 'chapterBank';
  mode: 'practice' | 'mock';
  onComplete: (results: Omit<QuizResult, 'userId' | 'completedAt'>, openReviewAfter?: boolean) => void;
  onReviewLastAttempt?: (results: Omit<QuizResult, 'userId' | 'completedAt'>) => void;
  bookmarkedIds?: Set<number>;
  onBookmarkToggle?: (question: Question) => void;
  onDeleteQuestion?: (question: Question) => void;
  isAdmin?: boolean;
}

type QuestionStatus = 'not-visited' | 'correct' | 'wrong' | 'marked' | 'answered-marked' | 'answered';

export const QuizContainer: React.FC<QuizContainerProps> = ({ 
  chapter, 
  category, 
  mode,
  onComplete,
  onReviewLastAttempt,
  bookmarkedIds = new Set(),
  onBookmarkToggle,
  onDeleteQuestion,
  isAdmin = false
}) => {
  const totalQuestions = chapter.questions.length;

  // Per-question time limit (seconds): 36s chapter bank (45s for Top500 set_2); no timer for mock errors.
  const perQuestionSec = category === 'mockErrors' ? 0 : (chapter.section === 'top500' && chapter.set_name === 'set_2' ? 45 : 36);
  const totalQuizTime = mode === 'mock' && perQuestionSec > 0 ? perQuestionSec * totalQuestions : null;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeSpent, setTimeSpent] = useState<Record<number, number>>({});
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [isFinished, setIsFinished] = useState(false);
  const [currentTimer, setCurrentTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(totalQuizTime);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showQuestionPaper, setShowQuestionPaper] = useState(false);
  
  const startTimeRef = useRef<number>(Date.now());

  // Safety check if questions were deleted
  useEffect(() => {
    if (currentIdx >= totalQuestions && totalQuestions > 0) {
      setCurrentIdx(totalQuestions - 1);
    }
  }, [totalQuestions, currentIdx]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    setCurrentTimer(0);
    
    // Mark as visited when currentIdx changes
    setVisited(prev => {
      const next = new Set(prev);
      next.add(currentIdx);
      return next;
    });
    
    const interval = setInterval(() => {
      if (!isPaused) {
        setCurrentTimer(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIdx, isPaused]);

  // Quiz countdown: auto-submits when time is up
  useEffect(() => {
    if (totalQuizTime == null || isFinished || isReviewMode || isPaused) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev == null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          recordTime();
          setIsFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [totalQuizTime, isFinished, isReviewMode, isPaused]);

  const recordTime = () => {
    if (isPaused) return;
    const endTime = Date.now();
    const duration = Math.round((endTime - startTimeRef.current) / 1000);
    setTimeSpent(prev => ({ ...prev, [currentIdx]: (prev[currentIdx] || 0) + duration }));
    startTimeRef.current = Date.now();
  };

  const handlePauseToggle = () => {
    if (!isPaused) {
      recordTime();
      setIsPaused(true);
    } else {
      startTimeRef.current = Date.now();
      setIsPaused(false);
    }
  };

  const handleAnswer = (answer: 'a' | 'b' | 'c' | 'd') => {
    recordTime();
    setAnswers(prev => ({ ...prev, [currentIdx]: answer }));
  };

  const handleClearResponse = () => {
    setAnswers(prev => {
      const next = { ...prev };
      delete next[currentIdx];
      return next;
    });
    setMarkedForReview(prev => {
      const next = new Set(prev);
      next.delete(currentIdx);
      return next;
    });
  };

  const jumpToQuestion = (idx: number) => {
    recordTime();
    setCurrentIdx(idx);
  };

  const handleSaveAndNext = () => {
    recordTime();
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      alert("You have reached the end of the test. Click 'Submit Test' to finish.");
    }
  };

  const handleMarkAndNext = () => {
    recordTime();
    setMarkedForReview(prev => {
      const next = new Set(prev);
      next.add(currentIdx);
      return next;
    });
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const getStatus = (idx: number): QuestionStatus => {
    const isAnswered = !!answers[idx];
    const isMarked = markedForReview.has(idx);

    if (!isReviewMode) {
      if (isMarked && isAnswered) return 'answered-marked';
      if (isMarked) return 'marked';
    }

    if (isAnswered) {
      if (mode === 'mock' && !isReviewMode) return 'answered';
      const isCorrect = answers[idx] === chapter.questions[idx].answer;
      return isCorrect ? 'correct' : 'wrong';
    }

    return 'not-visited';
  };

  const handleReattempt = () => {
    setAnswers({});
    setTimeSpent({});
    setVisited(new Set([0]));
    setMarkedForReview(new Set());
    setIsFinished(false);
    setIsReviewMode(false);
    setCurrentIdx(0);
    setCurrentTimer(0);
    setIsPaused(false);
    setTimeLeft(totalQuizTime);
  };

  const calculateScore = () => {
    let correct = 0;
    chapter.questions.forEach((q, idx) => {
      if (answers[idx] === q.answer) correct++;
    });
    return correct;
  };

  const buildResults = (): Omit<QuizResult, 'userId' | 'completedAt'> => {
    const score = calculateScore();
    const totalTime = (Object.values(timeSpent) as number[]).reduce((acc, t) => acc + t, 0);
    return {
      chapter_title: chapter.chapter_title,
      subject: chapter.subject,
      category,
      mode,
      score,
      totalQuestions,
      totalTime,
      questionDetails: chapter.questions.map((q, idx) => ({
        q_num: q.q_num,
        timeSpent: timeSpent[idx] || 0,
        isCorrect: answers[idx] === q.answer,
        selectedAnswer: answers[idx] || '',
        question: q,
        marked: markedForReview.has(idx),
      }))
    };
  };

  if (isFinished && !isReviewMode) {
    const score = calculateScore();
    const totalTime = (Object.values(timeSpent) as number[]).reduce((acc, t) => acc + t, 0);
    const attemptedQuestions = Object.keys(answers).length;
    const percentage = attemptedQuestions > 0 
      ? Math.round((score / attemptedQuestions) * 100) 
      : 0;

    const results = buildResults();

    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-[#f4f7f9]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-200"
        >
          <div className="w-16 h-16 bg-cyan-50 text-[#0097a7] rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Test Submitted!</h2>
          <p className="text-gray-500 text-sm mb-6">
            You completed <span className="font-semibold text-gray-700">{chapter.chapter_title}</span>
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6 text-left">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <span className="text-xs font-semibold text-emerald-700 uppercase">Correct</span>
              <div className="text-2xl font-bold text-emerald-800 mt-1">{score}/{totalQuestions}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <span className="text-xs font-semibold text-blue-700 uppercase">Accuracy</span>
              <div className="text-2xl font-bold text-blue-800 mt-1">{percentage}%</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 col-span-2">
              <span className="text-xs font-semibold text-purple-700 uppercase">Total Time Spent</span>
              <div className="text-xl font-bold text-purple-800 mt-1">{Math.floor(totalTime / 60)}m {totalTime % 60}s</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {onReviewLastAttempt && (
              <button
                onClick={() => onReviewLastAttempt(results)}
                className="flex-1 py-3 bg-[#0097a7] hover:bg-[#00838f] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center shadow"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Review Questions
              </button>
            )}
            <button
              onClick={handleReattempt}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center shadow"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reattempt
            </button>
            <button
              onClick={() => onComplete(results)}
              className="flex-1 py-3 bg-gray-800 hover:bg-black text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center shadow"
            >
              <CornerDownLeft className="w-4 h-4 mr-2" />
              Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = chapter.questions[currentIdx];
  const isShowSolution = mode === 'practice' ? !!answers[currentIdx] : false;

  const stats = {
    correct: mode === 'mock' && !isReviewMode ? 0 : Object.keys(answers).filter(idx => answers[parseInt(idx)] === chapter.questions[parseInt(idx)].answer).length,
    wrong: mode === 'mock' && !isReviewMode ? 0 : Object.keys(answers).filter(idx => answers[parseInt(idx)] !== chapter.questions[parseInt(idx)].answer).length,
    answered: Object.keys(answers).length,
    marked: markedForReview.size,
    notAttempted: totalQuestions - Object.keys(answers).length - markedForReview.size,
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f7f9] overflow-hidden select-none font-sans text-gray-800">
      
      {/* 1. TOP NAVBAR (Teal Header) */}
      <header className="bg-[#0097a7] text-white h-14 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow z-30">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              if (window.confirm("Do you want to exit the test? Your progress will be lost.")) {
                onComplete(buildResults());
              }
            }}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors focus:outline-none"
            title="Exit Test"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-base font-bold leading-tight tracking-wide">Tests</h1>
            <span className="text-xs text-[#e0f7fa] font-medium leading-none truncate max-w-xs sm:max-w-md">
              {isReviewMode ? `Review: ${chapter.chapter_title}` : chapter.chapter_title}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isReviewMode ? (
            <div className="flex items-center space-x-2">
              {onReviewLastAttempt && (
                <button
                  onClick={() => onReviewLastAttempt(buildResults())}
                  className="bg-[#0288d1] hover:bg-[#0277bd] text-white text-xs font-bold px-3 py-1.5 rounded uppercase tracking-wider shadow"
                >
                  Full Review
                </button>
              )}
              <button
                onClick={() => setIsReviewMode(false)}
                className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded"
              >
                Back to Summary
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={handlePauseToggle}
                className="flex items-center bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded text-xs font-semibold text-white transition-colors"
                title={isPaused ? "Resume Test" : "Pause Test"}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 mr-1 fill-current" /> : <Pause className="w-3.5 h-3.5 mr-1 fill-current" />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </button>

              <div className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-mono font-bold tracking-wider ${
                mode === 'mock' && totalQuizTime != null && timeLeft != null && timeLeft <= 60 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'bg-white/20 text-white'
              }`}>
                <Clock className="w-3.5 h-3.5 mr-0.5" />
                {mode === 'practice'
                  ? `Q ${Math.floor(currentTimer / 60).toString().padStart(2, '0')}:${(currentTimer % 60).toString().padStart(2, '0')}`
                  : (totalQuizTime != null && timeLeft != null
                    ? `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`
                    : `${Math.floor(currentTimer / 60).toString().padStart(2, '0')}:${(currentTimer % 60).toString().padStart(2, '0')}`)}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 2. SECONDARY SUB-BAR (SECTIONS) */}
      <div className="bg-white border-b border-gray-200 h-11 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200 pr-3">
            SECTIONS
          </span>
          <button className="bg-[#004d40] text-white text-xs font-semibold px-5 py-1.5 rounded shadow-xs">
            {chapter.subject || 'Test'}
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="font-medium text-gray-600">View In</span>
          <span className="border border-gray-300 rounded px-2.5 py-1 font-medium text-gray-800 bg-white">
            English
          </span>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* LEFT COLUMN: Main Question Area */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          
          {/* Scrollable Question Content */}
          <div className="flex-1 overflow-y-auto relative custom-scrollbar">
            {isPaused ? (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-8 text-center text-white">
                <div className="w-16 h-16 bg-[#0097a7] rounded-full flex items-center justify-center mb-4 shadow-lg animate-pulse">
                  <Pause className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Test Paused</h3>
                <p className="text-slate-200 max-w-sm mb-6 text-sm">
                  Your quiz is paused. The timer has been suspended. Click below to resume.
                </p>
                <button
                  onClick={handlePauseToggle}
                  className="px-6 py-2.5 bg-[#0097a7] hover:bg-[#00838f] text-white rounded-xl font-bold transition-all shadow text-sm flex items-center"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Resume Test
                </button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {currentQuestion && (
                  <QuestionCard
                    key={currentQuestion.q_num}
                    question={currentQuestion}
                    onAnswer={isReviewMode ? () => {} : handleAnswer}
                    selectedAnswer={answers[currentIdx] || null}
                    showSolution={isReviewMode ? true : isShowSolution}
                    isBookmarked={bookmarkedIds.has(currentQuestion.q_num)}
                    onBookmark={() => onBookmarkToggle?.(currentQuestion)}
                    isAdmin={isAdmin}
                    onDelete={() => onDeleteQuestion?.(currentQuestion)}
                    timeSpentSeconds={isReviewMode ? (timeSpent[currentIdx] || 0) : (mode === 'practice' ? currentTimer : undefined)}
                  />
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Bottom Action Bar (Left Pane) */}
          <div className="bg-[#f5f5f5] border-t border-gray-200 h-13 px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
            {isReviewMode ? (
              <>
                <button
                  onClick={() => currentIdx > 0 && setCurrentIdx(currentIdx - 1)}
                  disabled={currentIdx === 0}
                  className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] font-semibold text-xs px-5 py-2 rounded shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => currentIdx < totalQuestions - 1 && setCurrentIdx(currentIdx + 1)}
                  disabled={currentIdx === totalQuestions - 1}
                  className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] font-semibold text-xs px-5 py-2 rounded shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setIsReviewMode(false)}
                  className="bg-gray-800 text-white font-semibold text-xs px-5 py-2 rounded hover:bg-black"
                >
                  Back to Summary
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => currentIdx > 0 && jumpToQuestion(currentIdx - 1)}
                    disabled={currentIdx === 0}
                    className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] font-semibold text-xs px-4 py-2 rounded shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleClearResponse}
                    disabled={!answers[currentIdx]}
                    className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs px-3.5 py-2 rounded shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Clear Response
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleMarkAndNext}
                    className="bg-[#0288d1] hover:bg-[#0277bd] text-white font-semibold text-xs px-4 py-2 rounded shadow-xs"
                  >
                    Mark for Review & Next
                  </button>
                  <button
                    onClick={handleSaveAndNext}
                    className="bg-[#0097a7] hover:bg-[#00838f] text-white font-semibold text-xs px-4 py-2 rounded shadow-xs"
                  >
                    Save & Next
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to submit the test?")) {
                        recordTime();
                        setIsFinished(true);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded shadow-xs"
                  >
                    Submit Test
                  </button>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Sidebar Collapse Toggle */}
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

        {/* RIGHT COLUMN: Question Palette Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 bg-[#e1f5fe] border-l border-blue-200 flex flex-col shrink-0 h-full overflow-hidden transition-all select-none">
            
            {/* Candidate Header */}
            <div className="p-3.5 border-b border-blue-200/80 bg-white/70 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-[#00bcd4] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-800 leading-tight">Candidate</div>
                  <div className="text-[10px] text-gray-500 leading-tight">{chapter.subject}</div>
                </div>
              </div>
            </div>

            {/* Legend Box */}
            <div className="p-3 border-b border-blue-200/80 bg-white/40 grid grid-cols-2 gap-y-2 gap-x-2 text-xs shrink-0 font-medium text-gray-700">
              {mode === 'mock' && !isReviewMode ? (
                <div className="flex items-center">
                  <span className="w-5 h-5 rounded bg-[#2e7d32] text-white flex items-center justify-center font-bold text-[11px] mr-1.5 shadow-xs">
                    {stats.answered}
                  </span>
                  <span>Answered</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center">
                    <span className="w-5 h-5 rounded bg-[#2e7d32] text-white flex items-center justify-center font-bold text-[11px] mr-1.5 shadow-xs">
                      {stats.correct}
                    </span>
                    <span>Correct</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-5 h-5 rounded bg-[#c62828] text-white flex items-center justify-center font-bold text-[11px] mr-1.5 shadow-xs">
                      {stats.wrong}
                    </span>
                    <span>Wrong</span>
                  </div>
                </>
              )}
              <div className="flex items-center">
                <span className="w-5 h-5 rounded bg-white border border-gray-700 text-gray-900 flex items-center justify-center font-bold text-[11px] mr-1.5 shadow-xs">
                  {stats.notAttempted}
                </span>
                <span>Not Attempted</span>
              </div>
              <div className="flex items-center">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[11px] mr-1.5 shadow-xs">
                  {stats.marked}
                </span>
                <span>Marked</span>
              </div>
            </div>

            {/* SECTION Title Bar */}
            <div className="px-4 py-2 text-xs font-bold text-gray-800 bg-[#b2ebf2]/60 shrink-0">
              SECTION : {chapter.subject || 'Test'}
            </div>

            {/* Palette Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2.5">
                Choose a Question
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                {chapter.questions.map((q, idx) => {
                  const status = getStatus(idx);
                  const isActive = currentIdx === idx;
                  
                  let badgeStyle = "bg-white border border-gray-700 text-gray-900";
                  if (status === 'correct') {
                    badgeStyle = "bg-[#2e7d32] text-white border-transparent";
                  } else if (status === 'wrong') {
                    badgeStyle = "bg-[#c62828] text-white border-transparent";
                  } else if (status === 'answered') {
                    badgeStyle = "bg-[#2e7d32] text-white border-transparent";
                  } else if (status === 'marked' || status === 'answered-marked') {
                    badgeStyle = "bg-purple-600 text-white border-transparent rounded-full";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => jumpToQuestion(idx)}
                      className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all shadow-xs relative ${badgeStyle} ${
                        isActive ? 'ring-2 ring-sky-500 ring-offset-2 scale-105 z-10' : 'hover:opacity-90'
                      }`}
                    >
                      {idx + 1}
                      {status === 'answered-marked' && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-blue-200/80 bg-white/70 grid grid-cols-2 gap-2 shrink-0">
              <button
                onClick={() => setShowQuestionPaper(true)}
                className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] text-xs font-bold py-2 rounded text-center transition-colors shadow-xs"
              >
                Question Paper
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Submit test now?")) {
                    recordTime();
                    setIsFinished(true);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded text-center transition-colors shadow-xs"
              >
                Submit Test
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Question Paper Modal */}
      {showQuestionPaper && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-[#0097a7] text-white px-6 py-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <h3 className="font-bold text-base">Question Paper - {chapter.chapter_title}</h3>
              </div>
              <button 
                onClick={() => setShowQuestionPaper(false)}
                className="hover:bg-white/20 p-1 rounded text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {chapter.questions.map((q, idx) => (
                <div key={idx} className="border-b border-gray-200 pb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-[#0097a7]">Question {idx + 1}</span>
                    <span className="text-xs text-gray-500 font-medium">Marks: +2.0, -0.5</span>
                  </div>
                  <p className="text-sm text-gray-900 font-medium mb-3 whitespace-pre-line">
                    {q.question}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(Object.entries(q.options) as [string, string][]).map(([k, val]) => (
                      <div key={k} className="p-2 rounded border border-gray-200 bg-gray-50 text-gray-700">
                        <span className="uppercase mr-1.5 font-bold">{k}.</span>
                        {val}
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

    </div>
  );
};
