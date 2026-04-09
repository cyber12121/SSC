import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, RotateCcw, Trophy, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Question, Chapter, QuestionProgress, QuizResult } from '../types';
import { QuestionCard } from './QuestionCard';

interface QuizContainerProps {
  chapter: Chapter;
  category: 'mockErrors' | 'chapterBank';
  onComplete: (results: Omit<QuizResult, 'userId' | 'completedAt'>) => void;
  bookmarkedIds?: Set<number>;
  onBookmarkToggle?: (question: Question) => void;
}

export const QuizContainer: React.FC<QuizContainerProps> = ({ 
  chapter, 
  category, 
  onComplete,
  bookmarkedIds = new Set(),
  onBookmarkToggle
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeSpent, setTimeSpent] = useState<Record<number, number>>({});
  const [showSolution, setShowSolution] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [currentTimer, setCurrentTimer] = useState(0);
  
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setCurrentTimer(0);
    
    const interval = setInterval(() => {
      if (!answers[currentIdx]) {
        setCurrentTimer(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIdx, answers]);

  const handleAnswer = (answer: 'a' | 'b' | 'c' | 'd') => {
    const endTime = Date.now();
    const duration = Math.round((endTime - startTimeRef.current) / 1000);
    
    setAnswers(prev => ({ ...prev, [currentIdx]: answer }));
    setTimeSpent(prev => ({ ...prev, [currentIdx]: (prev[currentIdx] || 0) + duration }));
    setShowSolution(true);
  };

  const handleSkip = () => {
    const endTime = Date.now();
    const duration = Math.round((endTime - startTimeRef.current) / 1000);
    
    setTimeSpent(prev => ({ ...prev, [currentIdx]: (prev[currentIdx] || 0) + duration }));
    nextQuestion();
  };


  const nextQuestion = () => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx(currentIdx + 1);
      setShowSolution(false);
    } else {
      setIsFinished(true);
    }
  };

  const prevQuestion = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setShowSolution(true);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    chapter.questions.forEach((q, idx) => {
      if (answers[idx] === q.answer) correct++;
    });
    return correct;
  };

  const currentQuestion = chapter.questions[currentIdx];
  const totalQuestions = chapter.questions.length;

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

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto mt-12 bg-white rounded-3xl shadow-2xl p-10 text-center border border-gray-100"
      >
        <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-8">
          <Trophy className="w-12 h-12" />
        </div>
        <h2 className="text-4xl font-black text-gray-800 mb-4">Quiz Completed!</h2>
        <p className="text-gray-500 text-lg mb-8">
          You've finished the <span className="font-bold text-gray-700">{chapter.chapter_title}</span> chapter.
        </p>

        <div className="grid grid-cols-2 gap-6 mb-10">
          <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
            <div className="text-3xl font-black text-green-600 mb-1">{score}/{totalQuestions}</div>
            <div className="text-sm font-bold text-green-800 uppercase tracking-wider">Correct Answers</div>
          </div>
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
            <div className="text-3xl font-black text-blue-600 mb-1">{percentage}%</div>
            <div className="text-sm font-bold text-blue-800 uppercase tracking-wider">Accuracy</div>
          </div>
          <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 col-span-2">
            <div className="text-3xl font-black text-purple-600 mb-1">{Math.floor(totalTime / 60)}m {totalTime % 60}s</div>
            <div className="text-sm font-bold text-purple-800 uppercase tracking-wider">Total Time Spent</div>
          </div>
        </div>

        <button
          onClick={() => onComplete(results)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Finish & Save Progress
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-black text-gray-800">{chapter.chapter_title}</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-blue-50 text-blue-600 px-4 py-2 rounded-xl border border-blue-100">
                <Clock className="w-4 h-4 mr-2" />
                <span className="font-black font-mono">
                  {Math.floor(currentTimer / 60)}:{(currentTimer % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progress</div>
                <div className="text-lg font-black text-gray-800 leading-none">{currentIdx + 1}/{totalQuestions}</div>
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((currentIdx + 1) / totalQuestions) * 100}%` }}
              className="bg-blue-500 h-full"
            />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <QuestionCard
          key={currentIdx}
          question={currentQuestion}
          onAnswer={handleAnswer}
          selectedAnswer={answers[currentIdx] || null}
          showSolution={showSolution || !!answers[currentIdx]}
          isBookmarked={bookmarkedIds.has(currentQuestion.q_num)}
          onBookmark={() => onBookmarkToggle?.(currentQuestion)}
        />
      </AnimatePresence>

      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={prevQuestion}
          disabled={currentIdx === 0}
          className={`flex items-center px-6 py-3 rounded-xl font-bold transition-all ${
            currentIdx === 0
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Previous
        </button>

        <div className="flex items-center space-x-4">
          {!answers[currentIdx] && (
            <button
              onClick={handleSkip}
              className="flex items-center px-6 py-3 text-amber-600 hover:bg-amber-50 rounded-xl font-bold transition-all border border-amber-200"
            >
              Skip Question
            </button>
          )}

          <button
            onClick={nextQuestion}
            disabled={!answers[currentIdx]}
            className={`flex items-center px-8 py-4 rounded-2xl font-bold transition-all shadow-lg ${
              !answers[currentIdx]
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed hidden'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
            }`}
          >
            {currentIdx === totalQuestions - 1 ? 'Finish Quiz' : 'Next Question'}
            <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>

      </div>
    </div>
  );
};
