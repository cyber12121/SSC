import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  Bookmark, 
  BookmarkCheck, 
  Flag, 
  Check, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  ChevronDown, 
  Filter, 
  User, 
  RotateCcw, 
  Smile, 
  Frown, 
  AlertTriangle,
  BarChart3,
  FileText,
  HelpCircle,
  XCircle,
  CheckCircle2,
  Layers,
  Trash2,
  Sparkles,
  Target,
  Edit3,
  BookOpen,
  RotateCw,
  Info
} from 'lucide-react';
import { QuizResult, Question, QuestionProgress, RCATagType, RCAClassification } from '../types';
import { extractSolutionLanguage } from '../utils/cleanSolution';
import { normalizeAnswerKey } from '../utils/mathSanitizer';
import { getNormalizedOptions, getCorrectOptionKey } from '../utils/questionHelpers';
import { FormattedText } from './FormattedText';
import { SolutionViewer } from './SolutionViewer';
import { RcaClassifier } from './review/RcaClassifier';
import { safeStorage } from '../utils/safeStorage';
import { getLanguageText } from '../utils/formatQuestionText';
import { convertQuestionToSRSCardCandidate, addSRSCardsBatch } from '../utils/srsEngine';
import { SrsCardConfirmModal } from './srs/SrsCardConfirmModal';
import { SRSCard } from '../types/srs';
import { db, auth } from '../firebase';
import { collection, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { 
  RCA_TAG_CONFIG, 
  SILLY_SUB_TYPES, 
  getQuestionSillySubTypes, 
  matchesSillySubFilter, 
  getSillyPrimaryBadge, 
  generatePatternInsight 
} from '../utils/rcaHelper';

export const parseAvgTimeToSeconds = (rawTime?: string | number | null): number | null => {
  if (rawTime === undefined || rawTime === null) return null;
  if (typeof rawTime === 'number') {
    return isNaN(rawTime) || rawTime <= 0 ? null : Math.round(rawTime);
  }
  const str = String(rawTime).trim();
  if (!str) return null;

  // Format "MM:SS", "M:SS", or "HH:MM:SS"
  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseInt(p.trim(), 10));
    if (parts.some(p => isNaN(p))) return null;
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  // Raw numeric string e.g. "35" or "35s"
  const parsed = parseInt(str.replace(/[^0-9]/g, ''), 10);
  return isNaN(parsed) || parsed <= 0 ? null : parsed;
};

export interface ReviewSection {
  id: string;
  label: string;
  title: string;
  startIndex: number;
  endIndex: number;
  count: number;
  indices: number[];
}

interface ReviewViewProps {
  result: QuizResult;
  onReattempt: () => void;
  onBack: () => void;
  userName?: string;
  bookmarkedIds?: Set<number | string>;
  onBookmarkToggle?: (question: Question) => void;
  onViewAnalytics?: () => void;
  onDeleteQuestion?: (question: Question) => Promise<void> | void;
  onReattemptQuestions?: (title: string, questions: Question[]) => void;
  onUpdateResult?: (updatedResult: QuizResult) => void;
}

type FilterType = 
  | 'all' 
  | 'correct' 
  | 'slow' 
  | 'incorrect' 
  | 'unattempted' 
  | 'needs_rca' 
  | 'rca_c' 
  | 'rca_s'
  | 'rca_a' 
  | 'rca_t' 
  | 'rca_g';
type LanguageType = 'English' | 'Hindi' | 'Bilingual';

