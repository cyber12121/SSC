import React, { useState, useEffect, useRef } from 'react';

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

  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  // Practice mode: track elapsed question time using high-precision Date.now()
  const practiceStartRef = useRef<number>(Date.now());
  const practiceBaseRef = useRef<number>(initialQuestionTime);

  useEffect(() => {
    practiceBaseRef.current = initialQuestionTime;
    practiceStartRef.current = Date.now();
    setQuestionTimer(initialQuestionTime);
  }, [currentIdx, initialQuestionTime]);

  useEffect(() => {
    if (mode !== 'practice' || isFinished) return;

    if (isPaused) {
      // Accumulate elapsed time up to pause
      practiceBaseRef.current = practiceBaseRef.current + Math.floor((Date.now() - practiceStartRef.current) / 1000);
      return;
    }

    practiceStartRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - practiceStartRef.current) / 1000);
      setQuestionTimer(practiceBaseRef.current + elapsed);
    }, 500);

    return () => clearInterval(interval);
  }, [mode, isFinished, isPaused, currentIdx]);

  // Mock mode: countdown timer with timestamp references
  const remainingSecRef = useRef<number | null>(totalQuizTime);
  const targetEndRef = useRef<number>(Date.now() + (totalQuizTime || 0) * 1000);

  useEffect(() => {
    if (totalQuizTime != null && remainingSecRef.current === null) {
      remainingSecRef.current = totalQuizTime;
      targetEndRef.current = Date.now() + totalQuizTime * 1000;
      setMockTimeLeft(totalQuizTime);
    }
  }, [totalQuizTime]);

  useEffect(() => {
    if (mode !== 'mock' || totalQuizTime == null || isFinished) return;

    if (isPaused) {
      // Freeze remaining seconds
      if (targetEndRef.current) {
        remainingSecRef.current = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
      }
      return;
    }

    // Unpaused: re-anchor targetEndRef from remaining seconds
    const currentRemaining = remainingSecRef.current ?? totalQuizTime;
    targetEndRef.current = Date.now() + currentRemaining * 1000;

    const interval = setInterval(() => {
      const secLeft = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
      remainingSecRef.current = secLeft;
      setMockTimeLeft(secLeft);

      if (secLeft <= 0) {
        clearInterval(interval);
        onTimeUpRef.current();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [mode, totalQuizTime, isFinished, isPaused]);

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
