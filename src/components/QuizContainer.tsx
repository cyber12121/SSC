import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Clock, CheckCircle2, CornerDownLeft, RotateCcw,
  Pause, Play, BookOpen, ChevronRight, ChevronLeft,
  X, FileText, User, ArrowLeft
} from 'lucide-react';
import { Question, Chapter, QuizResult } from '../types';
import { QuestionCard } from './QuestionCard';

interface QuizContainerProps {
  chapter: Chapter;
  category: 'mockErrors' | 'chapterBank';
  mode: 'practice' | 'mock';
  onSaveResult: (results: Omit<QuizResult, 'userId' | 'completedAt'>) => Promise<QuizResult | null>;
  onExit: () => void;
  onReviewAttempt?: (result: QuizResult) => void;
  bookmarkedIds?: Set<number>;
  onBookmarkToggle?: (question: Question) => void;
  onDeleteQuestion?: (question: Question) => void;
  isAdmin?: boolean;
}

type QuestionStatus = 'not-visited' | 'not-attempted' | 'correct' | 'wrong' | 'marked' | 'answered-marked' | 'answered';

const fmtTime = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export const QuizContainer: React.FC<QuizContainerProps> = ({
  chapter,
  category,
  mode,
  onSaveResult,
  onExit,
  onReviewAttempt,
  bookmarkedIds = new Set(),
  onBookmarkToggle,
  onDeleteQuestion,
  isAdmin = false
}) => {
  const totalQuestions = chapter.questions.length;

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
  const [submittedResult, setSubmittedResult] = useState<QuizResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (currentIdx >= totalQuestions && totalQuestions > 0) {
      setCurrentIdx(totalQuestions - 1);
    }
  }, [totalQuestions, currentIdx]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    setCurrentTimer(0);
    setVisited(prev => { const n = new Set(prev); n.add(currentIdx); return n; });
    const interval = setInterval(() => {
      if (!isPaused) setCurrentTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIdx, isPaused]);

  useEffect(() => {
    if (totalQuizTime == null || isFinished || isReviewMode || isPaused) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev == null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [totalQuizTime, isFinished, isReviewMode, isPaused]);

  const recordTime = () => {
    if (isPaused) return;
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    setTimeSpent(prev => ({ ...prev, [currentIdx]: (prev[currentIdx] || 0) + duration }));
    startTimeRef.current = Date.now();
  };

  const handlePauseToggle = () => {
    if (!isPaused) { recordTime(); setIsPaused(true); }
    else { startTimeRef.current = Date.now(); setIsPaused(false); }
  };

  const handleAnswer = (answer: 'a' | 'b' | 'c' | 'd') => {
    recordTime();
    setAnswers(prev => ({ ...prev, [currentIdx]: answer }));
  };

  const handleClearResponse = () => {
    setAnswers(prev => { const n = { ...prev }; delete n[currentIdx]; return n; });
    setMarkedForReview(prev => { const n = new Set(prev); n.delete(currentIdx); return n; });
  };

  const jumpToQuestion = (idx: number) => { recordTime(); setCurrentIdx(idx); };

  const handleSaveAndNext = () => {
    recordTime();
    if (currentIdx < totalQuestions - 1) setCurrentIdx(currentIdx + 1);
    else alert("You have reached the end of the test. Click 'Submit Test' to finish.");
  };

  const handleMarkAndNext = () => {
    recordTime();
    setMarkedForReview(prev => { const n = new Set(prev); n.add(currentIdx); return n; });
    if (currentIdx < totalQuestions - 1) setCurrentIdx(currentIdx + 1);
  };

  const getCorrectAnswer = (q: Question) =>
    (q.answer || (q as any).correct_answer || (q as any).correctOption || '')?.toString().toLowerCase().trim();

  const isQuestionCorrect = (idx: number) => {
    const userAns = answers[idx]?.toLowerCase().trim();
    return !!userAns && userAns === getCorrectAnswer(chapter.questions[idx]);
  };

  const getStatus = (idx: number): QuestionStatus => {
    const isAnswered = !!answers[idx];
    const isMarked = markedForReview.has(idx);
    const isVis = visited.has(idx);

    if (!isReviewMode) {
      if (isMarked && isAnswered) return 'answered-marked';
      if (isMarked) return 'marked';
      if (isAnswered) return mode === 'mock' ? 'answered' : (isQuestionCorrect(idx) ? 'correct' : 'wrong');
      if (isVis && idx !== currentIdx) return 'not-attempted';
      return 'not-visited';
    }

    if (isAnswered) {
      return isQuestionCorrect(idx) ? 'correct' : 'wrong';
    }
    return 'not-visited';
  };

  const handleReattempt = () => {
    setAnswers({}); setTimeSpent({}); setVisited(new Set([0])); setMarkedForReview(new Set());
    setIsFinished(false); setIsReviewMode(false); setCurrentIdx(0); setCurrentTimer(0);
    setIsPaused(false); setTimeLeft(totalQuizTime); setSubmittedResult(null);
  };

  const calculateScore = () =>
    chapter.questions.filter((_, idx) => isQuestionCorrect(idx)).length;

  const buildResults = (): Omit<QuizResult, 'userId' | 'completedAt'> => {
    const score = calculateScore();
    const totalTime = (Object.values(timeSpent) as number[]).reduce((a, t) => a + t, 0);
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
        isCorrect: isQuestionCorrect(idx),
        selectedAnswer: answers[idx] || '',
        question: q,
        marked: markedForReview.has(idx),
      }))
    };
  };

  const handleSubmitTest = async () => {
    if (isFinished || isSubmitting) return;
    recordTime();
    setIsSubmitting(true);
    const results = buildResults();
    try {
      const saved = await onSaveResult(results);
      if (saved) {
        setSubmittedResult(saved);
      } else {
        setSubmittedResult({
          ...results,
          id: 'local-' + Date.now(),
          userId: '',
          completedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error submitting quiz result:', error);
      setSubmittedResult({
        ...results,
        id: 'local-' + Date.now(),
        userId: '',
        completedAt: new Date().toISOString()
      });
    } finally {
      setIsSubmitting(false);
      setIsFinished(true);
    }
  };

  const confirmAndSubmit = () => {
    if (window.confirm('Are you sure you want to submit the test?')) {
      handleSubmitTest();
    }
  };

  /* ── SCORE SCREEN ── */
  if (isFinished && !isReviewMode) {
    const score = calculateScore();
    const totalTime = (Object.values(timeSpent) as number[]).reduce((a, t) => a + t, 0);
    const attempted = Object.keys(answers).length;
    const wrong = attempted - score;
    const accuracy = attempted > 0 ? Math.round((score / attempted) * 100) : 0;
    const results = buildResults();
    const activeResult: QuizResult = submittedResult || {
      ...results,
      id: 'local-' + Date.now(),
      userId: '',
      completedAt: new Date().toISOString()
    };

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
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <span className="text-xs font-semibold text-red-700 uppercase">Wrong</span>
              <div className="text-2xl font-bold text-red-800 mt-1">{wrong}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <span className="text-xs font-semibold text-blue-700 uppercase">Accuracy</span>
              <div className="text-2xl font-bold text-blue-800 mt-1">{accuracy}%</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <span className="text-xs font-semibold text-purple-700 uppercase">Total Time</span>
              <div className="text-xl font-bold text-purple-800 mt-1">{Math.floor(totalTime / 60)}m {totalTime % 60}s</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {onReviewAttempt && (
              <button
                onClick={() => onReviewAttempt(activeResult)}
                className="py-3 bg-[#0097a7] hover:bg-[#00838f] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center shadow"
              >
                <BookOpen className="w-4 h-4 mr-2" />Review Questions
              </button>
            )}
            <button
              onClick={handleReattempt}
              className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center shadow"
            >
              <RotateCcw className="w-4 h-4 mr-2" />Reattempt
            </button>
            <button
              onClick={onExit}
              className="py-3 bg-slate-800 hover:bg-black text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center shadow"
            >
              <CornerDownLeft className="w-4 h-4 mr-2" />Back to Chapters
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = chapter.questions[currentIdx];
  const isShowSolution = mode === 'practice' ? !!answers[currentIdx] : false;

  const stats = {
    correct: Object.keys(answers).filter(i => isQuestionCorrect(parseInt(i, 10))).length,
    wrong: Object.keys(answers).filter(i => !isQuestionCorrect(parseInt(i, 10))).length,
    answered: Object.keys(answers).length,
    marked: markedForReview.size,
    notAttempted: totalQuestions - Object.keys(answers).length,
  };

  /* ── BADGE STYLE FOR PALETTE ── */
  const getBadgeStyle = (idx: number, isActive: boolean): string => {
    const status = getStatus(idx);
    let base = '';
    if (status === 'correct' || status === 'answered') {
      base = 'bg-[#2e7d32] text-white border-transparent';
    } else if (status === 'wrong') {
      base = 'bg-[#c62828] text-white border-transparent';
    } else if (status === 'not-attempted') {
      base = 'bg-[#e65100] text-white border-transparent';
    } else if (status === 'marked' || status === 'answered-marked') {
      base = 'bg-[#7b1fa2] text-white border-transparent';
    } else {
      base = 'bg-white text-gray-800 border-gray-400 border-2';
    }
    if (isActive) base += ' ring-2 ring-[#0097a7] ring-offset-1 scale-110 shadow-md z-10';
    return base;
  };

  const isTimeWarning = mode === 'mock' && totalQuizTime != null && timeLeft != null && timeLeft <= 60;

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f7f9] overflow-hidden select-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── TOP HEADER (teal) ── */}
      <header className="h-[46px] px-4 flex items-center justify-between shrink-0 shadow z-30" style={{ background: '#0097a7' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to exit the test? Your progress will NOT be recorded in Recent Activity.')) {
                onExit();
              }
            }}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            title="Exit test without saving"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <div className="text-[11px] text-white/70 leading-none mb-0.5">Tests</div>
            <div className="text-sm font-bold text-white leading-tight truncate max-w-xs sm:max-w-md">
              {isReviewMode ? `Review: ${chapter.chapter_title}` : chapter.chapter_title}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isReviewMode ? (
            <div className="flex items-center gap-2">
              {onReviewAttempt && submittedResult && (
                <button
                  onClick={() => onReviewAttempt(submittedResult)}
                  className="text-white text-xs font-bold px-3 py-1.5 rounded uppercase tracking-wider"
                  style={{ background: '#0288d1' }}
                >Full Review</button>
              )}
              <button
                onClick={() => setIsReviewMode(false)}
                className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded"
              >Back to Summary</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePauseToggle}
                className="flex items-center bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded text-xs font-semibold text-white transition-colors"
              >
                {isPaused ? <Play className="w-3.5 h-3.5 mr-1 fill-current" /> : <Pause className="w-3.5 h-3.5 mr-1 fill-current" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>

              <div className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-mono font-bold tracking-wider ${isTimeWarning ? 'bg-red-600 text-white animate-pulse' : 'bg-white/20 text-white'}`}>
                <Clock className="w-3.5 h-3.5" />
                {mode === 'practice'
                  ? fmtTime(currentTimer)
                  : (totalQuizTime != null && timeLeft != null ? fmtTime(timeLeft) : fmtTime(currentTimer))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── SECTIONS SUB-BAR ── */}
      <div className="bg-white border-b border-gray-200 h-10 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-r border-gray-200 pr-3">
            SECTIONS
          </span>
          <button className="text-white text-xs font-bold px-4 py-1.5 rounded" style={{ background: '#004d40' }}>
            {chapter.subject || 'Test'}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="font-medium">View In</span>
          <span className="border border-gray-300 rounded px-2.5 py-0.5 font-medium text-gray-800 bg-white">English</span>
        </div>
      </div>

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* LEFT COLUMN */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden border-r border-gray-200">

          {/* Scrollable Question Content */}
          <div className="flex-1 overflow-y-auto relative">
            {isPaused ? (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-8 text-center text-white">
                <div className="w-16 h-16 bg-[#0097a7] rounded-full flex items-center justify-center mb-4 shadow-lg animate-pulse">
                  <Pause className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Test Paused</h3>
                <p className="text-slate-200 max-w-sm mb-6 text-sm">Timer suspended. Click below to resume.</p>
                <button
                  onClick={handlePauseToggle}
                  className="px-6 py-2.5 bg-[#0097a7] hover:bg-[#00838f] text-white rounded-xl font-bold text-sm flex items-center"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />Resume Test
                </button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {currentQuestion && (
                  <motion.div
                    key={currentQuestion.q_num}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                  >
                    <QuestionCard
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
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* ── BOTTOM ACTION BAR ── */}
          <div className="bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-5 py-2.5 flex items-center justify-between shrink-0 z-10">
            {isReviewMode ? (
              <>
                <button
                  onClick={() => currentIdx > 0 && setCurrentIdx(currentIdx - 1)}
                  disabled={currentIdx === 0}
                  className="text-[#01579b] text-xs font-semibold px-5 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#b3e5fc' }}
                >Previous</button>
                <button
                  onClick={() => currentIdx < totalQuestions - 1 && setCurrentIdx(currentIdx + 1)}
                  disabled={currentIdx === totalQuestions - 1}
                  className="text-[#01579b] text-xs font-semibold px-5 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#b3e5fc' }}
                >Next</button>
                <button
                  onClick={() => setIsReviewMode(false)}
                  className="bg-gray-800 text-white text-xs font-semibold px-5 py-2 rounded hover:bg-black"
                >Back to Summary</button>
              </>
            ) : (
              <>
                {/* Left: Previous + Clear Response */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => currentIdx > 0 && jumpToQuestion(currentIdx - 1)}
                    disabled={currentIdx === 0}
                    className="text-[#01579b] text-xs font-semibold px-4 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#b3e5fc' }}
                  >Previous</button>
                  <button
                    onClick={handleClearResponse}
                    disabled={!answers[currentIdx]}
                    className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold px-3.5 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  >Clear Response</button>
                </div>

                {/* Right: Mark, Save, Submit */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMarkAndNext}
                    className="text-white text-xs font-semibold px-4 py-2 rounded"
                    style={{ background: '#0288d1' }}
                  >Mark for Review &amp; Next</button>
                  <button
                    onClick={handleSaveAndNext}
                    className="text-white text-xs font-semibold px-4 py-2 rounded"
                    style={{ background: '#0097a7' }}
                  >Save &amp; Next</button>
                  <button
                    onClick={confirmAndSubmit}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Test'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── SIDEBAR COLLAPSE TOGGLE ── */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-1/2 -translate-y-1/2 z-30 py-3 px-1 rounded-l-md shadow-md cursor-pointer flex items-center justify-center transition-all"
          style={{ right: sidebarOpen ? '280px' : '0px', background: '#37474f' }}
          title={sidebarOpen ? 'Hide Palette' : 'Show Palette'}
        >
          {sidebarOpen ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
        </button>

        {/* ── RIGHT SIDEBAR ── */}
        {sidebarOpen && (
          <aside className="w-[280px] flex flex-col shrink-0 h-full overflow-hidden" style={{ background: '#e1f5fe', borderLeft: '1px solid #b3e5fc' }}>

            {/* Candidate Header */}
            <div className="p-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: '#b3d9f0', background: 'rgba(255,255,255,0.65)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm" style={{ background: '#00bcd4', color: '#fff' }}>
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-800 leading-tight">Candidate</div>
                  <div className="text-[10px] text-gray-500 leading-tight">{chapter.subject}</div>
                </div>
              </div>
            </div>

            {/* Legend / Stats Row */}
            <div className="px-3 py-2 border-b flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs shrink-0 font-medium text-gray-700" style={{ borderColor: '#b3d9f0', background: 'rgba(255,255,255,0.4)' }}>
              {(mode === 'mock' && !isReviewMode) ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-[#2e7d32] text-white flex items-center justify-center font-bold text-[11px]">{stats.answered}</span>
                  <span>Answered</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-[#2e7d32] text-white flex items-center justify-center font-bold text-[11px]">{stats.correct}</span>
                    <span>Correct</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-[#c62828] text-white flex items-center justify-center font-bold text-[11px]">{stats.wrong}</span>
                    <span>Wrong</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-white border-2 border-gray-400 text-gray-800 flex items-center justify-center font-bold text-[11px]">{totalQuestions - stats.answered - stats.marked}</span>
                <span>Not Attempted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-[#7b1fa2] text-white flex items-center justify-center font-bold text-[11px]">{stats.marked}</span>
                <span>Marked</span>
              </div>
            </div>

            {/* Section Label */}
            <div className="px-3 py-1.5 text-xs font-bold text-gray-700 tracking-wide shrink-0" style={{ background: 'rgba(178,235,242,0.55)' }}>
              SECTION : <span className="text-gray-900">{chapter.subject || 'Test'}</span>
            </div>

            {/* Question Palette Grid */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Choose a Question</div>
              <div className="grid grid-cols-5 gap-2">
                {chapter.questions.map((q, idx) => {
                  const status = getStatus(idx);
                  const isActive = currentIdx === idx;
                  const badgeStyle = getBadgeStyle(idx, isActive);

                  return (
                    <button
                      key={idx}
                      onClick={() => jumpToQuestion(idx)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm relative hover:opacity-80 hover:scale-105 ${badgeStyle}`}
                    >
                      {idx + 1}
                      {status === 'answered-marked' && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t grid grid-cols-2 gap-2 shrink-0" style={{ borderColor: '#b3d9f0', background: 'rgba(255,255,255,0.65)' }}>
              <button
                onClick={() => setShowQuestionPaper(true)}
                className="text-[#01579b] text-xs font-bold py-2 rounded text-center transition-colors"
                style={{ background: '#b3e5fc' }}
              >Question Paper</button>
              <button
                onClick={confirmAndSubmit}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded text-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Test'}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ── QUESTION PAPER MODAL ── */}
      {showQuestionPaper && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="text-white px-6 py-3.5 flex items-center justify-between" style={{ background: '#0097a7' }}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <h3 className="font-bold text-base">Question Paper - {chapter.chapter_title}</h3>
              </div>
              <button onClick={() => setShowQuestionPaper(false)} className="hover:bg-white/20 p-1 rounded">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {chapter.questions.map((q, idx) => (
                <div key={idx} className="border-b border-gray-200 pb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm" style={{ color: '#0097a7' }}>Question {idx + 1}</span>
                    <span className="text-xs text-gray-500 font-medium">Marks: +2, -0.5</span>
                  </div>
                  <p className="text-sm text-gray-900 font-medium mb-3 whitespace-pre-line">{q.question}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(Object.entries(q.options) as [string, string][]).map(([k, val]) => (
                      <div key={k} className="p-2 rounded border border-gray-200 bg-gray-50 text-gray-700">
                        <span className="uppercase mr-1.5 font-bold">{k}.</span>{val}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowQuestionPaper(false)}
                className="px-5 py-2 text-white text-xs font-bold rounded hover:opacity-90"
                style={{ background: '#0097a7' }}
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMITTING OVERLAY ── */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-base font-bold">Submitting Test...</p>
          <p className="text-xs text-white/70 mt-1">Saving results to Recent Activity</p>
        </div>
      )}
    </div>
  );
};
