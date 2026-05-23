import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, CheckCircle2, AlertCircle, Bookmark, ChevronRight, CornerDownLeft, RotateCcw } from 'lucide-react';
import { Question, Chapter, QuizResult } from '../types';
import { QuestionCard } from './QuestionCard';

interface QuizContainerProps {
  chapter: Chapter;
  category: 'mockErrors' | 'chapterBank';
  onComplete: (results: Omit<QuizResult, 'userId' | 'completedAt'>) => void;
  bookmarkedIds?: Set<number>;
  onBookmarkToggle?: (question: Question) => void;
  onDeleteQuestion?: (question: Question) => void;
  isAdmin?: boolean;
}

type QuestionStatus = 'not-visited' | 'correct' | 'wrong' | 'marked' | 'answered-marked';

export const QuizContainer: React.FC<QuizContainerProps> = ({ 
  chapter, 
  category, 
  onComplete,
  bookmarkedIds = new Set(),
  onBookmarkToggle,
  onDeleteQuestion,
  isAdmin = false
}) => {
  const totalQuestions = chapter.questions.length;
  
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeSpent, setTimeSpent] = useState<Record<number, number>>({});
  const [visited, setVisited] = useState<Set<number>>(new Set([0])); // Start with 0 visited
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [isFinished, setIsFinished] = useState(false);
  const [currentTimer, setCurrentTimer] = useState(0);
  
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
      if (!answers[currentIdx]) {
        setCurrentTimer(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIdx, answers]);

  const recordTime = () => {
    const endTime = Date.now();
    const duration = Math.round((endTime - startTimeRef.current) / 1000);
    setTimeSpent(prev => ({ ...prev, [currentIdx]: (prev[currentIdx] || 0) + duration }));
    startTimeRef.current = Date.now(); // reset timer start
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

    if (isMarked && isAnswered) return 'answered-marked';
    if (isMarked) return 'marked';
    if (isAnswered) {
      const isCorrect = answers[idx] === chapter.questions[idx].answer;
      return isCorrect ? 'correct' : 'wrong';
    }
    
    return 'not-visited'; // Gray for both not visited and skipped
  };

  const calculateScore = () => {
    let correct = 0;
    chapter.questions.forEach((q, idx) => {
      if (answers[idx] === q.answer) correct++;
    });
    return correct;
  };

  if (isFinished) {
    const score = calculateScore();
    const totalTime = (Object.values(timeSpent) as number[]).reduce((acc, t) => acc + t, 0);
    const percentage = Math.round((score / totalQuestions) * 100);

    const results: Omit<QuizResult, 'userId' | 'completedAt'> = {
      chapter_title: chapter.chapter_title,
      subject: chapter.subject,
      category,
      score,
      totalQuestions,
      totalTime,
      questionDetails: chapter.questions.map((q, idx) => ({
        q_num: q.q_num,
        timeSpent: timeSpent[idx] || 0,
        isCorrect: answers[idx] === q.answer,
        selectedAnswer: answers[idx] || ''
      }))
    };

    return 
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

          <button
            onClick={() => onComplete(results)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center"
          >
            <CornerDownLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = chapter.questions[currentIdx];
  const isShowSolution = !!answers[currentIdx]; // Show solution if answered (Instant Solution mode)

  const stats = {
    correct: Object.keys(answers).filter(idx => answers[parseInt(idx)] === chapter.questions[parseInt(idx)].answer).length,
    wrong: Object.keys(answers).filter(idx => answers[parseInt(idx)] !== chapter.questions[parseInt(idx)].answer).length,
    marked: markedForReview.size,
    notAttempted: totalQuestions - Object.keys(answers).length - markedForReview.size,
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] bg-gray-100 border-t border-gray-200">
      {/* LEFT COLUMN: Main Question Area */}
      <div className="flex-1 flex flex-col bg-white">
        
        {/* Top Header */}
        <div className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow-sm z-10">
          <div className="font-bold text-lg">{chapter.chapter_title}</div>
          <div className="flex items-center space-x-2 bg-blue-700 px-3 py-1.5 rounded-md text-sm font-mono tracking-wider font-semibold">
            <Clock className="w-4 h-4 mr-1" />
            {Math.floor(currentTimer / 60).toString().padStart(2, '0')}:{(currentTimer % 60).toString().padStart(2, '0')}
          </div>
        </div>

        {/* 4 Action Buttons (Moved to Top) */}
        <div className="flex items-center justify-center space-x-2 py-3 border-b border-gray-200 bg-white">
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
            onClick={() => setIsFinished(true)} 
            className="px-5 py-1.5 bg-[#3366cc] text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Submit Test
          </button>
        </div>

        {/* Scrollable Question Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {currentQuestion && (
              <QuestionCard
                key={currentQuestion.q_num}
                question={currentQuestion}
                onAnswer={handleAnswer}
                selectedAnswer={answers[currentIdx] || null}
                showSolution={isShowSolution}
                isBookmarked={bookmarkedIds.has(currentQuestion.q_num)}
                onBookmark={() => onBookmarkToggle?.(currentQuestion)}
                isAdmin={isAdmin}
                onDelete={() => onDeleteQuestion?.(currentQuestion)}
              />
            )}
          </AnimatePresence>
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
          <div className="flex items-center">
            <span className="w-6 h-6 rounded-tl-full rounded-tr-full rounded-br-full flex items-center justify-center bg-green-500 text-white mr-2 text-[10px]">{stats.correct}</span>
            Correct
          </div>
          <div className="flex items-center">
            <span className="w-6 h-6 rounded-bl-full rounded-tr-full rounded-br-full flex items-center justify-center bg-red-500 text-white mr-2 text-[10px]">{stats.wrong}</span>
            Wrong
          </div>
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
              } else if (status === 'marked' || status === 'answered-marked') {
                bgClass = "bg-purple-600 text-white hover:bg-purple-700";
                shapeClass = "rounded-full";
              }

              return (
                <button
                  key={idx}
                  onClick={() => jumpToQuestion(idx)}
                  className={`w-10 h-10 flex items-center justify-center text-sm font-semibold transition-colors relative mx-auto
                    ${bgClass} ${shapeClass} ${isActive ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
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
