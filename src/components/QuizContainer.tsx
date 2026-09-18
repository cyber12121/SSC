import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Trophy, CheckCircle2, CornerDownLeft, RotateCcw,
  Pause, Play, BookOpen, ChevronRight, ChevronLeft,
  X, FileText, ArrowLeft, AlertTriangle, ChevronDown,
  Maximize2, Minimize2, Check, Eye, EyeOff, Bookmark, BookmarkCheck, Lightbulb, Trash2, Sparkles
} from 'lucide-react';
import { Question, Chapter, QuizResult } from '../types';
import { extractSolutionLanguage } from '../utils/cleanSolution';
import { normalizeAnswerKey } from '../utils/mathSanitizer';
import { getLanguageText } from '../utils/formatQuestionText';
import { getNormalizedOptions, getCorrectOptionKey } from '../utils/questionHelpers';
import { FormattedText } from './FormattedText';
import { SolutionViewer } from './SolutionViewer';
import { QuizPaletteSidebar, MockSection } from './quiz/QuizPaletteSidebar';
import { QuizSubmitModal } from './quiz/QuizSubmitModal';
import { QuizTimerBadge } from './quiz/QuizTimerBadge';

interface QuizContainerProps {
  chapter: Chapter;
  category: 'mockErrors' | 'chapterBank';
  mode: 'practice' | 'mock';
  onSaveResult: (results: Omit<QuizResult, 'userId' | 'completedAt'>) => Promise<QuizResult | null>;
  onExit: () => void;
  onReviewAttempt?: (result: QuizResult) => void;
  bookmarkedIds?: Set<number | string>;
  onBookmarkToggle?: (question: Question) => void;
  onDeleteQuestion?: (question: Question) => void;
  isAdmin?: boolean;
}