export const ReviewView: React.FC<ReviewViewProps> = ({ 
  result, 
  onReattempt, 
  onBack,
  userName = 'Candidate',
  bookmarkedIds = new Set(),
  onBookmarkToggle,
  onViewAnalytics,
  onDeleteQuestion,
  onReattemptQuestions,
  onUpdateResult
}) => {
  const [items, setItems] = useState<QuestionProgress[]>(() => result.questionDetails || []);

  useEffect(() => {
    setItems(result.questionDetails || []);
  }, [result]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState<string>('auto');
  const [reattemptMode, setReattemptMode] = useState(false);
  const [reattemptAnswers, setReattemptAnswers] = useState<Record<number, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [sillySubFilter, setSillySubFilter] = useState<string>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showReattemptMenu, setShowReattemptMenu] = useState(false);
  const [language, setLanguage] = useState<LanguageType>('English');
  const [showQuestionPaper, setShowQuestionPaper] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [localBookmarks, setLocalBookmarks] = useState<Set<number | string>>(new Set(bookmarkedIds));
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
  const [isFinishingReview, setIsFinishingReview] = useState(false);
  const [finishToast, setFinishToast] = useState<string | null>(null);
  const [srsCandidateCards, setSrsCandidateCards] = useState<Array<Partial<SRSCard>>>([]);
  const [srsModalOpen, setSrsModalOpen] = useState(false);
  const [srsToast, setSrsToast] = useState<string | null>(null);
  const [showSillyRevisionModal, setShowSillyRevisionModal] = useState<boolean>(false);
  const [revisedReviewKeys, setRevisedReviewKeys] = useState<Set<number>>(new Set());

  // isMockReview: only true for actual mock/error review sessions, not chapter bank quizzes
  const isMockReview = Boolean(
    result.chapter_title?.toLowerCase().includes('mock') ||
    result.category === 'mockErrors'
  );
  const [classifyModeEnabled, setClassifyModeEnabled] = useState<boolean>(true);
  const [rcaMap, setRcaMap] = useState<Record<number, RCAClassification>>(() => {
    const map: Record<number, RCAClassification> = {};
    (result.questionDetails || []).forEach((qd, idx) => {
      if (qd.rca) map[idx] = qd.rca;
      else if (qd.question?.rca) map[idx] = qd.question.rca;
    });

    try {
      if (typeof window !== 'undefined') {
        // Only load result.id scoped storage if it matches this specific result attempt
        if (result.id) {
          const saved = window.localStorage?.getItem(`cgl_rca_${result.id}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(map, parsed);
          }
        }
        // Match from global store BY QUESTION ID OR QUESTION TEXT, NOT by generic chapter_title numeric index!
        const globalRaw = window.localStorage?.getItem('cgl_rca_global_store');
        if (globalRaw) {
          const globalStore = JSON.parse(globalRaw);
          const globalEntries = Object.values(globalStore) as any[];
          (result.questionDetails || []).forEach((qd, idx) => {
            if (map[idx]) return;
            const q = qd.question;
            const qId = q?.id;
            const qText = q?.question ? q.question.trim().toLowerCase() : '';
            if (qId && globalStore[qId]) {
              map[idx] = globalStore[qId];
            } else if (qText && globalStore[qText]) {
              map[idx] = globalStore[qText];
            } else if (qText) {
              const matched = globalEntries.find(e => e?.questionText && e.questionText.trim().toLowerCase() === qText);
              if (matched) map[idx] = matched;
            }
          });
        }
      }
    } catch {}
    return map;
  });

  const [activeSillyNote, setActiveSillyNote] = useState<string>('');

  // Sync active silly note when moving between questions
  useEffect(() => {
    const currentRca = rcaMap[currentIdx] || items[currentIdx]?.rca || items[currentIdx]?.question?.rca;
    if (currentRca && (currentRca.tag === 'S' || (currentRca.tag as any) === 'A')) {
      setActiveSillyNote(currentRca.sillyMistakeNote || '');
    } else {
      setActiveSillyNote('');
    }
  }, [currentIdx, rcaMap]);

  const rcaStats = useMemo(() => {
    const counts: Record<string, number> = { C: 0, S: 0, T: 0, G: 0, total: 0 };
    Object.values(rcaMap).forEach((item: any) => {
      const tag = (item?.tag as any) === 'A' ? 'S' : item?.tag;
      if (tag && counts[tag] !== undefined) {
        counts[tag]++;
        counts.total++;
      }
    });
    return counts;
  }, [rcaMap]);

  const reviewSillySubTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      calculation: 0,
      misread: 0,
      option: 0,
      formula: 0,
      rushed: 0,
      unit: 0,
      custom: 0,
      unspecified: 0
    };
    items.forEach((it, idx) => {
      const qRca = rcaMap[idx] || it.rca || it.question?.rca;
      if (qRca?.tag === 'S' || (qRca?.tag as any) === 'A') {
        counts.all++;
        const types = getQuestionSillySubTypes({ ...(it.question || it), rca: qRca });
        types.forEach(t => {
          if (counts[t] !== undefined) counts[t]++;
        });
      }
    });
    return counts;
  }, [items, rcaMap]);

  const sillyQuestions = useMemo(() => {
    return items
      .filter((it, idx) => {
        const qRca = rcaMap[idx] || it.rca || it.question?.rca;
        return qRca?.tag === 'S' || (qRca?.tag as any) === 'A';
      })
      .map(it => it.question || it);
  }, [items, rcaMap]);

  const reviewPatternInsight = useMemo(() => {
    if (selectedFilter !== 'rca_s' && (selectedFilter as any) !== 'rca_a') return null;
    const targetQs = sillySubFilter === 'all' 
      ? sillyQuestions 
      : sillyQuestions.filter(q => matchesSillySubFilter(q, sillySubFilter));
    return generatePatternInsight(targetQs, sillySubFilter);
  }, [selectedFilter, sillySubFilter, sillyQuestions]);

  // Silly mistake items formatted for Revision Sheet (habits, slips & typed notes only, NOT questions)
  const reviewSillyMistakesList = useMemo(() => {
    return items
      .map((it, idx) => {
        const qRca = rcaMap[idx] || it.rca || it.question?.rca;
        const tag = (qRca?.tag as any) === 'A' ? 'S' : qRca?.tag;
        if (tag !== 'S') return null;
        const q = it.question || it;
        if (sillySubFilter !== 'all' && !matchesSillySubFilter({ ...q, rca: qRca }, sillySubFilter)) {
          return null;
        }
        const subTypes = getQuestionSillySubTypes({ ...q, rca: qRca });
        const primarySub = subTypes[0] || qRca?.subTag || 'unspecified';
        const subConfig = SILLY_SUB_TYPES[primarySub] || SILLY_SUB_TYPES.unspecified;
        const typedNote = (qRca?.note || qRca?.sillyMistakeNote || (q as any).sillyMistakeNote || (q as any).userTypedSillyNote || '').trim();
        return {
          questionIndex: idx,
          displayNum: idx + 1,
          question: q,
          rca: qRca,
          primarySub,
          subConfig,
          typedNote,
          topic: (q as any).topic || result.chapter_title || 'Mock Test',
          timeTaken: it.timeTaken
        };
      })
      .filter(Boolean) as Array<{
        questionIndex: number;
        displayNum: number;
        question: Question;
        rca: RCAClassification;
        primarySub: string;
        subConfig: typeof SILLY_SUB_TYPES[string];
        typedNote: string;
        topic: string;
        timeTaken?: number;
      }>;
  }, [items, rcaMap, sillySubFilter, result.chapter_title]);

  // Robust persistence helper for RCA classifications
  const persistRcaUpdate = (updatedMap: Record<number, RCAClassification>, targetIdx: number, newRca?: RCAClassification, isClear: boolean = false) => {
    try {
      if (typeof window === 'undefined') return;

      if (result.id) {
        window.localStorage?.setItem(`cgl_rca_${result.id}`, JSON.stringify(updatedMap));
      }
      if (result.chapter_title) {
        window.localStorage?.setItem(`cgl_rca_${result.chapter_title}`, JSON.stringify(updatedMap));
      }

      // Update global store for Error Heatmap & Sankalp AI
      const globalRaw = window.localStorage?.getItem('cgl_rca_global_store');
      const globalStore: Record<string, any> = globalRaw ? JSON.parse(globalRaw) : {};

      const it = items[targetIdx];
      const q = it?.question || ({} as Question);
      const qId = q.id || (result.id ? `${result.id}_${targetIdx + 1}` : `mock_${targetIdx + 1}`);
      const qTextNorm = q.question ? q.question.trim().toLowerCase() : '';

      if (isClear || !newRca) {
        delete globalStore[qId];
        if (qTextNorm) delete globalStore[qTextNorm];
      } else {
        const fullEntry = {
          ...newRca,
          id: qId,
          q_num: targetIdx + 1,
          mockId: result.id,
          mockTitle: result.chapter_title,
          subject: q.subject || result.subject || 'General Awareness',
          topic: q.tags?.topic || (q as any).topic || 'General',
          questionText: q.question,
          options: q.options,
          answer: q.answer,
          solution: q.solution,
          image: q.image,
          userAnswer: it?.selectedAnswer || (it as any)?.userAnswer || '',
          selectedAnswer: it?.selectedAnswer || (it as any)?.userAnswer || '',
          chosenOption: it?.selectedAnswer || (it as any)?.userAnswer || '',
          isCorrect: it?.isCorrect,
          isSlow: it?.isSlow,
          status: (it as any)?.status || (it?.isSlow ? 'slow' : (it?.isCorrect ? 'correct' : (it?.selectedAnswer ? 'wrong' : 'unattempted'))),
          errorType: it?.isSlow ? 'speed_issue' : (it?.isCorrect ? 'correct' : (it?.selectedAnswer ? 'wrong' : 'unattempted')),
          timeSpent: it?.timeSpent,
          userTime: it?.timeSpent,
          avgTime: q.avgTime ?? (it as any)?.avgTime,
          avgTimeSeconds: q.avgTimeSeconds ?? (it as any)?.avgTimeSeconds
        };

        globalStore[qId] = fullEntry;
        if (qTextNorm) {
          globalStore[qTextNorm] = fullEntry;
        }
      }

      window.localStorage?.setItem('cgl_rca_global_store', JSON.stringify(globalStore));

      // Update mock questions array in localStorage and trigger background persistence
      if (result.id && !result.id.startsWith('local-')) {
        const cachedRaw = window.localStorage?.getItem(`cgl_mock_questions_${result.id}`);
        let cachedList: any[] = [];
        if (cachedRaw) {
          try { cachedList = JSON.parse(cachedRaw); } catch {}
        }
        if (!Array.isArray(cachedList) || cachedList.length === 0) {
          cachedList = items.map((item, idx) => ({
            ...(item.question || {}),
            q_num: idx + 1,
            userAnswer: item.selectedAnswer || (item as any).userAnswer || '',
            selectedAnswer: item.selectedAnswer || (item as any).userAnswer || '',
            chosenOption: item.selectedAnswer || (item as any).userAnswer || '',
            isCorrect: item.isCorrect,
            isSlow: item.isSlow,
            status: (item as any).status || (item.isSlow ? 'slow' : (item.isCorrect ? 'correct' : (item.selectedAnswer ? 'wrong' : 'unattempted'))),
            errorType: item.isSlow ? 'speed_issue' : (item.isCorrect ? 'correct' : (item.selectedAnswer ? 'wrong' : 'unattempted')),
            timeSpent: item.timeSpent,
            userTime: item.timeSpent,
            rca: updatedMap[idx] || item.rca || item.question?.rca || undefined
          }));
        } else if (cachedList[targetIdx]) {
          cachedList[targetIdx].rca = isClear ? undefined : newRca;
        }

        window.localStorage?.setItem(`cgl_mock_questions_${result.id}`, JSON.stringify(cachedList));

        // Background sync to backend disk storage
        fetch(`/api/mock-questions/${encodeURIComponent(result.id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cachedList)
        }).catch(() => {});
      }

      // Notify other views (ErrorHeatmap, Dashboard) immediately
      window.dispatchEvent(new CustomEvent('cgl_rca_updated', {
        detail: { qId, qTextNorm, rca: isClear ? null : newRca }
      }));
    } catch (e) {
      console.error('Error persisting RCA:', e);
    }
  };

  const handleSelectRcaTag = (tag: RCATagType) => {
    const effectiveTag = (tag as any) === 'A' ? 'S' : tag;
    const tagNames: Record<RCATagType, RCAClassification['tagName']> = {
      C: 'Conceptual Gap',
      S: 'Silly Mistake',
      T: 'Time / Ego Trap',
      G: 'Guesswork Failed'
    };

    const newRca: RCAClassification = {
      tag: effectiveTag,
      tagName: tagNames[effectiveTag],
      sillyMistakeNote: effectiveTag === 'S' ? (activeSillyNote || rcaMap[currentIdx]?.sillyMistakeNote || '') : undefined,
      classifiedAt: new Date().toISOString()
    };

    const updated = { ...rcaMap, [currentIdx]: newRca };
    setRcaMap(updated);
    if (items[currentIdx]) items[currentIdx].rca = newRca;
    if (items[currentIdx]?.question) items[currentIdx].question!.rca = newRca;

    persistRcaUpdate(updated, currentIdx, newRca, false);
  };

  const handleClearRcaTag = () => {
    const updated = { ...rcaMap };
    delete updated[currentIdx];
    setRcaMap(updated);
    if (items[currentIdx]) items[currentIdx].rca = undefined;
    if (items[currentIdx]?.question) items[currentIdx].question!.rca = undefined;

    persistRcaUpdate(updated, currentIdx, undefined, true);
  };

  const handleSaveSillyNote = (note: string) => {
    setActiveSillyNote(note);
    if (rcaMap[currentIdx]?.tag === 'S' || (rcaMap[currentIdx]?.tag as any) === 'A') {
      const updatedRca: RCAClassification = {
        ...rcaMap[currentIdx],
        tag: 'S',
        sillyMistakeNote: note,
        classifiedAt: new Date().toISOString()
      };
      const updated = { ...rcaMap, [currentIdx]: updatedRca };
      setRcaMap(updated);
      if (items[currentIdx]) items[currentIdx].rca = updatedRca;
      if (items[currentIdx]?.question) items[currentIdx].question!.rca = updatedRca;

      persistRcaUpdate(updated, currentIdx, updatedRca, false);
    }
  };

  const handleToggleSillyChip = (chipText: string) => {
    const rawTokens = activeSillyNote
      ? activeSillyNote.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const exists = rawTokens.some(t => t.toLowerCase() === chipText.toLowerCase());
    let nextTokens: string[];
    if (exists) {
      nextTokens = rawTokens.filter(t => t.toLowerCase() !== chipText.toLowerCase());
    } else {
      nextTokens = [...rawTokens, chipText];
    }
    handleSaveSillyNote(nextTokens.join(', '));
  };

  const handleFinishReview = async () => {
    setIsFinishingReview(true);
    try {
      // 1. Flush any active silly note on the current question if tag is 'S' or 'A'
      let currentRcaMap = { ...rcaMap };
      if ((currentRcaMap[currentIdx]?.tag === 'S' || (currentRcaMap[currentIdx]?.tag as any) === 'A') && activeSillyNote) {
        currentRcaMap[currentIdx] = {
          ...currentRcaMap[currentIdx],
          tag: 'S',
          sillyMistakeNote: activeSillyNote,
          classifiedAt: new Date().toISOString()
        };
        setRcaMap(currentRcaMap);
      }

      // 2. Persist to localStorage
      if (typeof window !== 'undefined') {
        if (result.id && !result.id.startsWith('local-')) {
          window.localStorage?.setItem(`cgl_rca_${result.id}`, JSON.stringify(currentRcaMap));
        }

        // Update global store for Error Heatmap & Sankalp AI
        const globalRaw = window.localStorage?.getItem('cgl_rca_global_store');
        const globalStore: Record<string, any> = globalRaw ? JSON.parse(globalRaw) : {};
        items.forEach((item, idx) => {
          const rca = currentRcaMap[idx] || item.rca || item.question?.rca;
          if (rca) {
            const q = item.question || ({} as Question);
            const qId = q.id || (result.id ? `${result.id}_${idx + 1}` : `mock_${idx + 1}`);
            const qTextNorm = q.question ? q.question.trim().toLowerCase() : '';
            const entry = {
              ...rca,
              id: qId,
              q_num: idx + 1,
              mockId: result.id,
              mockTitle: result.chapter_title,
              subject: q.subject || result.subject || 'General Awareness',
              topic: q.tags?.topic || (q as any).topic || 'General',
              questionText: q.question,
              options: q.options,
              answer: q.answer,
              solution: q.solution,
              image: q.image,
              userAnswer: item.selectedAnswer || (item as any)?.userAnswer || '',
              selectedAnswer: item.selectedAnswer || (item as any)?.userAnswer || '',
              chosenOption: item.selectedAnswer || (item as any)?.userAnswer || '',
              isCorrect: item.isCorrect,
              isSlow: item.isSlow,
              status: (item as any)?.status || (item.isSlow ? 'slow' : (item.isCorrect ? 'correct' : (item.selectedAnswer ? 'wrong' : 'unattempted'))),
              errorType: item.isSlow ? 'speed_issue' : (item.isCorrect ? 'correct' : (item.selectedAnswer ? 'wrong' : 'unattempted')),
              timeSpent: item.timeSpent,
              userTime: item.timeSpent
            };
            globalStore[qId] = entry;
            if (qTextNorm) globalStore[qTextNorm] = entry;
          }
        });
        window.localStorage?.setItem('cgl_rca_global_store', JSON.stringify(globalStore));
        window.dispatchEvent(new CustomEvent('cgl_rca_updated', { detail: { count: Object.keys(currentRcaMap).length } }));

        // Update cached mock questions in localStorage with full attempt metadata
        let cachedExisting: any[] = [];
        if (result.id) {
          const cachedRaw = window.localStorage?.getItem(`cgl_mock_questions_${result.id}`);
          if (cachedRaw) {
            try {
              cachedExisting = JSON.parse(cachedRaw);
            } catch {}
          }
        }

        const questionsToSave = items.map((it, idx) => {
          const existingQ = (Array.isArray(cachedExisting) && cachedExisting[idx]) || {};
          const q = it.question ? { ...it.question } : { ...existingQ };
          const rca = currentRcaMap[idx] || it.rca || q.rca;
          
          // Use ONLY the current attempt's answer — do NOT pull from existingQ.userAnswer etc.,
          // as that is stale data from a previous session and would overwrite an unattempted
          // question with a wrong cached answer, breaking the second-review palette.
          const selectedAnswer = it.selectedAnswer || (it as any).userAnswer || '';
          const derivedStatus = (it as any).status || (it.isCorrect ? 'correct' : (selectedAnswer ? 'wrong' : 'unattempted'));
          const isSlow = (it as any).isSlow ?? (derivedStatus === 'slow');
          const isCorrect = it.isCorrect ?? (derivedStatus === 'correct' || derivedStatus === 'slow');
          const timeSpent = typeof it.timeSpent === 'number' ? it.timeSpent : (typeof existingQ.timeSpent === 'number' ? existingQ.timeSpent : (existingQ.userTime || 0));

          return {
            ...existingQ,
            ...q,
            userAnswer: selectedAnswer,
            selectedAnswer: selectedAnswer,
            chosenOption: selectedAnswer,
            status: isSlow ? 'slow' : (isCorrect ? 'correct' : (selectedAnswer ? 'wrong' : 'unattempted')),
            errorType: (it as any).errorType || (isSlow ? 'slow' : (isCorrect ? 'correct' : (selectedAnswer ? 'wrong' : 'unattempted'))),
            isCorrect,
            isSlow,
            timeSpent,
            userTime: timeSpent,
            avgTime: q.avgTime ?? (it as any).avgTime ?? existingQ.avgTime,
            avgTimeSeconds: q.avgTimeSeconds ?? (it as any).avgTimeSeconds ?? existingQ.avgTimeSeconds,
            rca: rca || undefined
          };
        });

        if (result.id && !result.id.startsWith('local-')) {
          window.localStorage?.setItem(`cgl_mock_questions_${result.id}`, JSON.stringify(questionsToSave));
          
          // 3. Post to backend /api/mock-questions/:id so disk storage also persists full attempts & RCA tags
          try {
            await fetch(`/api/mock-questions/${encodeURIComponent(result.id)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(questionsToSave)
            });
          } catch (postErr) {
            console.warn('Backend sync failed, saved locally:', postErr);
          }
        }

        // 4. Safe Firestore Sync for Silly Mistakes & RCA (In-place update preserving exact document ID)
        if (auth.currentUser && result.id && !result.id.startsWith('guest-')) {
          try {
            const targetDocId = result.id;
            const updatedQuestionDetails = items.map((it, idx) => {
              const rca = currentRcaMap[idx] || it.rca || it.question?.rca;
              return {
                q_num: it.q_num,
                timeSpent: it.timeSpent || 0,
                isCorrect: Boolean(it.isCorrect),
                selectedAnswer: it.selectedAnswer || '',
                marked: Boolean(it.marked),
                avgTime: it.avgTime || it.question?.avgTime || null,
                avgTimeSeconds: it.avgTimeSeconds || it.question?.avgTimeSeconds || null,
                rca: rca || null,
                question: it.question ? {
                  id: it.question.id || `${result.chapter_title}_${it.q_num}`,
                  q_num: it.question.q_num || it.q_num,
                  question: it.question.question || '',
                  options: it.question.options || { a: '', b: '', c: '', d: '' },
                  answer: it.question.answer || 'a',
                  subject: it.question.subject || result.subject || '',
                  section: it.question.section || '',
                  topic: it.question.topic || it.question.tags?.topic || '',
                  rca: rca || null,
                } : null
              };
            });

            const updatedDocData: any = {
              userId: auth.currentUser.uid,
              score: typeof result.score === 'number' ? result.score : 0,
              totalQuestions: typeof result.totalQuestions === 'number' ? result.totalQuestions : items.length,
              totalTime: typeof result.totalTime === 'number' ? result.totalTime : 0,
              completedAt: result.completedAt || new Date().toISOString(),
              chapter_title: result.chapter_title || 'Mock Test',
              subject: result.subject || 'Full Mock',
              category: result.category || 'mockErrors',
              questionDetails: updatedQuestionDetails,
              rcaMap: currentRcaMap
            };
            if (result.mode) updatedDocData.mode = result.mode;

            const sanitized = JSON.parse(JSON.stringify(updatedDocData));

            // CRITICAL FIX: Update the EXISTING document in-place.
            // Never call addDoc here, which creates new duplicate documents on every review!
            if (!targetDocId.startsWith('local-')) {
              try {
                await setDoc(doc(db, 'results', targetDocId), sanitized, { merge: true });
              } catch (setErr: any) {
                console.warn('In-place setDoc failed, attempting recreate on same ID:', setErr);
                try {
                  await deleteDoc(doc(db, 'results', targetDocId));
                  await setDoc(doc(db, 'results', targetDocId), sanitized);
                } catch (fallbackErr) {
                  console.error('Firestore cloud update failed (permission denied):', fallbackErr);
                  throw fallbackErr;
                }
              }
            }

            // Update user cache in localStorage
            try {
              const cacheKey = `cgl_user_results_cache_${auth.currentUser.uid}`;
              const cachedRaw = safeStorage.getItem(cacheKey);
              if (cachedRaw) {
                const cachedResults: QuizResult[] = JSON.parse(cachedRaw);
                const updatedCache = cachedResults.map(r => {
                  if (r.id === targetDocId) {
                    return { ...r, questionDetails: updatedQuestionDetails, rcaMap: currentRcaMap };
                  }
                  return r;
                });
                safeStorage.setItem(cacheKey, JSON.stringify(updatedCache.slice(0, 100)));
              }
            } catch {}

            // Update parent state so subsequent reviews use the updated object directly
            if (onUpdateResult) {
              onUpdateResult({
                ...result,
                questionDetails: updatedQuestionDetails,
                rcaMap: currentRcaMap
              });
            }
          } catch (cloudErr: any) {
            console.error('Cloud sync for RCA review failed:', cloudErr);
            if (cloudErr?.code === 'permission-denied' || String(cloudErr?.message).includes('permission')) {
              console.warn('[Firestore] Permission denied: please ensure "allow update" is published in Firebase Console under Firestore Rules.');
            }
          }
        }
      }

      const totalTagged = Object.keys(currentRcaMap).length;
      setFinishToast(`Review Saved! ${totalTagged} questions tagged with RCA reasons.`);
      setTimeout(() => {
        setFinishToast(null);
        onBack();
      }, 1200);
    } catch (e) {
      console.error('Failed to finish review:', e);
      setFinishToast('Review saved locally.');
      setTimeout(() => {
        setFinishToast(null);
        onBack();
      }, 1000);
    } finally {
      setIsFinishingReview(false);
    }
  };

  // Pre-index avgTime and userTime from bundled mock questions or localStorage
  const [mockAvgTimeMap, setMockAvgTimeMap] = useState<Map<string, number>>(new Map());
  const [mockUserTimeMap, setMockUserTimeMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let isCancelled = false;
    const loadMockTimes = async () => {
      const avgMap = new Map<string, number>();
      const userMap = new Map<string, number>();

      // 1. Check if there is data in localStorage for mock reports
      try {
        const allKeys = safeStorage.getAllKeys();
        for (const key of allKeys) {
          if (key && key.startsWith('cgl_mock_questions_')) {
            const raw = safeStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                list.forEach((item: any) => {
                  const text = (item.question || item.questionText || item.qText || '').trim().toLowerCase();
                  const parsedAvg = parseAvgTimeToSeconds(item.avgTime || item.avg_time || item.avgTimeSeconds);
                  if (parsedAvg !== null) {
                    if (text) avgMap.set(text, parsedAvg);
                    if (item.id) avgMap.set(String(item.id), parsedAvg);
                  }
                  const parsedUser = parseAvgTimeToSeconds(item.userTime || item.user_time || item.timeSpent || item.timeTaken);
                  if (parsedUser !== null && parsedUser > 0) {
                    if (text) userMap.set(text, parsedUser);
                    if (item.id) userMap.set(String(item.id), parsedUser);
                  }
                });
              }
            }
          }
        }
      } catch {}

      if (!isCancelled) {
        if (avgMap.size > 0) setMockAvgTimeMap(avgMap);
        if (userMap.size > 0) setMockUserTimeMap(userMap);
      }
    };

    loadMockTimes();
    return () => { isCancelled = true; };
  }, []);

  const handleConfirmDelete = async () => {
    const currentQ = items[currentIdx]?.question;
    if (!currentQ) return;
    setIsDeleting(true);
    try {
      if (onDeleteQuestion) {
        await onDeleteQuestion(currentQ);
      }

      const qTextClean = (currentQ.question || '').trim().toLowerCase();
      const qId = currentQ.id;

      // 1. Remove from local items state
      const nextItems = items.filter((item, idx) => {
        if (idx === currentIdx) return false;
        const itText = (item.question?.question || '').trim().toLowerCase();
        if (qTextClean && itText === qTextClean) return false;
        if (qId && item.question?.id === qId) return false;
        return true;
      });

      // 2. Also keep result.questionDetails in sync
      if (result.questionDetails) {
        result.questionDetails = nextItems;
      }

      setItems(nextItems);

      // 3. Adjust currentIdx if it is now out of bounds
      if (currentIdx >= nextItems.length) {
        setCurrentIdx(Math.max(0, nextItems.length - 1));
      }

      // 4. Update rcaMap and shift higher indices down by 1
      setRcaMap(prev => {
        const next: Record<number, RCAClassification> = {};
        Object.entries(prev).forEach(([kStr, val]) => {
          const k = Number(kStr);
          if (k < currentIdx) {
            next[k] = val as RCAClassification;
          } else if (k > currentIdx) {
            next[k - 1] = val as RCAClassification;
          }
        });
        return next;
      });

      // 5. Shift reattempt answers down by 1
      setReattemptAnswers(prev => {
        const next: Record<number, string> = {};
        Object.entries(prev).forEach(([kStr, val]) => {
          const k = Number(kStr);
          if (k < currentIdx) {
            next[k] = val as string;
          } else if (k > currentIdx) {
            next[k - 1] = val as string;
          }
        });
        return next;
      });

      // 6. Purge from cgl_rca_global_store
      try {
        const globalRaw = window.localStorage?.getItem('cgl_rca_global_store');
        if (globalRaw) {
          const globalStore = JSON.parse(globalRaw);
          const questionIdentifier = qId || (result.id ? `${result.id}_${currentIdx + 1}` : `mock_${currentIdx + 1}`);
          delete globalStore[questionIdentifier];
          if (qTextClean) delete globalStore[qTextClean];
          window.localStorage?.setItem('cgl_rca_global_store', JSON.stringify(globalStore));
        }
      } catch {}

      // 7. If mock result, update cached mock questions in localStorage & server
      if (result.id) {
        try {
          const cachedRaw = window.localStorage?.getItem(`cgl_mock_questions_${result.id}`);
          if (cachedRaw) {
            const list = JSON.parse(cachedRaw);
            if (Array.isArray(list)) {
              const updatedList = list.filter((q: any) => {
                const t = (q.question || q.questionText || '').trim().toLowerCase();
                return t !== qTextClean && (!qId || q.id !== qId);
              });
              window.localStorage?.setItem(`cgl_mock_questions_${result.id}`, JSON.stringify(updatedList));
              fetch(`/api/mock-questions/${encodeURIComponent(result.id)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedList)
              }).catch(() => {});
            }
          }
        } catch {}
      }

      setDeletedIndices(prev => new Set(prev).add(currentIdx));
      setShowDeleteModal(false);
      setDeleteToast('Question permanently deleted everywhere.');
      setTimeout(() => setDeleteToast(null), 3500);
    } catch (e) {
      console.error('Error deleting question:', e);
      alert('Failed to delete question. Please check connection and try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to map question to SSC canonical section keys
  const getQuestionSectionKey = (q?: Question): 'part_a' | 'part_b' | 'part_c' | 'part_d' | null => {
    if (!q) return null;
    const explicitSec = (q as any).section;
    if (explicitSec === 'part_a' || explicitSec === 'part_b' || explicitSec === 'part_c' || explicitSec === 'part_d') {
      return explicitSec;
    }
    const raw = String((q as any).subject || (q as any).subjectName || q.tags?.topic || '');
    if (/reason|intel/i.test(raw)) return 'part_a';
    if (/aware|gk|gs|ga|knowledge/i.test(raw)) return 'part_b';
    if (/quant|math|aptitude/i.test(raw)) return 'part_c';
    if (/eng/i.test(raw)) return 'part_d';
    return null;
  };

  // Compute sections dynamically from question details
  const sections: ReviewSection[] = useMemo(() => {
    const raw = items || [];
    const total = raw.length;
    if (total === 0) return [];

    const partAIndices: number[] = [];
    const partBIndices: number[] = [];
    const partCIndices: number[] = [];
    const partDIndices: number[] = [];
    const otherIndices: number[] = [];

    raw.forEach((it, idx) => {
      const sec = getQuestionSectionKey(it.question);
      if (sec === 'part_a') partAIndices.push(idx);
      else if (sec === 'part_b') partBIndices.push(idx);
      else if (sec === 'part_c') partCIndices.push(idx);
      else if (sec === 'part_d') partDIndices.push(idx);
      else otherIndices.push(idx);
    });

    const hasExplicit = (partAIndices.length + partBIndices.length + partCIndices.length + partDIndices.length) > 0;

    // 1. Explicit or detected section tags
    if (hasExplicit) {
      if (otherIndices.length > 0) {
        if (partAIndices.length > 0) partAIndices.push(...otherIndices);
        else if (partBIndices.length > 0) partBIndices.push(...otherIndices);
        else if (partCIndices.length > 0) partCIndices.push(...otherIndices);
        else if (partDIndices.length > 0) partDIndices.push(...otherIndices);
        else partAIndices.push(...otherIndices);
      }

      const list: ReviewSection[] = [];
      if (partAIndices.length > 0) {
        list.push({
          id: 'part_a',
          label: 'PART-A',
          title: 'General Intelligence and Reasoning',
          startIndex: partAIndices[0],
          endIndex: partAIndices[partAIndices.length - 1] + 1,
          count: partAIndices.length,
          indices: partAIndices
        });
      }
      if (partBIndices.length > 0) {
        list.push({
          id: 'part_b',
          label: 'PART-B',
          title: 'General Awareness',
          startIndex: partBIndices[0],
          endIndex: partBIndices[partBIndices.length - 1] + 1,
          count: partBIndices.length,
          indices: partBIndices
        });
      }
      if (partCIndices.length > 0) {
        list.push({
          id: 'part_c',
          label: 'PART-C',
          title: 'Quantitative Aptitude',
          startIndex: partCIndices[0],
          endIndex: partCIndices[partCIndices.length - 1] + 1,
          count: partCIndices.length,
          indices: partCIndices
        });
      }
      if (partDIndices.length > 0) {
        list.push({
          id: 'part_d',
          label: 'PART-D',
          title: 'English Comprehension',
          startIndex: partDIndices[0],
          endIndex: partDIndices[partDIndices.length - 1] + 1,
          count: partDIndices.length,
          indices: partDIndices
        });
      }
      if (list.length > 0) return list;
    }

    // 2. Standard 100 questions SSC Full Mock (25 each)
    if (total === 100) {
      return [
        { id: 'part_a', label: 'PART-A', title: 'General Intelligence and Reasoning', startIndex: 0, endIndex: 25, count: 25, indices: Array.from({ length: 25 }, (_, i) => i) },
        { id: 'part_b', label: 'PART-B', title: 'General Awareness', startIndex: 25, endIndex: 50, count: 25, indices: Array.from({ length: 25 }, (_, i) => i + 25) },
        { id: 'part_c', label: 'PART-C', title: 'Quantitative Aptitude', startIndex: 50, endIndex: 75, count: 25, indices: Array.from({ length: 25 }, (_, i) => i + 50) },
        { id: 'part_d', label: 'PART-D', title: 'English Comprehension', startIndex: 75, endIndex: 100, count: 25, indices: Array.from({ length: 25 }, (_, i) => i + 75) },
      ];
    }

    // 3. Fallback: single section
    return [
      {
        id: 'part_all',
        label: result.subject || 'Section',
        title: result.chapter_title || result.subject || 'Questions',
        startIndex: 0,
        endIndex: total,
        count: total,
        indices: Array.from({ length: total }, (_, i) => i)
      }
    ];
  }, [items, result.subject, result.chapter_title]);

  // Track the current section that contains currentIdx
  const currentSection = useMemo(() => {
    return sections.find(s => s.indices.includes(currentIdx)) || sections[0] || {
      id: 'part_all',
      label: result.subject || 'Section',
      title: result.chapter_title || result.subject || 'Questions',
      startIndex: 0,
      endIndex: items.length,
      count: items.length,
      indices: items.map((_, i) => i)
    };
  }, [sections, currentIdx, items, result.subject, result.chapter_title]);

  // Keep activeSectionId in sync with currentIdx if in auto mode
  useEffect(() => {
    if (activeSectionId !== 'all') {
      const match = sections.find(s => s.indices.includes(currentIdx));
      if (match && match.id !== activeSectionId) {
        setActiveSectionId(match.id);
      }
    }
  }, [currentIdx, sections, activeSectionId]);

  // Active section for display
  const activeSection = useMemo(() => {
    if (activeSectionId === 'all') {
      return {
        id: 'all',
        label: 'ALL',
        title: 'All Sections',
        startIndex: 0,
        endIndex: items.length,
        count: items.length,
        indices: items.map((_, i) => i)
      };
    }
    const found = sections.find(s => s.id === activeSectionId);
    return found || currentSection;
  }, [activeSectionId, sections, currentSection, items]);

  const activeIndices = activeSection.indices;
  const questionNumberInSection = activeIndices.indexOf(currentIdx) + 1;

  const current = items[currentIdx];
  const question = current?.question;
  const currentRca: RCAClassification | undefined = rcaMap[currentIdx] || current?.rca || question?.rca;

  const handleBookmarkClick = () => {
    if (!question) return;
    if (onBookmarkToggle) {
      onBookmarkToggle(question);
    }
    const textKey = (question.question || '').trim().toLowerCase();
    setLocalBookmarks(prev => {
      const next = new Set(prev);
      const isMarked = (textKey && next.has(textKey)) || next.has(question.q_num);
      if (isMarked) {
        if (textKey) next.delete(textKey);
        next.delete(question.q_num);
      } else {
        if (textKey) next.add(textKey);
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

  // Question stats calculation
  const getQuestionStatus = (idx: number): 'correct' | 'wrong' | 'unattempted' | 'slow' => {
    const item = items[idx];
    if (!item) return 'unattempted';
    if (reattemptMode && reattemptAnswers[idx]) {
      const targetAns = normalizeAnswerKey(item.question?.answer || (item.question as any)?.correct_answer || (item.question as any)?.correctOption);
      return normalizeAnswerKey(reattemptAnswers[idx]) === targetAns ? 'correct' : 'wrong';
    }
    const q = (item.question || {}) as any;

    // Prioritise explicit status tags (from saved mock_questions JSON or handleFinishReview)
    const qStatus = String((item as any).status || (item as any).errorType || '').toLowerCase();

    // The user's chosen answer for THIS attempt — ONLY from QuestionProgress fields.
    // Do NOT fall back to q.userAnswer / q.chosenOption: those are stale fields from the
    // mock question JSON of a previous session and would incorrectly mark unattempted qs.
    const rawUser = String(
      item.selectedAnswer ||
      (item as any).userAnswer ||
      ''
    ).trim().toLowerCase();

    // 1. Unattempted / Skipped (evaluated first so we never misclassify empty answers)
    if (
      qStatus.includes('unattempt') ||
      qStatus.includes('skip') ||
      qStatus.includes('left') ||
      qStatus === 'not attempted' ||
      rawUser === 'unattempted' ||
      rawUser === 'skipped' ||
      rawUser === 'not attempted' ||
      (!rawUser && !qStatus)   // no answer + no explicit status → unattempted
    ) {
      // Edge-case: if isCorrect is explicitly true (shouldn't happen but be safe), treat as correct
      if (item.isCorrect === true) return 'correct';
      return 'unattempted';
    }

    // 2. Slow / Speed Issue (Correct, but took too long)
    if (
      qStatus.includes('slow') ||
      qStatus.includes('speed') ||
      (item as any).isSlow === true ||
      q.isSlow === true
    ) {
      return 'slow';
    }

    // 3. Explicit status tags for correct/wrong
    if (qStatus.includes('correct') && !qStatus.includes('incorrect')) return 'correct';
    if (qStatus === 'right') return 'correct';
    if (qStatus.includes('wrong') || qStatus.includes('incorrect')) return 'wrong';

    // 4. Use isCorrect field (most reliable for QuizContainer-generated QuizResult)
    if (item.isCorrect === true) return 'correct';
    if (item.isCorrect === false) {
      // Only classify as wrong if a user answer was actually recorded
      if (rawUser && rawUser !== 'unattempted' && rawUser !== 'skipped') return 'wrong';
      return 'unattempted';
    }

    // 5. Final fallback
    return 'unattempted';
  };

  // Question stats calculation
  const totalQuestions = items.length;
  const correctCount = items.filter((_, idx) => getQuestionStatus(idx) === 'correct').length;
  const slowCount = items.filter((_, idx) => getQuestionStatus(idx) === 'slow').length;
  const wrongCount = items.filter((_, idx) => getQuestionStatus(idx) === 'wrong').length;
  const unattemptedCount = totalQuestions - correctCount - slowCount - wrongCount;
  const partiallyCorrectCount = 0; // standard mock has single-correct

  // Section specific stats
  const sectionQuestionsCount = activeIndices.length;
  const sectionCorrectCount = activeIndices.filter(idx => getQuestionStatus(idx) === 'correct').length;
  const sectionSlowCount = activeIndices.filter(idx => getQuestionStatus(idx) === 'slow').length;
  const sectionWrongCount = activeIndices.filter(idx => getQuestionStatus(idx) === 'wrong').length;
  const sectionUnattemptedCount = sectionQuestionsCount - sectionCorrectCount - sectionSlowCount - sectionWrongCount;

  // RCA specific stats
  const sectionNeedsRcaCount = activeIndices.filter(idx => {
    const st = getQuestionStatus(idx);
    const qRca = rcaMap[idx] || items[idx]?.rca || items[idx]?.question?.rca;
    return (st === 'wrong' || st === 'slow' || st === 'unattempted') && !qRca;
  }).length;
  const overallNeedsRcaCount = items.filter((_, idx) => {
    const st = getQuestionStatus(idx);
    const qRca = rcaMap[idx] || items[idx]?.rca || items[idx]?.question?.rca;
    return (st === 'wrong' || st === 'slow' || st === 'unattempted') && !qRca;
  }).length;

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
    return getLanguageText(text, language);
  };

  // Format solution text
  const formatSolutionText = (sol: string = '') => {
    if (!sol) return '';
    return extractSolutionLanguage(sol, language);
  };

  // Filter questions for the active section palette
  const filteredIndices = activeIndices.filter(idx => {
    if (selectedFilter === 'all') return true;
    const status = getQuestionStatus(idx);
    const qRca = rcaMap[idx] || items[idx]?.rca || items[idx]?.question?.rca;
    if (selectedFilter === 'correct') return status === 'correct';
    if (selectedFilter === 'slow') return status === 'slow';
    if (selectedFilter === 'incorrect') return status === 'wrong';
    if (selectedFilter === 'unattempted') return status === 'unattempted';
    if (selectedFilter === 'needs_rca') return (status === 'wrong' || status === 'slow' || status === 'unattempted') && !qRca;
    if (selectedFilter === 'rca_c') return qRca?.tag === 'C';
    if (selectedFilter === 'rca_s' || (selectedFilter as any) === 'rca_a') {
      const isSilly = qRca?.tag === 'S' || (qRca?.tag as any) === 'A';
      if (!isSilly) return false;
      if (sillySubFilter !== 'all') {
        const qObj = items[idx]?.question || items[idx];
        return matchesSillySubFilter({ ...qObj, rca: qRca }, sillySubFilter);
      }
      return true;
    }
    if (selectedFilter === 'rca_t') return qRca?.tag === 'T';
    if (selectedFilter === 'rca_g') return qRca?.tag === 'G';
    return true;
  });

  const handleDrillByRca = (tag: 'all_mistakes' | 'S' | 'A' | 'C' | 'T' | 'G') => {
    let targetQuestions: Question[] = [];
    let title = '';

    if (tag === 'all_mistakes') {
      targetQuestions = items
        .filter((_, idx) => {
          const st = getQuestionStatus(idx);
          return st === 'wrong' || st === 'slow';
        })
        .map(it => it.question)
        .filter((q): q is Question => Boolean(q && q.question));
      title = `${result.chapter_title} • All Mistakes (${targetQuestions.length} Qs)`;
    } else {
      const tagLabels: Record<string, string> = {
        S: 'Silly Mistakes [S]',
        A: 'Silly Mistakes [S]',
        C: 'Conceptual Gaps [C]',
        T: 'Time Traps [T]',
        G: 'Guesswork [G]'
      };
      targetQuestions = items
        .filter((_, idx) => {
          const qRca = rcaMap[idx] || items[idx]?.rca || items[idx]?.question?.rca;
          if (tag === 'S' || tag === 'A') {
            return qRca?.tag === 'S' || (qRca?.tag as any) === 'A';
          }
          return qRca?.tag === tag;
        })
        .map(it => it.question)
        .filter((q): q is Question => Boolean(q && q.question));
      title = `${result.chapter_title} • ${tagLabels[tag]} (${targetQuestions.length} Qs)`;
    }

    if (targetQuestions.length === 0) {
      alert(`No questions found for this selection.`);
      return;
    }

    if (onReattemptQuestions) {
      onReattemptQuestions(title, targetQuestions);
    } else {
      onReattempt();
    }
  };

  const handleSectionClick = (secId: string) => {
    setActiveSectionId(secId);
    if (secId === 'all') return;
    const target = sections.find(s => s.id === secId);
    if (target && !target.indices.includes(currentIdx)) {
      setCurrentIdx(target.indices[0]);
    }
  };

  const handlePrevious = () => {
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      if (activeSectionId !== 'all') {
        const prevSec = sections.find(s => s.indices.includes(prevIdx));
        if (prevSec && prevSec.id !== activeSectionId) {
          setActiveSectionId(prevSec.id);
        }
      }
    }
  };

  const handleNext = () => {
    if (currentIdx < items.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      if (activeSectionId !== 'all') {
        const nextSec = sections.find(s => s.indices.includes(nextIdx));
        if (nextSec && nextSec.id !== activeSectionId) {
          setActiveSectionId(nextSec.id);
        }
      }
    }
  };

  // ── Global Keyboard Shortcuts for Review Mode ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is actively typing in an input, textarea, or contentEditable
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

      // Ignore modifier combinations (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toLowerCase();

      // Navigation: ArrowRight or K -> Next
      if (e.key === 'ArrowRight' || key === 'k') {
        e.preventDefault();
        handleNext();
        return;
      }

      // Navigation: ArrowLeft or J -> Previous
      if (e.key === 'ArrowLeft' || key === 'j') {
        e.preventDefault();
        handlePrevious();
        return;
      }

      // Toggle Reattempt / Solution: R
      if (key === 'r') {
        e.preventDefault();
        setReattemptMode(prev => !prev);
        return;
      }

      // RCA Hotkeys: C, S, T, G (and 'a' for legacy)
      if (key === 'c') {
        e.preventDefault();
        handleSelectRcaTag('C');
        return;
      }
      if (key === 's' || key === 'a') {
        e.preventDefault();
        handleSelectRcaTag('S');
        return;
      }
      if (key === 't') {
        e.preventDefault();
        handleSelectRcaTag('T');
        return;
      }
      if (key === 'g') {
        e.preventDefault();
        handleSelectRcaTag('G');
        return;
      }

      // Clear RCA: X or Delete
      if (key === 'x' || e.key === 'Delete') {
        e.preventDefault();
        handleClearRcaTag();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIdx, items.length, activeSectionId, sections, rcaMap]);

  const currentStatus = current ? getQuestionStatus(currentIdx) : 'unattempted';
  const qTextKey = (question?.question || '').trim().toLowerCase();
  const isBookmarked = question ? (localBookmarks.has(qTextKey) || localBookmarks.has(question.q_num)) : false;

  // Average time for question:
  // Use exact avgTime if provided in mock data; if not given, default to 35 seconds
  const avgSeconds = useMemo(() => {
    const rawDirect = 
      question?.avgTime ?? 
      (question as any)?.avg_time ?? 
      question?.avgTimeSeconds ?? 
      (current as any)?.avgTime ?? 
      (current as any)?.avg_time ?? 
      (current as any)?.avgTimeSeconds;

    const parsedDirect = parseAvgTimeToSeconds(rawDirect);
    if (parsedDirect !== null) return parsedDirect;

    if (question) {
      if (question.id && mockAvgTimeMap.has(String(question.id))) {
        return mockAvgTimeMap.get(String(question.id))!;
      }
      const cleanText = (question.question || '').trim().toLowerCase();
      if (cleanText && mockAvgTimeMap.has(cleanText)) {
        return mockAvgTimeMap.get(cleanText)!;
      }
    }

    // Default when not given in mock: 35 seconds
    return 35;
  }, [question, current, mockAvgTimeMap]);

  // User time for question:
  // Check direct userTime/timeSpent, then query mockUserTimeMap by question text/id
  const userSeconds = useMemo(() => {
    const rawDirect = 
      (current as any)?.timeSpent ?? 
      (current as any)?.userTime ?? 
      (current as any)?.user_time ?? 
      question?.timeSpent ?? 
      (question as any)?.userTime ?? 
      (question as any)?.user_time;

    const parsedDirect = parseAvgTimeToSeconds(rawDirect);
    // If it's a real parsed time from extractor and not the generic 65/35 fallback
    if (parsedDirect !== null && parsedDirect > 0 && parsedDirect !== 65 && parsedDirect !== 35) {
      return parsedDirect;
    }

    if (question) {
      if (question.id && mockUserTimeMap.has(String(question.id))) {
        return mockUserTimeMap.get(String(question.id))!;
      }
      const cleanText = (question.question || '').trim().toLowerCase();
      if (cleanText && mockUserTimeMap.has(cleanText)) {
        return mockUserTimeMap.get(cleanText)!;
      }
    }

    if (parsedDirect !== null && parsedDirect > 0) return parsedDirect;
    return typeof current?.timeSpent === 'number' ? current.timeSpent : 0;
  }, [question, current, mockUserTimeMap]);

  const handleBack = () => {
    if ((rcaMap[currentIdx]?.tag === 'S' || (rcaMap[currentIdx]?.tag as any) === 'A') && activeSillyNote && activeSillyNote !== rcaMap[currentIdx]?.sillyMistakeNote) {
      handleSaveSillyNote(activeSillyNote);
    }
    onBack();
  };

  // Marks logic (+2 for correct/slow, -0.5 for incorrect, 0 for skipped)
  const currentMarks = (currentStatus === 'correct' || currentStatus === 'slow') ? 2 : (currentStatus === 'wrong' ? -0.5 : 0);

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-screen w-full bg-[#f4f7f9] items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4 text-rose-600 shadow-sm">
          <Trash2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Questions Remaining</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
          All questions in this test review have been deleted.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-[#0097a7] hover:bg-[#00838f] text-white text-sm font-semibold rounded-lg shadow transition cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f7f9] overflow-hidden select-none font-sans text-gray-800">
      
      {/* 1. TOP NAVBAR (Teal Header) */}
      <header className="bg-[#0097a7] text-white h-14 px-4 flex items-center justify-between shrink-0 shadow z-30">
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleBack}
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

        <div className="flex items-center space-x-3">
          {/* FINISH REVIEW Button */}
          <button
            onClick={handleFinishReview}
            disabled={isFinishingReview}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3.5 py-1.5 rounded tracking-wider uppercase shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Save all RCA reasons and finish review"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isFinishingReview ? 'Saving...' : 'Finish Review'}</span>
          </button>

          {/* ANALYTICS Button */}
          <button
            onClick={() => {
              if (result.id?.startsWith('local-')) {
                setShowSummaryModal(true);
              } else if (onViewAnalytics) {
                onViewAnalytics();
              } else {
                setShowSummaryModal(true);
              }
            }}
            className="bg-[#0288d1] hover:bg-[#0277bd] text-white text-xs font-bold px-4 py-1.5 rounded tracking-wider uppercase shadow transition-all active:scale-95"
          >
            ANALYTICS
          </button>
        </div>
      </header>

      {/* 2. SECONDARY SUB-BAR (SECTIONS & Language) */}
      <div className="bg-white border-b border-gray-200 h-11 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-2 overflow-x-auto py-1 custom-scrollbar">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200 pr-3 shrink-0">
            SECTIONS
          </span>
          {sections.map((sec) => {
            const isActive = activeSection.id === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => handleSectionClick(sec.id)}
                className={`text-xs font-semibold px-4 py-1.5 rounded transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#004d40] text-white shadow-sm font-bold ring-2 ring-[#004d40]/30'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
                title={`${sec.label}: ${sec.title} (${sec.count} Questions)`}
              >
                <span>{sec.label}</span>
                <span className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {sec.count}
                </span>
              </button>
            );
          })}

          {sections.length > 1 && (
            <button
              onClick={() => handleSectionClick('all')}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition-all shrink-0 cursor-pointer flex items-center space-x-1 ${
                activeSection.id === 'all'
                  ? 'bg-[#004d40] text-white shadow-sm font-bold ring-2 ring-[#004d40]/30'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              title="View all questions across all sections"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All ({totalQuestions})</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs shrink-0 ml-3">
          {/* Re-attempt Mistakes Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReattemptMenu(!showReattemptMenu)}
              className="text-[11px] font-bold px-2.5 py-1 rounded transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white shadow-xs"
              title="Re-attempt questions by mistake category or RCA tag"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Re-attempt</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showReattemptMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 text-xs z-50">
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  By Mistake
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowReattemptMenu(false);
                    handleDrillByRca('all_mistakes');
                  }}
                  disabled={wrongCount + slowCount === 0}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center justify-between text-rose-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>All Mistakes</span>
                  </span>
                  <span className="text-[10px] bg-rose-100 px-1.5 py-0.2 rounded-full font-black">
                    {wrongCount + slowCount}
                  </span>
                </button>

                <div className="my-1 border-t border-gray-100" />
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  By RCA Tag
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowReattemptMenu(false);
                    handleDrillByRca('A');
                  }}
                  disabled={rcaStats.A === 0}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center justify-between text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[9px] font-black flex items-center justify-center">A</span>
                    <span className="font-semibold">Silly Mistakes</span>
                  </span>
                  <span className="text-[10px] bg-rose-50 text-rose-800 px-1.5 py-0.2 rounded-full font-bold">
                    {rcaStats.A}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowReattemptMenu(false);
                    handleDrillByRca('C');
                  }}
                  disabled={rcaStats.C === 0}
                  className="w-full text-left px-3 py-1.5 hover:bg-purple-50 flex items-center justify-between text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white font-mono text-[9px] font-black flex items-center justify-center">C</span>
                    <span className="font-semibold">Conceptual Gaps</span>
                  </span>
                  <span className="text-[10px] bg-purple-50 text-purple-800 px-1.5 py-0.2 rounded-full font-bold">
                    {rcaStats.C}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowReattemptMenu(false);
                    handleDrillByRca('T');
                  }}
                  disabled={rcaStats.T === 0}
                  className="w-full text-left px-3 py-1.5 hover:bg-amber-50 flex items-center justify-between text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-mono text-[9px] font-black flex items-center justify-center">T</span>
                    <span className="font-semibold">Time Traps</span>
                  </span>
                  <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                    {rcaStats.T}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowReattemptMenu(false);
                    handleDrillByRca('G');
                  }}
                  disabled={rcaStats.G === 0}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center justify-between text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-mono text-[9px] font-black flex items-center justify-center">G</span>
                    <span className="font-semibold">Guesswork</span>
                  </span>
                  <span className="text-[10px] bg-blue-50 text-blue-800 px-1.5 py-0.2 rounded-full font-bold">
                    {rcaStats.G}
                  </span>
                </button>

                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={() => {
                    setShowReattemptMenu(false);
                    onReattempt();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between text-gray-600 text-[11px] font-medium cursor-pointer"
                >
                  <span>Re-attempt Full Paper</span>
                  <span>{totalQuestions} Qs</span>
                </button>
              </div>
            )}
          </div>

          {/* Classify RCA Toggle */}
          <button
            type="button"
            onClick={() => setClassifyModeEnabled(prev => !prev)}
            className={`text-[11px] font-bold px-2.5 py-1 rounded transition-all flex items-center space-x-1.5 cursor-pointer border ${
              classifyModeEnabled
                ? 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-400/40 shadow-xs'
                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
            }`}
            title="Toggle Root-Cause Analysis (RCA) classification toolbar"
          >
            <span>🎯 Classify (RCA):</span>
            <span className="font-extrabold uppercase">{classifyModeEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <span className="bg-slate-100 border border-slate-200 text-slate-700 rounded px-2.5 py-1 text-xs font-semibold">
            English
          </span>
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
                Question No.{questionNumberInSection > 0 ? questionNumberInSection : currentIdx + 1}
              </span>

              {sections.length > 1 && (
                <span className="text-xs bg-teal-50 border border-teal-200 text-teal-800 font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <span className="font-bold">{currentSection.label}:</span>
                  <span className="truncate max-w-[160px] sm:max-w-xs">{currentSection.title}</span>
                  <span className="text-teal-600 font-mono text-[11px]">(Overall #{currentIdx + 1})</span>
                </span>
              )}

              {/* Status Badge: Skipped / Correct / Incorrect / Slow */}
              {currentStatus === 'correct' && (
                <span className="bg-[#2e7d32] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Correct
                </span>
              )}
              {currentStatus === 'slow' && (
                <span className="bg-[#ef6c00] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span>Slow (Correct)</span>
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

              {/* Stopwatch & Time: You: 00:05  Avg: 01:11 */}
              <div className="flex items-center space-x-1.5 text-xs text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-medium">You: {formatTime(userSeconds)}</span>
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

              {/* Exact Silly Mistake Badge on Question Card */}
              {(currentRca?.tag === 'S' || (currentRca?.tag as any) === 'A') && (() => {
                const badge = getSillyPrimaryBadge({ ...(question || current), rca: currentRca });
                return (
                  <span 
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${badge.badgeClass}`}
                    title={badge.noteText ? `Silly Mistake: ${badge.noteText}` : badge.label}
                  >
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                    {badge.noteText && (
                      <span className="text-[10px] opacity-75 font-normal italic">
                        ({badge.noteText})
                      </span>
                    )}
                  </span>
                );
              })()}

              {/* RCA Tag Badge for non-silly */}
              {currentRca?.tag && currentRca.tag !== 'S' && (currentRca.tag as any) !== 'A' && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${
                  RCA_TAG_CONFIG[currentRca.tag]?.lightClass || 'bg-purple-50 text-purple-700 border-purple-200'
                }`}>
                  <span className="font-mono">[{currentRca.tag}]</span>
                  <span>{RCA_TAG_CONFIG[currentRca.tag]?.label}</span>
                </span>
              )}
            </div>

            {/* Save & Report Actions */}
            <div className="flex items-center space-x-3 text-xs font-medium text-gray-600">
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

              {onDeleteQuestion && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center space-x-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded border border-rose-200 transition-colors"
                  title="Permanently delete this question from everywhere"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Question and Solution Content */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 custom-scrollbar">
            {question ? (
              <div className="max-w-4xl">
                {/* Speed & Pattern Insight Banner */}
                {reviewPatternInsight && (
                  <div className="mb-4 p-3.5 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 border border-amber-400/40 rounded-2xl flex items-start gap-3 shadow-xs">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Sparkles className="w-4 h-4 text-amber-100" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <span>⚡ Speed & Pattern Insight</span>
                        {sillySubFilter !== 'all' && SILLY_SUB_TYPES[sillySubFilter] && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-900 font-bold">
                            {SILLY_SUB_TYPES[sillySubFilter].label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1 leading-relaxed">
                        "{reviewPatternInsight}"
                      </p>
                    </div>
                  </div>
                )}

                {/* Question Body */}
                <div className="text-[15.5px] text-gray-900 leading-relaxed font-normal mb-4">
                  <FormattedText
                    text={question.question}
                    language={language}
                    as="div"
                    isQuestion={true}
                    subject={question.subject || question.section}
                  />
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
                  {getNormalizedOptions(question).map(({ key: normKey, text: optText }) => {
                    const correctKey = getCorrectOptionKey(question);
                    const isCorrectAnswer = correctKey === normKey;

                    const userAnsKey = current.selectedAnswer
                      ? normalizeAnswerKey(current.selectedAnswer)
                      : (current as any).userAnswer
                      ? normalizeAnswerKey((current as any).userAnswer)
                      : null;
                    const reattemptKey = reattemptAnswers[currentIdx] ? normalizeAnswerKey(reattemptAnswers[currentIdx]) : null;

                    const userSelected = reattemptMode
                      ? reattemptKey === normKey
                      : (currentStatus !== 'unattempted' && userAnsKey === normKey);
                    const isReattemptSelected = reattemptMode && reattemptAnswers[currentIdx] !== undefined;

                    // When reattempt is OFF: normal analysis view matching the screenshot!
                    if (!reattemptMode) {
                      if (isCorrectAnswer) {
                        return (
                          <div 
                            key={normKey}
                            className="bg-[#2e7d32] text-white rounded px-4 py-3.5 flex items-center justify-between shadow-sm transition-all"
                          >
                            <div className="flex items-center space-x-3">
                              <Check className="w-5 h-5 text-white stroke-[2.5] shrink-0" />
                              <span className="text-[15px] font-medium leading-normal">
                                <FormattedText text={optText} language={language} />
                              </span>
                            </div>
                            {userSelected && (
                              <div className="flex items-center space-x-2 shrink-0 ml-3">
                                <span className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-sm whitespace-nowrap">
                                  Your first attempt
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (userSelected && !isCorrectAnswer) {
                        return (
                          <div 
                            key={normKey}
                            className="bg-[#c62828] text-white rounded px-4 py-3.5 flex items-center justify-between shadow-sm transition-all"
                          >
                            <div className="flex items-center space-x-3">
                              <RotateCcw className="w-4 h-4 text-white shrink-0" />
                              <span className="text-[15px] font-medium leading-normal">
                                <FormattedText text={optText} language={language} />
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
                          key={normKey}
                          className="px-4 py-3.5 text-[15px] text-gray-800 rounded hover:bg-gray-50 flex items-center transition-colors"
                        >
                          <span className="w-5 mr-3 shrink-0" />
                          <span className="leading-normal">
                            <FormattedText text={optText} language={language} />
                          </span>
                        </div>
                      );
                    }

                    // When Reattempt mode is ON:
                    // If user has not chosen yet, show clickable options
                    if (!isReattemptSelected) {
                      return (
                        <div 
                          key={normKey}
                          onClick={() => handleReattemptSelect(normKey)}
                          className="px-4 py-3 text-[15px] text-gray-800 border border-gray-200 rounded hover:border-[#0097a7] hover:bg-cyan-50/50 cursor-pointer flex items-center transition-all group"
                        >
                          <span className="w-5 h-5 rounded-full border-2 border-gray-400 group-hover:border-[#0097a7] mr-3 flex items-center justify-center shrink-0">
                            <span className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-[#0097a7]/40" />
                          </span>
                          <span className="leading-normal">
                            <FormattedText text={optText} language={language} />
                          </span>
                        </div>
                      );
                    }

                    // User reattempted and made a selection:
                    if (isCorrectAnswer) {
                      return (
                        <div 
                          key={normKey}
                          className="bg-[#2e7d32] text-white rounded px-4 py-3 flex items-center justify-between shadow-sm"
                        >
                          <div className="flex items-center space-x-3">
                            <Check className="w-5 h-5 text-white stroke-[2.5] shrink-0" />
                            <span className="text-[15px] font-medium">
                              <FormattedText text={optText} language={language} />
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (userSelected) {
                      return (
                        <div 
                          key={normKey}
                          className="bg-[#c62828] text-white rounded px-4 py-3 flex items-center justify-between shadow-sm"
                        >
                          <div className="flex items-center space-x-3">
                            <X className="w-5 h-5 text-white stroke-[2.5] shrink-0" />
                            <span className="text-[15px] font-medium">
                              <FormattedText text={optText} language={language} />
                            </span>
                          </div>
                          <span className="bg-white/20 text-white text-xs font-medium px-2.5 py-0.5 rounded shrink-0">
                            Your Attempt
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={normKey}
                        className="px-4 py-3 text-[15px] text-gray-700 opacity-70 flex items-center"
                      >
                        <span className="w-5 mr-3 shrink-0" />
                        <span>
                          <FormattedText text={optText} language={language} />
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Subtext notice matching screenshot */}
                <p className="text-xs text-gray-500 italic mt-2 mb-4">
                  {reattemptMode 
                    ? "Reattempt mode is On. Click an option to test yourself."
                    : "Reattempt mode is Off. Turn it on from bottom bar"}
                </p>

                {/* 4-Bucket Root Cause Analysis (RCA) Classification Bar */}
                {classifyModeEnabled && (
                  <RcaClassifier
                    currentRca={currentRca}
                    onSelectTag={handleSelectRcaTag}
                    onClearTag={handleClearRcaTag}
                    activeSillyNote={activeSillyNote}
                    onSaveSillyNote={handleSaveSillyNote}
                    onToggleSillyChip={handleToggleSillyChip}
                  />
                )}

                {/* Solution Section */}
                {(!reattemptMode || reattemptAnswers[currentIdx] !== undefined) && (
                  <div className="mt-8 pt-4 border-t border-gray-200">
                    {/* Solution Header Tab */}
                    <div className="mb-4 flex items-center justify-between">
                      <span className="border-b-2 border-[#0097a7] text-[#0097a7] font-bold text-sm inline-block pb-1.5">
                        Solution
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            if (!question) return;
                            const uTime = Number(current?.timeSpent || 0);
                            const aTime = parseAvgTimeToSeconds(current?.avgTimeSeconds || current?.avgTime || question.avgTime) || 45;
                            const isSlow = uTime > (aTime + 5);
                            const cardSource = isSlow ? 'speed_trap' : (current?.isCorrect ? 'bookmark' : (current?.userAnswer ? 'quiz_wrong' : 'quiz_unattempted'));

                            const candidate = convertQuestionToSRSCardCandidate(
                              question,
                              cardSource,
                              result.chapter_title,
                              current?.userAnswer,
                              { userTime: uTime, avgTime: aTime }
                            );
                            setSrsCandidateCards([candidate]);
                            setSrsModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                          title="Generate an Anki flashcard for this question"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-white" />
                          <span>✨ AI Anki</span>
                        </button>
                        <button
                          onClick={() => {
                            const isSectional = result.is_mock && (
                              String(result.chapter_title || '').toLowerCase().includes('sectional') ||
                              result.totalQuestions === 25
                            );
                            const sType: 'full_mock' | 'sectional' | 'subject_wise' = result.is_mock
                              ? (isSectional ? 'sectional' : 'full_mock')
                              : 'subject_wise';
                            const sLabel = result.is_mock
                              ? (isSectional ? `Sectional Test: ${result.chapter_title}` : `Full Mock Test: ${result.chapter_title}`)
                              : `Subject-Wise: ${result.subject || ''} (${result.chapter_title || ''})`;

                            const effTag = (currentRca?.tag as any) === 'A' ? 'S' : currentRca?.tag;
                            const effTagName = currentRca?.tagName || (effTag ? RCA_TAG_CONFIG[effTag as RCATagType]?.label : undefined);

                            window.dispatchEvent(new CustomEvent('cgl_ask_ai_question', {
                              detail: {
                                questionNumber: questionNumberInSection > 0 ? questionNumberInSection : currentIdx + 1,
                                questionText: question.question,
                                options: question.options,
                                userAnswer: current?.userAnswer,
                                correctAnswer: question.answer,
                                solution: question.solution,
                                topic: question.tags?.topic || (question as any).topic || result.subject,
                                sourceType: sType,
                                sourceLabel: sLabel,
                                testName: result.chapter_title,
                                rcaTag: effTag,
                                rcaTagName: effTagName,
                                sillyMistakeNote: currentRca?.sillyMistakeNote
                              }
                            }));
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer group"
                          title="Ask Tommy to explain this question, formulas, and elimination tricks"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
                          <span>Ask Tommy</span>
                        </button>
                      </div>
                    </div>

                    {/* Solution Body */}
                    <div className="bg-white rounded-lg">
                      <div className="flex items-center space-x-1.5 text-blue-600 mb-3">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        <span className="text-base font-bold text-gray-900">Detailed Solution</span>
                      </div>

                      <SolutionViewer
                        solution={question.solution}
                        language={language}
                        subject={question.subject || question.section}
                      />
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
              onClick={handlePrevious}
              disabled={currentIdx === 0}
              className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] font-medium text-xs px-4 py-2 rounded shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              title="Previous question"
            >
              <span>Previous</span>
            </button>

            {/* Practice Mode (Hide Solutions) Toggle Switch */}
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                Practice Mode (Hide Solutions)
              </span>
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
                title="Toggle Practice Mode (Hide Solutions)"
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
              onClick={handleNext}
              disabled={currentIdx === items.length - 1}
              className="bg-[#b3e5fc] hover:bg-[#81d4fa] text-[#01579b] font-medium text-xs px-4 py-2 rounded shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              title="Next question"
            >
              <span>Next</span>
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
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-xs z-40">
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
                      onClick={() => { setSelectedFilter('slow'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 ${selectedFilter === 'slow' ? 'font-bold text-amber-700' : 'text-gray-700'}`}
                    >
                      Slow ({slowCount})
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

                    <div className="my-1 border-t border-gray-200" />
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      RCA Classification
                    </div>

                    <button
                      onClick={() => { setSelectedFilter('needs_rca'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center justify-between ${
                        selectedFilter === 'needs_rca' ? 'font-bold text-rose-700 bg-rose-50/70' : 'text-rose-700'
                      }`}
                    >
                      <span>⚠️ Needs RCA</span>
                      <span className="font-bold text-[11px] bg-rose-100 px-1.5 py-0.2 rounded-full">{overallNeedsRcaCount}</span>
                    </button>
                    <button
                      onClick={() => { setSelectedFilter('rca_c'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-purple-50 flex items-center justify-between ${
                        selectedFilter === 'rca_c' ? 'font-bold text-purple-700 bg-purple-50/70' : 'text-gray-700'
                      }`}
                    >
                      <span>🟣 [C] Conceptual Gap</span>
                      <span className="font-bold text-[11px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-full">{rcaStats.C}</span>
                    </button>
                    <button
                      onClick={() => { setSelectedFilter('rca_s'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center justify-between ${
                        selectedFilter === 'rca_s' || (selectedFilter as any) === 'rca_a' ? 'font-bold text-rose-700 bg-rose-50/70' : 'text-gray-700'
                      }`}
                    >
                      <span>⚡ [S] Silly Mistake</span>
                      <span className="font-bold text-[11px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded-full">{rcaStats.S}</span>
                    </button>
                    <button
                      onClick={() => { setSelectedFilter('rca_t'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-amber-50 flex items-center justify-between ${
                        selectedFilter === 'rca_t' ? 'font-bold text-amber-700 bg-amber-50/70' : 'text-gray-700'
                      }`}
                    >
                      <span>🟡 [T] Time Trap</span>
                      <span className="font-bold text-[11px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">{rcaStats.T}</span>
                    </button>
                    <button
                      onClick={() => { setSelectedFilter('rca_g'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center justify-between ${
                        selectedFilter === 'rca_g' ? 'font-bold text-blue-700 bg-blue-50/70' : 'text-gray-700'
                      }`}
                    >
                      <span>🔵 [G] Guesswork</span>
                      <span className="font-bold text-[11px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full">{rcaStats.G}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Legend / Status Row (Section & Overall) */}
            <div className="px-3 py-2.5 border-b border-blue-200/80 bg-white/40 flex items-center gap-x-2.5 text-xs shrink-0 flex-wrap gap-y-1.5">
              <div className="flex items-center space-x-1" title={`Section: ${sectionCorrectCount} | Overall: ${correctCount}`}>
                <span className="w-5 h-5 rounded-full bg-[#2e7d32] text-white flex items-center justify-center font-bold text-[10px] shadow-sm">
                  {sectionCorrectCount}
                </span>
                <span className="text-gray-700 font-medium text-[11px]">Correct</span>
              </div>
              <div className="flex items-center space-x-1" title={`Section: ${sectionSlowCount} | Overall: ${slowCount}`}>
                <span className="w-5 h-5 rounded-full bg-[#ef6c00] text-white flex items-center justify-center font-bold text-[10px] shadow-sm">
                  {sectionSlowCount}
                </span>
                <span className="text-gray-700 font-medium text-[11px]">Slow</span>
              </div>
              <div className="flex items-center space-x-1" title={`Section: ${sectionUnattemptedCount} | Overall: ${unattemptedCount}`}>
                <span className="w-5 h-5 rounded-full bg-white border-2 border-gray-500 text-gray-900 flex items-center justify-center font-bold text-[10px] shadow-sm">
                  {sectionUnattemptedCount}
                </span>
                <span className="text-gray-700 font-medium text-[11px]">Skipped</span>
              </div>
              <div className="flex items-center space-x-1" title={`Section: ${sectionWrongCount} | Overall: ${wrongCount}`}>
                <span className="w-5 h-5 rounded-full bg-[#c62828] text-white flex items-center justify-center font-bold text-[10px] shadow-sm">
                  {sectionWrongCount}
                </span>
                <span className="text-gray-700 font-medium text-[11px]">Incorrect</span>
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
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-[#ef6c00] flex items-center justify-center mb-0.5 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9.5px] text-gray-600 leading-tight">Slow (Correct)</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-[#c62828] flex items-center justify-center mb-0.5 shadow-xs">
                    <Frown className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9.5px] text-gray-600 leading-tight">Incorrect</span>
                </div>
              </div>
            </div>

            {/* SECTION Title Bar */}
            <div className="px-4 py-2 text-xs font-bold text-gray-700 bg-[#b2ebf2]/60 shrink-0 tracking-wide flex items-center justify-between">
              <span className="truncate pr-2">
                SECTION : <span className="text-gray-900 font-bold">{activeSection.label}</span>
                {activeSection.title !== activeSection.label && (
                  <span className="text-gray-600 font-normal ml-1">({activeSection.title})</span>
                )}
              </span>
              <span className="text-[11px] bg-[#0097a7] text-white font-bold px-2 py-0.5 rounded-full shrink-0">
                {activeSection.count} Qs
              </span>
            </div>

            {/* RCA Quick Filter Bar */}
            <div className="px-2.5 py-1.5 bg-white/70 border-b border-blue-200/80 flex items-center gap-1 overflow-x-auto shrink-0 custom-scrollbar text-[10px]">
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  selectedFilter === 'all'
                    ? 'bg-[#0097a7] text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                All
              </button>

              <button
                type="button"
                onClick={() => setSelectedFilter('needs_rca')}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedFilter === 'needs_rca'
                    ? 'bg-rose-600 text-white shadow-2xs ring-1 ring-rose-400'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                }`}
                title="Questions that are wrong or slow without an RCA tag"
              >
                <span>Needs Tag</span>
                {sectionNeedsRcaCount > 0 && (
                  <span className={`px-1 py-0.2 rounded-full text-[9px] font-black ${
                    selectedFilter === 'needs_rca' ? 'bg-white text-rose-700' : 'bg-rose-200 text-rose-900'
                  }`}>
                    {sectionNeedsRcaCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedFilter('rca_c')}
                className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  selectedFilter === 'rca_c'
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200'
                }`}
                title="Conceptual Gap [C]"
              >
                [C]
              </button>

              <button
                type="button"
                onClick={() => setSelectedFilter('rca_s')}
                className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  selectedFilter === 'rca_s' || (selectedFilter as any) === 'rca_a'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                }`}
                title="Silly Mistake [S]"
              >
                [S]
              </button>

              <button
                type="button"
                onClick={() => setSelectedFilter('rca_t')}
                className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  selectedFilter === 'rca_t'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                }`}
                title="Time Trap [T]"
              >
                [T]
              </button>

              <button
                type="button"
                onClick={() => setSelectedFilter('rca_g')}
                className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  selectedFilter === 'rca_g'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                }`}
                title="Guesswork [G]"
              >
                [G]
              </button>
            </div>

            {/* Secondary Breakdown Row for Silly Mistakes */}
            {(selectedFilter === 'rca_s' || (selectedFilter as any) === 'rca_a') && (
              <div className="px-2.5 py-1.5 bg-gradient-to-r from-rose-50/90 to-pink-50/80 border-b border-rose-200/80 flex items-center gap-1 overflow-x-auto shrink-0 custom-scrollbar text-[10px]">
                {/* (i) Info icon on the left to revise typed/selected mistakes without questions */}
                <button
                  type="button"
                  onClick={() => setShowSillyRevisionModal(true)}
                  className="px-2 py-0.5 rounded font-bold transition-all cursor-pointer shrink-0 bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1 shadow-2xs"
                  title="Revision Mode: List all silly mistakes typed or selected to revise (not questions)"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Revise</span>
                  <span className="font-mono font-black">({reviewSillyMistakesList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSillySubFilter('all')}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer shrink-0 ${
                    sillySubFilter === 'all'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-rose-800 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <span>All Silly</span>
                  <span className="ml-1 opacity-80 font-mono">({rcaStats.S})</span>
                </button>

                {Object.values(SILLY_SUB_TYPES).map(sub => {
                  const count = reviewSillySubTypeCounts[sub.id] || 0;
                  if (count === 0 && sub.id !== 'calculation' && sub.id !== 'misread' && sub.id !== 'option' && sub.id !== 'formula') {
                    return null;
                  }
                  const isSelected = sillySubFilter === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSillySubFilter(isSelected ? 'all' : sub.id)}
                      className={`px-1.5 py-0.5 rounded font-semibold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        isSelected
                          ? 'bg-rose-600 text-white font-bold shadow-2xs'
                          : count > 0
                          ? 'bg-white text-rose-900 hover:bg-rose-100 border border-rose-200'
                          : 'bg-white/60 text-slate-400 border border-slate-200 opacity-60'
                      }`}
                      title={sub.desc}
                    >
                      <span>{sub.icon}</span>
                      <span>{sub.shortLabel}</span>
                      <span className="font-mono font-bold">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Question Palette Grid (Section-Wise) */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              <div className="grid grid-cols-5 gap-2">
                {filteredIndices.map(idx => {
                  const localNumber = activeIndices.indexOf(idx) + 1;
                  const status = getQuestionStatus(idx);
                  const isCurrent = currentIdx === idx;
                  const qRca = rcaMap[idx] || items[idx]?.rca || items[idx]?.question?.rca;
                  
                  let badgeStyle = "bg-white border-2 border-gray-400 text-gray-800";
                  if (status === 'correct') {
                    badgeStyle = "bg-[#2e7d32] text-white border-transparent";
                  } else if (status === 'slow') {
                    badgeStyle = "bg-[#ef6c00] text-white border-transparent";
                  } else if (status === 'wrong') {
                    badgeStyle = "bg-[#c62828] text-white border-transparent";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentIdx(idx)}
                      title={`Question ${localNumber} of ${activeSection.label} (Overall #${idx + 1}) - ${status}${qRca ? ` [RCA: ${qRca.tag} - ${qRca.tagName}]` : ''}`}
                      className={`relative w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${badgeStyle} ${
                        isCurrent ? 'ring-2 ring-[#0097a7] ring-offset-1 scale-110 z-10 shadow-md' : 'hover:opacity-80 hover:scale-105'
                      }`}
                    >
                      {activeSectionId === 'all' ? idx + 1 : localNumber}
                      {qRca ? (
                        <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-mono font-black flex items-center justify-center shadow-xs border border-white ${
                          qRca.tag === 'C' ? 'bg-purple-600 text-white' :
                          (qRca.tag === 'S' || (qRca.tag as any) === 'A') ? 'bg-rose-600 text-white' :
                          qRca.tag === 'T' ? 'bg-amber-500 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                          {(qRca.tag as any) === 'A' ? 'S' : qRca.tag}
                        </span>
                      ) : (status === 'wrong' || status === 'slow') && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-white shadow-2xs animate-pulse"
                          title="Needs RCA Tag"
                        />
                      )}
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
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {sections.map(sec => {
                const secItems = sec.indices.map(idx => ({ item: items[idx], idx, localNum: sec.indices.indexOf(idx) + 1 }));
                return (
                  <div key={sec.id} className="space-y-4">
                    <div className="sticky top-0 bg-[#e0f2f1] text-[#004d40] px-4 py-2.5 rounded-lg font-bold text-sm flex items-center justify-between border border-teal-200 shadow-xs z-10">
                      <span>{sec.label}: {sec.title}</span>
                      <span className="text-xs font-semibold bg-white/80 px-2 py-0.5 rounded-full">{sec.count} Questions</span>
                    </div>

                    <div className="space-y-5 pl-1 pr-1">
                      {secItems.map(({ item: it, idx, localNum }) => (
                        <div key={idx} className="border-b border-gray-200 pb-5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm text-[#0097a7]">
                              Q{localNum} <span className="text-gray-400 font-normal text-xs">(Overall #{idx + 1})</span>
                            </span>
                            {(() => {
                              const qSt = getQuestionStatus(idx);
                              if (qSt === 'correct') return <span className="text-xs px-2 py-0.5 rounded font-semibold bg-green-100 text-green-800">Correct</span>;
                              if (qSt === 'slow') return <span className="text-xs px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800">Slow (Correct)</span>;
                              if (qSt === 'wrong') return <span className="text-xs px-2 py-0.5 rounded font-semibold bg-red-100 text-red-800">Incorrect</span>;
                              return <span className="text-xs px-2 py-0.5 rounded font-semibold bg-gray-100 text-gray-600">Unattempted</span>;
                            })()}
                          </div>
                          <FormattedText
                            text={it.question?.question}
                            language={language}
                            as="div"
                            className="text-sm text-gray-900 font-medium mb-3 whitespace-pre-line"
                            isQuestion={true}
                            subject={it.question?.subject || it.question?.section}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {it.question && (Object.entries(it.question.options) as [string, string][]).map(([k, val]) => (
                              <div 
                                key={k} 
                                className={`p-2 rounded border flex items-start gap-1.5 ${
                                  k === it.question?.answer ? 'border-green-500 bg-green-50 font-bold text-green-900' : 'border-gray-200 bg-gray-50 text-gray-700'
                                }`}
                              >
                                <span className="uppercase font-bold shrink-0">{k}.</span>
                                <FormattedText text={val} language={language} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
                    {((correctCount + slowCount) * 2 - wrongCount * 0.5).toFixed(1)}
                  </p>
                  <span className="text-[10px] text-blue-600">Max: {totalQuestions * 2}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <span className="text-xs text-emerald-700 font-semibold uppercase">Accuracy</span>
                  <p className="text-2xl font-black text-emerald-900 mt-1">
                    {totalQuestions > 0 && (correctCount + slowCount + wrongCount) > 0 
                      ? `${Math.round(((correctCount + slowCount) / (correctCount + slowCount + wrongCount)) * 100)}%` 
                      : '0%'}
                  </p>
                  <span className="text-[10px] text-emerald-600">{correctCount + slowCount}/{correctCount + slowCount + wrongCount} attempted</span>
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
                  <span className="flex items-center text-[#ef6c00] font-medium">
                    <AlertTriangle className="w-4 h-4 mr-2" /> Slow (Correct)
                  </span>
                  <span className="font-bold text-amber-800">{slowCount}</span>
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

              {/* RCA Classification Breakdown with 1-Click Re-attempt */}
              {rcaStats.total > 0 && (
                <div className="border border-purple-200 bg-purple-50/40 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-purple-700" />
                      <span>RCA Error Breakdown</span>
                    </h4>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                      {rcaStats.total} Classified
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSummaryModal(false);
                        handleDrillByRca('S');
                      }}
                      disabled={rcaStats.S === 0}
                      className="p-2 rounded-lg bg-white border border-rose-200 hover:border-rose-400 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      <div className="text-[10px] font-bold text-rose-700 flex items-center justify-between">
                        <span>[S] Silly</span>
                        <span className="font-black text-xs">{rcaStats.S}</span>
                      </div>
                      <span className="text-[9px] text-rose-600 block mt-0.5 font-medium">Re-attempt &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSummaryModal(false);
                        handleDrillByRca('C');
                      }}
                      disabled={rcaStats.C === 0}
                      className="p-2 rounded-lg bg-white border border-purple-200 hover:border-purple-400 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      <div className="text-[10px] font-bold text-purple-700 flex items-center justify-between">
                        <span>[C] Concept</span>
                        <span className="font-black text-xs">{rcaStats.C}</span>
                      </div>
                      <span className="text-[9px] text-purple-600 block mt-0.5 font-medium">Re-attempt &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSummaryModal(false);
                        handleDrillByRca('T');
                      }}
                      disabled={rcaStats.T === 0}
                      className="p-2 rounded-lg bg-white border border-amber-200 hover:border-amber-400 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      <div className="text-[10px] font-bold text-amber-700 flex items-center justify-between">
                        <span>[T] Trap</span>
                        <span className="font-black text-xs">{rcaStats.T}</span>
                      </div>
                      <span className="text-[9px] text-amber-600 block mt-0.5 font-medium">Re-attempt &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSummaryModal(false);
                        handleDrillByRca('G');
                      }}
                      disabled={rcaStats.G === 0}
                      className="p-2 rounded-lg bg-white border border-blue-200 hover:border-blue-400 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      <div className="text-[10px] font-bold text-blue-700 flex items-center justify-between">
                        <span>[G] Guess</span>
                        <span className="font-black text-xs">{rcaStats.G}</span>
                      </div>
                      <span className="text-[9px] text-blue-600 block mt-0.5 font-medium">Re-attempt &rarr;</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              {!result.id?.startsWith('local-') && (
                <button
                  onClick={onReattempt}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 flex items-center cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reattempt Test
                </button>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold rounded hover:bg-gray-100 cursor-pointer"
                >
                  Back to Review
                </button>
                <button
                  onClick={() => {
                    setShowSummaryModal(false);
                    handleFinishReview();
                  }}
                  disabled={isFinishingReview}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isFinishingReview ? 'Saving...' : 'Finish Review'}</span>
                </button>
              </div>
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
                Are you sure you want to delete Question No. {questionNumberInSection > 0 ? questionNumberInSection : currentIdx + 1}?
              </p>
              <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800 leading-relaxed">
                <p className="font-bold mb-1">Warning: Permanent Deletion Across Entire App</p>
                This question will be completely removed from this test and filtered out from all future practice and mock tests across the app and database.
              </div>
              <p className="text-xs text-gray-600 line-clamp-3 italic bg-gray-50 p-2.5 rounded border border-gray-200">
                "{items[currentIdx]?.question?.question}"
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

      {/* ── TOAST NOTIFICATION ── */}
      {deleteToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border border-slate-700 animate-in slide-in-from-bottom duration-200">
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>{deleteToast}</span>
        </div>
      )}

      {finishToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-lg shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 border border-emerald-500 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{finishToast}</span>
        </div>
      )}

      {srsToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-900 text-white px-5 py-3 rounded-xl shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 border border-indigo-500 animate-in slide-in-from-bottom duration-200">
          <RotateCw className="w-5 h-5 text-amber-400" />
          <span>{srsToast}</span>
        </div>
      )}

      {/* SrsCardConfirmModal for Review Question */}
      <SrsCardConfirmModal
        isOpen={srsModalOpen}
        cards={srsCandidateCards}
        title="Add to Anki / SRS Deck"
        sourceLabel={`Question #${questionNumberInSection || currentIdx + 1}`}
        onConfirm={(confirmed) => {
          if (confirmed.length > 0) {
            addSRSCardsBatch(confirmed);
            setSrsToast(`Successfully added ${confirmed.length} card to your SRS queue!`);
            setTimeout(() => setSrsToast(null), 3000);
          }
          setSrsModalOpen(false);
          setSrsCandidateCards([]);
        }}
        onCancel={() => {
          setSrsModalOpen(false);
          setSrsCandidateCards([]);
        }}
      />

      {/* ── SILLY MISTAKES REVISION SHEET MODAL ── */}
      {showSillyRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-rose-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide">
                    ⚡ Silly Mistakes Revision Sheet
                  </h3>
                  <p className="text-[11px] text-rose-100 font-medium">
                    {reviewSillyMistakesList.length} silly mistakes recorded • Questions hidden for rapid habit review
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSillyRevisionModal(false)}
                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50">
              {reviewSillyMistakesList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold bg-white rounded-2xl border border-dashed border-slate-200">
                  No silly mistakes classified in this test yet.
                </div>
              ) : (
                reviewSillyMistakesList.map(item => {
                  const isRevised = revisedReviewKeys.has(item.questionIndex);
                  const cfg = item.subConfig;
                  return (
                    <div
                      key={item.questionIndex}
                      className={`p-4 rounded-2xl border transition-all ${
                        isRevised
                          ? 'bg-slate-50 border-slate-200 opacity-70'
                          : 'bg-white border-rose-200/80 shadow-xs hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRevisedReviewKeys(prev => {
                                const next = new Set(prev);
                                if (next.has(item.questionIndex)) next.delete(item.questionIndex);
                                else next.add(item.questionIndex);
                                return next;
                              });
                            }}
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                              isRevised ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                            }`}
                            title={isRevised ? "Mark as unrevised" : "Mark as revised"}
                          >
                            {isRevised && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCurrentIdx(item.questionIndex);
                              setShowSillyRevisionModal(false);
                            }}
                            className={`text-xs font-mono font-bold hover:underline cursor-pointer ${
                              isRevised ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                            title="Jump to question in review mode"
                          >
                            Q{item.displayNum}
                          </button>

                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${cfg.badgeClass}`}>
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                          </span>

                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 text-slate-600">
                            {item.topic}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentIdx(item.questionIndex);
                            setShowSillyRevisionModal(false);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded transition cursor-pointer"
                        >
                          View Question →
                        </button>
                      </div>

                      {item.typedNote ? (
                        <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs text-amber-950">
                          <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-800 block mb-1">
                            ✍️ Your Typed Slip Note:
                          </span>
                          <p className="font-semibold text-slate-900 leading-relaxed italic">
                            "{item.typedNote}"
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl text-xs text-rose-950">
                          <span className="font-extrabold uppercase tracking-wider text-[10px] text-rose-800 block mb-1">
                            📌 Selected Slip: {cfg.label}
                          </span>
                          <p className="text-slate-700 leading-relaxed">
                            {cfg.desc}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {revisedReviewKeys.size} of {reviewSillyMistakesList.length} marked revised
              </span>
              <button
                type="button"
                onClick={() => setShowSillyRevisionModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
