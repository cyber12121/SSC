import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, CheckCircle2, AlertCircle, Bookmark, ChevronRight, CornerDownLeft, RotateCcw, Pause, Play, BookOpen } from 'lucide-react';
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
  const [visited, setVisited] = useState<Set<number>>(new Set([0])); // Start with 0 visited
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [isFinished, setIsFinished] = useState(false);
  const [currentTimer, setCurrentTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(totalQuizTime);
  
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

  // Quiz countdown: auto-submits when time is up (chapter bank only, not mock errors).
  useEffect(() => {
    if (totalQuizTime == null || isFinished || isReviewMode) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev == null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          // record time for the current question before auto-submitting
          recordTime();
          setIsFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [totalQuizTime, isFinished, isReviewMode]);

  const recordTime = () => {
    if (isPaused) return;
    const endTime = Date.now();
    const duration = Math.round((endTime - startTimeRef.current) / 1000);
    setTimeSpent(prev => ({ ...prev, [currentIdx]: (prev[currentIdx] || 0) + duration }));
    startTimeRef.current = Date.now(); // reset timer start
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
    // Optional: unmark if clear response
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
      // Reached the end, maybe show submit dialog
      alert("You have reached the end of the questions. Click 'Submit Test' to finish.");
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

    // During the live test a marked question keeps its purple marker.
    // In review mode we always show correctness (right/wrong) so the colour
    // never gets overridden by the marker — this keeps it consistent with the
    // revisit review (which has no marked state).
    if (!isReviewMode) {
      if (isMarked && isAnswered) return 'answered-marked';
      if (isMarked) return 'marked';
    }

    if (isAnswered) {
      // In Mock mode, don't reveal correct/wrong colours until review.
      if (mode === 'mock' && !isReviewMode) return 'answered';
      const isCorrect = answers[idx] === chapter.questions[idx].answer;
      return isCorrect ? 'correct' : 'wrong';
    }

    return 'not-visited'; // Gray for both not visited and skipped
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
      <div className="flex items-center justify-center min-h-[80vh] p-4 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-10 text-center border border-gray-200"
        >
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-gray-800 mb-2">Test Submitted!</h2>
          <p className="text-gray-500 mb-8">
            You've completed <span className="font-bold text-gray-700">{chapter.chapter_title}</span>.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-green-50 p-5 rounded-lg border border-green-100">
              <div className="text-2xl font-black text-green-600 mb-1">{score}/{totalQuestions}</div>
              <div className="text-xs font-bold text-green-800 uppercase tracking-wide">Correct</div>
            </div>
            <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
              <div className="text-2xl font-black text-blue-600 mb-1">{percentage}%</div>
              <div className="text-xs font-bold text-blue-800 uppercase tracking-wide">Accuracy</div>
            </div>
            <div className="bg-purple-50 p-5 rounded-lg border border-purple-100 col-span-2">
              <div className="text-2xl font-black text-purple-600 mb-1">{Math.floor(totalTime / 60)}m {totalTime % 60}s</div>
              <div className="text-xs font-bold text-purple-800 uppercase tracking-wide">Total Time Spent</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {mode === 'mock' && (
              <button
                onClick={() => setIsReviewMode(true)}
                className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center shadow-lg"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Review Questions
              </button>
            )}
            <button
              onClick={handleReattempt}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center shadow-lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reattempt
            </button>
            <button
              onClick={() => onComplete(results)}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center shadow-lg"
            >
              <CornerDownLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = chapter.questions[currentIdx];
  // Practice mode: reveal solution instantly on answering. Mock mode: hide until submit/review.
  const isShowSolution = mode === 'practice' ? !!answers[currentIdx] : false;

  const stats = {
    correct: mode === 'mock' && !isReviewMode ? 0 : Object.keys(answers).filter(idx => answers[parseInt(idx)] === chapter.questions[parseInt(idx)].answer).length,
    wrong: mode === 'mock' && !isReviewMode ? 0 : Object.keys(answers).filter(idx => answers[parseInt(idx)] !== chapter.questions[parseInt(idx)].answer).length,
    answered: Object.keys(answers).length,
    marked: markedForReview.size,
    notAttempted: totalQuestions - Object.keys(answers).length - markedForReview.size,
  };

  const totalReviewedTime = (Object.values(timeSpent) as number[]).reduce((acc, t) => acc + (t || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] bg-gray-100 border-t border-gray-200">
      {/* LEFT COLUMN: Main Question Area */}
      <div className="flex-1 flex flex-col bg-white">
        
        {/* Top Header */}
        <div className={`${isReviewMode ? 'bg-slate-700' : 'bg-blue-600'} text-white px-6 py-3 flex items-center justify-between shadow-sm z-10`}>
          <div className="font-bold text-lg flex items-center gap-3">
            {isReviewMode ? `Review Mode: ${chapter.chapter_title}` : chapter.chapter_title}
            {isReviewMode && (
              <span className="text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-md">
                Time: {Math.floor(totalReviewedTime / 60)}m {totalReviewedTime % 60}s
              </span>
            )}
          </div>
          {isReviewMode ? (
            <div className="flex items-center space-x-3">
              {onReviewLastAttempt && (
                <button
                  onClick={() => {
                    const r = buildResults();
                    onReviewLastAttempt(r);
                  }}
                  className="bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center"
                  title="Open the full last-attempt review"
                >
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  Open full review
                </button>
              )}
              <button
                onClick={() => setIsReviewMode(false)}
                className="bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center"
              >
                <Trophy className="w-4 h-4 mr-1.5" />
                Back to Summary
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePauseToggle}
                className="flex items-center bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors"
                title={isPaused ? "Resume Test" : "Pause Test"}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 mr-1.5 fill-current" /> : <Pause className="w-3.5 h-3.5 mr-1.5 fill-current" />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </button>
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-mono tracking-wider font-semibold ${mode === 'mock' && totalQuizTime != null && timeLeft != null && timeLeft <= 60 ? 'bg-red-600 animate-pulse' : 'bg-blue-700'}`}>
                <Clock className="w-4 h-4 mr-1" />
                {mode === 'practice'
                  ? `Q ${Math.floor(currentTimer / 60).toString().padStart(2, '0')}:${(currentTimer % 60).toString().padStart(2, '0')}`
                  : (totalQuizTime != null && timeLeft != null
                    ? `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`
                    : `${Math.floor(currentTimer / 60).toString().padStart(2, '0')}:${(currentTimer % 60).toString().padStart(2, '0')}`)}
              </div>
            </div>
          )}
        </div>

        {/* 4 Action Buttons */}
        <div className="flex items-center justify-center space-x-2 py-3 border-b border-gray-200 bg-white">
          {isReviewMode ? (
            <>
              <button 
                onClick={() => currentIdx > 0 && setCurrentIdx(currentIdx - 1)} 
                disabled={currentIdx === 0}
                className={`px-5 py-1.5 rounded text-sm font-medium transition-colors ${
                  currentIdx === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-700 text-white hover:bg-slate-800'
                }`}
              >
                Previous
              </button>
              <button 
                onClick={() => currentIdx < totalQuestions - 1 && setCurrentIdx(currentIdx + 1)} 
                disabled={currentIdx === totalQuestions - 1}
                className={`px-5 py-1.5 rounded text-sm font-medium transition-colors ${
                  currentIdx === totalQuestions - 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-700 text-white hover:bg-slate-800'
                }`}
              >
                Next
              </button>
              <button 
                onClick={() => setIsReviewMode(false)} 
                className="px-5 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Back to Summary
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => currentIdx > 0 && jumpToQuestion(currentIdx - 1)} 
                disabled={currentIdx === 0}
                className={`px-5 py-1.5 rounded text-sm font-medium transition-colors ${
                  currentIdx === 0 ? 'bg-blue-400 text-white/70 cursor-not-allowed' : 'bg-[#3366cc] text-white hover:bg-blue-700'
                }`}
              >
                Previous
              </button>
              <button 
                onClick={handleMarkAndNext} 
                className="px-5 py-1.5 bg-[#3366cc] text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Mark for Review
              </button>
              <button 
                onClick={handleSaveAndNext} 
                className="px-5 py-1.5 bg-[#3366cc] text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Save & Next
              </button>
              <button 
                onClick={() => {
                  recordTime();
                  setIsFinished(true);
                }} 
                className="px-5 py-1.5 bg-[#3366cc] text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Submit Test
              </button>
            </>
          )}
        </div>

        {/* Scrollable Question Content */}
        <div className="flex-1 overflow-hidden relative">
          {isPaused ? (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 text-center text-white">
              <div className="w-20 h-20 bg-blue-600/90 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20 animate-pulse">
                <Pause className="w-10 h-10" />
              </div>
              <h3 className="text-3xl font-black mb-2">Test Paused</h3>
              <p className="text-slate-200 max-w-sm mb-8 text-base">
                Your quiz is paused. The timer has been suspended. Click below to resume when you are ready.
              </p>
              <button
                onClick={handlePauseToggle}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center text-lg hover:scale-105 active:scale-95"
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                Resume Practice
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

      </div>

      {/* RIGHT COLUMN: Question Palette */}
      <div className="w-full lg:w-80 bg-blue-50/30 flex flex-col border-l border-gray-200">
        
        {/* Palette Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              <img src="https://ui-avatars.com/api/?name=Candidate&background=0D8ABC&color=fff" alt="User" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800">Candidate</div>
              <div className="text-xs text-gray-500">{chapter.subject}</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 grid grid-cols-2 gap-y-3 gap-x-2 border-b border-gray-200 bg-white text-xs font-medium text-gray-700">
          {mode === 'mock' && !isReviewMode ? (
            <div className="flex items-center">
              <span className="w-6 h-6 rounded-md flex items-center justify-center bg-blue-400 text-white mr-2 text-[10px]">{stats.answered}</span>
              Answered
            </div>
          ) : (
            <>
              <div className="flex items-center">
                <span className="w-6 h-6 rounded-tl-full rounded-tr-full rounded-br-full flex items-center justify-center bg-green-500 text-white mr-2 text-[10px]">{stats.correct}</span>
                Correct
              </div>
              <div className="flex items-center">
                <span className="w-6 h-6 rounded-bl-full rounded-tr-full rounded-br-full flex items-center justify-center bg-red-500 text-white mr-2 text-[10px]">{stats.wrong}</span>
                Wrong
              </div>
            </>
          )}
          <div className="flex items-center">
            <span className="w-6 h-6 rounded-md flex items-center justify-center bg-gray-200 text-gray-700 mr-2 text-[10px]">{stats.notAttempted}</span>
            Not Attempted
          </div>
          <div className="flex items-center">
            <span className="w-6 h-6 rounded-full flex items-center justify-center bg-purple-600 text-white mr-2 text-[10px]">{stats.marked}</span>
            Marked
          </div>
        </div>

        {/* Section Header */}
        <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold">
          {chapter.subject}
        </div>

        {/* Palette Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-blue-50/20 custom-scrollbar">
          <div className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Choose a Question</div>
          <div className="grid grid-cols-4 gap-3">
            {chapter.questions.map((q, idx) => {
              const status = getStatus(idx);
              const isActive = currentIdx === idx;
              
              let bgClass = "bg-gray-200 text-gray-700 hover:bg-gray-300"; // not-visited
              let shapeClass = "rounded-md";

              if (status === 'correct') {
                bgClass = "bg-green-500 text-white hover:bg-green-600";
                shapeClass = "rounded-tl-full rounded-tr-full rounded-br-full";
              } else if (status === 'wrong') {
                bgClass = "bg-red-500 text-white hover:bg-red-600";
                shapeClass = "rounded-bl-full rounded-tr-full rounded-br-full";
              } else if (status === 'answered') {
                bgClass = "bg-blue-400 text-white hover:bg-blue-500";
                shapeClass = "rounded-md";
              } else if (status === 'marked' || status === 'answered-marked') {
                bgClass = "bg-purple-600 text-white hover:bg-purple-700";
                shapeClass = "rounded-full";
              }

              return (
                <button
                  key={idx}
                  onClick={() => jumpToQuestion(idx)}
                  className={`w-10 h-10 flex items-center justify-center text-sm font-semibold transition-colors relative mx-auto
                    ${bgClass} ${shapeClass} ${isActive ? 'ring-2 ring-blue-400 ring-offset-2' : ''} ${isReviewMode && markedForReview.has(idx) ? 'ring-2 ring-purple-400 ring-offset-1' : ''}
                  `}
                >
                  {idx + 1}
                  {status === 'answered-marked' && (
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center border border-white">
                      <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
