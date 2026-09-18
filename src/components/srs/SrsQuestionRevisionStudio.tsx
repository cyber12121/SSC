import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, XCircle, ArrowLeft, ChevronRight, PenTool,
  Clock, Sparkles, Trophy, Trash2, Zap, RotateCw, Filter,
  Wind, ShieldAlert, HeartHandshake, Smile, BookOpen, AlertCircle
} from 'lucide-react';
import { SRSCard, SRSGrade } from '../../types/srs';
import { FormattedText } from '../FormattedText';
import { SrsScratchpad } from './SrsScratchpad';
import {
  calculateNextReview,
  getSRSSettings,
  getCardCorrectAnswer,
  matchesSubject,
  coolOffCard,
  isLeechCard
} from '../../utils/srsEngine';

interface SrsQuestionRevisionStudioProps {
  cards: SRSCard[];
  initialTopic?: string;
  onFinishSession: (updatedCards: SRSCard[]) => void;
  onExit: () => void;
  onDeleteCurrentCard: (cardId: string) => void;
}

export const SrsQuestionRevisionStudio: React.FC<SrsQuestionRevisionStudioProps> = ({
  cards: initialCards,
  initialTopic = 'all',
  onFinishSession,
  onExit,
  onDeleteCurrentCard
}) => {
  const settings = useMemo(() => getSRSSettings(), []);
  const sprintBatchSize = Math.max(5, settings.sprintBatchSize || 10);

  const [topicFilter, setTopicFilter] = useState<string>(initialTopic);
  const [queue, setQueue] = useState<SRSCard[]>(() => {
    if (initialTopic && initialTopic !== 'all') {
      const filtered = initialCards.filter(c =>
        (c.topic && c.topic.trim().toLowerCase() === initialTopic.trim().toLowerCase()) ||
        (c.subtopic && c.subtopic.trim().toLowerCase() === initialTopic.trim().toLowerCase())
      );
      return filtered.length > 0 ? filtered : initialCards;
    }
    return initialCards;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [sessionResults, setSessionResults] = useState<SRSCard[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Anti-Burnout / Zen mode
  const [isZenMode, setIsZenMode] = useState<boolean>(settings.zenModeDefault || false);
  const [sprintCount, setSprintCount] = useState(0);
  const [isRestCheckpointOpen, setIsRestCheckpointOpen] = useState(false);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');

  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    initialCards.forEach(c => {
      if (c.topic && c.topic !== 'General' && c.topic !== 'All Topics') set.add(c.topic.trim());
      if (c.subtopic && c.subtopic !== 'General') set.add(c.subtopic.trim());
    });
    return Array.from(set).sort();
  }, [initialCards]);

  const handleTopicChange = (newTopic: string) => {
    setTopicFilter(newTopic);
    if (newTopic === 'all') {
      setQueue(initialCards);
    } else {
      const filtered = initialCards.filter(c =>
        (c.topic && c.topic.trim() === newTopic) || (c.subtopic && c.subtopic.trim() === newTopic)
      );
      setQueue(filtered.length > 0 ? filtered : initialCards);
    }
    setCurrentIndex(0);
    setSprintCount(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setIsCompleted(false);
  };

  const currentCard = queue[currentIndex];

  // Stopwatch timer for current question
  useEffect(() => {
    setSelectedOption(null);
    setIsSubmitted(false);
    setQuestionStartTime(Date.now());
    setElapsedSeconds(0);

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, queue]);

  // Guided Breathing Animation Timer
  useEffect(() => {
    if (!breathingActive) return;
    const phases: Array<'Inhale' | 'Hold' | 'Exhale'> = ['Inhale', 'Hold', 'Exhale'];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setBreathingPhase(phases[idx]);
    }, 4000);
    return () => clearInterval(interval);
  }, [breathingActive]);

  // Options normalization
  const currentOptions = useMemo(() => {
    if (!currentCard) return [];
    if (currentCard.options && typeof currentCard.options === 'object') {
      return Object.entries(currentCard.options).map(([key, val]) => ({
        key: key.toLowerCase(),
        label: key.toUpperCase(),
        text: String(val || '').trim()
      }));
    }
    if (currentCard.questionRef?.options && typeof currentCard.questionRef.options === 'object') {
      return Object.entries(currentCard.questionRef.options).map(([key, val]) => ({
        key: key.toLowerCase(),
        label: key.toUpperCase(),
        text: String(val || '').trim()
      }));
    }
    return [];
  }, [currentCard]);

  const correctAnswerKey = useMemo(() => {
    if (!currentCard) return '';
    return getCardCorrectAnswer(currentCard);
  }, [currentCard]);

  const isUserCorrect = useMemo(() => {
    if (!selectedOption || !correctAnswerKey) return false;
    return selectedOption.toLowerCase() === correctAnswerKey.toLowerCase();
  }, [selectedOption, correctAnswerKey]);

  // Calculate SM-2 Grade automatically based on correctness and duration
  const autoDeterminedGrade: SRSGrade = useMemo(() => {
    if (!isUserCorrect) return 'again';
    const benchmark = currentCard?.avgTimeSeconds || 50;
    if (elapsedSeconds <= Math.min(25, benchmark * 0.7)) {
      return 'easy';
    }
    if (elapsedSeconds > benchmark * 1.6) {
      return 'hard';
    }
    return 'good';
  }, [isUserCorrect, elapsedSeconds, currentCard]);

  const [activeGrade, setActiveGrade] = useState<SRSGrade>('good');

  // Handle Answer Submission
  const handleSubmitAnswer = () => {
    if (!selectedOption || isSubmitted) return;
    setIsSubmitted(true);
    const grade = autoDeterminedGrade;
    setActiveGrade(grade);
    if (isUserCorrect) {
      setCorrectCount(prev => prev + 1);
    }
  };

  // Handle Skip / Reveal Solution
  const handleRevealSolution = () => {
    if (isSubmitted) return;
    setIsSubmitted(true);
    setActiveGrade('again');
  };

  // Move to next question or complete session
  const handleAdvanceNext = useCallback((overrideGrade?: SRSGrade) => {
    if (!currentCard) return;

    const finalGrade = overrideGrade || activeGrade;
    const solveDuration = Math.max(1, Math.round((Date.now() - questionStartTime) / 1000));
    const updatedCard = calculateNextReview(currentCard, finalGrade, solveDuration);

    setSessionResults(prev => [...prev, updatedCard]);

    if (finalGrade === 'again') {
      // Re-queue card to end of session so student gets another attempt today
      setQueue(prev => [...prev, currentCard]);
    }

    const nextSprint = sprintCount + 1;
    setSprintCount(nextSprint);

    // Rest checkpoint trigger
    if (nextSprint >= sprintBatchSize && currentIndex + 1 < queue.length) {
      setIsRestCheckpointOpen(true);
      setCurrentIndex(prev => prev + 1);
      return;
    }

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  }, [currentCard, activeGrade, questionStartTime, sprintCount, sprintBatchSize, currentIndex, queue.length]);

  // Keyboard shortcut navigation (1, 2, 3, 4, A, B, C, D, Space, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (scratchpadOpen || deleteConfirmOpen || isRestCheckpointOpen || isCompleted) return;

      if (!isSubmitted) {
        if (e.key === '1' || e.key.toLowerCase() === 'a') setSelectedOption('a');
        else if (e.key === '2' || e.key.toLowerCase() === 'b') setSelectedOption('b');
        else if (e.key === '3' || e.key.toLowerCase() === 'c') setSelectedOption('c');
        else if (e.key === '4' || e.key.toLowerCase() === 'd') setSelectedOption('d');
        else if (e.key === 'Enter' && selectedOption) {
          handleSubmitAnswer();
        }
      } else {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAdvanceNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitted, selectedOption, scratchpadOpen, deleteConfirmOpen, isRestCheckpointOpen, isCompleted, handleAdvanceNext]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getSubjectBadge = (subj: string = '') => {
    if (matchesSubject(subj, 'english')) return { name: 'English', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    if (matchesSubject(subj, 'gk')) return { name: 'General Awareness', color: 'bg-sky-50 text-sky-800 border-sky-200' };
    if (matchesSubject(subj, 'mathematics')) return { name: 'Quantitative Aptitude', color: 'bg-amber-50 text-amber-900 border-amber-200' };
    if (matchesSubject(subj, 'reasoning')) return { name: 'Reasoning', color: 'bg-purple-50 text-purple-900 border-purple-200' };
    return { name: subj || 'General', color: 'bg-slate-50 text-slate-800 border-slate-200' };
  };

  // Completion View
  if (isCompleted || !currentCard) {
    const totalAttempted = sessionResults.length;
    const accuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 100;

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6"
        >
          <div className="w-16 h-16 bg-emerald-100 rounded-3xl mx-auto flex items-center justify-center text-emerald-600 shadow-inner">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">Revision Session Complete!</h2>
            <p className="text-xs text-slate-500 mt-1">Great job re-attempting and fixing your test questions.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Questions Solved</span>
              <span className="text-2xl font-black text-slate-900">{totalAttempted}</span>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-700 block uppercase">Accuracy Rate</span>
              <span className="text-2xl font-black text-emerald-700">{accuracy}%</span>
            </div>
          </div>

          <button
            onClick={() => onFinishSession(sessionResults)}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all cursor-pointer"
          >
            Return to SRS Hub
          </button>
        </motion.div>
      </div>
    );
  }

  const subjConfig = getSubjectBadge(currentCard.subject);
  const progressPercent = Math.round(((currentIndex) / queue.length) * 100);

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Scratchpad overlay */}
      <SrsScratchpad isOpen={scratchpadOpen} onClose={() => setScratchpadOpen(false)} />

      {/* Top Navigation Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onExit}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-2xs transition-colors cursor-pointer"
            title="Exit Revision"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${subjConfig.color}`}>
                {subjConfig.name}
              </span>

              {availableTopics.length > 1 ? (
                <div className="flex items-center space-x-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={topicFilter}
                    onChange={e => handleTopicChange(e.target.value)}
                    aria-label="Filter Topic"
                    className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 shadow-2xs hover:border-indigo-300 transition-colors cursor-pointer"
                  >
                    <option value="all">🎯 All Chapters ({initialCards.length})</option>
                    {availableTopics.map(t => {
                      const count = initialCards.filter(c => (c.topic && c.topic.trim() === t) || (c.subtopic && c.subtopic.trim() === t)).length;
                      return (
                        <option key={t} value={t}>
                          {t} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                currentCard.topic && (
                  <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]">
                    • {currentCard.topic}
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        {/* Action buttons & controls */}
        <div className="flex items-center space-x-2">
          {/* Zen Focus Mode */}
          <button
            onClick={() => setIsZenMode(!isZenMode)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer ${
              isZenMode
                ? 'bg-purple-600 text-white border-purple-600 shadow-purple-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Zen Mode hides stopwatch & metrics for zero anxiety"
          >
            <Smile className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Zen Mode</span>
          </button>

          {/* Rough Scratchpad button */}
          <button
            onClick={() => setScratchpadOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            title="Open Scratchpad for Rough Work"
          >
            <PenTool className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Scratchpad</span>
          </button>

          {/* Delete Card */}
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="p-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
            title="Delete this question from SRS"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress & Stopwatch Strip (hidden in Zen Mode) */}
      {!isZenMode && (
        <div className="max-w-4xl w-full mx-auto my-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
            <div className="flex items-center space-x-2">
              <span>Question {currentIndex + 1} of {queue.length}</span>
              {currentCard.sourceTitle && (
                <span className="text-slate-400 font-normal hidden sm:inline truncate max-w-[260px]">
                  ({currentCard.sourceTitle})
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              {currentCard.avgTimeSeconds && (
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Benchmark: ~{currentCard.avgTimeSeconds}s
                </span>
              )}
              <div className="flex items-center space-x-1 text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-mono text-xs font-black">{formatTimer(elapsedSeconds)}</span>
              </div>
            </div>
          </div>

          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Interactive Question Canvas */}
      <div className="max-w-4xl w-full mx-auto my-auto py-2">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8 space-y-6">
          {/* Question Statement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span>Test Question</span>
              </span>
              {currentCard.conceptTested && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Concept: {currentCard.conceptTested}
                </span>
              )}
            </div>

            <div className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed pt-1">
              <FormattedText text={currentCard.front} subject={currentCard.subject} isQuestion />
            </div>
          </div>

          {/* Interactive MCQ Options List */}
          {currentOptions.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select Your Answer:
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {currentOptions.map(opt => {
                  const isSelected = selectedOption === opt.key;
                  const isCorrect = correctAnswerKey && opt.key.toLowerCase() === correctAnswerKey.toLowerCase();

                  let optionCardStyle = 'border-slate-200 bg-slate-50/70 hover:border-indigo-300 hover:bg-indigo-50/30 text-slate-800';
                  let badgeStyle = 'bg-white text-slate-700 border-slate-200';

                  if (isSubmitted) {
                    if (isCorrect) {
                      optionCardStyle = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 shadow-xs';
                      badgeStyle = 'bg-emerald-600 text-white border-emerald-600';
                    } else if (isSelected && !isCorrect) {
                      optionCardStyle = 'border-rose-500 bg-rose-50/80 text-rose-950 shadow-xs';
                      badgeStyle = 'bg-rose-600 text-white border-rose-600';
                    } else {
                      optionCardStyle = 'border-slate-200 bg-slate-50/40 opacity-60 text-slate-500';
                    }
                  } else if (isSelected) {
                    optionCardStyle = 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-950';
                    badgeStyle = 'bg-indigo-600 text-white border-indigo-600';
                  }

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => !isSubmitted && setSelectedOption(opt.key)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${optionCardStyle}`}
                    >
                      <div className="flex items-start space-x-3 flex-1">
                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 border mt-0.5 ${badgeStyle}`}>
                          {opt.label}
                        </span>
                        <div className="font-medium text-sm leading-snug flex-1">
                          <FormattedText text={opt.text} subject={currentCard.subject} />
                        </div>
                      </div>

                      {/* State Icons post-submission */}
                      {isSubmitted && (
                        <div className="shrink-0 mt-0.5">
                          {isCorrect && (
                            <span className="flex items-center gap-1 text-emerald-700 font-black text-xs">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              <span className="hidden sm:inline">Correct</span>
                            </span>
                          )}
                          {isSelected && !isCorrect && (
                            <span className="flex items-center gap-1 text-rose-700 font-black text-xs">
                              <XCircle className="w-5 h-5 text-rose-600" />
                              <span className="hidden sm:inline">Incorrect</span>
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Open Ended / No Options fallback */
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
              <p className="text-xs text-slate-500">Attempt this question on your scratchpad, then click Reveal Solution to inspect step-by-step methods.</p>
            </div>
          )}

          {/* Action Row Pre-Submission */}
          {!isSubmitted && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleRevealSolution}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Reveal Solution / Skip
              </button>

              <button
                type="button"
                disabled={!selectedOption && currentOptions.length > 0}
                onClick={handleSubmitAnswer}
                className={`px-6 py-2.5 rounded-xl font-black text-xs flex items-center space-x-2 transition-all cursor-pointer ${
                  selectedOption || currentOptions.length === 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Check Answer</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Detailed Solution & Diagnostic Feedback Post-Submission */}
          {isSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-5 border-t border-slate-200 space-y-4"
            >
              {/* Verdict Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-2 ${
                  isUserCorrect
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  {isUserCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-black">
                      {isUserCorrect
                        ? `Solved Correctly in ${elapsedSeconds}s!`
                        : `Incorrect. Correct answer is Option (${correctAnswerKey.toUpperCase()})`}
                    </div>
                    <div className="text-[11px] opacity-80">
                      {isUserCorrect
                        ? 'SM-2 spaced interval updated. Card advanced.'
                        : 'Card scheduled for quick re-attempt today to ensure mastery.'}
                    </div>
                  </div>
                </div>

                {/* Grade override pills if student wants to fine-tune */}
                <div className="flex items-center space-x-1.5 text-xs font-bold">
                  <span className="text-[10px] uppercase text-slate-500 mr-1 hidden sm:inline">Grade:</span>
                  {(['again', 'hard', 'good', 'easy'] as SRSGrade[]).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setActiveGrade(g)}
                      className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-all cursor-pointer ${
                        activeGrade === g
                          ? 'bg-slate-900 text-white shadow-2xs font-black'
                          : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verified Solution Body */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Step-by-Step Solution</span>
                  </span>
                </div>

                <div className="text-xs text-slate-800 leading-relaxed font-sans prose prose-slate max-w-none">
                  <FormattedText text={currentCard.back} subject={currentCard.subject} />
                </div>
              </div>

              {/* Shortcut Formula / Speed Trick Callout */}
              {currentCard.shortcutFormula && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-amber-900 uppercase tracking-wider block">
                      ⚡ Shortcut / Speed Method
                    </span>
                    <div className="text-xs font-medium text-amber-950">
                      <FormattedText text={currentCard.shortcutFormula} subject={currentCard.subject} />
                    </div>
                  </div>
                </div>
              )}

              {/* Next Question / Finish Action Button */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleAdvanceNext()}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <span>{currentIndex + 1 < queue.length ? 'Next Question' : 'Complete Session'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-sm w-full bg-white rounded-3xl p-6 space-y-4 border border-slate-200 shadow-2xl"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">Remove from Revision Queue?</h3>
              <p className="text-xs text-slate-500 mt-1">This test question will be deleted from your spaced repetition schedule.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCurrentCard(currentCard.id);
                  setDeleteConfirmOpen(false);
                  if (currentIndex + 1 < queue.length) {
                    setCurrentIndex(prev => prev + 1);
                  } else {
                    setIsCompleted(true);
                  }
                }}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors shadow-md shadow-red-200 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Anti-Burnout Rest Checkpoint Modal */}
      {isRestCheckpointOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 space-y-5 border border-slate-200 shadow-2xl text-center"
          >
            <div className="w-14 h-14 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Wind className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">Quick Rest Checkpoint</h3>
              <p className="text-xs text-slate-500 mt-1">
                You've completed a batch of {sprintBatchSize} questions! Take a 30-second breath to keep recall sharp.
              </p>
            </div>

            {breathingActive ? (
              <div className="py-4 space-y-3">
                <motion.div
                  animate={{
                    scale: breathingPhase === 'Inhale' ? 1.3 : breathingPhase === 'Hold' ? 1.3 : 1
                  }}
                  transition={{ duration: 3.8, ease: 'easeInOut' }}
                  className="w-24 h-24 rounded-full bg-purple-100 border-4 border-purple-400 mx-auto flex items-center justify-center text-purple-800 font-black text-sm"
                >
                  {breathingPhase}
                </motion.div>
                <span className="text-[11px] text-purple-600 font-bold block">
                  Follow the breathing circle (4-4-4 technique)
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setBreathingActive(true)}
                className="py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 mx-auto cursor-pointer"
              >
                <HeartHandshake className="w-4 h-4 text-purple-600" />
                <span>Start Guided Breathing (30s)</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setBreathingActive(false);
                  setIsRestCheckpointOpen(false);
                  onExit();
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Pause & Finish
              </button>
              <button
                type="button"
                onClick={() => {
                  setBreathingActive(false);
                  setIsRestCheckpointOpen(false);
                }}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-md shadow-indigo-200 cursor-pointer"
              >
                Continue Next Sprint ➔
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
