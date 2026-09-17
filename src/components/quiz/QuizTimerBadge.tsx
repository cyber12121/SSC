import React, { useState, useEffect } from 'react';

interface QuizTimerBadgeProps {
  mode: 'practice' | 'mock';
  totalQuizTime: number | null;
  isPaused: boolean;
  isFinished: boolean;
  initialQuestionTime?: number;
  currentIdx: number;
  onTimeUp: () => void;
}

const fmtTime = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')} : ${(s % 60).toString().padStart(2, '0')}`;

export const QuizTimerBadge: React.FC<QuizTimerBadgeProps> = ({
  mode,
  totalQuizTime,
  isPaused,
  isFinished,
  initialQuestionTime = 0,
  currentIdx,
  onTimeUp
}) => {
  const [questionTimer, setQuestionTimer] = useState(initialQuestionTime);
  const [mockTimeLeft, setMockTimeLeft] = useState<number | null>(totalQuizTime);

  // Sync initial question timer when currentIdx changes
  useEffect(() => {
    setQuestionTimer(initialQuestionTime);
  }, [currentIdx, initialQuestionTime]);

  // Practice mode question elapsed time
  useEffect(() => {
    if (isFinished || isPaused) return;
    const interval = setInterval(() => {
      setQuestionTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isFinished, isPaused, currentIdx]);

  // Mock mode countdown timer
  useEffect(() => {
    if (totalQuizTime == null || isFinished || isPaused) return;
    const interval = setInterval(() => {
      setMockTimeLeft(prev => {
        if (prev == null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [totalQuizTime, isFinished, isPaused, onTimeUp]);

  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-gray-500 font-semibold leading-tight">
        {mode === 'practice' ? 'Time Spent' : 'Section Time'}
      </span>
      <div className="bg-[#fff9db] border border-[#ffe066] text-[#d90429] font-mono font-bold text-sm sm:text-base px-2 py-0.5 rounded shadow-2xs leading-none">
        {mode === 'practice'
          ? fmtTime(questionTimer)
          : (totalQuizTime != null && mockTimeLeft != null ? fmtTime(mockTimeLeft) : fmtTime(questionTimer))}
      </div>
    </div>
  );
};