const CandidateAvatar: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center">
    <div className="w-11 h-12 bg-gray-200 rounded-[2px] border border-gray-300 overflow-hidden flex flex-col items-center justify-end relative shadow-2xs">
      <svg className="w-9 h-11 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
      <div className="absolute bottom-0 inset-x-0 bg-black/80 text-white text-[7px] leading-tight text-center py-0.5 px-0.5 truncate font-sans">
        {label}
      </div>
    </div>
  </div>
);

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
  const perQuestionSec = 36;
  const totalQuizTime = mode === 'mock' ? perQuestionSec * totalQuestions : null;

  // Normalize subject into canonical SSC section keys (PART-A: Reasoning, PART-B: GA, PART-C: Math, PART-D: English)
  const getQuestionSectionKey = useCallback((q: Question): 'part_a' | 'part_b' | 'part_c' | 'part_d' | null => {
    const rawSec = String((q as any).section || (q as any).sectionKey || '').toLowerCase().trim();
    if (rawSec === 'part_a' || rawSec === 'part a' || rawSec === 'part-a' || rawSec === 'section 1' || rawSec === 'section a') return 'part_a';
    if (rawSec === 'part_b' || rawSec === 'part b' || rawSec === 'part-b' || rawSec === 'section 2' || rawSec === 'section b') return 'part_b';
    if (rawSec === 'part_c' || rawSec === 'part c' || rawSec === 'part-c' || rawSec === 'section 3' || rawSec === 'section c') return 'part_c';
    if (rawSec === 'part_d' || rawSec === 'part d' || rawSec === 'part-d' || rawSec === 'section 4' || rawSec === 'section d') return 'part_d';

    const raw = String((q as any).subject || (q as any).subjectName || q.tags?.topic || '').toLowerCase();
    if (/reason|intel/i.test(raw)) return 'part_a';
    if (/aware|gk|gs|ga|knowledge|history|polity|geography|science|economy|current/i.test(raw)) return 'part_b';
    if (/quant|math|aptitude|arithmetic|advance/i.test(raw)) return 'part_c';
    if (/eng|comprehension|verbal/i.test(raw)) return 'part_d';
    return null;
  }, []);

  // Compute 4 mock sections and properly ordered questions
  const { questions, sections } = useMemo(() => {
    const raw = chapter.questions || [];
    const total = raw.length;

    // 1. Standard 100 questions SSC Full Mock (25 questions each: Reasoning, GA, Quant, English)
    if (total === 100) {
      const partA: Question[] = [];
      const partB: Question[] = [];
      const partC: Question[] = [];
      const partD: Question[] = [];

      raw.forEach(q => {
        const sec = getQuestionSectionKey(q);
        if (sec === 'part_a') partA.push(q);
        else if (sec === 'part_b') partB.push(q);
        else if (sec === 'part_c') partC.push(q);
        else if (sec === 'part_d') partD.push(q);
      });

      // If all 4 sections are explicitly identified with questions
      if (partA.length > 0 && partB.length > 0 && partC.length > 0 && partD.length > 0) {
        const orderedList = [...partA, ...partB, ...partC, ...partD];
        const startA = 0;
        const endA = partA.length;
        const startB = endA;
        const endB = startB + partB.length;
        const startC = endB;
        const endC = startC + partC.length;
        const startD = endC;
        const endD = startD + partD.length;

        return {
          questions: orderedList,
          sections: [
            { id: 'part_a', label: 'PART-A', title: 'General Intelligence and Reasoning', startIndex: startA, endIndex: endA, count: partA.length },
            { id: 'part_b', label: 'PART-B', title: 'General Awareness', startIndex: startB, endIndex: endB, count: partB.length },
            { id: 'part_c', label: 'PART-C', title: 'Quantitative Aptitude', startIndex: startC, endIndex: endC, count: partC.length },
            { id: 'part_d', label: 'PART-D', title: 'English Comprehension', startIndex: startD, endIndex: endD, count: partD.length },
          ]
        };
      }

      // Canonical 25-25-25-25 split for standard SSC CGL Tier 1 Mock tests
      return {
        questions: raw,
        sections: [
          { id: 'part_a', label: 'PART-A', title: 'General Intelligence and Reasoning', startIndex: 0, endIndex: 25, count: 25 },
          { id: 'part_b', label: 'PART-B', title: 'General Awareness', startIndex: 25, endIndex: 50, count: 25 },
          { id: 'part_c', label: 'PART-C', title: 'Quantitative Aptitude', startIndex: 50, endIndex: 75, count: 25 },
          { id: 'part_d', label: 'PART-D', title: 'English Comprehension', startIndex: 75, endIndex: 100, count: 25 },
        ]
      };
    }

    // 2. If questions carry section or subject classification (e.g. from Mock Score practice, mock error remediation, or multi-subject test)
    const partA: Question[] = [];
    const partB: Question[] = [];
    const partC: Question[] = [];
    const partD: Question[] = [];
    const other: Question[] = [];

    raw.forEach(q => {
      const sec = getQuestionSectionKey(q);
      if (sec === 'part_a') partA.push(q);
      else if (sec === 'part_b') partB.push(q);
      else if (sec === 'part_c') partC.push(q);
      else if (sec === 'part_d') partD.push(q);
      else other.push(q);
    });

    const hasExplicit = (partA.length + partB.length + partC.length + partD.length) > 0;

    if (hasExplicit) {
      if (other.length > 0) {
        if (partA.length > 0) partA.push(...other);
        else if (partB.length > 0) partB.push(...other);
        else if (partC.length > 0) partC.push(...other);
        else if (partD.length > 0) partD.push(...other);
        else partA.push(...other);
      }

      const orderedList = [...partA, ...partB, ...partC, ...partD];
      const startA = 0;
      const endA = partA.length;
      const startB = endA;
      const endB = startB + partB.length;
      const startC = endB;
      const endC = startC + partC.length;
      const startD = endC;
      const endD = startD + partD.length;

      const computed: MockSection[] = [
        { id: 'part_a', label: 'PART-A', title: 'General Intelligence and Reasoning', startIndex: startA, endIndex: endA, count: partA.length },
        { id: 'part_b', label: 'PART-B', title: 'General Awareness', startIndex: startB, endIndex: endB, count: partB.length },
        { id: 'part_c', label: 'PART-C', title: 'Quantitative Aptitude', startIndex: startC, endIndex: endC, count: partC.length },
        { id: 'part_d', label: 'PART-D', title: 'English Comprehension', startIndex: startD, endIndex: endD, count: partD.length },
      ];

      return { questions: orderedList, sections: computed };
    }

    // 3. Fallback for single-subject chapter without individual question subject tags
    const chSub = String(chapter.subject || '');
    let targetKey = 'part_a';
    if (/quant|math|aptitude/i.test(chSub)) targetKey = 'part_c';
    else if (/aware|gk|gs|ga/i.test(chSub)) targetKey = 'part_b';
    else if (/eng/i.test(chSub)) targetKey = 'part_d';

    const computed: MockSection[] = [
      { id: 'part_a', label: 'PART-A', title: 'General Intelligence and Reasoning', startIndex: targetKey === 'part_a' ? 0 : 0, endIndex: targetKey === 'part_a' ? total : 0, count: targetKey === 'part_a' ? total : 0 },
      { id: 'part_b', label: 'PART-B', title: 'General Awareness', startIndex: targetKey === 'part_b' ? 0 : 0, endIndex: targetKey === 'part_b' ? total : 0, count: targetKey === 'part_b' ? total : 0 },
      { id: 'part_c', label: 'PART-C', title: 'Quantitative Aptitude', startIndex: targetKey === 'part_c' ? 0 : 0, endIndex: targetKey === 'part_c' ? total : 0, count: targetKey === 'part_c' ? total : 0 },
      { id: 'part_d', label: 'PART-D', title: 'English Comprehension', startIndex: targetKey === 'part_d' ? 0 : 0, endIndex: targetKey === 'part_d' ? total : 0, count: targetKey === 'part_d' ? total : 0 },
    ];

    return { questions: raw, sections: computed };
  }, [chapter.questions, chapter.subject, getQuestionSectionKey]);

  const initialSectionIdx = useMemo(() => {
    const idx = sections.findIndex(s => s.count > 0);
    return idx !== -1 ? idx : 0;
  }, [sections]);

  const [activeSectionIdx, setActiveSectionIdx] = useState(initialSectionIdx);
  const [currentIdx, setCurrentIdx] = useState(sections[initialSectionIdx]?.startIndex || 0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showSolutionMap, setShowSolutionMap] = useState<Record<number, boolean>>({});
  const [timeSpent, setTimeSpent] = useState<Record<number, number>>({});
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [isFinished, setIsFinished] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showQuestionPaper, setShowQuestionPaper] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Incorrect Question or Solution');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<QuizResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(0); // -1: small, 0: base, 1: large, 2: xl
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showSymbolsModal, setShowSymbolsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const fontSizeClass = zoomLevel === -1
    ? 'text-xs'
    : zoomLevel === 1
    ? 'text-base'
    : zoomLevel === 2
    ? 'text-lg'
    : 'text-sm sm:text-[15px]';

  const startTimeRef = useRef<number>(Date.now());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const timeSpentRef = useRef(timeSpent);
  useEffect(() => {
    timeSpentRef.current = timeSpent;
  }, [timeSpent]);
  const markedRef = useRef(markedForReview);
  markedRef.current = markedForReview;
  const currentIdxRef = useRef(currentIdx);
  currentIdxRef.current = currentIdx;
  const isFinishedRef = useRef(isFinished);
  isFinishedRef.current = isFinished;
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Always call the latest version of handleSubmitTest from the timer effect
  const handleSubmitTestRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Sync activeSectionIdx when currentIdx changes
  useEffect(() => {
    const secIdx = sections.findIndex(s => s.count > 0 && currentIdx >= s.startIndex && currentIdx < s.endIndex);
    if (secIdx !== -1 && secIdx !== activeSectionIdx) {
      setActiveSectionIdx(secIdx);
    }
  }, [currentIdx, sections, activeSectionIdx]);

  useEffect(() => {
    if (currentIdx >= totalQuestions && totalQuestions > 0) {
      setCurrentIdx(totalQuestions - 1);
    }
  }, [totalQuestions, currentIdx]);

  useEffect(() => {
    if (isFinished) return;
    startTimeRef.current = Date.now();
    setVisited(prev => { const n = new Set(prev); n.add(currentIdx); return n; });
    return () => {
      if (!isPaused && !isFinished) {
        const duration = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
        if (duration > 0) {
          const newTime = (timeSpentRef.current[currentIdx] || 0) + duration;
          timeSpentRef.current = { ...timeSpentRef.current, [currentIdx]: newTime };
          setTimeSpent(prev => ({ ...prev, [currentIdx]: newTime }));
          startTimeRef.current = Date.now();
        }
      }
    };
  }, [currentIdx, isPaused, isFinished]);

  const recordTime = () => {
    if (isPaused) return;
    const duration = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
    if (duration > 0) {
      const newTime = (timeSpentRef.current[currentIdx] || 0) + duration;
      timeSpentRef.current = { ...timeSpentRef.current, [currentIdx]: newTime };
      setTimeSpent(prev => ({ ...prev, [currentIdx]: newTime }));
    }
    startTimeRef.current = Date.now();
  };

  const handlePauseToggle = () => {
    if (!isPaused) { recordTime(); setIsPaused(true); }
    else { startTimeRef.current = Date.now(); setIsPaused(false); }
  };

  const handleAnswer = (answer: 'a' | 'b' | 'c' | 'd') => {
    setAnswers(prev => {
      const updated = { ...prev };
      if (mode === 'mock' && updated[currentIdx] === answer) {
        delete updated[currentIdx];
      } else {
        updated[currentIdx] = answer;
      }
      answersRef.current = updated;
      return updated;
    });

    if (mode === 'practice') {
      setShowSolutionMap(prev => ({ ...prev, [currentIdx]: true }));
    }
  };

  const handleClearResponse = () => {
    setAnswers(prev => {
      const n = { ...prev };
      delete n[currentIdx];
      answersRef.current = n;
      return n;
    });
    setMarkedForReview(prev => {
      const n = new Set(prev);
      n.delete(currentIdx);
      markedRef.current = n;
      return n;
    });
    if (mode === 'practice') {
      setShowSolutionMap(prev => {
        const n = { ...prev };
        delete n[currentIdx];
        return n;
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!currentQuestion) return;
    setIsDeleting(true);
    try {
      if (onDeleteQuestion) {
        await onDeleteQuestion(currentQuestion);
      }
      setAnswers(prev => {
        const n = { ...prev };
        delete n[currentIdx];
        return n;
      });
      setMarkedForReview(prev => {
        const n = new Set(prev);
        n.delete(currentIdx);
        return n;
      });
      setShowSolutionMap(prev => {
        const n = { ...prev };
        delete n[currentIdx];
        return n;
      });
      setShowDeleteModal(false);
      setDeleteToast('Question permanently deleted everywhere.');
      setTimeout(() => setDeleteToast(null), 3500);
    } catch (e) {
      console.error('Error deleting question:', e);
      alert('Failed to delete question. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const jumpToQuestion = (idx: number) => {
    if (idx < 0 || idx >= totalQuestions) return;
    recordTime();
    setCurrentIdx(idx);
    const secIdx = sections.findIndex(s => s.count > 0 && idx >= s.startIndex && idx < s.endIndex);
    if (secIdx !== -1) {
      setActiveSectionIdx(secIdx);
    }
  };

  const handleSaveAndNext = () => {
    // If current question was marked for review, save answer and remove from review
    if (markedRef.current.has(currentIdx)) {
      setMarkedForReview(prev => {
        const n = new Set(prev);
        n.delete(currentIdx);
        markedRef.current = n;
        return n;
      });
    }
    if (currentIdx < totalQuestions - 1) {
      jumpToQuestion(currentIdx + 1);
    } else {
      recordTime();
      setShowSubmitModal(true);
    }
  };

  const handleToggleMarkForReview = () => {
    setMarkedForReview(prev => {
      const n = new Set(prev);
      if (n.has(currentIdx)) {
        n.delete(currentIdx);
      } else {
        n.add(currentIdx);
      }
      markedRef.current = n;
      return n;
    });
  };

  const handleSectionClick = (idx: number) => {
    const sec = sections[idx];
    if (!sec || sec.count === 0) return;
    jumpToQuestion(sec.startIndex);
  };

  const handleSubmitSection = () => {
    recordTime();
    // Check if next section exists with questions
    const nextSecIdx = sections.findIndex((s, i) => i > activeSectionIdx && s.count > 0);
    if (nextSecIdx !== -1) {
      setActiveSectionIdx(nextSecIdx);
      setCurrentIdx(sections[nextSecIdx].startIndex);
    } else {
      setShowSubmitModal(true);
    }
  };

  const isQuestionCorrect = (idx: number, answersMap: Record<number, string> = answers) => {
    const userAns = answersMap[idx]?.toLowerCase().trim();
    return !!userAns && userAns === getCorrectOptionKey(questions[idx]);
  };

  const handleReattempt = () => {
    setAnswers({}); setTimeSpent({}); setVisited(new Set([0])); setMarkedForReview(new Set());
    setShowSolutionMap({});
    answersRef.current = {}; timeSpentRef.current = {}; markedRef.current = new Set();
    startTimeRef.current = Date.now();
    setIsFinished(false); isFinishedRef.current = false;
    const firstSec = sections.findIndex(s => s.count > 0);
    const startSec = firstSec !== -1 ? firstSec : 0;
    setCurrentIdx(sections[startSec]?.startIndex || 0);
    setActiveSectionIdx(startSec);
    setIsPaused(false); setSubmittedResult(null);
  };

  const calculateScore = (answersMap: Record<number, string> = answers) =>
    questions.filter((_, idx) => isQuestionCorrect(idx, answersMap)).length;

  const buildResults = (computedTimeSpent: Record<number, number> = timeSpent, answersMap: Record<number, string> = answers): Omit<QuizResult, 'userId' | 'completedAt'> => {
    const score = calculateScore(answersMap);
    const totalTime = (Object.values(computedTimeSpent) as number[]).reduce((a, t) => a + t, 0);
    const currentMarked = markedRef.current;
    return {
      chapter_title: chapter.chapter_title,
      subject: chapter.subject,
      category,
      mode,
      score,
      totalQuestions,
      totalTime,
      questionDetails: questions.map((q, idx) => ({
        q_num: q.q_num,
        timeSpent: computedTimeSpent[idx] || 0,
        isCorrect: isQuestionCorrect(idx, answersMap),
        selectedAnswer: answersMap[idx] || '',
        question: q,
        marked: currentMarked.has(idx),
      }))
    };
  };

  const handleSubmitTest = async () => {
    if (isFinishedRef.current || isSubmittingRef.current) return;
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    const duration = isPausedRef.current ? 0 : Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
    const activeIdx = currentIdxRef.current;
    const finalTimeSpent: Record<number, number> = {
      ...timeSpentRef.current,
      [activeIdx]: (timeSpentRef.current[activeIdx] || 0) + duration
    };
    timeSpentRef.current = finalTimeSpent;
    setTimeSpent(finalTimeSpent);

    const currentAnswers = answersRef.current;
    const results = buildResults(finalTimeSpent, currentAnswers);

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
      isSubmittingRef.current = false;
      setIsFinished(true);
      isFinishedRef.current = true;
      setShowSubmitModal(false);
    }
  };

  // Keep handleSubmitTestRef pointing at the latest version on every render
  handleSubmitTestRef.current = handleSubmitTest;

  const currentQuestion = questions[currentIdx] || questions[0];
  const activeSection = sections[activeSectionIdx] || sections[0];
  const sectionQuestions = activeSection ? questions.slice(activeSection.startIndex, activeSection.endIndex) : [];

  // Section Analysis stats (matches the screenshot: PART-A Analysis)
  const sectionAnswered = activeSection ? sectionQuestions.filter((_, i) => !!answers[activeSection.startIndex + i]).length : 0;
  const sectionMarked = activeSection ? sectionQuestions.filter((_, i) => markedForReview.has(activeSection.startIndex + i)).length : 0;
  const sectionNotAnswered = sectionQuestions.length - sectionAnswered;

  // Overall stats for submission modal
  const stats = {
    answered: Object.keys(answers).length,
    marked: markedForReview.size,
    notAttempted: Math.max(0, totalQuestions - Object.keys(answers).length),
  };

  // Practice mode stats
  const scorePractice = calculateScore();
  const answeredPractice = Object.keys(answers).length;
  const wrongPractice = answeredPractice - scorePractice;
  const accuracyPractice = answeredPractice > 0 ? Math.round((scorePractice / answeredPractice) * 100) : 0;
  const unattemptedPractice = Math.max(0, totalQuestions - answeredPractice);

  const correctOptionKey = getCorrectOptionKey(currentQuestion);
  const currentNormalizedOptions = useMemo(() => getNormalizedOptions(currentQuestion), [currentQuestion]);
  const isSolutionOpen = showSolutionMap[currentIdx] ?? (answers[currentIdx] !== undefined);

  const getFormattedSolution = () => {
    if (!currentQuestion?.solution) return '';
    return extractSolutionLanguage(currentQuestion.solution, language);
  };

  // Question numbering within section (e.g. Question No. 2)
  const questionNumberInSection = activeSection ? currentIdx - activeSection.startIndex + 1 : currentIdx + 1;

  // Extract bilingual text safely without splitting math
  const getQuestionText = () => {
    if (!currentQuestion?.question) return '';
    return getLanguageText(currentQuestion.question, language);
  };

  const getOptionText = (rawOptionText: string) => {
    if (!rawOptionText) return '';
    return getLanguageText(rawOptionText, language);
  };

  const optionKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];

  // Global Keyboard Shortcuts (Arrow keys, J/K, 1-4, A-D, S, Clear/Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('input, textarea, [contenteditable="true"]'))
      ) {
        return;
      }

      // Ignore modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Ignore if any modal is active or test is finished/paused
      if (
        isFinished ||
        isPaused ||
        showSubmitModal ||
        showReportModal ||
        showInstructionsModal ||
        showQuestionPaper ||
        showSymbolsModal ||
        showDeleteModal
      ) {
        return;
      }

      const key = e.key;

      // 1. Navigation: Left / J (Previous)
      if (key === 'ArrowLeft' || key === 'j' || key === 'J') {
        e.preventDefault();
        if (currentIdx > 0) {
          jumpToQuestion(currentIdx - 1);
        }
        return;
      }

      // 2. Navigation: Right / K (Next / Save & Next)
      if (key === 'ArrowRight' || key === 'k' || key === 'K') {
        e.preventDefault();
        if (mode === 'practice') {
          if (currentIdx < totalQuestions - 1) {
            jumpToQuestion(currentIdx + 1);
          } else {
            setShowSubmitModal(true);
          }
        } else {
          handleSaveAndNext();
        }
        return;
      }

      // 3. Option Selection: 1/A -> 'a', 2/B -> 'b', 3/C -> 'c', 4/D -> 'd'
      const lowerKey = key.toLowerCase();
      if (key === '1' || lowerKey === 'a') {
        e.preventDefault();
        handleAnswer('a');
        return;
      }
      if (key === '2' || lowerKey === 'b') {
        e.preventDefault();
        handleAnswer('b');
        return;
      }
      if (key === '3' || lowerKey === 'c') {
        e.preventDefault();
        handleAnswer('c');
        return;
      }
      if (key === '4' || lowerKey === 'd') {
        e.preventDefault();
        handleAnswer('d');
        return;
      }

      // 4. Toggle Solution (Practice Mode only): S
      if (lowerKey === 's') {
        e.preventDefault();
        if (mode === 'practice') {
          setShowSolutionMap(prev => ({ ...prev, [currentIdx]: !isSolutionOpen }));
        }
        return;
      }

      // 5. Clear Response: Delete or X
      if (key === 'Delete' || lowerKey === 'x') {
        if (answers[currentIdx] !== undefined) {
          e.preventDefault();
          handleClearResponse();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentIdx,
    totalQuestions,
    mode,
    isFinished,
    isPaused,
    showSubmitModal,
    showReportModal,
    showInstructionsModal,
    showQuestionPaper,
    showSymbolsModal,
    showDeleteModal,
    answers,
    isSolutionOpen
  ]);

  /* ── SCORE SCREEN ── */
  if (isFinished) {
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
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            {mode === 'practice' ? 'Practice Session Completed!' : 'Test Submitted!'}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {mode === 'practice' ? 'You practiced ' : 'You completed '}
            <span className="font-semibold text-gray-700">{chapter.chapter_title}</span>
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
                className="py-3 bg-[#0097a7] hover:bg-[#00838f] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center shadow cursor-pointer"
              >
                <BookOpen className="w-4 h-4 mr-2" />Review Questions
              </button>
            )}
            <button
              onClick={handleReattempt}
              className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center shadow cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 mr-2" />Reattempt
            </button>
            <button
              onClick={onExit}
              className="py-3 bg-slate-800 hover:bg-black text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center shadow cursor-pointer"
            >
              <CornerDownLeft className="w-4 h-4 mr-2" />Back to Chapters
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 border border-rose-200 shadow-sm">
          <Trash2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">No Questions Remaining</h3>
        <p className="text-gray-500 text-sm max-w-md mb-6">
          All questions in this chapter or test have been deleted.
        </p>
        <button
          onClick={onExit}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <CornerDownLeft className="w-4 h-4" />
          <span>Back to Chapters</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-white text-gray-900 select-none overflow-hidden font-sans">

      {/* ── TOP HEADER BAR ── */}
      <header className="h-[60px] bg-white border-b border-gray-300 px-4 flex items-center justify-between shrink-0 shadow-2xs z-30">
        {/* Left: Brand + Test Subtitle + Mode Badge + Zoom Buttons */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <svg className="w-5 h-5 text-[#00baf2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 2H5C3.89 2 3 2.89 3 4v16c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V4c0-1.11-.89-2-2-2zm-7 16H6v-2h6v2zm0-4H6v-2h6v2zm0-4H6V8h6v2zm6 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V8h4v2z"/>
                </svg>
                <span className="font-extrabold text-lg tracking-tight text-[#00baf2] leading-none">testbook</span>
              </div>
              {mode === 'practice' ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                  <BookOpen className="w-3 h-3 text-emerald-600" />
                  Practice Mode
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  Mock Simulator
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-gray-900 truncate max-w-[130px] sm:max-w-[200px] mt-0.5">
              {chapter.chapter_title || 'Percentage'}
            </span>
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 1, 2))}
              className="px-2.5 py-0.5 bg-[#1e60aa] hover:bg-[#164d8a] text-white text-[11px] font-bold rounded-full transition-all shadow-2xs cursor-pointer"
              title="Zoom In"
            >
              Zoom (+)
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 1, -1))}
              className="px-2.5 py-0.5 bg-[#1e60aa] hover:bg-[#164d8a] text-white text-[11px] font-bold rounded-full transition-all shadow-2xs cursor-pointer"
              title="Zoom Out"
            >
              Zoom (-)
            </button>
          </div>
        </div>

        {/* Center: Title & Candidate Roll No (or Practice Live Score) */}
        <div className="hidden md:flex flex-col items-center justify-center text-center">
          <h2 className="text-sm font-bold text-gray-900 leading-tight">
            {chapter.chapter_title || 'Percentage'}
          </h2>
          {mode === 'mock' ? (
            <span className="text-[11px] text-gray-700 font-semibold mt-0.5">
              Roll No : 919754035746
            </span>
          ) : (
            <div className="flex items-center gap-3 text-xs font-semibold mt-0.5">
              <span className="text-emerald-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" /> {scorePractice} Correct
              </span>
              <span className="text-rose-700 flex items-center gap-1">
                <X className="w-3.5 h-3.5 stroke-[3]" /> {wrongPractice} Incorrect
              </span>
              <span className="text-indigo-700 font-bold">
                {accuracyPractice}% Accuracy
              </span>
            </div>
          )}
        </div>

        {/* Right: Fullscreen, Pause, Time Left, Candidate Photos (or Practice Finish) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded border border-[#00baf2] text-[#00baf2] hover:bg-[#00baf2]/10 flex items-center justify-center transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Pause Button */}
          <button
            onClick={handlePauseToggle}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded border border-[#00baf2] text-[#00baf2] hover:bg-[#00baf2]/10 flex items-center justify-center transition-colors cursor-pointer"
            title={isPaused ? 'Resume Test' : 'Pause Test'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-emerald-600" /> : <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-[#00baf2]" />}
          </button>

          {/* Section Time Badge */}
          <QuizTimerBadge
            mode={mode}
            totalQuizTime={totalQuizTime}
            isPaused={isPaused}
            isFinished={isFinished}
            initialQuestionTime={timeSpentRef.current[currentIdx] || 0}
            currentIdx={currentIdx}
            onTimeUp={() => {
              handleSubmitTestRef.current();
            }}
          />

          {mode === 'mock' ? (
            /* Candidate Profile Photos in Mock Mode */
            <div className="hidden sm:flex items-center gap-1.5 ml-1">
              <CandidateAvatar label="Registration Photo" />
              <CandidateAvatar label="Captured Photo" />
            </div>
          ) : (
            /* Finish Practice Button in Practice Mode */
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer ml-1"
              title="Finish Practice and view summary"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline">Finish Practice</span>
            </button>
          )}

          {/* Exit Button */}
          <button
            onClick={() => {
              if (window.confirm(mode === 'practice' ? 'Are you sure you want to exit practice mode?' : 'Are you sure you want to exit the test? Your progress will not be saved.')) {
                onExit();
              }
            }}
            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors ml-1 cursor-pointer"
            title="Exit"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── SECOND SUB-HEADER ROW 1 (Links on Left, Status Counter on Right) ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center justify-between shrink-0 z-20">
        {mode === 'mock' ? (
          /* Quick Links: SYMBOLS | INSTRUCTIONS | OVERALL TEST SUMMARY in Mock */
          <div className="flex items-center gap-4 text-[11px] font-bold tracking-wide uppercase">
            <button
              onClick={() => setShowSymbolsModal(true)}
              className="text-[#0088cc] hover:underline cursor-pointer"
            >
              SYMBOLS
            </button>
            <button
              onClick={() => setShowInstructionsModal(true)}
              className="text-[#d9534f] hover:underline cursor-pointer"
            >
              INSTRUCTIONS
            </button>
            <button
              onClick={() => setShowQuestionPaper(true)}
              className="text-[#a94442] hover:underline cursor-pointer"
            >
              OVERALL TEST SUMMARY
            </button>
          </div>
        ) : (
          /* Practice Mode Sub-header Left: Breadcrumb / Topic Info */
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <span className="font-bold text-gray-900">
              Question {currentIdx + 1} of {totalQuestions}
            </span>
            {currentQuestion?.tags?.topic && (
              <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded text-[11px] border border-indigo-100">
                {currentQuestion.tags.topic}
              </span>
            )}
          </div>
        )}

        {/* Right: Answered / Practice status counter */}
        {mode === 'mock' ? (
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-800 font-bold ml-auto">
            <span>Total Questions Answered:</span>
            <span className="bg-[#ffff00] border border-gray-400 text-black px-1.5 py-0.5 font-bold text-xs">
              {stats.answered}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-xs font-semibold ml-auto">
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <Check className="w-3 h-3 stroke-[3]" /> {scorePractice} Correct
            </span>
            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
              <X className="w-3 h-3 stroke-[3]" /> {wrongPractice} Wrong
            </span>
            <span className="text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
              {unattemptedPractice} Left
            </span>
          </div>
        )}
      </div>

      {/* ── SECOND SUB-HEADER ROW 2 (Section Pills and Action Buttons aligned to the left - Testbook Exact) ── */}
      <div className="bg-white border-b border-gray-300 px-3 sm:px-4 py-1.5 flex items-center justify-start gap-2 sm:gap-3 shrink-0 z-20 overflow-x-auto">
        {/* Section Pills: PART-A, PART-B, PART-C, PART-D */}
        <div className="flex items-center gap-1.5 shrink-0">
          {sections.map((sec, idx) => {
            const isActive = idx === activeSectionIdx;
            const hasQuestions = sec.count > 0;
            return (
              <button
                key={sec.id}
                onClick={() => handleSectionClick(idx)}
                disabled={!hasQuestions}
                title={`${sec.label}: ${sec.title} (${sec.count} Questions)`}
                className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-[2px] transition-all shrink-0 select-none ${
                  isActive
                    ? 'bg-[#008000] text-white border border-[#006600] shadow-xs'
                    : hasQuestions
                    ? 'bg-white border border-[#d0d0d0] text-gray-700 hover:text-gray-900 hover:bg-gray-50 cursor-pointer'
                    : 'bg-white border border-[#e5e5e5] text-[#b0b0b0] cursor-not-allowed opacity-60'
                }`}
              >
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons: Practice vs Mock Mode */}
        {mode === 'practice' ? (
          <div className="flex items-center gap-2 shrink-0 ml-3 sm:ml-6">
            <button
              onClick={() => currentIdx > 0 && jumpToQuestion(currentIdx - 1)}
              disabled={currentIdx === 0}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              title="Previous question"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setShowSolutionMap(prev => ({ ...prev, [currentIdx]: !isSolutionOpen }))}
              className={`font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                isSolutionOpen
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
              }`}
              title="Toggle solution visibility"
            >
              {isSolutionOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-amber-600" />}
              <span>{isSolutionOpen ? 'Hide Solution' : 'Show Solution'}</span>
            </button>

            <button
              onClick={() => {
                if (currentIdx < totalQuestions - 1) {
                  jumpToQuestion(currentIdx + 1);
                } else {
                  setShowSubmitModal(true);
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              title="Next question"
            >
              <span>{currentIdx < totalQuestions - 1 ? 'Next' : 'Finish'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Mock Mode Buttons (Exact match to official Testbook interface - Left aligned after PART pills) */
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-3 sm:ml-7">
            <button
              onClick={() => currentIdx > 0 && jumpToQuestion(currentIdx - 1)}
              disabled={currentIdx === 0}
              className="bg-[#2460b9] hover:bg-[#1c4d94] active:bg-[#183f7a] text-white font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-[2px] transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center gap-1"
              title="Previous question"
            >
              <span>Previous</span>
            </button>
            <button
              onClick={handleToggleMarkForReview}
              className={`${
                markedForReview.has(currentIdx)
                  ? 'bg-[#7e57c2] hover:bg-[#673ab7] active:bg-[#512da8]'
                  : 'bg-[#2460b9] hover:bg-[#1c4d94] active:bg-[#183f7a]'
              } text-white font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-[2px] transition-colors shadow-2xs cursor-pointer whitespace-nowrap`}
              title={markedForReview.has(currentIdx) ? "Marked for Review (Click to unmark)" : "Mark for Review (Remain on question)"}
            >
              {markedForReview.has(currentIdx) ? 'Marked for Review' : 'Mark for Review'}
            </button>
            <button
              onClick={handleSaveAndNext}
              className="bg-[#2460b9] hover:bg-[#1c4d94] active:bg-[#183f7a] text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded-[2px] transition-colors shadow-2xs cursor-pointer whitespace-nowrap flex items-center gap-1"
              title="Save response & go to next"
            >
              <span>Save &amp; Next</span>
            </button>
            <button
              onClick={handleSubmitSection}
              className="bg-[#2460b9] hover:bg-[#1c4d94] active:bg-[#183f7a] text-white font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-[2px] transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
            >
              Submit Section
            </button>
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={isSubmitting}
              className="bg-[#2460b9] hover:bg-[#1c4d94] active:bg-[#183f7a] text-white font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-[2px] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              Submit Test
            </button>
          </div>
        )}
      </div>

      {/* ── MAIN LAYOUT (QUESTION ON LEFT, PALETTE ON RIGHT) ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── LEFT PANE: QUESTION & OPTIONS TABLE (Exact match to Testbook) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-32 bg-white border-r border-gray-200 custom-scrollbar">

          {isPaused ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/70 rounded-xl border border-slate-200">
              <div className="w-14 h-14 bg-[#2460b9] text-white rounded-full flex items-center justify-center mb-3 shadow">
                <Pause className="w-7 h-7 fill-current" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Test Paused</h3>
              <p className="text-gray-500 text-sm mb-5">Click below to resume your test timer.</p>
              <button
                onClick={handlePauseToggle}
                className="px-5 py-2 bg-[#2460b9] hover:bg-[#1c4d94] text-white rounded font-bold text-sm flex items-center shadow"
              >
                <Play className="w-4 h-4 mr-2 fill-current" /> Resume Test
              </button>
            </div>
          ) : (
            <>
              {/* Question Label Row: Question No. X | Language | Report */}
              {/* Question Label Row: Question No. X | Bookmark | Language | Report */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm sm:text-base">
                    Question No. {questionNumberInSection}
                  </span>
                  {mode === 'practice' && (
                    <span className="text-xs text-gray-500 font-medium">
                      (Q.{currentIdx + 1} of {totalQuestions})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Bookmark Button */}
                  {onBookmarkToggle && currentQuestion && (() => {
                    const isBookmarked =
                      bookmarkedIds.has(currentQuestion.question?.trim().toLowerCase()) ||
                      bookmarkedIds.has(currentQuestion.q_num);
                    return (
                      <button
                        onClick={() => onBookmarkToggle(currentQuestion)}
                        className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border transition-colors cursor-pointer ${
                          isBookmarked
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-white text-gray-600 border-gray-300 hover:text-amber-600 hover:border-amber-200'
                        }`}
                        title="Bookmark this question"
                      >
                        {isBookmarked ? (
                          <>
                            <BookmarkCheck className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                            <span className="hidden sm:inline">Bookmarked</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Bookmark</span>
                          </>
                        )}
                      </button>
                    );
                  })()}

                  {/* Delete Button (Permanently deletes question from everywhere) */}
                  {onDeleteQuestion && currentQuestion && (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-colors cursor-pointer shadow-2xs"
                      title="Permanently delete this unwanted or incomplete question from everywhere"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  )}

                  {/* Language Indicator */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-700">
                    <span className="font-medium text-gray-500">Language:</span>
                    <span className="border border-gray-300 rounded px-2.5 py-0.5 text-xs text-gray-800 bg-slate-50 font-semibold">
                      English
                    </span>
                  </div>

                  {/* Report Button */}
                  <button
                    onClick={() => { setShowReportModal(true); setReportSubmitted(false); }}
                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-600 transition-colors font-medium cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Report</span>
                  </button>
                </div>
              </div>

              {/* Question Statement Box */}
              <div className="border border-gray-300 rounded-[2px] bg-white overflow-hidden shadow-2xs mb-4">
                <div className={`p-4 sm:p-5 ${fontSizeClass} text-gray-900 leading-relaxed`}>
                  <FormattedText
                    text={currentQuestion?.question}
                    language={language}
                    className="whitespace-pre-wrap select-text leading-relaxed"
                    as="div"
                    isQuestion={true}
                    subject={currentQuestion?.subject || currentQuestion?.section}
                  />
                  {currentQuestion?.image?.src && (
                    <div className="mt-4">
                      <img
                        src={currentQuestion.image.src}
                        alt="Question diagram"
                        className="max-h-72 max-w-full rounded border border-gray-200"
                      />
                    </div>
                  )}
                </div>

                {/* Mock Mode Options Table (Official Testbook Table) */}
                {mode === 'mock' && (
                  <div className="border-t border-gray-200 divide-y divide-gray-200">
                    {currentNormalizedOptions.map(({ key: k, text: rawOpt }) => {
                      const isSelected = answers[currentIdx] === k;

                      return (
                        <div
                          key={k}
                          onClick={() => handleAnswer(k)}
                          title={`Option ${k.toUpperCase()}`}
                          className={`flex items-stretch hover:bg-slate-50/80 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/30' : 'bg-white'
                          }`}
                        >
                          {/* Left column: Radio button */}
                          <div className="w-12 shrink-0 border-r border-gray-200 flex items-center justify-center py-3.5 bg-white">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                              isSelected ? 'border-blue-600 bg-white' : 'border-gray-400 bg-white'
                            }`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                            </div>
                          </div>

                          {/* Right column: Option text */}
                          <div className={`flex-1 px-4 py-3.5 ${fontSizeClass} text-gray-800 leading-normal flex items-center`}>
                            <FormattedText text={rawOpt} language={language} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Practice Mode Options Cards (Instant Feedback) */}
              {mode === 'practice' && (
                <div className="space-y-2.5 mb-5">
                  {currentNormalizedOptions.map(({ key: k, text: rawOpt }) => {
                    const isSelected = answers[currentIdx] === k;
                    const isAttempted = answers[currentIdx] !== undefined;
                    const isCorrectOption = k === correctOptionKey;

                    let cardStyle = 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/20 text-gray-800';
                    let badgeIcon = (
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs uppercase ${
                        isSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600 bg-gray-50'
                      }`}>
                        {k}
                      </div>
                    );
                    let statusBadge = null;

                    if (isAttempted) {
                      if (isCorrectOption) {
                        cardStyle = 'border-emerald-500 bg-emerald-50/90 text-emerald-950 font-medium ring-1 ring-emerald-500 shadow-2xs';
                        badgeIcon = (
                          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        );
                        statusBadge = (
                          <span className="text-[11px] font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Correct Answer
                          </span>
                        );
                      } else if (isSelected) {
                        cardStyle = 'border-rose-500 bg-rose-50/90 text-rose-950 font-medium ring-1 ring-rose-500 shadow-2xs';
                        badgeIcon = (
                          <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs">
                            <X className="w-4 h-4 stroke-[3]" />
                          </div>
                        );
                        statusBadge = (
                          <span className="text-[11px] font-bold bg-rose-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                            <X className="w-3 h-3 stroke-[3]" />
                            Your Answer (Incorrect)
                          </span>
                        );
                      } else {
                        cardStyle = 'border-gray-200 bg-gray-50/60 text-gray-400 opacity-60';
                        badgeIcon = (
                          <div className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 bg-gray-100 flex items-center justify-center text-xs uppercase">
                            {k}
                          </div>
                        );
                      }
                    }

                    return (
                      <div
                        key={k}
                        onClick={() => handleAnswer(k)}
                        className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${cardStyle}`}
                      >
                        <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-2">
                          {badgeIcon}
                          <span className={`${fontSizeClass} leading-normal select-text flex-1`}>
                            <FormattedText text={rawOpt} language={language} />
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {statusBadge}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Clear Response / Reattempt in Mock vs Practice Mode */}
              {answers[currentIdx] && (
                <div className="flex items-center justify-between mb-4">
                  {mode === 'mock' ? (
                    <button
                      onClick={handleClearResponse}
                      className="text-xs text-gray-500 hover:text-red-600 underline font-medium cursor-pointer flex items-center gap-1.5"
                      title="Clear selected option (Delete or X)"
                    >
                      <span>Clear Selected Option</span>
                      <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-gray-100 border border-gray-300 rounded text-gray-600">Del / X</kbd>
                    </button>
                  ) : (
                    <button
                      onClick={handleClearResponse}
                      className="text-xs text-gray-500 hover:text-red-600 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Clear selection and try again (Delete or X)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear Selection (Try Again)</span>
                      <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-gray-100 border border-gray-300 rounded text-gray-600">Del / X</kbd>
                    </button>
                  )}
                </div>
              )}

              {/* Practice Mode Solution & Step-by-Step Explanation Box */}
              {mode === 'practice' && isSolutionOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-emerald-300 bg-emerald-50/30 overflow-hidden shadow-xs mb-6"
                >
                  <div className="bg-emerald-700 text-white px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <h4 className="font-bold text-xs sm:text-sm tracking-wide uppercase">
                        Step-by-Step Solution &amp; Explanation
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const isSectional = (chapter as any)?.is_mock && (
                            String(chapter?.chapter_title || '').toLowerCase().includes('sectional') ||
                            (chapter?.questions?.length || 0) === 25
                          );
                          const sType: 'full_mock' | 'sectional' | 'subject_wise' = (chapter as any)?.is_mock
                            ? (isSectional ? 'sectional' : 'full_mock')
                            : (category === 'mockErrors' ? 'subject_wise' : 'subject_wise');
                          const sLabel = (chapter as any)?.is_mock
                            ? (isSectional ? `Sectional Test: ${chapter?.chapter_title}` : `Full Mock Test: ${chapter?.chapter_title}`)
                            : (category === 'mockErrors' ? `Mock Errors: ${chapter?.chapter_title}` : `Chapter Practice: ${chapter?.chapter_title}`);

                          window.dispatchEvent(new CustomEvent('cgl_ask_ai_question', {
                            detail: {
                              questionNumber: questionNumberInSection > 0 ? questionNumberInSection : currentIdx + 1,
                              questionText: currentQuestion?.question,
                              options: currentQuestion?.options,
                              userAnswer: answers[currentIdx],
                              correctAnswer: correctOptionKey,
                              solution: currentQuestion?.solution,
                              topic: (currentQuestion as any)?.tags?.topic || (currentQuestion as any)?.topic || chapter?.chapter_title || category || 'Practice',
                              sourceType: sType,
                              sourceLabel: sLabel,
                              testName: chapter?.chapter_title
                            }
                          }));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer group border border-white/20"
                        title="Ask Tommy to explain this question, formulas, and elimination tricks"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
                        <span>Ask Tommy</span>
                      </button>
                      <span className="bg-white/20 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-white/30">
                        Correct: Option ({correctOptionKey.toUpperCase()})
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 text-gray-900 bg-white">
                    {getFormattedSolution() ? (
                      <div className={`${fontSizeClass} leading-relaxed font-sans text-gray-800`}>
                        <SolutionViewer
                          solution={getFormattedSolution()}
                          language={language}
                          subject={currentQuestion?.subject || currentQuestion?.section}
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600 flex items-center gap-1 flex-wrap">
                        <span>The correct answer is Option <b className="text-gray-900">({correctOptionKey.toUpperCase()})</b>:</span>
                        <FormattedText text={currentQuestion?.options?.[correctOptionKey] || ''} language={language} />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT PANE: PALETTE & SECTION ANALYSIS (Matches Testbook screenshot) ── */}
        <QuizPaletteSidebar
          mode={mode}
          activeSection={activeSection}
          sectionQuestions={sectionQuestions}
          answers={answers}
          markedForReview={markedForReview}
          currentIdx={currentIdx}
          isQuestionCorrect={isQuestionCorrect}
          jumpToQuestion={jumpToQuestion}
          totalQuestions={totalQuestions}
          answeredPractice={answeredPractice}
          scorePractice={scorePractice}
          wrongPractice={wrongPractice}
          unattemptedPractice={unattemptedPractice}
          accuracyPractice={accuracyPractice}
          sectionAnswered={sectionAnswered}
          sectionNotAnswered={sectionNotAnswered}
          sectionMarked={sectionMarked}
        />
      </div>

      {/* ── INSTRUCTIONS MODAL ── */}
      {showInstructionsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-300 overflow-hidden">
            <div className="bg-[#2460b9] text-white px-4 py-2.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">General Instructions</h3>
              <button onClick={() => setShowInstructionsModal(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-xs text-gray-700 leading-relaxed custom-scrollbar">
              <p className="font-bold text-gray-900 text-sm">1. Navigating to a Question:</p>
              <p>• Click on the question number in the Question Palette to go to that question directly.</p>
              <p>• Click on <b>Save &amp; Next</b> to save your answer for the current question and then go to the next question.</p>
              <p>• Click on <b>Mark for Review</b> to mark the question for review while remaining on the question.</p>
              <p className="font-bold text-gray-900 text-sm mt-3">2. Answering a Question:</p>
              <p>• To select your answer, click on the option row or radio button.</p>
              <p>• To deselect your chosen answer, click on the <b>Clear Selected Option</b> button.</p>
              <p>• To change your chosen answer, click on another option.</p>
              <p className="font-bold text-gray-900 text-sm mt-3">3. Navigating through Sections:</p>
              <p>• Sections in this paper are displayed above the question panel. Questions in a section can be viewed by clicking on the section name.</p>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="px-4 py-1.5 bg-[#2460b9] text-white text-xs font-bold rounded hover:bg-[#1c4d94] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUESTION PAPER MODAL ── */}
      {showQuestionPaper && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="text-white px-6 py-3.5 flex items-center justify-between bg-[#2460b9]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <h3 className="font-bold text-base">Question Paper - {chapter.chapter_title}</h3>
              </div>
              <button onClick={() => setShowQuestionPaper(false)} className="hover:bg-white/20 p-1 rounded">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {questions.map((q, idx) => (
                <div key={idx} className="border-b border-gray-200 pb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-[#2460b9]">Question {idx + 1}</span>
                    <span className="text-xs text-gray-500 font-medium">Marks: +2, -0.5</span>
                  </div>
                  <FormattedText
                    text={q.question}
                    language={language}
                    as="div"
                    className="text-sm text-gray-900 font-medium mb-3 whitespace-pre-line"
                    isQuestion={true}
                    subject={q.subject || q.section}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(Object.entries(q.options) as [string, string][]).map(([k, val]) => (
                      <div key={k} className="p-2 rounded border border-gray-200 bg-gray-50 text-gray-700 flex items-start gap-1.5">
                        <span className="uppercase font-bold shrink-0">{k}.</span>
                        <FormattedText text={val} language={language} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowQuestionPaper(false)}
                className="px-5 py-2 text-white text-xs font-bold rounded hover:opacity-90 bg-[#2460b9]"
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT QUESTION MODAL ── */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="text-white px-5 py-3.5 flex items-center justify-between bg-amber-600">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">Report Question No. {questionNumberInSection}</h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="hover:bg-white/20 p-1 rounded text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {reportSubmitted ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                  <p className="font-bold text-gray-800 text-sm">Feedback Received</p>
                  <p className="text-xs text-gray-500 mt-1">Thank you for reporting. Our team will review this question.</p>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="mt-4 px-4 py-2 bg-gray-800 text-white rounded text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600">Please choose the issue you found with this question:</p>
                  <div className="space-y-2 text-xs">
                    {[
                      'Incorrect Question or Solution',
                      'Wrong Options or Ambiguous Answer',
                      'Image / Formatting / Translation Error',
                      'Other Issue'
                    ].map(r => (
                      <label key={r} className="flex items-center gap-2.5 p-2 rounded border border-gray-200 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="radio"
                          name="reportReason"
                          checked={reportReason === r}
                          onChange={() => setReportReason(r)}
                          className="accent-blue-600"
                        />
                        <span className="text-gray-800 font-medium">{r}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => setShowReportModal(false)}
                      className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setReportSubmitted(true)}
                      className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded transition-colors"
                    >
                      Submit Report
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMIT TEST / FINISH PRACTICE MODAL ── */}
      <QuizSubmitModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onSubmit={handleSubmitTest}
        isSubmitting={isSubmitting}
        mode={mode}
        chapter={chapter}
        totalQuestions={totalQuestions}
        activeSection={activeSection}
        scorePractice={scorePractice}
        wrongPractice={wrongPractice}
        unattemptedPractice={unattemptedPractice}
        accuracyPractice={accuracyPractice}
        stats={stats}
      />

      {/* ── DELETE QUESTION CONFIRMATION MODAL ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg max-w-md w-full shadow-2xl border border-gray-300 overflow-hidden">
            <div className="bg-rose-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-sm sm:text-base">Delete Question Permanently</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">
                Are you sure you want to delete Question No. {questionNumberInSection}?
              </p>
              <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800 leading-relaxed">
                <p className="font-bold mb-1">Warning: Permanent Deletion Across Entire App</p>
                This question will be completely removed from this test and filtered out from all future practice and mock tests across the app and database.
              </div>
              <p className="text-xs text-gray-600 line-clamp-3 italic bg-gray-50 p-2.5 rounded border border-gray-200">
                "{getQuestionText()}"
              </p>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2.5">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 text-xs font-bold rounded hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting Everywhere...' : 'Delete Everywhere'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SYMBOLS LEGEND MODAL ── */}
      {showSymbolsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg max-w-md w-full shadow-2xl border border-gray-300 overflow-hidden">
            <div className="bg-[#0088cc] text-white px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base">Question Palette Symbols Legend</h3>
              <button
                onClick={() => setShowSymbolsModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-gray-700">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-[#2e7d32] text-white font-bold rounded flex items-center justify-center shrink-0">1</span>
                <span><b>Answered</b>: You have answered the question.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-[#c62828] text-white font-bold rounded flex items-center justify-center shrink-0">2</span>
                <span><b>Not Answered</b>: You have not answered the question.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-[#6a1b9a] text-white font-bold rounded flex items-center justify-center shrink-0">3</span>
                <span><b>Marked for Review</b>: You have marked the question for review without answering.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-[#d32f2f] text-white font-bold rounded flex items-center justify-center shrink-0">4</span>
                <span><b>Not Visited</b>: You have not visited the question yet.</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowSymbolsModal(false)}
                className="px-4 py-1.5 bg-[#0088cc] text-white text-xs font-bold rounded hover:bg-[#0077b3] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATION ── */}
      {deleteToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border border-slate-700 animate-in slide-in-from-bottom duration-200">
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>{deleteToast}</span>
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
