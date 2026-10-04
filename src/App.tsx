import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Trophy, GraduationCap, LayoutDashboard, LogIn, LogOut, Loader2, AlertCircle, ListChecks, ChevronRight, ChevronLeft, Play, Layers, Bookmark as BookmarkIcon, BookMarked, Trash2, Shield, Crown, Zap, Flame, Star, History, RotateCcw, RotateCw, Calculator, Compass, Languages, Globe2, Clock, Target, Search, Filter, X, XCircle, Landmark, Scale, TrendingUp, Atom, Sparkles, FileText, Smartphone } from 'lucide-react';
import { Chapter, SubjectData, QuizResult, Bookmark, Question } from './types';
import { detectTopic, normalizeTopicTitle } from './utils/topicDetector';
import { GK_SUBJECT_CONFIGS, GK_SUBJECT_LIST, GKSubjectId, getChapterGKSubject, getTopicGKSubject, formatGKSubTopicTitle } from './utils/gkSubjectHelper';
import { auth, googleProvider, db, browserPopupRedirectResolver } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';

// Lazy load heavier views to minimize initial bundle footprint and speed up first paint
const QuizContainer = React.lazy(() => import('./components/QuizContainer').then(m => ({ default: m.QuizContainer })));
const ReviewView = React.lazy(() => import('./components/Review').then(m => ({ default: m.ReviewView })));
const DrillHub = React.lazy(() => import('./components/drill/DrillHub').then(m => ({ default: m.DrillHub })));
const MockScoreDashboard = React.lazy(() => import('./components/MockScoreDashboard').then(m => ({ default: m.MockScoreDashboard })));

import { MockScoreReport } from './types/mockScore';
import initialMockReports from './data/mock_reports.json';
import { AiMentorChat } from './components/AiMentorChat';
import { safeStorage } from './utils/safeStorage';
import { syncMockReports } from './utils/syncMockReports';
import { FormattedText } from './components/FormattedText';
import { cleanSolutionText } from './utils/cleanSolution';
import { normalizeAnswerKey } from './utils/mathSanitizer';
import { cleanQuestionForSession, toLeanQuestionCache } from './utils/questionHelpers';
import { purgeBloatedIdbSubjectData, setIdbKey } from './utils/cache';
import { resolveQuestionSolution, initSolutionResolver } from './utils/solutionResolver';
import { openAiWithScope } from './utils/aiScopeHelper';
import { AiFocusedQuestion } from './types/aiScope';
import { classifyTestType, TestScopeFilter } from './utils/testClassifier';
import { MockChapterErrorsModal, MockChapterModalData, ModalFilterType } from './components/modals/MockChapterErrorsModal';
import { SetPickerModal, SetPickerModalData } from './components/modals/SetPickerModal';
import { CheatSheetModal } from './components/modals/CheatSheetModal';
import { getGrammarPdfUrl } from './utils/grammarPdfs';
import { BookmarksView } from './components/BookmarksView';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { getSubjectTheme, getQuestionId, formatAttemptDate, computeDashboardStats } from './utils/subjectThemes';
import { findQuestionRca, RCA_TAG_CONFIG, loadBundledMockRcaMap, matchesSillySubFilter, SILLY_SUB_TYPES, initGlobalRcaStoreFromIdb, syncRcaFromFirestore, syncRcaToFirestore } from './utils/rcaHelper';
import { RCATagType, RCAClassification } from './types';
import { loadAllBundledMockQuestions, aggregateMockErrors, evictDeletedQuestionFromAggregator } from './utils/mockErrorAggregator';
import { MockErrorsRcaCockpit } from './components/rca/MockErrorsRcaCockpit';
import { SillyMistakesAggregateView } from './components/rca/SillyMistakesAggregateView';
import { ThemeSelector } from './components/ThemeSelector';
import { BotMistakesPage } from './components/BotMistakesPage';
import { getInitialTheme, setAppliedTheme } from './utils/theme';
import { getDailyThought } from './utils/dailyThoughts';

import { getCachedData, setCachedData, clearCachedData } from './utils/cache';
import { useToast } from './components/ui/Toast';
import { recordQuizMistakes, isFullOrSectionalMock, extractOptionsArray, getDedupeKey } from './utils/mistakeRecorder';

const GK_ICONS: Record<string, any> = {
  Landmark,
  Scale,
  Globe2,
  TrendingUp,
  Atom,
  Sparkles,
  FileText,
};

import { parseSubjectChapter } from './utils/subjectDataLoader';

// Dynamic import fallback of all subject JSON files (used if API is unavailable, e.g. static export)
const subjectModules = import.meta.glob('./data/{mock_errors,chapter_bank}/**/*.json');
const mockQuestionModules = import.meta.glob('./data/mock_questions/*.json', { eager: true });

const loadSubjectData = async (): Promise<{ rawMockData: SubjectData; rawBankData: SubjectData }> => {
  // 1. Fast Path: Single fetch from Express backend (~50ms)
  try {
    const res = await fetch('/api/subject-data');
    if (res.ok) {
      const data = await res.json();
      if (data && (Object.keys(data.rawBankData || {}).length > 0 || Object.keys(data.rawMockData || {}).length > 0)) {
        return data;
      }
    }
  } catch (e) {
    console.warn('[loadSubjectData] API fetch failed, using local module fallback:', e);
  }

  // 2. Fallback Path: Client-side dynamic import chunk loader
  const rawMockData: SubjectData = {};
  const rawBankData: SubjectData = {};

  const entries = Object.entries(subjectModules);
  const loaded = await Promise.all(
    entries.map(async ([path, loader]) => {
      try {
        const mod: any = await (loader as () => Promise<any>)();
        return { path, data: mod.default || mod };
      } catch (e) {
        console.error('Failed to load JSON chunk:', path, e);
        return null;
      }
    })
  );

  loaded.forEach(item => {
    if (!item) return;
    parseSubjectChapter(item.path, item.data, rawMockData, rawBankData);
  });

  return { rawMockData, rawBankData };
};

const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0' ||
  window.location.hostname.endsWith('.localhost')
);

export type ReviewBackTo = 'home' | 'dashboard' | 'mockScores' | 'botErrors';

export default function App() {
  const { showToast, showConfirm } = useToast();
  const [view, setView] = useState<'home' | 'quiz' | 'dashboard' | 'bookmarks' | 'review' | 'drill' | 'mockScores' | 'botErrors'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const search = window.location.search;
        if (search) {
          const params = new URLSearchParams(search);
          const v = params.get('view');
          if (v === 'botErrors' || params.has('syncQ') || params.has('syncBatch')) {
            return 'botErrors';
          }
          if (v === 'mockScores' || v === 'drill' || v === 'dashboard' || v === 'bookmarks') {
            return v as any;
          }
        }
      } catch {}
    }
    return 'home';
  });

  useEffect(() => {
    const handleUrlChange = () => {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        const params = new URLSearchParams(window.location.search);
        const v = params.get('view');
        if (v === 'botErrors' || params.has('syncQ') || params.has('syncBatch')) {
          setView('botErrors');
        }
      } catch {}
    };
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);
  const [dailyThoughtSalt, setDailyThoughtSalt] = useState(0);
  const dailyThought = useMemo(() => getDailyThought(dailyThoughtSalt), [dailyThoughtSalt]);
  const [mockReportsList, setMockReportsList] = useState<MockScoreReport[]>(() => {
    let list: MockScoreReport[] = [];
    try {
      const saved = safeStorage.getItem('cgl_mock_score_reports');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      }
    } catch (e) { }
    const synced = syncMockReports(list, initialMockReports as MockScoreReport[]);
    try {
      safeStorage.setItem('cgl_mock_score_reports', JSON.stringify(synced));
    } catch { }
    return synced;
  });

  useEffect(() => {
    setAppliedTheme(getInitialTheme());
  }, []);

  useEffect(() => {
    // Sync backend mock reports on mount so AI immediately has latest Full Mocks (including 13 Sept)
    fetch('/api/mock-reports')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const cType = res.headers.get('content-type') || '';
        if (!cType.includes('application/json')) throw new Error('Not JSON');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const synced = syncMockReports(data, initialMockReports as MockScoreReport[]);
          setMockReportsList(synced);
          try {
            safeStorage.setItem('cgl_mock_score_reports', JSON.stringify(synced));
          } catch { }
        }
      })
      .catch(() => { });

    const handleStorage = async () => {
      try {
        const saved = safeStorage.getItem('cgl_mock_score_reports');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const synced = syncMockReports(parsed, initialMockReports as MockScoreReport[]);
            setMockReportsList(synced);
          }
        }
      } catch (e) { }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('cgl_mock_reports_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('cgl_mock_reports_updated', handleStorage);
    };
  }, []);
  const [reviewResult, setReviewResult] = useState<QuizResult | null>(null);
  const [reviewBackTo, setReviewBackTo] = useState<ReviewBackTo>('dashboard');
  const [category, setCategory] = useState<'mockErrors' | 'chapterBank'>('chapterBank');
  const [quizMode, setQuizMode] = useState<'practice' | 'mock'>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage?.getItem('quizMode') : null;
      return saved === 'mock' ? 'mock' : 'practice';
    } catch {
      return 'practice';
    }
  });
  const setQuizModePersisted = (mode: 'practice' | 'mock') => {
    setQuizMode(mode);
    try { localStorage.setItem('quizMode', mode); } catch { }
  };
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedMathSection, setSelectedMathSection] = useState<'spartan' | 'pinnacle' | 'qrb' | 'top500' | 'mrq' | null>(null);
  const [selectedEnglishSection, setSelectedEnglishSection] = useState<'ayush_vocab' | 'black_book' | 'general' | null>(null);
  const [selectedGKSubject, setSelectedGKSubject] = useState<GKSubjectId | null>(null);
  const [selectedGKSubTopic, setSelectedGKSubTopic] = useState<string>('all');
  const [mockGKFilter, setMockGKFilter] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<Set<string>>(() => {
    try {
      const cached = safeStorage.getItem('cgl_deleted_question_ids');
      if (cached) return new Set(JSON.parse(cached));
    } catch { }
    return new Set();
  });
  const [selectedBookmarkSubject, setSelectedBookmarkSubject] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Mock Error View Mode: 'chapters' (clubbed chapter-wise) vs 'buckets' (by error type) vs 'rca' (4-Bucket RCA) vs 'silly' (Silly Mistakes)
  const [mockViewMode, setMockViewMode] = useState<'chapters' | 'buckets' | 'rca' | 'silly'>(() => {
    try {
      const saved = safeStorage.getItem('mockViewMode');
      return (saved === 'buckets' || saved === 'rca' || saved === 'silly') ? saved : 'chapters';
    } catch {
      return 'chapters';
    }
  });

  const setMockViewModePersisted = (mode: 'chapters' | 'buckets' | 'rca' | 'silly') => {
    setMockViewMode(mode);
    try { safeStorage.setItem('mockViewMode', mode); } catch { }
  };

  const [modalSillySubFilter, setModalSillySubFilter] = useState<string>('all');

  const [rcaSelectedFilter, setRcaSelectedFilter] = useState<'all' | RCATagType | 'unclassified'>('all');
  const [rcaSearchQuery, setRcaSearchQuery] = useState<string>('');
  const [rcaVersion, setRcaVersion] = useState(0);

  useEffect(() => {
    loadBundledMockRcaMap();
    initSolutionResolver().catch(() => {});
    let debounceTimer: any;
    const handleRcaUpdated = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setRcaVersion(v => v + 1);
      }, 300);
    };
    window.addEventListener('cgl_rca_updated', handleRcaUpdated);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('cgl_rca_updated', handleRcaUpdated);
    };
  }, []);

  // Mock Error Test Scope Filter: 'all' (combined) | 'full' (full tests) | 'sectional' (sectional tests)
  const [mockTestTypeFilter, setMockTestTypeFilter] = useState<'all' | 'full' | 'sectional'>(() => {
    try {
      const saved = safeStorage.getItem('mockTestTypeFilter');
      return (saved === 'full' || saved === 'sectional') ? saved : 'all';
    } catch {
      return 'all';
    }
  });

  const setMockTestTypeFilterPersisted = (filter: 'all' | 'full' | 'sectional') => {
    setMockTestTypeFilter(filter);
    try { safeStorage.setItem('mockTestTypeFilter', filter); } catch { }
  };

  const [activeMockChapterModal, setActiveMockChapterModal] = useState<MockChapterModalData | null>(null);
  const [modalActiveSet, setModalActiveSet] = useState<number | 'all'>('all');
  const [modalErrorFilter, setModalErrorFilter] = useState<ModalFilterType>('all');
  const [setPickerModal, setSetPickerModal] = useState<SetPickerModalData | null>(null);
  const [selectedCheatSheet, setSelectedCheatSheet] = useState<Chapter | null>(null);

  // Bundled full mock questions dynamically loaded once on mount for unified error aggregation
  const [bundledMockQuestions, setBundledMockQuestions] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    loadAllBundledMockQuestions().then(all => {
      if (active) setBundledMockQuestions(all);
    });
    return () => { active = false; };
  }, []);

  // Resets all home/chapter navigation state and returns to home view
  const resetToHome = useCallback(() => {
    setView('home');
    setSelectedSubject(null);
    setSelectedMathSection(null);
    setSelectedEnglishSection(null);
    setSelectedGKSubject(null);
    setSelectedGKSubTopic('all');
    setSelectedTopic(null);
    setSelectedBookmarkSubject(null);
  }, []);

  const processData = (data: SubjectData, deletedIds: Set<string>) => {
    const filteredData: SubjectData = {};
    Object.entries(data).forEach(([subject, chapters]) => {
      const mergedChaptersMap: Record<string, Chapter> = {};
      const chapterQTextsMap = new Map<string, Set<string>>();

      chapters.forEach(chapter => {
        const titleLower = chapter.chapter_title.trim().toLowerCase();
        let canonicalTitle = chapter.chapter_title;

        // Standardize Math chapter names to include parenthetical versions
        if (subject.toLowerCase() === 'mathematics' || subject.toLowerCase().includes('aptitude')) {
          const lower = titleLower.replace(/\s+/g, ' ');
          if (lower === 'number system' || lower === 'number system (includes hcf, lcm, fractions)') {
            canonicalTitle = 'Number System (Includes HCF, LCM, Fractions)';
          } else if (lower === 'time and work' || lower === 'time and work (includes pipe and cistern)') {
            canonicalTitle = 'Time and Work (Includes Pipe and Cistern)';
          } else if (lower === 'time, speed and distance' || lower === 'time, speed and distance (includes boat, stream, races)') {
            canonicalTitle = 'Time, Speed and Distance (Includes Boat, Stream, Races)';
          } else if (lower === 'trigonometry' || lower === 'trigonometry (includes heights and distances)') {
            canonicalTitle = 'Trigonometry (Includes Heights and Distances)';
          }
        }

        const key = `${canonicalTitle.trim().toLowerCase()}|${chapter.section || ''}|${chapter.set_name || ''}`;

        if (!mergedChaptersMap[key]) {
          mergedChaptersMap[key] = {
            ...chapter,
            original_chapter_num: chapter.original_chapter_num || chapter.chapter_num,
            chapter_title: canonicalTitle,
            questions: []
          };
          chapterQTextsMap.set(key, new Set<string>());
        }

        const existingQs = mergedChaptersMap[key].questions;
        const existingQTexts = chapterQTextsMap.get(key)!;

        chapter.questions.forEach(q => {
          const qId = getQuestionId(chapter, q);
          const qTextClean = q.question.trim().toLowerCase();
          const isDeleted = deletedIds.has(qId) || deletedIds.has(qTextClean) || (!!q.id && deletedIds.has(q.id));
          if (!isDeleted) {
            if (!existingQTexts.has(qTextClean)) {
              existingQs.push(q);
              existingQTexts.add(qTextClean);
            }
          }
        });
      });

      filteredData[subject] = Object.values(mergedChaptersMap).map((chapter, chIdx) => {
        const origNum = chapter.original_chapter_num || chapter.chapter_num;
        return {
          ...chapter,
          original_chapter_num: origNum,
          chapter_num: (chapter.section === 'grammar' || chapter.section === 'ayush_vocab' || chapter.section === 'black_book')
            ? (origNum || chIdx + 1)
            : chIdx + 1,
          questions: chapter.questions.map((q, qIdx) => ({ ...q, q_num: qIdx + 1 }))
        };
      }).filter(chapter => chapter.questions.length > 0);
    });
    return filteredData;
  };

  const [rawData, setRawData] = useState<{ rawMockData: SubjectData; rawBankData: SubjectData }>({
    rawMockData: {},
    rawBankData: {}
  });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getCachedData<{ rawMockData: SubjectData; rawBankData: SubjectData }>()
      .then(cached => {
        if (cached && isMounted && Object.keys(cached.rawBankData || {}).length > 0) {
          setRawData(cached);
          setDataLoading(false);
        }
      })
      .catch(() => { });

    loadSubjectData()
      .then(data => {
        if (isMounted) {
          setRawData(data);
          setDataLoading(false);
          setCachedData(data).catch(() => { });
        }
      })
      .catch(err => {
        console.error('Error loading subject data:', err);
        if (isMounted) setDataLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const mockData = React.useMemo(() => processData(rawData.rawMockData, deletedQuestionIds), [rawData.rawMockData, deletedQuestionIds]);
  const bankData = React.useMemo(() => processData(rawData.rawBankData, deletedQuestionIds), [rawData.rawBankData, deletedQuestionIds]);

  const currentData = category === 'mockErrors' ? mockData : bankData;

  const [userResults, setUserResults] = useState<QuizResult[]>(() => {
    try {
      const guestRaw = safeStorage.getItem('guest_results') || safeStorage.getItem('cgl_user_results_cache_guest');
      if (guestRaw) {
        const parsed = JSON.parse(guestRaw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return [];
  });
  const [loadingResults, setLoadingResults] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  const toggleChapterExpand = (subject: string, chapterTitle: string) => {
    const key = `${subject}|${chapterTitle}`;
    setExpandedChapters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Latest (newest) saved result per chapter, keyed for quick lookup on Home/Dashboard.
  const latestResultByChapter = React.useMemo(() => {
    const map = new Map<string, QuizResult>();
    // Sort descending by completedAt so newest attempt is always picked
    const sorted = [...userResults].sort((a, b) => {
      const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    sorted.forEach(r => {
      const key = `${r.subject}|${r.chapter_title}`;
      if (!map.has(key)) map.set(key, r);
    });
    return map;
  }, [userResults]);

  const dashboardStats = useMemo(() => computeDashboardStats(userResults), [userResults]);

  // Auth Listener
  useEffect(() => {
    // Check if previously logged in as guest on localhost
    if (typeof window !== 'undefined' && isLocalhost && safeStorage.getItem('cgl_is_guest_login') === 'true') {
      setUser({
        uid: 'guest',
        email: 'guest@localhost',
        displayName: 'Guest Aspirant',
        emailVerified: true,
        isAnonymous: true,
      } as unknown as User);
      setLoading(false);
      try {
        const cached = safeStorage.getItem('guest_results') || safeStorage.getItem('cgl_user_results_cache_guest');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setUserResults(parsed);
        }
      } catch { }
    }

    // Clean up bloated mock caches, stale keys, and hydrate RCA from IDB/Firestore
    safeStorage.clearStaleTemporaryCaches();
    safeStorage.compactAndEvictStaleMockCaches();
    purgeBloatedIdbSubjectData().catch(() => {});
    initGlobalRcaStoreFromIdb().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (isLocalhost && safeStorage.getItem('cgl_is_guest_login') === 'true') {
        return;
      }
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        syncRcaFromFirestore().catch(() => {});
      }
      try {
        const key = currentUser ? `cgl_user_results_cache_${currentUser.uid}` : 'guest_results';
        const cached = safeStorage.getItem(key) || safeStorage.getItem('cgl_user_results_cache_guest');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            parsed.sort((a, b) => {
              const tA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
              const tB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
              return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
            });
            setUserResults(parsed);
          }
        }
      } catch { }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Deleted Questions — only when authenticated to avoid unauthenticated Firestore reads
  useEffect(() => {
    if (!user) return;
    const fetchDeleted = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'deleted_questions'));
        setDeletedQuestionIds(prev => {
          const merged = new Set(prev);
          querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.questionId) merged.add(data.questionId);
            if (data.questionText) merged.add(data.questionText);
          });
          try {
            safeStorage.setItem('cgl_deleted_question_ids', JSON.stringify(Array.from(merged)));
          } catch { }

          return merged;
        });
      } catch (error) {
        console.warn('Could not fetch deleted questions from remote DB (offline or rules):', error);
      }
    };
    fetchDeleted();
  }, [user]);

  // Fetch Results
  const fetchResults = useCallback(async () => {
    if (!user) {
      try {
        const guestHistory = JSON.parse(safeStorage.getItem('guest_results') || '[]');
        const cachedGuest = JSON.parse(safeStorage.getItem('cgl_user_results_cache_guest') || '[]');
        const combined = [...guestHistory, ...cachedGuest];
        const seen = new Set<string>();
        const unique = combined.filter((r: any) => {
          if (!r) return false;
          const id = r.id || `${r.subject}-${r.chapter_title}-${r.completedAt}`;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        unique.sort((a, b) => {
          const tA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const tB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
        });
        setUserResults(unique);
      } catch (e) {
        console.warn('Error reading local guest results:', e);
      }
      return;
    }

    setLoadingResults(true);
    // Populate immediately from local cache if userResults is empty
    try {
      const cached = safeStorage.getItem(`cgl_user_results_cache_${user.uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUserResults(parsed);
        }
      }
    } catch { }

    try {
      const q = query(
        collection(db, 'results'),
        where('userId', '==', user.uid),
        orderBy('completedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const remoteResults = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as QuizResult[];

      // Merge offline results
      let offlineResults: QuizResult[] = [];
      try {
        offlineResults = JSON.parse(safeStorage.getItem('offline_results_' + user.uid) || '[]');
      } catch { }

      const allMerged = [...remoteResults, ...offlineResults];

      // Filter out cleared history and individually deleted items
      let clearedAt: string | null = null;
      let hiddenIds = new Set<string>();
      try {
        if (typeof window !== 'undefined') {
          clearedAt = window.localStorage?.getItem('activity_cleared_at_' + user.uid) || null;
          hiddenIds = new Set(JSON.parse(window.localStorage?.getItem('hidden_result_ids_' + user.uid) || '[]'));
        }
      } catch (e) { }

      const seen = new Set<string>();
      const filtered = allMerged.filter(r => {
        if (!r || !r.id) return false;
        if (hiddenIds.has(r.id)) return false;
        if (clearedAt && r.completedAt && r.completedAt <= clearedAt) return false;
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      filtered.sort((a, b) => {
        const tA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const tB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });

      setUserResults(filtered);
      safeStorage.setItem(`cgl_user_results_cache_${user.uid}`, JSON.stringify(filtered.slice(0, 100)));
    } catch (error) {
      console.warn('Error fetching results with orderBy, attempting fallback query:', error);
      try {
        const fallbackQ = query(
          collection(db, 'results'),
          where('userId', '==', user.uid)
        );
        const fallbackSnapshot = await getDocs(fallbackQ);
        const fallbackResults = fallbackSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as QuizResult[];

        let offlineResults: QuizResult[] = [];
        try {
          offlineResults = JSON.parse(safeStorage.getItem('offline_results_' + user.uid) || '[]');
        } catch { }

        const allFallback = [...fallbackResults, ...offlineResults];
        let clearedAt: string | null = null;
        let hiddenIds = new Set<string>();
        try {
          if (typeof window !== 'undefined') {
            clearedAt = window.localStorage?.getItem('activity_cleared_at_' + user.uid) || null;
            hiddenIds = new Set(JSON.parse(window.localStorage?.getItem('hidden_result_ids_' + user.uid) || '[]'));
          }
        } catch (e) { }

        const seen = new Set<string>();
        const filtered = allFallback.filter(r => {
          if (!r || !r.id) return false;
          if (hiddenIds.has(r.id)) return false;
          if (clearedAt && r.completedAt && r.completedAt <= clearedAt) return false;
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });

        filtered.sort((a, b) => {
          const tA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const tB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
        });
        setUserResults(filtered);
        safeStorage.setItem(`cgl_user_results_cache_${user.uid}`, JSON.stringify(filtered.slice(0, 100)));
      } catch (fallbackErr) {
        console.warn('Fallback result fetch failed, keeping local cache:', fallbackErr);
      }
    } finally {
      setLoadingResults(false);
    }
  }, [user]);

  // Refetch results when the authenticated user changes
  useEffect(() => {
    fetchResults();
  }, [user, fetchResults]);

  // Refetch results when navigating to the analytics dashboard
  useEffect(() => {
    if (view === 'dashboard') {
      fetchResults();
    }
  }, [view, fetchResults]);

  // Fetch Bookmarks — wrapped in useCallback to prevent stale closure issues
  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    if (user.uid === 'guest') {
      try {
        const saved = safeStorage.getItem('cgl_guest_bookmarks');
        if (saved) setBookmarks(JSON.parse(saved));
      } catch { }
      setLoadingBookmarks(false);
      return;
    }
    setLoadingBookmarks(true);
    try {
      const q = query(
        collection(db, 'bookmarks'),
        where('userId', '==', user.uid),
        orderBy('bookmarkedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedBookmarks = querySnapshot.docs.map(d => ({
        ...d.data(),
        id: d.id
      })) as Bookmark[];
      setBookmarks(fetchedBookmarks);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoadingBookmarks(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && (view === 'home' || view === 'bookmarks' || view === 'quiz')) {
      fetchBookmarks();
    }
  }, [user, view, fetchBookmarks]);

  const toggleBookmark = async (question: Question) => {
    if (!user) return;

    if (user.uid === 'guest') {
      const existing = bookmarks.find(b =>
        b.question.question === question.question &&
        b.subject === (activeChapter?.subject || 'Unknown')
      );
      if (existing) {
        setBookmarks(prev => {
          const updated = prev.filter(b => b.id !== existing.id);
          try { safeStorage.setItem('cgl_guest_bookmarks', JSON.stringify(updated)); } catch { }
          return updated;
        });
      } else {
        const newBookmark: Bookmark = {
          id: `guest_bm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: 'guest',
          question,
          subject: activeChapter?.subject || 'Unknown',
          chapter_title: activeChapter?.chapter_title || 'Unknown',
          category: category,
          bookmarkedAt: new Date().toISOString()
        };
        setBookmarks(prev => {
          const updated = [newBookmark, ...prev];
          try { safeStorage.setItem('cgl_guest_bookmarks', JSON.stringify(updated)); } catch { }
          return updated;
        });
      }
      return;
    }

    const existing = bookmarks.find(b =>
      b.question.question === question.question &&
      b.subject === (activeChapter?.subject || 'Unknown')
    );

    if (existing && existing.id) {
      try {
        await deleteDoc(doc(db, 'bookmarks', existing.id));
        setBookmarks(prev => prev.filter(b => b.id !== existing.id));
      } catch (error) {
        console.error('Error removing bookmark:', error);
      }
    } else {
      try {
        let origChapterTitle = activeChapter?.chapter_title || 'Unknown';
        let origSubject = activeChapter?.subject || 'Unknown';
        let origCategory = category;

        if (activeChapter?.chapter_title.startsWith('Bookmarked:')) {
          if (activeChapter.chapter_title.startsWith('Bookmarked: All')) {
            const foundChapter = currentData[activeChapter.subject]?.find(ch =>
              ch.questions.some(q => q.question === question.question)
            );
            if (foundChapter) {
              origChapterTitle = foundChapter.chapter_title;
              origSubject = foundChapter.subject;
            }
          } else {
            origChapterTitle = activeChapter.chapter_title.replace('Bookmarked: ', '');
            origSubject = activeChapter.subject;
          }
        }

        const newBookmark: Bookmark = {
          userId: user.uid,
          question,
          subject: origSubject,
          chapter_title: origChapterTitle,
          category: origCategory,
          bookmarkedAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, 'bookmarks'), newBookmark);
        setBookmarks(prev => [{ ...newBookmark, id: docRef.id }, ...prev]);
      } catch (error) {
        console.error('Error adding bookmark:', error);
      }
    }
  };

  const handleDeleteQuestion = async (question: Question) => {
    if (!question) return;

    const qTextClean = question.question.trim().toLowerCase();
    const coreText = qTextClean ? qTextClean.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';
    const qId = (view === 'quiz' && activeChapter) ? getQuestionId(activeChapter, question) : (question.id || qTextClean);

    // If deleting during an active Mistakes Drill in quiz mode, ONLY remove it from the Mistake Notebook!
    const isMistakeDrill =
      view === 'quiz' &&
      (activeChapter?.section === 'mistakes_drill' ||
       (activeChapter?.chapter_title || '').toLowerCase().includes('mistakes drill'));

    if (isMistakeDrill) {
      // 1. Remove from activeChapter questions so current quiz continues without it
      if (activeChapter) {
        const updatedQuestions = activeChapter.questions.filter(q => {
          const thisId = getQuestionId(activeChapter, q);
          const thisText = q.question.trim().toLowerCase();
          return thisId !== qId && thisText !== qTextClean && (!question.id || q.id !== question.id);
        });
        setActiveChapter({
          ...activeChapter,
          questions: updatedQuestions.map((q, idx) => ({ ...q, q_num: idx + 1 }))
        });
      }

      // 2. Remove ONLY from Mistake Notebook (local & Firestore)
      try {
        const rawOpts = extractOptionsArray(question.options);
        const targetKey = getDedupeKey(question.question, question.id, rawOpts);

        // Remove from cgl_user_mistake_notebook
        const nbRaw = safeStorage.getItem('cgl_user_mistake_notebook');
        if (nbRaw) {
          const list = JSON.parse(nbRaw);
          if (Array.isArray(list)) {
            const filtered = list.filter((m: any) => {
              const mKey = getDedupeKey(m.question, m.id, m.options);
              return m.id !== question.id && mKey !== targetKey;
            });
            safeStorage.setItem('cgl_user_mistake_notebook', JSON.stringify(filtered));
          }
        }

        // Remove from cgl_synced_telegram_mistakes
        const synRaw = safeStorage.getItem('cgl_synced_telegram_mistakes');
        if (synRaw) {
          const list = JSON.parse(synRaw);
          if (Array.isArray(list)) {
            const filtered = list.filter((m: any) => {
              const mKey = getDedupeKey(m.question, m.id, m.options);
              return m.id !== question.id && mKey !== targetKey;
            });
            safeStorage.setItem('cgl_synced_telegram_mistakes', JSON.stringify(filtered));
          }
        }

        // Remove from Firestore user_mistakes if authenticated
        if (auth.currentUser) {
          const docId = question.id ? question.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) : '';
          if (docId) {
            deleteDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, docId)).catch(() => {});
          } else {
            const snap = await getDocs(collection(db, `user_mistakes_${auth.currentUser.uid}`));
            for (const d of snap.docs) {
              const dData = d.data();
              const dKey = getDedupeKey(dData?.question, d.id, dData?.options);
              if (d.id === question.id || dKey === targetKey) {
                deleteDoc(doc(db, `user_mistakes_${auth.currentUser.uid}`, d.id)).catch(() => {});
              }
            }
          }
        }

        window.dispatchEvent(new CustomEvent('cgl_mistakes_updated', { detail: { count: 1 } }));
      } catch (err) {
        console.warn('Error removing question from mistake notebook:', err);
      }

      showToast('Question removed from Mistake Notebook.', 'info');
      return; // Do NOT proceed to delete from chapter bank or deleted_questions!
    }

    // 1. Immediately update deletedQuestionIds set & localStorage so it's deleted everywhere
    setDeletedQuestionIds(prev => {
      const next = new Set(prev);
      if (qId) next.add(String(qId).toLowerCase().trim());
      if (question.id) next.add(String(question.id).toLowerCase().trim());
      if (qTextClean) next.add(qTextClean);
      if (coreText) next.add(coreText);
      try {
        safeStorage.setItem('cgl_deleted_question_ids', JSON.stringify(Array.from(next)));
      } catch { }
      return next;
    });

    // 2. Evict from memory in mock aggregator
    evictDeletedQuestionFromAggregator(question.id, qTextClean);

    // 3. Update bundledMockQuestions state
    setBundledMockQuestions(prev => prev.filter(q => {
      const thisId = q.id ? String(q.id).toLowerCase().trim() : '';
      const thisText = (q.question || q.questionText || '').trim().toLowerCase();
      const thisCore = thisText ? thisText.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';
      if (question.id && thisId === String(question.id).toLowerCase().trim()) return false;
      if (qId && thisId === String(qId).toLowerCase().trim()) return false;
      if (thisText === qTextClean) return false;
      if (coreText && thisCore === coreText) return false;
      return true;
    }));

    // 4. Update rawData state so mockData re-derives immediately
    setRawData(prev => {
      const nextMock: SubjectData = {};
      Object.entries(prev.rawMockData || {}).forEach(([sub, chs]) => {
        nextMock[sub] = (chs as Chapter[] || []).map(ch => ({
          ...ch,
          questions: (ch.questions || []).filter(q => {
            const thisId = q.id ? String(q.id).toLowerCase().trim() : '';
            const thisText = (q.question || (q as any).questionText || '').trim().toLowerCase();
            const thisCore = thisText ? thisText.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';
            if (question.id && thisId === String(question.id).toLowerCase().trim()) return false;
            if (qId && thisId === String(qId).toLowerCase().trim()) return false;
            if (thisText === qTextClean) return false;
            if (coreText && thisCore === coreText) return false;
            return true;
          })
        }));
      });
      return { ...prev, rawMockData: nextMock };
    });

    // 5. Remove from activeChapter immediately if in quiz mode
    if (activeChapter) {
      const updatedQuestions = activeChapter.questions.filter(q => {
        const thisId = getQuestionId(activeChapter, q);
        const thisText = q.question.trim().toLowerCase();
        return thisId !== qId && thisText !== qTextClean && (!question.id || q.id !== question.id);
      });
      setActiveChapter({
        ...activeChapter,
        questions: updatedQuestions.map((q, idx) => ({ ...q, q_num: idx + 1 }))
      });
    }

    // 6. Immediately update reviewResult if currently reviewing
    setReviewResult(prev => {
      if (!prev || !prev.questionDetails) return prev;
      const updatedDetails = prev.questionDetails.filter(qd => {
        const thisId = qd.question?.id ? String(qd.question.id).toLowerCase().trim() : '';
        const thisText = (qd.question?.question || '').trim().toLowerCase();
        const thisCore = thisText ? thisText.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';
        if (question.id && thisId === String(question.id).toLowerCase().trim()) return false;
        if (qId && thisId === String(qId).toLowerCase().trim()) return false;
        if (thisText === qTextClean) return false;
        if (coreText && thisCore === coreText) return false;
        return true;
      });
      return {
        ...prev,
        questionDetails: updatedDetails,
        totalQuestions: updatedDetails.length
      };
    });

    // 7. Update userResults so previous results state don't hold the deleted question
    setUserResults(prev => prev.map(res => {
      if (!res.questionDetails) return res;
      const updatedDetails = res.questionDetails.filter(qd => {
        const thisId = qd.question?.id ? String(qd.question.id).toLowerCase().trim() : '';
        const thisText = (qd.question?.question || '').trim().toLowerCase();
        const thisCore = thisText ? thisText.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';
        if (question.id && thisId === String(question.id).toLowerCase().trim()) return false;
        if (qId && thisId === String(qId).toLowerCase().trim()) return false;
        if (thisText === qTextClean) return false;
        if (coreText && thisCore === coreText) return false;
        return true;
      });
      return {
        ...res,
        questionDetails: updatedDetails,
        totalQuestions: updatedDetails.length
      };
    }));

    // 8. Also remove from bookmarks if present
    setBookmarks(prev => prev.filter(b => b.question.question.trim().toLowerCase() !== qTextClean));

    // 9. Purge from all cached mock questions (cgl_mock_questions_*) and sync to backend
    try {
      const allKeys = safeStorage.getAllKeys();
      for (const key of allKeys) {
        if (key && key.startsWith('cgl_mock_questions_')) {
          try {
            const raw = safeStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const updated = list.filter((q: any) => {
                  const t = (q.question || q.questionText || '').trim().toLowerCase();
                  const c = t ? t.replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-zA-Z0-9]/g, '') : '';
                  const thisId = q.id ? String(q.id).toLowerCase().trim() : '';
                  if (question.id && thisId === String(question.id).toLowerCase().trim()) return false;
                  if (t === qTextClean) return false;
                  if (coreText && c === coreText) return false;
                  return true;
                });
                if (updated.length !== list.length) {
                  safeStorage.setItem(key, JSON.stringify(updated));
                  const mockId = key.replace('cgl_mock_questions_', '');
                  fetch(`/api/mock-questions/${encodeURIComponent(mockId)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updated)
                  }).catch(() => { });
                }
              }
            }
          } catch { }
        }
      }
    } catch { }

    // 10. Purge from cgl_rca_global_store and sync to Firestore
    try {
      const globalRaw = safeStorage.getItem('cgl_rca_global_store');
      if (globalRaw) {
        const globalStore = JSON.parse(globalRaw);
        if (question.id) delete globalStore[question.id];
        delete globalStore[qId];
        delete globalStore[qTextClean];
        if (coreText) delete globalStore[coreText];
        safeStorage.setItem('cgl_rca_global_store', JSON.stringify(globalStore));
        syncRcaToFirestore(globalStore).catch(() => {});
      }
    } catch { }

    // 11. Remove from Mistake Notebook
    try {
      const rawOpts = extractOptionsArray(question.options);
      const targetKey = getDedupeKey(question.question, question.id, rawOpts);
      const nbRaw = safeStorage.getItem('cgl_user_mistake_notebook');
      if (nbRaw) {
        const list = JSON.parse(nbRaw);
        if (Array.isArray(list)) {
          const filtered = list.filter((m: any) => {
            const mKey = getDedupeKey(m.question, m.id, m.options);
            return m.id !== question.id && mKey !== targetKey;
          });
          safeStorage.setItem('cgl_user_mistake_notebook', JSON.stringify(filtered));
        }
      }
    } catch {}

    // 12. Persist to Firestore deleted_questions collection
    try {
      await addDoc(collection(db, 'deleted_questions'), {
        questionId: question.id || qId,
        questionText: qTextClean,
        coreText,
        chapter_title: activeChapter?.chapter_title || reviewResult?.chapter_title || 'Unknown',
        subject: activeChapter?.subject || reviewResult?.subject || 'Unknown',
        deletedBy: user?.uid || 'user',
        deletedAt: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Could not sync deleted question to remote DB (offline/rules):', error);
    }

    // 13. Force immediate recalculation of all aggregated mock errors data
    setRcaVersion(v => v + 1);
    window.dispatchEvent(new CustomEvent('cgl_rca_updated'));
  };

  const handleLogin = async () => {
    try {
      if (!auth) {
        console.error('Login failed: Firebase Auth is not initialized');
        return;
      }
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error?.code === 'auth/popup-blocked') {
        alert('Popup was blocked by your browser. Please allow popups for this site to sign in with Google.');
      }
    }
  };

  const handleGuestLogin = () => {
    const guestUser = {
      uid: 'guest',
      email: 'guest@localhost',
      displayName: 'Guest Aspirant',
      emailVerified: true,
      isAnonymous: true,
    } as unknown as User;
    setUser(guestUser);
    setLoading(false);
    try {
      safeStorage.setItem('cgl_is_guest_login', 'true');
    } catch { }
  };

  const handleLogout = async () => {
    try {
      safeStorage.removeItem('cgl_is_guest_login');
      if (user?.uid !== 'guest') {
        await signOut(auth);
      }
      setUser(null);
      setView('home');
      setSelectedSubject(null);
      setSelectedMathSection(null);
      setSelectedEnglishSection(null);
      setSelectedGKSubject(null);
      setSelectedGKSubTopic('all');
      setSelectedTopic(null);
      setSelectedBookmarkSubject(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const startQuiz = (chapter: Chapter) => {
    if (!chapter.questions || chapter.questions.length === 0) {
      alert(`No questions available in "${chapter.chapter_title}" yet.`);
      return;
    }
    setActiveChapter(chapter);
    setView('quiz');
    if (quizMode === 'mock') {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => { });
      }
    }
  };

  const startAllSubjectQuiz = (subjectName: string) => {
    let sourceQuestions: Question[] = [];
    if (category === 'mockErrors') {
      sourceQuestions = clubbedMockChapters.flatMap(ch => ch.questions);
    } else {
      sourceQuestions = (currentData[subjectName] || []).flatMap(ch => ch.questions);
    }
    const allQuestions = sourceQuestions.map((q, idx) => cleanQuestionForSession(q, idx));
    if (allQuestions.length === 0) {
      alert(`No questions available in ${subjectName} for ${mockTestTypeFilter === 'full' ? 'Full Tests' : mockTestTypeFilter === 'sectional' ? 'Sectional Tests' : 'this filter'}.`);
      return;
    }
    const scopeLabel = category === 'mockErrors' && mockTestTypeFilter !== 'all'
      ? ` (${mockTestTypeFilter === 'full' ? 'Full Tests' : 'Sectional'})`
      : '';
    const gkLabel = category === 'mockErrors' && subjectName === 'General Awareness' && mockGKFilter !== 'all'
      ? ` • ${mockGKFilter.charAt(0).toUpperCase() + mockGKFilter.slice(1).replace('_', ' ')}`
      : '';
    const filterLabel = `${scopeLabel}${gkLabel}`;

    // In Mock Errors: if questions exceed 25, open the set picker modal
    if (category === 'mockErrors' && allQuestions.length > 25) {
      setSetPickerModal({
        title: `All ${subjectName} Questions${filterLabel}`,
        subtitle: `${allQuestions.length} questions in this subject`,
        subject: subjectName,
        questions: allQuestions
      });
      return;
    }

    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `All ${subjectName} Questions${filterLabel}`,
      subject: subjectName,
      subject_id: subjectName.toLowerCase().replace(/\s+/g, '_'),
      questions: allQuestions
    };
    startQuiz(virtualChapter);
  };

  const startMockTopicQuiz = (chapter: Chapter, topicName: string) => {
    const filteredQuestions = chapter.questions
      .filter(q => {
        if (category === 'mockErrors' && mockTestTypeFilter !== 'all') {
          if (classifyTestType(q) !== mockTestTypeFilter) return false;
        }
        const raw = q.tags?.topic || (q as any).topic || detectTopic(q, chapter.subject || '');
        return normalizeTopicTitle(raw) === topicName;
      })
      .map((q, idx) => cleanQuestionForSession(q, idx));
    if (filteredQuestions.length === 0) {
      alert(`No questions available in topic "${topicName}" yet.`);
      return;
    }

    // In Mock Errors: if topic questions exceed 25, open the set picker modal
    if (category === 'mockErrors' && filteredQuestions.length > 25) {
      setSetPickerModal({
        title: `${chapter.chapter_title} • ${topicName}`,
        subtitle: `${filteredQuestions.length} questions in this topic`,
        subject: chapter.subject || selectedSubject || 'All Subjects',
        questions: filteredQuestions
      });
      return;
    }

    const virtualChapter: Chapter = {
      chapter_num: chapter.chapter_num,
      chapter_title: `${chapter.chapter_title} • ${topicName}`,
      subject: chapter.subject,
      subject_id: chapter.subject_id,
      questions: filteredQuestions
    };
    startQuiz(virtualChapter);
  };

  const startWeakTopicDrill = (topicName: string, subjectName?: string) => {
    const normalized = normalizeTopicTitle(topicName);
    const targetSubject = subjectName || (
      ['Active & Passive Voice', 'Direct & Indirect Speech', 'Para Jumbles', 'One Word Substitution', 'Spelling Errors', 'Synonyms & Antonyms', 'Spotting Errors', 'Cloze Test'].includes(normalized)
        ? 'English'
        : ['Missing Number / Matrix', 'Analogy', 'Coding-Decoding', 'Syllogism', 'Direction & Distance', 'Blood Relations', 'Venn Diagram'].includes(normalized)
          ? 'Reasoning'
          : 'Mathematics'
    );

    // 1. Gather all questions matching this topic from mockData (mock errors)
    const mockQuestions = (mockData[targetSubject] || []).flatMap(ch => ch.questions).filter(q => {
      const raw = q.tags?.topic || (q as any).topic || detectTopic(q, targetSubject);
      return normalizeTopicTitle(raw) === normalized;
    });

    // 2. Gather from bankData (chapter bank)
    const bankQuestions = (bankData[targetSubject] || []).flatMap(ch => ch.questions).filter(q => {
      const raw = q.tags?.topic || (q as any).topic || detectTopic(q, targetSubject);
      return normalizeTopicTitle(raw) === normalized;
    });

    // Combine, deduplicate, and limit to 15-20 questions
    const combined = [...mockQuestions, ...bankQuestions];
    const seen = new Set<string>();
    const drillQuestions: Question[] = [];
    for (const q of combined) {
      const key = (q.question || '').trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        drillQuestions.push({
          ...q,
          q_num: drillQuestions.length + 1
        });
        if (drillQuestions.length >= 20) break;
      }
    }

    if (drillQuestions.length === 0) {
      alert(`No practice questions found specifically for topic "${normalized}".`);
      return;
    }

    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `AI Targeted Drill • ${normalized} (${drillQuestions.length} Qs)`,
      subject: targetSubject,
      subject_id: targetSubject.toLowerCase().replace(/\s+/g, '_'),
      questions: drillQuestions
    };

    setCategory('mockErrors');
    setQuizMode('practice');
    startQuiz(virtualChapter);
  };

  const startSubjectBookmarkQuiz = (subjectName: string, subjectBookmarks: Bookmark[]) => {
    const questions = subjectBookmarks.map((b, idx) => ({
      ...b.question,
      q_num: idx + 1
    }));
    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `Bookmarked: All ${subjectName}`,
      subject: subjectName,
      subject_id: subjectName.toLowerCase().replace(/\s+/g, '_'),
      questions
    };
    startQuiz(virtualChapter);
  };

  const startChapterBookmarkQuiz = (subjectName: string, chapterTitle: string, chapterBookmarks: Bookmark[]) => {
    const questions = chapterBookmarks.map((b, idx) => ({
      ...b.question,
      q_num: idx + 1
    }));
    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `Bookmarked: ${chapterTitle}`,
      subject: subjectName,
      subject_id: subjectName.toLowerCase().replace(/\s+/g, '_'),
      questions
    };
    startQuiz(virtualChapter);
  };

  const handleSaveQuizResult = async (
    results: Omit<QuizResult, 'userId' | 'completedAt'>
  ): Promise<QuizResult | null> => {
    const fullResult: QuizResult = {
      ...results,
      userId: user ? user.uid : 'guest',
      completedAt: new Date().toISOString(),
    };

    let savedResult: QuizResult;

    if (!user) {
      const guestSaved: QuizResult = { ...fullResult, id: 'guest-' + Date.now() };
      try {
        const guestHistory: QuizResult[] = JSON.parse(safeStorage.getItem('guest_results') || '[]');
        const updated = [guestSaved, ...guestHistory.filter(r => r.id !== guestSaved.id)].slice(0, 100);
        safeStorage.setItem('guest_results', JSON.stringify(updated));
        safeStorage.setItem('cgl_user_results_cache_guest', JSON.stringify(updated));
      } catch { }
      setUserResults(prev => [guestSaved, ...prev.filter(r => r.id !== guestSaved.id)]);
      savedResult = guestSaved;
    } else {
      try {
        // 98% Firestore Payload Optimization:
        // Retain scoring, time, answer choices, and RCA tags while omitting multi-paragraph solutions and image blobs.
        const lightweightQuestionDetails = (fullResult.questionDetails || []).map(d => {
          const hasAnswer = Boolean(d.selectedAnswer && String(d.selectedAnswer).trim() !== '');
          const isCorrect = Boolean(d.isCorrect);
          const isSlow = Boolean((d as any).isSlow || (d.timeSpent && d.timeSpent > 90));
          const status = isCorrect ? (isSlow ? 'Correct (Slow)' : 'Correct') : (hasAnswer ? 'Incorrect' : 'Unattempted');
          const errorType = isCorrect ? (isSlow ? 'speed_issue' : 'correct') : (hasAnswer ? 'wrong' : 'unattempted');

          return {
            q_num: d.q_num,
            timeSpent: d.timeSpent || 0,
            isCorrect,
            isSlow,
            status,
            errorType,
            selectedAnswer: d.selectedAnswer || '',
            marked: Boolean(d.marked),
            avgTime: d.avgTime || d.question?.avgTime || null,
            avgTimeSeconds: d.avgTimeSeconds || d.question?.avgTimeSeconds || null,
            rca: d.rca || d.question?.rca || null,
            question: d.question ? {
              id: d.question.id || `${fullResult.chapter_title}_${d.q_num}`,
              q_num: d.question.q_num || d.q_num,
              question: d.question.question || '',
              options: d.question.options || { a: '', b: '', c: '', d: '' },
              answer: d.question.answer || 'a',
              subject: d.question.subject || fullResult.subject || '',
              section: d.question.section || '',
              topic: d.question.topic || d.question.tags?.topic || '',
              solution: d.question.solution || (d.question as any).explanation || (d as any).solution || '',
              rca: d.rca || d.question?.rca || null,
            } : null
          };
        });

        const firestorePayload = {
          ...fullResult,
          questionDetails: lightweightQuestionDetails
        };

        // Deep sanitize to strip any undefined properties that Firestore rejects
        const sanitizedDoc = JSON.parse(JSON.stringify(firestorePayload));
        const docRef = await addDoc(collection(db, 'results'), sanitizedDoc);
        savedResult = { ...fullResult, id: docRef.id };
        setUserResults(prev => {
          const updated = [savedResult, ...prev.filter(r => r.id !== savedResult.id)];
          try {
            safeStorage.setItem('cgl_user_results_cache_' + user.uid, JSON.stringify(updated.slice(0, 100)));
          } catch { }
          return updated;
        });
      } catch (error) {
        console.warn('Firestore offline or storage restricted, saving attempt locally:', error);
        savedResult = { ...fullResult, id: 'local-' + Date.now() };
        try {
          const localHistory = JSON.parse(safeStorage.getItem('offline_results_' + user.uid) || '[]');
          safeStorage.setItem('offline_results_' + user.uid, JSON.stringify([savedResult, ...localHistory].slice(0, 50)));
        } catch { }
        setUserResults(prev => {
          const updated = [savedResult, ...prev.filter(r => r.id !== savedResult.id)];
          try {
            safeStorage.setItem('cgl_user_results_cache_' + user.uid, JSON.stringify(updated.slice(0, 100)));
          } catch { }
          return updated;
        });
      }
    }

    const isMockTest = fullResult.mode === 'mock' && isFullOrSectionalMock(fullResult);

    // If mock quiz, cache full question attempt details into cgl_mock_questions_* immediately so Mock Errors displays them right away
    if (isMockTest && fullResult.questionDetails && fullResult.questionDetails.length > 0) {
      try {
        const isSectional = (
          (fullResult as any).type === 'sectional' ||
          (savedResult as any).type === 'sectional' ||
          (fullResult.totalQuestions && fullResult.totalQuestions <= 35) ||
          (savedResult.totalQuestions && savedResult.totalQuestions <= 35)
        );
        const resolvedTestType: 'full' | 'sectional' = isSectional ? 'sectional' : 'full';

        const mockQuestionsToSave = fullResult.questionDetails.map((d, idx) => {
          const hasAnswer = Boolean(d.selectedAnswer && String(d.selectedAnswer).trim() !== '');
          const isCorrect = Boolean(d.isCorrect);
          const isSlow = Boolean((d as any).isSlow || (d.timeSpent && d.timeSpent > 90));
          const status = isCorrect ? (isSlow ? 'Correct (Slow)' : 'Correct') : (hasAnswer ? 'Incorrect' : 'Unattempted');
          const errorType = isCorrect ? (isSlow ? 'speed_issue' : 'correct') : (hasAnswer ? 'wrong' : 'unattempted');

          return {
            ...(d.question || {}),
            q_num: d.q_num || idx + 1,
            mockId: savedResult.id,
            testId: savedResult.id,
            testName: fullResult.chapter_title,
            testType: resolvedTestType,
            mockType: resolvedTestType,
            userAnswer: d.selectedAnswer || '',
            selectedAnswer: d.selectedAnswer || '',
            chosenOption: d.selectedAnswer || '',
            isCorrect,
            isSlow,
            status,
            errorType,
            timeSpent: d.timeSpent || 0,
            userTime: d.timeSpent || 0
          };
        });
        const leanToSave = toLeanQuestionCache(mockQuestionsToSave);
        safeStorage.setItem(`cgl_mock_questions_${savedResult.id}`, JSON.stringify(leanToSave));
        setIdbKey(`cgl_mock_questions_${savedResult.id}`, leanToSave).catch(() => {});
        fetch(`/api/mock-questions/${encodeURIComponent(savedResult.id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockQuestionsToSave)
        }).catch(() => {});
      } catch (err) {
        console.warn('Failed to cache mock questions locally:', err);
      }
    }

    // Automatically record wrong & unattempted answers to local Mistake Notebook & Firestore
    // STRICTLY for Chapter Bank quizzes and Mock Error remediation drills (NEVER full/sectional mocks)
    try {
      const isEligibleCategory = (savedResult.category === 'chapterBank' || savedResult.category === 'mockErrors') && !isFullOrSectionalMock(savedResult);

      if (isEligibleCategory) {
        const errorList = (fullResult.questionDetails || []).filter(d => !d.isCorrect && d.question);
        if (errorList.length > 0) {
          const uid = user ? user.uid : (auth.currentUser ? auth.currentUser.uid : undefined);
          const recorded = recordQuizMistakes(savedResult, uid);
          if (recorded && recorded.length > 0) {
            showToast(`Recorded ${recorded.length} mistake(s) into your Mistake Notebook.`, 'success');
          }
        }
      }
    } catch (err) {
      console.warn('[handleSaveQuizResult] Error recording mistakes:', err);
    }



    return savedResult;
  };

  const handleQuizExit = () => {
    setView('home');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => { });
    }
  };

  const handleReviewFromQuiz = (result: QuizResult) => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => { });
    }
    openReview(result, 'home');
  };

  const handleClearAllResults = async () => {
    if (userResults.length === 0) {
      alert('No recent activity records to clear.');
      return;
    }

    if (!user) {
      if (!window.confirm(`Are you sure you want to clear all ${userResults.length} local practice records? This action cannot be undone.`)) {
        return;
      }
      try {
        safeStorage.removeItem('guest_results');
        safeStorage.removeItem('cgl_user_results_cache_guest');
      } catch { }
      setUserResults([]);
      alert('All local practice records have been cleared.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete all ${userResults.length} records from your Recent Activity history? This action cannot be undone.`)) {
      return;
    }
    setLoadingResults(true);

    // 1. Immediately record cleared timestamp in localStorage and clear local cache
    const nowIso = new Date().toISOString();
    try {
      safeStorage.setItem('activity_cleared_at_' + user.uid, nowIso);
      safeStorage.removeItem('cgl_user_results_cache_' + user.uid);
      safeStorage.removeItem('offline_results_' + user.uid);
    } catch { }

    // 2. Clear state immediately
    setUserResults([]);

    // 3. Attempt physical deletion from Firestore (handles permission errors gracefully)
    try {
      const q = query(
        collection(db, 'results'),
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(d =>
        deleteDoc(doc(db, 'results', d.id)).catch(err => {
          console.warn('Firestore doc delete permission note:', d.id, err);
        })
      );
      await Promise.all(deletePromises);
      // All recent activity results processed
    } catch (error) {
      console.warn('Firestore bulk delete notice (handled via local filter):', error);
    } finally {
      setLoadingResults(false);
      alert('All recent activity records have been cleared from your history.');
    }
  };

  const openReview = (result: QuizResult, backTo: ReviewBackTo = 'dashboard') => {
    let resultToReview: QuizResult = { ...result };

    // 1. If questionDetails is missing or empty, attempt to load from cached mock questions
    if (!resultToReview.questionDetails || resultToReview.questionDetails.length === 0) {
      if (result.id) {
        try {
          const cachedRaw = safeStorage.getItem(`cgl_mock_questions_${result.id}`);
          let list = cachedRaw ? JSON.parse(cachedRaw) : null;
          if (!list || !Array.isArray(list) || list.length === 0) {
            const bundledMod = (mockQuestionModules as any)[`./data/mock_questions/${result.id}.json`];
            if (bundledMod) {
              const rawMod = bundledMod.default || bundledMod;
              list = Array.isArray(rawMod) ? rawMod : (rawMod?.questions || rawMod?.data || null);
            }
          }
          if (Array.isArray(list) && list.length > 0) {
            resultToReview.questionDetails = list.map((q: any, idx: number) => {
              // Prefer the explicitly saved selectedAnswer; fall back to userAnswer
              // only when selectedAnswer is truly absent (undefined/null), NOT when it
              // is '' (empty string = unattempted in the current session). This prevents
              // imported question-object answers (userAnswer/chosenOption from Testbook
              // or Oliveboard) from making unattempted questions appear as wrong.
              const ans = q.selectedAnswer !== undefined && q.selectedAnswer !== null
                ? q.selectedAnswer
                : (q.userAnswer || q.chosenOption || '');
              return {
                q_num: q.q_num || idx + 1,
                question: q,
                selectedAnswer: ans,
                isCorrect: Boolean(q.isCorrect),
                timeSpent: q.timeSpent || q.userTime || 0,
                rca: q.rca
              };
            });
          }
        } catch {}
      }
    }

    // 2. If still missing, attempt to find matching chapter (including stripped set / drill suffixes)
    if (!resultToReview.questionDetails || resultToReview.questionDetails.length === 0) {
      const primaryData = result.category === 'mockErrors' ? mockData : bankData;
      const secondaryData = result.category === 'mockErrors' ? bankData : mockData;
      const cleanTitle = (result.chapter_title || '')
        .replace(/\s*•\s*Set\s*\d+.*$/i, '')
        .replace(/\s*•\s*\[\w+\]\s*.*$/i, '')
        .trim();
      const chapter = (primaryData[result.subject] || []).find(ch => ch.chapter_title === result.chapter_title || (cleanTitle && ch.chapter_title === cleanTitle))
        || (secondaryData[result.subject] || []).find(ch => ch.chapter_title === result.chapter_title || (cleanTitle && ch.chapter_title === cleanTitle));
      if (chapter && chapter.questions) {
        resultToReview = {
          ...resultToReview,
          questionDetails: chapter.questions.map((q, idx) => ({
            q_num: q.q_num || idx + 1,
            question: q,
            selectedAnswer: '',
            isCorrect: false,
            timeSpent: 0
          }))
        };
      }
    }

    // 3. Guarantee every questionDetail has a well-formed Question object and rehydrate missing solutions
    if (resultToReview.questionDetails && resultToReview.questionDetails.length > 0) {
      let globalRcaMap: Record<string, any> = {};
      try {
        const rawStore = safeStorage.getItem('cgl_rca_global_store');
        if (rawStore) globalRcaMap = JSON.parse(rawStore);
      } catch {}

      let cachedMockQuestions: any[] = [];
      if (result.id) {
        try {
          const rawCached = safeStorage.getItem(`cgl_mock_questions_${result.id}`);
          if (rawCached) cachedMockQuestions = JSON.parse(rawCached);
        } catch {}
      }

      resultToReview.questionDetails = resultToReview.questionDetails.map((qd, idx) => {
        let q = qd.question;
        const qdAny = qd as any;

        const rawSub = qdAny.subject || qdAny.section || (qdAny.tags && qdAny.tags.topic) || qdAny.topic || '';
        let detectedSub = 'General Awareness';
        if (/reason|intel/i.test(rawSub)) detectedSub = 'Reasoning';
        else if (/quant|math|aptitude|arithmetic|advance/i.test(rawSub)) detectedSub = 'Mathematics';
        else if (/eng|comprehension|verbal|vocab|grammar|cloze|synonym|antonym|idiom|phrase|one\s*word|substitution|para\s*jumble|jumbled|spelling|voice|narration|sentence\s*improvement|spotting\s*error/i.test(rawSub)) detectedSub = 'English';
        else if (/aware|gk|gs|ga|knowledge|history|polity|geography|science|economy/i.test(rawSub)) detectedSub = 'General Awareness';
        else if (result.subject && result.subject !== 'All 4 Sections Mock') detectedSub = result.subject;

        const secKey = detectedSub === 'Reasoning' ? 'part_a' : detectedSub === 'General Awareness' ? 'part_b' : detectedSub === 'Mathematics' ? 'part_c' : 'part_d';

        if (!q || !q.question) {
          q = {
            id: qdAny.id || (result.id ? `${result.id}_${idx + 1}` : `q_${idx + 1}`),
            q_num: qd.q_num || idx + 1,
            question: qdAny.questionText || qdAny.question || 'Question text unavailable',
            options: qdAny.options || {},
            answer: qdAny.answer || qdAny.correctAnswer || 'a',
            solution: qdAny.solution || (qdAny.question && qdAny.question.solution) || '',
            subject: qdAny.subject || detectedSub,
            section: qdAny.section || secKey,
            topic: qdAny.topic || result.chapter_title || 'Review',
            rca: qd.rca || qdAny.rca || null
          };
        } else if (!q.subject || !q.section) {
          q = {
            ...q,
            subject: q.subject || detectedSub,
            section: (q as any).section || secKey
          };
        }

        // Rehydrate solution if missing
        let sol = q.solution || (q as any).explanation || (q as any).sol || (q as any).detailedSolution || qdAny.solution || '';
        if (!sol) {
          const qId = q.id || qdAny.id;
          const qText = (q.question || '').trim().toLowerCase();
          const rcaMatch = (qId && globalRcaMap[qId]) || (qText && globalRcaMap[qText]);
          if (rcaMatch && (rcaMatch.solution || rcaMatch.explanation || rcaMatch.sol)) {
            sol = rcaMatch.solution || rcaMatch.explanation || rcaMatch.sol;
          } else if (Array.isArray(cachedMockQuestions) && cachedMockQuestions[idx]) {
            const cachedItem = cachedMockQuestions[idx];
            sol = cachedItem?.solution || cachedItem?.explanation || cachedItem?.sol || cachedItem?.detailedSolution || '';
          }
        }
        if (!sol) {
          sol = resolveQuestionSolution({ ...q, id: q.id || qdAny.id, mockId: result.id, testId: result.id });
        }

        if (sol && !q.solution) {
          q = { ...q, solution: sol };
        }

        const cleanQ = cleanQuestionForSession(q, idx);
        const effectiveAns = (qd.selectedAnswer !== undefined && qd.selectedAnswer !== null)
          ? qd.selectedAnswer
          : ((qd as any).userAnswer !== undefined && (qd as any).userAnswer !== null ? (qd as any).userAnswer : '');

        return {
          ...qd,
          q_num: qd.q_num || idx + 1,
          question: cleanQ,
          selectedAnswer: effectiveAns,
          userAnswer: effectiveAns,
          chosenOption: effectiveAns,
          isCorrect: Boolean(qd.isCorrect),
          timeSpent: qd.timeSpent || 0
        };
      });
    }

    setReviewResult(resultToReview);
    setReviewBackTo(backTo);
    setView('review');
  };

  const openUnclassifiedReview = (title: string, questions: Question[], subject: string, backTo: ReviewBackTo = 'home') => {
    if (!questions || questions.length === 0) {
      alert('No unclassified questions to review.');
      return;
    }
    const syntheticResult: QuizResult = {
      id: `local-unclassified-${Date.now()}`,
      userId: user?.uid || 'guest',
      chapter_title: title,
      subject: subject,
      category: 'mockErrors',
      mode: 'practice',
      score: 0,
      totalQuestions: questions.length,
      totalTime: 0,
      completedAt: new Date().toISOString(),
      questionDetails: questions.map((q, idx) => {
        const rawUserAns = ((q as any).selectedAnswer !== undefined && (q as any).selectedAnswer !== null)
          ? String((q as any).selectedAnswer).trim().toLowerCase()
          : String((q as any).userAnswer || (q as any).chosenOption || '').trim().toLowerCase();
        const rawTargetAns = String(q.answer || (q as any).correctOption || (q as any).correctAnswer || '').trim().toLowerCase();
        const normUser = rawUserAns === '1' ? 'a' : rawUserAns === '2' ? 'b' : rawUserAns === '3' ? 'c' : rawUserAns === '4' ? 'd' : rawUserAns;
        const normTarget = rawTargetAns === '1' ? 'a' : rawTargetAns === '2' ? 'b' : rawTargetAns === '3' ? 'c' : rawTargetAns === '4' ? 'd' : rawTargetAns;

        const isExplicitWrongAnswer = Boolean(
          normUser &&
          normTarget &&
          !['unattempted', 'skipped', 'not attempted', 'left', 'n/a'].includes(normUser) &&
          normUser !== normTarget
        );

        const isWrong =
          isExplicitWrongAnswer ||
          q.status === 'wrong' ||
          q.status === 'Incorrect' ||
          q.errorType === 'wrong' ||
          (normUser && (q as any).isCorrect === false);

        const isConfirmedCorrect = Boolean(
          !isWrong &&
          (q.status === 'correct' || q.status === 'Correct' || (q as any).isCorrect === true || (normUser && normTarget && normUser === normTarget))
        );

        const isSlow = Boolean(isConfirmedCorrect && (q.status === 'slow' || (q as any).isSlow || q.errorType === 'speed_issue'));

        return {
          q_num: idx + 1,
          timeSpent: typeof (q as any).userTime === 'number' ? (q as any).userTime : (typeof (q as any).timeSpent === 'number' ? (q as any).timeSpent : 0),
          isCorrect: isConfirmedCorrect,
          selectedAnswer: isWrong ? (normUser || (normTarget === 'a' ? 'b' : 'a')) : (isConfirmedCorrect ? normTarget : ''),
          status: isSlow ? 'slow' : (isConfirmedCorrect ? 'correct' : (isWrong ? 'wrong' : 'unattempted')),
          errorType: isSlow ? 'speed_issue' : (isConfirmedCorrect ? 'correct' : (isWrong ? 'wrong' : 'unattempted')),
          isSlow,
          question: {
            ...q,
            solution: q.solution || (q as any).explanation || (q as any).sol || ''
          },
          marked: false,
          rca: q.rca
        };
      })
    };
    openReview(syntheticResult, backTo);
  };

  const reattemptFromResult = (result: QuizResult) => {
    // 1. Check primary category
    const primaryData = result.category === 'mockErrors' ? mockData : bankData;
    let chapter = (primaryData[result.subject] || []).find(ch => ch.chapter_title === result.chapter_title);

    // 2. Check alternate category
    if (!chapter) {
      const secondaryData = result.category === 'mockErrors' ? bankData : mockData;
      chapter = (secondaryData[result.subject] || []).find(ch => ch.chapter_title === result.chapter_title);
      if (chapter) {
        setCategory(result.category === 'mockErrors' ? 'chapterBank' : 'mockErrors');
        startQuiz(chapter);
        return;
      }
    }

    // 3. Sub-topic breakdown if format is "Chapter • Topic" (possibly multi-bullet e.g. "Ch • Sub • Sub2")
    if (!chapter && result.chapter_title.includes(' • ')) {
      const parts = result.chapter_title.split(' • ');
      const parentTitle = parts[0];
      const topic = parts.slice(1).join(' • ');  // preserve multi-segment topic names
      const parentChapter = (primaryData[result.subject] || []).find(ch => ch.chapter_title === parentTitle.trim());
      if (parentChapter) {
        setCategory(result.category);
        startMockTopicQuiz(parentChapter, topic.trim());
        return;
      }
    }

    // 4. "All Subject Questions" quiz
    if (!chapter && result.chapter_title.startsWith('All ') && result.chapter_title.includes(' Questions')) {
      setCategory(result.category);
      startAllSubjectQuiz(result.subject);
      return;
    }

    if (chapter) {
      setCategory(result.category);
      startQuiz(chapter);
      return;
    }

    // 5. Fallback: reconstruct virtual chapter from stored questionDetails
    const storedQuestions = (result.questionDetails || [])
      .map(qd => qd.question)
      .filter((q): q is Question => Boolean(q && q.question));

    if (storedQuestions.length > 0) {
      const virtualChapter: Chapter = {
        chapter_num: 0,
        chapter_title: result.chapter_title,
        subject: result.subject,
        subject_id: result.subject.toLowerCase().replace(/\s+/g, '_'),
        questions: storedQuestions.map((q, idx) => ({ ...q, q_num: idx + 1 }))
      };
      setCategory(result.category);
      startQuiz(virtualChapter);
      return;
    }

    alert('Source questions for this quiz could not be reloaded.');
  };

  const reattemptFilteredQuestions = (title: string, questions: Question[], subjectName?: string) => {
    if (!questions || questions.length === 0) {
      alert('No questions found for this re-attempt filter.');
      return;
    }
    const resolvedSubject = subjectName || selectedSubject || 'Mock Practice';
    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: title,
      subject: resolvedSubject,
      subject_id: resolvedSubject.toLowerCase().replace(/\s+/g, '_'),
      questions: questions.map((q, idx) => ({ ...q, q_num: idx + 1 })),
      section: 'mockErrors',
      is_test: true
    };
    if (reviewResult?.category) {
      setCategory(reviewResult.category);
    } else if (category !== 'chapterBank') {
      setCategory('mockErrors');
    }
    setQuizMode('practice');
    startQuiz(virtualChapter);
  };

  const handleDeleteResult = async (resultId?: string) => {
    if (!resultId) return;
    if (!window.confirm('Are you sure you want to delete this quiz attempt from your history?')) return;

    if (!user) {
      try {
        const guestHistory: QuizResult[] = JSON.parse(safeStorage.getItem('guest_results') || '[]');
        const updated = guestHistory.filter(r => r.id !== resultId);
        safeStorage.setItem('guest_results', JSON.stringify(updated));
        safeStorage.setItem('cgl_user_results_cache_guest', JSON.stringify(updated));
      } catch { }
      setUserResults(prev => prev.filter(r => r.id !== resultId));
      return;
    }

    // Store in hidden list so it immediately and permanently disappears
    try {
      const key = 'hidden_result_ids_' + user.uid;
      const hidden: string[] = JSON.parse(safeStorage.getItem(key) || '[]');
      if (!hidden.includes(resultId)) {
        hidden.push(resultId);
        safeStorage.setItem(key, JSON.stringify(hidden));
      }
      // Update local cache
      const cachedKey = 'cgl_user_results_cache_' + user.uid;
      const cached: QuizResult[] = JSON.parse(safeStorage.getItem(cachedKey) || '[]');
      safeStorage.setItem(cachedKey, JSON.stringify(cached.filter(r => r.id !== resultId)));
      // Update offline results if any
      const offKey = 'offline_results_' + user.uid;
      const off: QuizResult[] = JSON.parse(safeStorage.getItem(offKey) || '[]');
      safeStorage.setItem(offKey, JSON.stringify(off.filter(r => r.id !== resultId)));
    } catch { }

    setUserResults(prev => prev.filter(r => r.id !== resultId));

    try {
      await deleteDoc(doc(db, 'results', resultId));
    } catch (error) {
      console.warn('Firestore deleteDoc notice (handled via local filter):', error);
    }
  };

  const handleAskAiSubject = (subjectName: string) => {
    const isChapterBank = category === 'chapterBank';
    const subjectChapters = currentData[subjectName] || [];
    const weakTopics: { topic: string; mistakeCount: number }[] = [];
    let totalQuestions = 0;
    const allMistakeQuestions: AiFocusedQuestion[] = [];

    subjectChapters.forEach(ch => {
      const qs = ch.questions || [];
      totalQuestions += qs.length;
      if (qs.length > 0) {
        weakTopics.push({ topic: ch.chapter_title, mistakeCount: qs.length });
      }

      qs.forEach((q, idx) => {
        let optionsMap: Record<string, string> | undefined = undefined;
        if (q.options && typeof q.options === 'object' && !Array.isArray(q.options)) {
          optionsMap = {
            A: String(q.options.a || q.options['1'] || q.options.A || '').trim(),
            B: String(q.options.b || q.options['2'] || q.options.B || '').trim(),
            C: String(q.options.c || q.options['3'] || q.options.C || '').trim(),
            D: String(q.options.d || q.options['4'] || q.options.D || '').trim(),
          };
        } else if (Array.isArray(q.options)) {
          optionsMap = {
            A: String((q.options[0] as any)?.text || q.options[0] || '').trim(),
            B: String((q.options[1] as any)?.text || q.options[1] || '').trim(),
            C: String((q.options[2] as any)?.text || q.options[2] || '').trim(),
            D: String((q.options[3] as any)?.text || q.options[3] || '').trim(),
          };
        }

        allMistakeQuestions.push({
          id: q.id,
          qNum: idx + 1,
          question: q.question,
          options: optionsMap,
          correctAnswer: q.answer,
          userAnswer: (q as any).userAnswer || undefined,
          solution: q.solution,
          status: ((q as any).status || (q as any).errorType || (isChapterBank ? 'practice' : 'wrong')) as any,
          subject: subjectName,
          topic: ch.chapter_title
        });
      });
    });

    weakTopics.sort((a, b) => b.mistakeCount - a.mistakeCount);

    const subjectAttempts = userResults.filter(r => r.subject === subjectName);
    let subjectAccuracy: number | undefined = undefined;
    if (subjectAttempts.length > 0) {
      const totQ = subjectAttempts.reduce((acc, r) => acc + (r.totalQuestions || 0), 0);
      const totC = subjectAttempts.reduce((acc, r) => acc + (r.score || 0), 0);
      if (totQ > 0) {
        subjectAccuracy = Math.round((totC / totQ) * 100);
      }
    }

    openAiWithScope({
      type: 'subject',
      title: subjectName,
      subject: subjectName,
      stats: {
        totalQuestions,
        accuracy: subjectAccuracy,
        chaptersCount: subjectChapters.length
      },
      weakTopics: weakTopics.slice(0, 10),
      questions: allMistakeQuestions
    });
  };

  const handleAskAiTopic = (
    topicName: string,
    subject: string,
    questions: Question[],
    stats?: { total?: number; wrong?: number; slow?: number; unattempted?: number },
    mode?: 'chapters' | 'buckets' | 'rca',
    rcaTagFilter?: string
  ) => {
    // Determine overall source category across questions
    const hasFull = (questions || []).some(q => (q as any).sourceType === 'full_mock' || classifyTestType(q) === 'full');
    const hasSectional = (questions || []).some(q => (q as any).sourceType === 'sectional' || classifyTestType(q) === 'sectional');
    const hasSubjectWise = (questions || []).some(q => (q as any).sourceType === 'subject_wise');

    const isRcaMode = mode === 'rca' || mockViewMode === 'rca' || Boolean(rcaTagFilter && rcaTagFilter !== 'all');
    const rcaTagLabel = rcaTagFilter && rcaTagFilter !== 'all'
      ? (rcaTagFilter === 'unclassified' ? 'Unclassified' : `[${rcaTagFilter}] ${RCA_TAG_CONFIG[rcaTagFilter as RCATagType]?.label || rcaTagFilter}`)
      : undefined;

    const isChapterBank = category === 'chapterBank';

    let sourceScope: 'full_mock' | 'sectional' | 'subject_wise' | 'mixed' = 'subject_wise';
    let sourceScopeLabel = isRcaMode
      ? `RCA Analysis${rcaTagLabel ? ` • ${rcaTagLabel}` : ''} (${subject} • ${topicName})`
      : isChapterBank
        ? `Chapter Bank Practice (${subject} • ${topicName})`
        : `Subject-Wise Mock Errors (${subject} • ${topicName})`;

    if (mockTestTypeFilter === 'full' || (hasFull && !hasSectional && !hasSubjectWise)) {
      sourceScope = 'full_mock';
      sourceScopeLabel = isRcaMode
        ? `Full Mock RCA${rcaTagLabel ? ` • ${rcaTagLabel}` : ''} (${subject} • ${topicName})`
        : `Full Mock Test Errors (${subject} • ${topicName})`;
    } else if (mockTestTypeFilter === 'sectional' || (hasSectional && !hasFull && !hasSubjectWise)) {
      sourceScope = 'sectional';
      sourceScopeLabel = isRcaMode
        ? `Sectional RCA${rcaTagLabel ? ` • ${rcaTagLabel}` : ''} (${subject} • ${topicName})`
        : `Sectional Test Errors (${subject} • ${topicName})`;
    } else if (hasFull && hasSectional) {
      sourceScope = 'mixed';
      sourceScopeLabel = isRcaMode
        ? `Mock RCA${rcaTagLabel ? ` • ${rcaTagLabel}` : ''} (${subject} • ${topicName})`
        : `Full & Sectional Test Errors (${subject} • ${topicName})`;
    }

    const scopedQuestions: AiFocusedQuestion[] = (questions || []).map((q, idx) => {
      let optionsMap: Record<string, string> | undefined = undefined;
      if (q.options && typeof q.options === 'object' && !Array.isArray(q.options)) {
        const optAny = q.options as any;
        optionsMap = {
          A: String(optAny.a || optAny['1'] || optAny.A || '').trim(),
          B: String(optAny.b || optAny['2'] || optAny.B || '').trim(),
          C: String(optAny.c || optAny['3'] || optAny.C || '').trim(),
          D: String(optAny.d || optAny['4'] || optAny.D || '').trim(),
        };
      } else if (Array.isArray(q.options)) {
        optionsMap = {
          A: String((q.options[0] as any)?.text || q.options[0] || '').trim(),
          B: String((q.options[1] as any)?.text || q.options[1] || '').trim(),
          C: String((q.options[2] as any)?.text || q.options[2] || '').trim(),
          D: String((q.options[3] as any)?.text || q.options[3] || '').trim(),
        };
      }

      const qTestType = classifyTestType(q);
      const qSourceType: 'full_mock' | 'sectional' | 'subject_wise' = (q as any).sourceType || (
        qTestType === 'sectional' ? 'sectional' : ((q as any).mockId || (q as any).testName ? 'full_mock' : 'subject_wise')
      );
      const qSourceLabel = (q as any).sourceLabel || (
        qSourceType === 'full_mock'
          ? ((q as any).testName ? `Full Mock: ${(q as any).testName}` : 'Full Mock Test')
          : qSourceType === 'sectional'
            ? ((q as any).testName ? `Sectional Test: ${(q as any).testName}` : 'Sectional Test')
            : `Subject-Wise: ${subject}`
      );

      const qRca = (q as any).rca || (q as any).rcaClassification;
      const effectiveRcaTag = (qRca?.tag as any) === 'A' ? 'S' : (qRca?.tag || (rcaTagFilter && rcaTagFilter !== 'all' && rcaTagFilter !== 'unclassified' ? rcaTagFilter : undefined));
      const effectiveRcaName = qRca?.tagName || (effectiveRcaTag ? RCA_TAG_CONFIG[effectiveRcaTag as RCATagType]?.label : undefined);
      const sillyNote = qRca?.sillyMistakeNote || (q as any).sillyMistakeNote;

      return {
        id: q.id,
        qNum: idx + 1,
        question: q.question,
        options: optionsMap,
        correctAnswer: q.answer,
        userAnswer: (q as any).userAnswer || undefined,
        solution: q.solution,
        status: ((q as any).status || (q as any).errorType || 'wrong') as any,
        subject,
        topic: topicName,
        rcaReason: (q as any).rcaReason || qRca?.reason || undefined,
        rca: effectiveRcaTag ? { tag: effectiveRcaTag, tagName: effectiveRcaName } : undefined,
        rcaTag: effectiveRcaTag,
        rcaTagName: effectiveRcaName,
        sillyMistakeNote: sillyNote,
        sourceType: qSourceType,
        sourceLabel: qSourceLabel,
        testName: (q as any).testName
      };
    });

    openAiWithScope({
      type: 'topic',
      title: isRcaMode && rcaTagLabel ? `${topicName} • ${rcaTagLabel}` : topicName,
      subject,
      sourceScope,
      sourceScopeLabel,
      rcaTag: rcaTagFilter && rcaTagFilter !== 'all' ? rcaTagFilter : undefined,
      rcaMode: isRcaMode ? 'rca' : undefined,
      stats: {
        totalQuestions: stats?.total || questions.length,
        wrong: stats?.wrong,
        slow: stats?.slow,
        unattempted: stats?.unattempted
      },
      questions: scopedQuestions
    });
  };

  // Unified aggregated mock error data (deduplicated across mock_errors, bundled tests, cached tests)
  const aggregatedMockErrorsData = useMemo(() => {
    return aggregateMockErrors({
      mockData,
      bundledQuestions: bundledMockQuestions,
      testScopeFilter: mockTestTypeFilter,
      gkFilter: mockGKFilter,
      selectedSubject,
      deletedQuestionIds
    });
  }, [mockData, bundledMockQuestions, mockTestTypeFilter, mockGKFilter, selectedSubject, rcaVersion, deletedQuestionIds]);

  // Test scope question counts for currently selected subject in Mock Errors
  const mockScopeCounts = useMemo(() => {
    if (!selectedSubject) return { all: 0, full: 0, sectional: 0 };
    return aggregatedMockErrorsData.mockScopeCounts[selectedSubject] || { all: 0, full: 0, sectional: 0 };
  }, [aggregatedMockErrorsData, selectedSubject]);

  // Clubbed Mock Error Chapters: deduplicated chapter-wise errors with RCA classifications
  const clubbedMockChapters = useMemo(() => {
    if (category !== 'mockErrors' || !selectedSubject) return [];
    return aggregatedMockErrorsData.clubbedChapters[selectedSubject] || [];
  }, [category, selectedSubject, aggregatedMockErrorsData]);

  // Subject-level RCA statistics across all mock chapters
  const subjectRcaData = useMemo(() => {
    if (!selectedSubject) {
      return {
        totals: { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
        questionsByTag: { C: [], A: [], T: [], G: [], unclassified: [] }
      };
    }
    return aggregatedMockErrorsData.subjectRcaData[selectedSubject] || {
      totals: { C: 0, A: 0, T: 0, G: 0, unclassified: 0 },
      questionsByTag: { C: [], A: [], T: [], G: [], unclassified: [] }
    };
  }, [selectedSubject, aggregatedMockErrorsData]);

  // Filtered chapters for RCA table view
  const filteredRcaChapters = useMemo(() => {
    let list = clubbedMockChapters;
    if (rcaSelectedFilter !== 'all') {
      list = list.filter(ch => ((ch.rcaCounts?.[rcaSelectedFilter]) || 0) > 0);
    }
    if (rcaSearchQuery.trim()) {
      const q = rcaSearchQuery.toLowerCase();
      list = list.filter(ch => ch.topic.toLowerCase().includes(q));
    }
    return list;
  }, [clubbedMockChapters, rcaSelectedFilter, rcaSearchQuery]);

  const startSubjectRcaQuiz = (tag: RCATagType | 'unclassified', subTag?: string) => {
    if (!selectedSubject) return;
    let questions = subjectRcaData.questionsByTag[tag] || [];
    if (tag === 'unclassified') {
      openUnclassifiedReview(`${selectedSubject} • All Unclassified Mistakes`, questions, selectedSubject);
      return;
    }
    if (tag === 'S' && subTag && subTag !== 'all') {
      questions = questions.filter(q => matchesSillySubFilter(q, subTag));
    }
    if (questions.length === 0) {
      alert('No error questions found in this RCA category.');
      return;
    }
    const cfg = RCA_TAG_CONFIG[tag];
    const subCfg = subTag && subTag !== 'all' ? SILLY_SUB_TYPES[subTag] : undefined;
    const tagLabel = subCfg
      ? `[S] ${subCfg.label}`
      : `[${tag}] ${cfg.label}`;
    if (questions.length > 25) {
      setSetPickerModal({
        title: `${selectedSubject} • ${tagLabel}`,
        subtitle: `${questions.length} questions categorized under ${subCfg ? subCfg.label : cfg.label}`,
        subject: selectedSubject,
        questions
      });
      return;
    }
    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `${selectedSubject} • ${tagLabel}`,
      subject: selectedSubject,
      subject_id: selectedSubject.toLowerCase().replace(/\s+/g, '_'),
      questions: questions.map((q, idx) => ({ ...q, q_num: idx + 1 })),
      section: 'mockErrors',
      is_test: true
    };
    startQuiz(virtualChapter);
  };

  const handleAskAiRca = (tagKey: RCATagType | 'unclassified', subTag?: string) => {
    if (!selectedSubject) return;
    let questions = subjectRcaData.questionsByTag[tagKey] || [];
    if (tagKey === 'S' && subTag && subTag !== 'all') {
      questions = questions.filter(q => matchesSillySubFilter(q, subTag));
    }
    if (questions.length === 0) {
      alert('No questions in this RCA category to analyze.');
      return;
    }
    const cfg = RCA_TAG_CONFIG[tagKey];
    const subCfg = subTag && subTag !== 'all' ? SILLY_SUB_TYPES[subTag] : undefined;
    const tagLabel = tagKey === 'unclassified'
      ? 'Unclassified Mistakes'
      : subCfg
      ? `[S] ${subCfg.label} Mistakes`
      : `[${tagKey}] ${cfg.label}`;

    const scopedQuestions: AiFocusedQuestion[] = questions.map((q, idx) => {
      let optionsMap: Record<string, string> | undefined = undefined;
      if (q.options && typeof q.options === 'object' && !Array.isArray(q.options)) {
        const optAny = q.options as any;
        optionsMap = {
          A: String(optAny.a || optAny['1'] || optAny.A || '').trim(),
          B: String(optAny.b || optAny['2'] || optAny.B || '').trim(),
          C: String(optAny.c || optAny['3'] || optAny.C || '').trim(),
          D: String(optAny.d || optAny['4'] || optAny.D || '').trim(),
        };
      } else if (Array.isArray(q.options)) {
        optionsMap = {
          A: String((q.options[0] as any)?.text || q.options[0] || '').trim(),
          B: String((q.options[1] as any)?.text || q.options[1] || '').trim(),
          C: String((q.options[2] as any)?.text || q.options[2] || '').trim(),
          D: String((q.options[3] as any)?.text || q.options[3] || '').trim(),
        };
      }

      const qTestType = classifyTestType(q);
      const qSourceType: 'full_mock' | 'sectional' | 'subject_wise' = (q as any).sourceType || (
        qTestType === 'sectional' ? 'sectional' : ((q as any).mockId || (q as any).testName ? 'full_mock' : 'subject_wise')
      );
      const qSourceLabel = (q as any).sourceLabel || (
        qSourceType === 'full_mock'
          ? ((q as any).testName ? `Full Mock: ${(q as any).testName}` : 'Full Mock Test')
          : qSourceType === 'sectional'
            ? ((q as any).testName ? `Sectional Test: ${(q as any).testName}` : 'Sectional Test')
            : `Subject-Wise: ${selectedSubject}`
      );

      const effectiveTag = tagKey === 'unclassified' ? undefined : ((tagKey as any) === 'A' ? 'S' : tagKey);
      const sillyNote = (q as any).sillyMistakeNote || (q as any).rca?.sillyMistakeNote;

      return {
        id: q.id,
        qNum: idx + 1,
        question: q.question,
        options: optionsMap,
        correctAnswer: q.answer,
        userAnswer: (q as any).userAnswer || undefined,
        solution: q.solution,
        status: ((q as any).status || (q as any).errorType || 'wrong') as any,
        subject: selectedSubject,
        topic: (q as any).chapter_title || (q as any).topic || selectedSubject,
        rcaReason: (q as any).rcaReason || (q as any).rca?.reason || undefined,
        rca: effectiveTag ? { tag: effectiveTag, tagName: tagLabel } : undefined,
        rcaTag: effectiveTag,
        rcaTagName: tagLabel,
        sillyMistakeNote: sillyNote,
        sourceType: qSourceType,
        sourceLabel: qSourceLabel,
        testName: (q as any).testName
      };
    });

    openAiWithScope({
      type: 'topic',
      title: `${selectedSubject} • ${tagLabel}`,
      subject: selectedSubject,
      sourceScope: 'mixed',
      sourceScopeLabel: `RCA Analysis: ${tagLabel}`,
      rcaTag: tagKey === 'unclassified' ? undefined : tagKey,
      rcaMode: 'rca',
      stats: {
        totalQuestions: questions.length
      },
      questions: scopedQuestions
    });
  };

  const startSubjectErrorTypeQuiz = (type: 'wrong' | 'slow' | 'unattempted') => {
    if (!selectedSubject) return;
    const questions = clubbedMockChapters.flatMap(ch =>
      type === 'wrong' ? ch.wrongQuestions : type === 'slow' ? ch.slowQuestions : ch.unattemptedQuestions
    );
    if (questions.length === 0) {
      alert(`No ${type} error questions found.`);
      return;
    }
    const typeLabel = type === 'wrong' ? 'Incorrect' : type === 'slow' ? 'Slow' : 'Skipped';
    if (questions.length > 25) {
      setSetPickerModal({
        title: `${selectedSubject} • ${typeLabel}`,
        subtitle: `${questions.length} ${typeLabel.toLowerCase()} questions across all topics`,
        subject: selectedSubject,
        questions
      });
      return;
    }
    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `${selectedSubject} • ${typeLabel}`,
      subject: selectedSubject,
      subject_id: selectedSubject.toLowerCase().replace(/\s+/g, '_'),
      questions: questions.map((q, idx) => ({ ...q, q_num: idx + 1 })),
      section: 'mockErrors',
      is_test: true
    };
    startQuiz(virtualChapter);
  };

  const handleAskAiErrorType = (type: 'wrong' | 'slow' | 'unattempted') => {
    if (!selectedSubject) return;
    const questions = clubbedMockChapters.flatMap(ch =>
      type === 'wrong' ? ch.wrongQuestions : type === 'slow' ? ch.slowQuestions : ch.unattemptedQuestions
    );
    if (questions.length === 0) {
      alert(`No questions found to analyze.`);
      return;
    }
    const typeLabel = type === 'wrong' ? 'Incorrect' : type === 'slow' ? 'Slow' : 'Skipped';
    const scopedQuestions: AiFocusedQuestion[] = questions.map((q, idx) => {
      let optionsMap: Record<string, string> | undefined = undefined;
      if (q.options && typeof q.options === 'object' && !Array.isArray(q.options)) {
        const optAny = q.options as any;
        optionsMap = {
          A: String(optAny.a || optAny['1'] || optAny.A || '').trim(),
          B: String(optAny.b || optAny['2'] || optAny.B || '').trim(),
          C: String(optAny.c || optAny['3'] || optAny.C || '').trim(),
          D: String(optAny.d || optAny['4'] || optAny.D || '').trim(),
        };
      }
      return {
        id: q.id || `q_${idx}`,
        qNum: idx + 1,
        question: q.question,
        options: optionsMap,
        correctAnswer: q.answer,
        userAnswer: (q as any).userAnswer || undefined,
        solution: q.solution,
        status: (type === 'slow' ? 'slow' : type === 'wrong' ? 'wrong' : 'unattempted') as any,
        subject: selectedSubject || 'Unknown',
        topic: (q as any).chapter_title || (q as any).topic || selectedSubject || 'General',
      };
    });

    openAiWithScope({
      type: 'topic',
      title: `${selectedSubject} • ${typeLabel} Mistakes`,
      subject: selectedSubject,
      sourceScope: 'mixed',
      sourceScopeLabel: `Error Type Analysis: ${typeLabel}`,
      stats: {
        totalQuestions: questions.length
      },
      questions: scopedQuestions
    });
  };

  const startClubbedChapterQuiz = (
    topicName: string,
    questions: Question[],
    subType?: 'slow' | 'unattempted' | 'wrong' | 'C' | 'S' | 'T' | 'G' | 'unclassified' | 'A',
    setNumber?: number
  ) => {
    if (!selectedSubject) return;
    if (!questions || questions.length === 0) {
      alert(`No questions available for this drill.`);
      return;
    }
    if (subType === 'unclassified') {
      openUnclassifiedReview(`${topicName} • Unclassified Review`, questions, selectedSubject);
      return;
    }
    const SET_SIZE = 25;
    let targetQuestions = questions;
    let setLabel = '';
    if (setNumber && setNumber > 0) {
      const startIdx = (setNumber - 1) * SET_SIZE;
      const endIdx = Math.min(startIdx + SET_SIZE, questions.length);
      targetQuestions = questions.slice(startIdx, endIdx);
      setLabel = ` • Set ${setNumber} (Q${startIdx + 1}-${endIdx})`;
    }
    const rcaTagNames: Record<string, string> = {
      C: 'Conceptual Gap',
      A: 'Silly Mistake',
      T: 'Time Trap',
      G: 'Guesswork',
      unclassified: 'Unclassified'
    };
    let label = '';
    if (subType === 'slow') label = ' • Slow';
    else if (subType === 'unattempted') label = ' • Skipped';
    else if (subType === 'wrong') label = ' • Wrong';
    else if (subType && rcaTagNames[subType]) label = ` • [${subType.toUpperCase()}] ${rcaTagNames[subType]}`;

    const virtualChapter: Chapter = {
      chapter_num: setNumber || 0,
      chapter_title: `${topicName}${label}${setLabel}`,
      subject: selectedSubject,
      subject_id: selectedSubject.toLowerCase().replace(/\s+/g, '_'),
      questions: targetQuestions.map((q, idx) => cleanQuestionForSession(q, idx)),
      section: 'mockErrors',
      is_test: true
    };
    startQuiz(virtualChapter);
  };

  const isAuthorized = user?.email === 'cyberdevil0101@gmail.com' || (isLocalhost && Boolean(user));

  // Group bookmarks by subject and then by chapter — memoized to avoid re-running on unrelated renders
  const bookmarksBySubjectAndChapter = useMemo(() => bookmarks.reduce((acc, b) => {
    const subject = b.subject || 'Unknown Subject';
    const chapter = b.chapter_title || 'Unknown Chapter';
    if (!acc[subject]) acc[subject] = {};
    if (!acc[subject][chapter]) acc[subject][chapter] = [];
    acc[subject][chapter].push(b);
    return acc;
  }, {} as Record<string, Record<string, Bookmark[]>>), [bookmarks]);

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border border-slate-100">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-200">
            <GraduationCap className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4">mock</h1>
          <p className="text-slate-500 mb-8 font-medium">Please login to access your private practice dashboard.</p>
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center cursor-pointer"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Login with Google
          </button>
          {isLocalhost && (
            <button
              onClick={handleGuestLogin}
              className="w-full mt-3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-2xl font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer gap-2"
            >
              <span>👤 Continue as Guest (Localhost)</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!loading && user && !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border border-red-100">
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4">Access Restricted</h1>
          <p className="text-slate-500 mb-8 font-medium">This is a private practice hub. Your account ({user.email}) is not authorized to access this content.</p>
          <button
            onClick={handleLogout}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`font-sans text-slate-900 ${view === 'quiz' || view === 'review' ? 'h-[100dvh] max-h-[100dvh] overflow-hidden bg-white' : 'min-h-screen bg-slate-100'}`}>
      {/* Navigation */}
      {view !== 'quiz' && view !== 'review' && (
        <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-50 transition-colors">
          <div className="max-w-[1520px] mx-auto px-3 sm:px-6">
            <div className="flex items-center justify-between h-14">
              
              {/* Brand & Context Switcher */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                <button
                  onClick={resetToHome}
                  className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
                  title="Go to Home"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-xs shadow-blue-200 group-hover:scale-105 transition-transform">
                    <GraduationCap className="text-white w-4 h-4" />
                  </div>
                  <span className="text-lg font-black tracking-tight text-slate-800">mock</span>
                </button>

                <div className="h-4 w-px bg-slate-200" />

                <a
                  href="https://cat-nu-ruby.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 border border-purple-200/80 text-[11px] font-bold tracking-wide transition-all inline-flex items-center gap-1 shadow-2xs"
                  title="Switch to CAT practice"
                >
                  <span>CAT</span>
                  <span className="text-[9px] opacity-60">↗</span>
                </a>
              </div>

              {/* Desktop Nav Items */}
              <div className="hidden lg:flex items-center gap-1 xl:gap-1.5">
                {/* 1. Practice */}
                <button
                  onClick={resetToHome}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    view === 'home'
                      ? 'bg-blue-50 text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Practice</span>
                </button>

                {/* 2. Drills */}
                <button
                  onClick={() => { setView('drill'); setSelectedSubject(null); setSelectedTopic(null); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    view === 'drill'
                      ? 'bg-blue-50 text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Drills</span>
                </button>

                {/* 3. Saved */}
                <button
                  onClick={() => { setView('bookmarks'); setSelectedBookmarkSubject(null); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    view === 'bookmarks'
                      ? 'bg-blue-50 text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <BookmarkIcon className="w-3.5 h-3.5" />
                  <span>Saved</span>
                  {bookmarks.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">({bookmarks.length})</span>
                  )}
                </button>

                {/* 5. Analytics */}
                <button
                  onClick={() => setView('dashboard')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    view === 'dashboard'
                      ? 'bg-blue-50 text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Analytics</span>
                </button>

                {/* 6. Mock Scores */}
                <button
                  onClick={() => setView('mockScores')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    view === 'mockScores'
                      ? 'bg-blue-50 text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Scores</span>
                </button>

                {/* 7. My Mistakes */}
                <button
                  onClick={() => setView('botErrors')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    view === 'botErrors'
                      ? 'bg-rose-50 text-rose-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                  title="Personal Mistake Notebook"
                >
                  <span className="text-xs">📕</span>
                  <span>My Mistakes</span>
                </button>
              </div>

              {/* Utility & Actions Right Cluster */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Mode Switcher Segmented Control */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/90 text-xs font-semibold">
                  <button
                    onClick={() => setQuizModePersisted('practice')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs ${
                      quizMode === 'practice'
                        ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BookOpen className="w-3 h-3 text-emerald-600" />
                    <span>Practice</span>
                  </button>
                  <button
                    onClick={() => setQuizModePersisted('mock')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs ${
                      quizMode === 'mock'
                        ? 'bg-white text-rose-700 font-bold shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Trophy className="w-3 h-3 text-rose-600" />
                    <span>Mock</span>
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                {/* Mobile Mistakes trigger */}
                <button
                  onClick={() => setView('botErrors')}
                  className={`lg:hidden p-1.5 rounded-lg border text-xs font-bold transition-colors ${
                    view === 'botErrors'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200/80'
                  }`}
                  title="My Mistakes"
                >
                  📕
                </button>

                {/* Theme Selector */}
                <ThemeSelector isCompact />

                {/* PWA Install Button */}
                {deferredPrompt && !isAppInstalled && (
                  <button
                    onClick={async () => {
                      if (!deferredPrompt) return;
                      deferredPrompt.prompt();
                      const choice = await deferredPrompt.userChoice;
                      if (choice && choice.outcome === 'accepted') {
                        setDeferredPrompt(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer animate-pulse"
                    title="Install SSC CGL App to your Home Screen"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Install App</span>
                  </button>
                )}

                {/* User / Login */}
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title={`Logout (${user.email || user.displayName || 'User'})`}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleLogin}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Login</span>
                    </button>
                    {isLocalhost && (
                      <button
                        onClick={handleGuestLogin}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Login as Guest on Localhost"
                      >
                        <span>👤 Guest</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </nav>
      )}

      <main className={view === 'quiz' || view === 'review' ? 'w-full h-full overflow-hidden' : 'max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 pb-24 md:pb-8'}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
            <p className="text-slate-500 font-bold text-sm">Loading your practice hub...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
              >
                {!selectedSubject ? (
                  <>
                    {/* ─── Minimalist Practice & Preparation Hub (Stitch Design) ─── */}
                    {/* Dashboard Header Hero */}
                    <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs relative overflow-hidden mb-5" data-purpose="hero-header">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                        <div className="space-y-3 max-w-3xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-bold tracking-wider uppercase shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                              <span>DAILY MINDSET</span>
                            </div>
                            {dailyThought.focusTag && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                                {dailyThought.focusTag}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 pl-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span className="text-slate-500 font-semibold">Focused Mode</span>
                            </div>
                            {userResults.length > 0 && (
                              <span className="text-xs text-slate-400 font-medium hidden sm:inline-block font-mono">
                                • Last active: {userResults[0].subject}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setDailyThoughtSalt(prev => prev + 1)}
                              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-blue-600 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-100"
                              title="Shuffle daily thought"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span className="hidden sm:inline">New thought</span>
                            </button>
                          </div>
                          <div>
                            <blockquote className="text-xl sm:text-2xl lg:text-[25px] font-bold tracking-tight text-slate-900 leading-snug">
                              <span className="text-blue-600 mr-1 font-serif">“</span>{dailyThought.quote}<span className="text-blue-600 ml-1 font-serif">”</span>
                            </blockquote>
                            <p className="mt-2 text-xs sm:text-sm font-medium text-slate-500 tracking-wide flex items-center gap-2">
                              <span className="w-4 h-0.5 bg-blue-600 rounded-full inline-block"></span>
                              {dailyThought.author}
                            </p>
                          </div>
                        </div>

                        {/* Category Mode Switcher */}
                        <div className="flex items-center gap-2.5 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => {
                              setCategory('chapterBank');
                              setSelectedMathSection(null);
                              setSelectedEnglishSection(null);
                              setSelectedGKSubject(null);
                              setSelectedGKSubTopic('all');
                              setSelectedTopic(null);
                            }}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold tracking-wide transition-all shadow-xs cursor-pointer ${
                              category === 'chapterBank'
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <ListChecks className="w-4 h-4 text-blue-500" />
                            <span>Chapter Bank</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCategory('mockErrors');
                              setSelectedMathSection(null);
                              setSelectedEnglishSection(null);
                              setSelectedGKSubject(null);
                              setSelectedGKSubTopic('all');
                              setSelectedTopic(null);
                            }}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold tracking-wide transition-all shadow-xs cursor-pointer ${
                              category === 'mockErrors'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                : 'bg-rose-50/50 text-rose-700 border-rose-200 hover:bg-rose-100/60'
                            }`}
                          >
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            <span>Mock Errors</span>
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* Core Subject Cards Grid (4 Columns: English, General Awareness, Mathematics, Reasoning) */}
                    {dataLoading ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-5">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-36 rounded-2xl border border-slate-200/80 bg-white p-4 animate-pulse">
                            <div className="flex items-center justify-between">
                              <div className="h-8 w-8 rounded-lg bg-slate-100" />
                              <div className="h-4 w-12 rounded bg-slate-100" />
                            </div>
                            <div className="mt-3 h-4 w-24 rounded bg-slate-100" />
                            <div className="mt-1.5 h-3 w-16 rounded bg-slate-100" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5" aria-label="Core Subjects">
                        {['English', 'General Awareness', 'Mathematics', 'Reasoning'].map((subject) => {
                          const config = ({
                            English: {
                              icon: BookOpen,
                              iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                              desc: 'Grammar & Ayush Vocab 2025',
                            },
                            'General Awareness': {
                              icon: Globe2,
                              iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
                              desc: 'Polity, History, Science & Tests',
                            },
                            Mathematics: {
                              icon: Calculator,
                              iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
                              desc: 'Arithmetic & Advanced sets',
                            },
                            Reasoning: {
                              icon: Compass,
                              iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
                              desc: 'Verbal, Logic & Analogies',
                            },
                          } as Record<string, any>)[subject] || {
                            icon: Layers,
                            iconBg: 'bg-slate-50 text-slate-600 border-slate-100',
                            desc: 'Subject Question Bank',
                          };

                          const SubjectIcon = config.icon;
                          const chapterCount = currentData[subject]?.length || 0;

                          return (
                            <article
                              key={subject}
                              onClick={() => {
                                setSelectedSubject(subject);
                                if (subject === 'General Awareness') {
                                  setSelectedGKSubject(null);
                                  setSelectedGKSubTopic('all');
                                }
                                if (subject === 'Mathematics') {
                                  setSelectedMathSection(null);
                                }
                                if (subject === 'English') {
                                  setSelectedEnglishSection(null);
                                }
                                setSelectedTopic(null);
                              }}
                              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2.5">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${config.iconBg}`}>
                                    <SubjectIcon className="w-4 h-4" />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAskAiSubject(subject);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100 transition-colors cursor-pointer"
                                      title={`Ask Tommy AI about ${subject}`}
                                    >
                                      <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                      <span>AI Tutor</span>
                                    </button>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                      {chapterCount} Ch
                                    </span>
                                  </div>
                                </div>

                                <h2 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {subject}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5 mb-2.5 leading-snug">
                                  {config.desc}
                                </p>

                                {/* Subject Sub-Topic Quick Pills */}
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {subject === 'English' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedSubject('English');
                                          setSelectedEnglishSection('black_book');
                                          setSelectedTopic(null);
                                        }}
                                        className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                      >
                                        Black Book ({(bankData['English'] || []).filter(ch => ch.section === 'black_book').reduce((sum, ch) => sum + (ch.questions?.length || 0), 0)} Qs)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedSubject('English');
                                          setSelectedEnglishSection('ayush_vocab');
                                          setSelectedTopic(null);
                                        }}
                                        className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                      >
                                        Vocab 2025 ({(bankData['English'] || []).filter(ch => ch.section === 'ayush_vocab').reduce((sum, ch) => sum + (ch.questions?.length || 0), 0)} Qs)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedSubject('English');
                                          setSelectedEnglishSection('general');
                                          setSelectedTopic(null);
                                        }}
                                        className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-medium transition-colors cursor-pointer"
                                      >
                                        Grammar
                                      </button>
                                    </>
                                  )}

                                  {subject === 'General Awareness' && (
                                    <>
                                      {['history', 'polity', 'geography', 'economics'].map((gkId) => {
                                        const label = gkId.charAt(0).toUpperCase() + gkId.slice(1);
                                        return (
                                          <button
                                            key={gkId}
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedSubject('General Awareness');
                                              setSelectedGKSubject(gkId);
                                              setSelectedGKSubTopic('all');
                                              setMockGKFilter(gkId);
                                            }}
                                            className="px-1.5 py-0.5 bg-slate-50 hover:bg-amber-50 hover:text-amber-800 text-slate-600 border border-slate-200 rounded text-[10px] font-medium transition-colors cursor-pointer"
                                          >
                                            {label}
                                          </button>
                                        );
                                      })}
                                    </>
                                  )}

                                  {subject === 'Mathematics' && (
                                    <>
                                      {['Spartan', 'Pinnacle', 'QRB', 'Top 500', 'MRQ'].map((mathSec) => {
                                        const secKey = mathSec === 'Top 500' ? 'top500' : (mathSec.toLowerCase() as any);
                                        return (
                                          <button
                                            key={mathSec}
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedSubject('Mathematics');
                                              setSelectedMathSection(secKey);
                                              setSelectedTopic(null);
                                            }}
                                            className="px-1.5 py-0.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-800 text-slate-600 border border-slate-200 rounded text-[10px] font-medium transition-colors cursor-pointer"
                                          >
                                            {mathSec}
                                          </button>
                                        );
                                      })}
                                    </>
                                  )}

                                  {subject === 'Reasoning' && (
                                    <>
                                      {['Coding', 'Analogy', 'Series', 'Syllogism'].map((rTopic) => (
                                        <button
                                          key={rTopic}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSubject('Reasoning');
                                            setSelectedTopic(null);
                                          }}
                                          className="px-1.5 py-0.5 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 text-slate-600 border border-slate-200 rounded text-[10px] font-medium cursor-pointer transition-colors"
                                        >
                                          {rTopic}
                                        </button>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="inline-flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">
                                <span>Explore Chapters</span>
                                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}

                    {/* Fast Drill & Bookmarks Utility Section (2-Column Grid) */}
                    <section aria-label="Quick Practice Studios" className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                      {/* Calculation & Speed Drill Studio */}
                      <div
                        onClick={() => setView('drill')}
                        className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-sm hover:border-amber-300 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-105 transition-transform">
                              <Zap className="w-4 h-4 fill-amber-500/20 text-amber-600" />
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-amber-700 bg-amber-50 rounded-md border border-amber-200/80">
                              SPEED STUDIO
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                            Calculation & Speed Drill
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Rapid-fire drills for squares, cubes, fractions, percentages, and Pythagorean triplets.
                          </p>
                        </div>
                        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-600">
                          <span>Open Speed Studio</span>
                          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>

                      {/* Bookmarked Question Vault */}
                      <div
                        onClick={() => setView('bookmarks')}
                        className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-sm hover:border-blue-300 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-105 transition-transform">
                              <BookmarkIcon className="w-4 h-4 fill-indigo-500/20 text-indigo-600" />
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-indigo-700 bg-indigo-50 rounded-md border border-indigo-200/80">
                              {bookmarks.length} SAVED
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                            Bookmarked Question Vault
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Personal collection of tricky problems, formula shortcuts, and questions flagged for quick revision.
                          </p>
                        </div>
                        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
                          <span>Review Saved Vault</span>
                          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </section>

                    {/* Bottom Practice Analytics Split (2 Cols Recent Activity + 1 Col Exam Readiness) */}
                    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start" aria-label="Recent Practice and Exam Readiness">
                      {/* Left 2 Cols: Recent Practice Activity */}
                      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs" data-purpose="recent-activity-panel">
                        {/* Header Strip */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                              <Clock className="w-3.5 h-3.5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">Recent Practice Activity</h3>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-semibold">
                            {userResults.length > 0 && (
                              <button
                                type="button"
                                onClick={handleClearAllResults}
                                disabled={loadingResults}
                                className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer disabled:opacity-50"
                                title="Clear all recent activity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Clear</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setView('dashboard')}
                              className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer font-bold"
                            >
                              View All ({userResults.length}) →
                            </button>
                          </div>
                        </div>

                        {/* Activity List Container */}
                        {userResults.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {userResults.slice(0, 4).map((r, idx) => {
                              const acc = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
                              return (
                                <div key={idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                    <span className="px-2 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200/80 rounded-md shrink-0">
                                      {r.subject}
                                    </span>
                                    <div className="min-w-0">
                                      <h4 className="text-xs font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors truncate">
                                        {r.chapter_title}
                                      </h4>
                                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                        {r.score}/{r.totalQuestions} correct • {r.mode === 'mock' ? 'Mock Mode' : 'Practice'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded border font-mono ${
                                      acc >= 75
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : acc >= 50
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}>
                                      {acc}%
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openReview(r, 'home')}
                                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                                    >
                                      Review
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-xs text-slate-400">
                            No quiz attempts recorded yet. Select any subject above to begin practicing.
                          </div>
                        )}
                      </div>

                      {/* Right 1 Col: Exam Readiness Analytics Widget */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between" data-purpose="exam-readiness-widget">
                        <div>
                          {/* Widget Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                <Target className="w-3.5 h-3.5" />
                              </div>
                              <h3 className="text-sm font-bold text-slate-900">Exam Readiness</h3>
                            </div>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded">
                              SSC CGL
                            </span>
                          </div>

                          {/* 2x2 Metric Stat Boxes */}
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {/* Solved Metric */}
                            <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">SOLVED</span>
                              <div className="text-xl font-extrabold text-slate-900 leading-tight">{dashboardStats.totalQuestions}</div>
                            </div>
                            {/* Accuracy Metric */}
                            <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">ACCURACY</span>
                              <div className="text-xl font-extrabold text-emerald-600 leading-tight">{dashboardStats.overallAccuracy}%</div>
                            </div>
                            {/* Quizzes Metric */}
                            <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">QUIZZES</span>
                              <div className="text-xl font-extrabold text-blue-600 leading-tight">{dashboardStats.totalQuizzes}</div>
                            </div>
                            {/* Avg Time Metric */}
                            <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">AVG TIME</span>
                              <div className="text-xl font-extrabold text-amber-600 leading-tight">{dashboardStats.avgTimePerQ}s</div>
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          type="button"
                          onClick={() => setView('dashboard')}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold tracking-wide transition-all shadow-xs group cursor-pointer active:scale-95"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-slate-300 group-hover:text-white transition-colors" />
                          <span>Open Detailed Analytics</span>
                        </button>
                      </div>
                    </section>
                  </>
                ) : selectedSubject === 'Mathematics' && category === 'chapterBank' && !selectedMathSection ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => setSelectedSubject(null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Subjects
                        </button>
                        <div>
                          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Mathematics Practice Sections</h2>
                          <p className="text-[11px] text-slate-500 font-medium">Choose a specialised book or practice series to get started</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {([
                        { key: 'spartan', icon: Shield, chip: 'from-amber-500 to-orange-600', title: 'Spartan Series', desc: 'High-yield, battle-tested challenges and conceptually advanced problem sets.' },
                        { key: 'pinnacle', icon: Crown, chip: 'from-blue-500 to-indigo-600', title: 'Pinnacle Series', desc: 'Comprehensive past year practice sets, exhaustive subject mapping, and exam models.' },
                        { key: 'qrb', icon: Zap, chip: 'from-emerald-500 to-teal-600', title: 'QRB Series', desc: 'Quick Revision Book question bank focusing on high-speed formula checks and concepts.' },
                        { key: 'top500', icon: Star, chip: 'from-violet-500 to-purple-600', title: 'Top 500 Series', desc: 'The most repeated Arithmetic questions for SSC CGL, level-wise to master high-yield exam patterns.' },
                        { key: 'mrq', icon: Sparkles, chip: 'from-pink-500 to-rose-600', title: 'MRQ Series', desc: 'Most Repeated Questions (MRQ) and concept revision series for SSC CGL 2026.' },
                      ] as const).map(({ key, icon: Icon, chip, title, desc }) => (
                        <motion.div
                          key={key}
                          whileHover={{ y: -2 }}
                          onClick={() => setSelectedMathSection(key)}
                          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 transition-all duration-200 hover:border-indigo-300 hover:shadow-md flex flex-col shadow-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${chip} text-white shadow-xs`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs font-bold text-slate-800">{title}</h3>
                          </div>
                          <p className="mt-2 flex-1 text-[11px] text-slate-500 leading-relaxed">{desc}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                              {currentData['Mathematics']?.filter(ch => ch.section === key).length || 0} Chapters
                            </span>
                            <div className="flex items-center text-xs font-semibold text-indigo-600">
                              Enter
                              <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : selectedSubject === 'General Awareness' && category === 'chapterBank' && !selectedGKSubject ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => { setSelectedSubject(null); setSelectedGKSubject(null); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Subjects
                        </button>
                        <div>
                          <h2 className="text-sm font-bold text-slate-900 tracking-tight">General Awareness (GK) Subjects</h2>
                          <p className="text-[11px] text-slate-500 font-medium">Choose a subject to practice chapter-wise questions and full tests</p>
                        </div>
                      </div>
                      <span className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        GK Vault
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {GK_SUBJECT_LIST.map((sub) => {
                        const Icon = GK_ICONS[sub.iconName] || Globe2;
                        const chaptersForSub = (currentData['General Awareness'] || []).filter(ch => {
                          if (sub.id === 'full_tests') return ch.is_test || ch.subject === 'GK Full Tests';
                          return getChapterGKSubject(ch) === sub.id;
                        });
                        return (
                          <motion.div
                            key={sub.id}
                            whileHover={{ y: -2 }}
                            onClick={() => { setSelectedGKSubject(sub.id); setSelectedGKSubTopic('all'); }}
                            className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 transition-all duration-200 hover:border-indigo-300 hover:shadow-md flex flex-col justify-between shadow-xs"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${sub.gradient} text-white shadow-xs`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${sub.badge}`}>
                                  {chaptersForSub.length} {sub.id === 'full_tests' ? 'Tests' : 'Chapters'}
                                </span>
                              </div>
                              <h3 className="mt-3 text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{sub.title}</h3>
                              <p className="mt-1 text-[11px] text-slate-500 leading-relaxed line-clamp-2">{sub.desc}</p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
                              <span>Enter Subject</span>
                              <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ) : selectedSubject === 'English' && category === 'chapterBank' && !selectedEnglishSection ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => setSelectedSubject(null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Subjects
                        </button>
                        <div>
                          <h2 className="text-sm font-bold text-slate-900 tracking-tight">English Language & Comprehension</h2>
                          <p className="text-[11px] text-slate-500 font-medium">Choose a practice section or specialized vocabulary vault</p>
                        </div>
                      </div>
                      <span className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        English Vault
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {([
                        {
                          key: 'black_book',
                          icon: BookMarked,
                          chip: 'from-amber-500 to-orange-600',
                          badge: 'Black Book Edition',
                          title: 'Black Book Vocabulary',
                          desc: '790 High-Yield questions: One Word Substitution (317 Qs), Synonyms (434 Qs) & Phrasal Verbs (39 Qs) in 30 sets.',
                          count: `${(currentData['English'] || []).filter(ch => ch.section === 'black_book').reduce((acc, ch) => acc + (ch.questions?.length || 0), 0)} Questions • ${(currentData['English'] || []).filter(ch => ch.section === 'black_book').length} Sets`
                        },
                        {
                          key: 'ayush_vocab',
                          icon: Sparkles,
                          chip: 'from-emerald-500 to-teal-600',
                          badge: 'SSC 2025 Edition',
                          title: 'All Vocabs SSC 2025 - by Ayush',
                          desc: '914 High-Yield questions organized into sets of 20. Full coverage of Synonyms, Antonyms, One Word Substitution, Idioms & Phrases, and Spellings with mnemonics.',
                          count: `${(currentData['English'] || []).filter(ch => ch.section === 'ayush_vocab').reduce((acc, ch) => acc + (ch.questions?.length || 0), 0)} Questions • ${(currentData['English'] || []).filter(ch => ch.section === 'ayush_vocab').length} Sets of 20`
                        },
                        {
                          key: 'general',
                          icon: BookOpen,
                          chip: 'from-indigo-600 to-violet-700',
                          badge: 'Pinnacle 60 Days',
                          title: 'Grammar (Topic-Wise)',
                          desc: 'Exhaustive chapter-wise grammar bank with rule revision cheat sheet and practice question sets.',
                          count: `${(currentData['English'] || []).filter(ch => ch.section === 'grammar' || (ch.section !== 'ayush_vocab' && ch.section !== 'black_book')).reduce((acc, ch) => acc + (ch.questions?.length || 0), 0)} Questions • ${(currentData['English'] || []).filter(ch => ch.section === 'grammar' || (ch.section !== 'ayush_vocab' && ch.section !== 'black_book')).length} Chapters`
                        }
                      ] as const).map(({ key, icon: Icon, chip, badge, title, desc, count }) => (
                        <motion.div
                          key={key}
                          whileHover={{ y: -2 }}
                          onClick={() => { setSelectedEnglishSection(key); setSelectedTopic(null); }}
                          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 transition-all duration-200 hover:border-emerald-300 hover:shadow-md flex flex-col justify-between shadow-xs"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${chip} text-white shadow-xs`}>
                                  <Icon className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{title}</h3>
                                  <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 mt-0.5">
                                    {badge}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <p className="mt-2.5 text-xs text-slate-500 leading-relaxed">{desc}</p>
                          </div>
                          <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              {count}
                            </span>
                            <div className="flex items-center text-xs font-bold text-emerald-600">
                              Enter Section
                              <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => {
                            if (selectedTopic) {
                              setSelectedTopic(null);
                            } else if (selectedGKSubject && category === 'chapterBank') {
                              setSelectedGKSubject(null);
                              setSelectedGKSubTopic('all');
                            } else if (selectedSubject === 'Mathematics' && category === 'chapterBank') {
                              setSelectedMathSection(null);
                            } else if (selectedSubject === 'English' && category === 'chapterBank') {
                              setSelectedEnglishSection(null);
                            } else {
                              setSelectedSubject(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          {selectedTopic
                            ? 'Topics'
                            : (selectedSubject === 'General Awareness' && category === 'chapterBank' && selectedGKSubject
                              ? 'GK Subjects'
                              : (selectedSubject === 'Mathematics' && category === 'chapterBank'
                                ? 'Math Sections'
                                : (selectedSubject === 'English' && category === 'chapterBank'
                                  ? 'English Sections'
                                  : 'Subjects')))}
                        </button>
                        <div>
                          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                            {selectedSubject === 'General Awareness' && category === 'chapterBank' && selectedGKSubject
                              ? GK_SUBJECT_CONFIGS[selectedGKSubject]?.title
                              : selectedSubject === 'English' && category === 'chapterBank' && selectedEnglishSection === 'ayush_vocab'
                                ? 'All Vocabs SSC 2025 - by Ayush'
                                : selectedSubject === 'English' && category === 'chapterBank' && selectedEnglishSection === 'black_book'
                                  ? 'Black Book Vocabulary - OWS'
                                  : selectedSubject === 'Mathematics' && category === 'chapterBank' && selectedMathSection === 'mrq'
                                ? 'MRQ Series - Most Repeated Questions'
                                : selectedSubject}
                          </h2>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {category === 'mockErrors'
                              ? 'Mock error remediation & weak topic drills'
                              : selectedSubject === 'General Awareness' && category === 'chapterBank' && selectedGKSubject
                                ? GK_SUBJECT_CONFIGS[selectedGKSubject]?.desc
                                : selectedSubject === 'English' && category === 'chapterBank' && selectedEnglishSection === 'ayush_vocab'
                                  ? '914 High-Yield SSC 2025 vocabulary questions in sets of 20'
                                  : selectedSubject === 'English' && category === 'chapterBank' && selectedEnglishSection === 'black_book'
                                    ? '790 High-Yield OWS, Synonyms & Phrasal Verbs questions in 30 sets'
                                    : 'Comprehensive chapter-wise question vault'}
                          </p>
                        </div>
                      </div>
                      <span className={`self-start sm:self-auto rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${category === 'mockErrors' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                        }`}>
                        {category === 'mockErrors' ? 'Mock Errors' : 'Chapter Bank'}
                      </span>
                    </div>

                    {/* Mock Errors Direct Subject Switcher */}
                    {category === 'mockErrors' && (
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 overflow-x-auto custom-scrollbar">
                        {[
                          { name: 'Mathematics', label: 'Quantitative', icon: Calculator },
                          { name: 'Reasoning', label: 'Reasoning', icon: Compass },
                          { name: 'English', label: 'English', icon: BookOpen },
                          { name: 'General Awareness', label: 'GA / GK', icon: Globe2 },
                        ].map((s) => {
                          const isSelected = selectedSubject === s.name;
                          const Icon = s.icon;
                          const subjectErrorCount = (aggregatedMockErrorsData.clubbedChapters[s.name] || []).reduce(
                            (acc, c) => acc + c.total,
                            0
                          );

                          return (
                            <button
                              key={s.name}
                              onClick={() => {
                                setSelectedSubject(s.name);
                                if (s.name === 'General Awareness') {
                                  setSelectedGKSubject(null);
                                  setSelectedGKSubTopic('all');
                                }
                                setSelectedTopic(null);
                              }}
                              className={`flex-1 min-w-[125px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70 font-bold'
                                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                              }`}
                            >
                              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                              <span>{s.label}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                  isSelected
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'bg-slate-200/70 text-slate-500'
                                }`}
                              >
                                {subjectErrorCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* GK Quick-Switch Subject Tabs & Sub-topic Filter */}
                    {selectedSubject === 'General Awareness' && category === 'chapterBank' && selectedGKSubject && (
                      <div className="space-y-2">
                        {/* Quick Subject Tabs */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                          {GK_SUBJECT_LIST.map((sub) => {
                            const Icon = GK_ICONS[sub.iconName] || Globe2;
                            const isSelected = selectedGKSubject === sub.id;
                            const count = (currentData['General Awareness'] || []).filter(ch => {
                              if (sub.id === 'full_tests') return ch.is_test || ch.subject === 'GK Full Tests';
                              return getChapterGKSubject(ch) === sub.id;
                            }).length;
                            return (
                              <button
                                key={sub.id}
                                onClick={() => {
                                  setSelectedGKSubject(sub.id);
                                  setSelectedGKSubTopic('all');
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${isSelected
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{sub.shortTitle}</span>
                                <span className={`px-1.5 py-0.5 text-[10px] rounded font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Sub-Topics / Series Filter Tabs */}
                        {GK_SUBJECT_CONFIGS[selectedGKSubject]?.subTopics.length > 1 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                            {GK_SUBJECT_CONFIGS[selectedGKSubject].subTopics.map((st) => (
                              <button
                                key={st.key}
                                onClick={() => setSelectedGKSubTopic(st.key)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${selectedGKSubTopic === st.key
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mock Errors: Controls Bar */}
                    {category === 'mockErrors' && (currentData[selectedSubject] || []).length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                              {selectedSubject} Mock Errors
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {clubbedMockChapters.length} {clubbedMockChapters.length === 1 ? 'Topic' : 'Topics'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {clubbedMockChapters.reduce((acc, ch) => acc + ch.total, 0)} total mistakes recorded
                            {mockTestTypeFilter !== 'all' && (
                              <span className="text-indigo-600 font-semibold"> · {mockTestTypeFilter === 'full' ? 'Full Mocks Only' : 'Sectionals Only'}</span>
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Test Scope Filter (Combined / Full / Sectional) — buckets mode only */}
                          {mockViewMode === 'buckets' && (
                            <div className="inline-flex bg-slate-100/90 p-0.5 rounded-lg border border-slate-200/80 text-[11px] font-semibold">
                              <button
                                onClick={() => setMockTestTypeFilterPersisted('all')}
                                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${mockTestTypeFilter === 'all'
                                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                title="Combined: all full and sectional test errors"
                              >
                                <span>Combined</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${mockTestTypeFilter === 'all' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                                  {mockScopeCounts.all}
                                </span>
                              </button>
                              <button
                                onClick={() => setMockTestTypeFilterPersisted('full')}
                                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${mockTestTypeFilter === 'full'
                                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                title="Errors from Full Mock Tests only"
                              >
                                <span>Full</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${mockTestTypeFilter === 'full' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                                  {mockScopeCounts.full}
                                </span>
                              </button>
                              <button
                                onClick={() => setMockTestTypeFilterPersisted('sectional')}
                                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${mockTestTypeFilter === 'sectional'
                                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                title="Errors from Sectional Mock Tests only"
                              >
                                <span>Sectional</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${mockTestTypeFilter === 'sectional' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                                  {mockScopeCounts.sectional}
                                </span>
                              </button>
                            </div>
                          )}

                          {/* Mode Toggle: Chapter-Wise / Error Types / RCA / Silly — always visible */}
                          <div className="inline-flex bg-slate-100/90 p-0.5 rounded-lg border border-slate-200/80 text-[11px] font-semibold">
                            <button
                              onClick={() => setMockViewModePersisted('chapters')}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${mockViewMode === 'chapters'
                                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                                  : 'text-slate-500 hover:text-slate-800'
                                }`}
                              title="Chapter-Wise clubbed view"
                            >
                              <ListChecks className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Chapters</span>
                            </button>
                            <button
                              onClick={() => setMockViewModePersisted('buckets')}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${mockViewMode === 'buckets'
                                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                                  : 'text-slate-500 hover:text-slate-800'
                                }`}
                              title="By Error Type (Slow, Wrong, Skipped)"
                            >
                              <Layers className="w-3.5 h-3.5 text-slate-500" />
                              <span>By Type</span>
                            </button>
                            <button
                              onClick={() => setMockViewModePersisted('rca')}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${mockViewMode === 'rca'
                                  ? 'bg-white text-purple-700 shadow-xs font-bold'
                                  : 'text-slate-500 hover:text-purple-700'
                                }`}
                              title="Root Cause Analysis: [C] Concept, [A] Silly, [T] Time Trap, [G] Guesswork"
                            >
                              <Target className="w-3.5 h-3.5 text-purple-600" />
                              <span>RCA</span>
                            </button>
                            <button
                              onClick={() => setMockViewModePersisted('silly')}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${mockViewMode === 'silly'
                                  ? 'bg-white text-orange-700 shadow-xs font-bold'
                                  : 'text-slate-500 hover:text-orange-700'
                                }`}
                              title="Silly Mistakes aggregate analysis"
                            >
                              <Flame className="w-3.5 h-3.5 text-orange-500" />
                              <span>Silly</span>
                            </button>
                          </div>

                          {/* Start All Button — buckets mode only */}
                          {mockViewMode === 'buckets' && (
                            <button
                              onClick={() => startAllSubjectQuiz(selectedSubject)}
                              disabled={clubbedMockChapters.reduce((acc, ch) => acc + ch.total, 0) === 0}
                              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg h-8 px-3 text-xs font-bold shadow-xs transition-all ${clubbedMockChapters.reduce((acc, ch) => acc + ch.total, 0) === 0
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                  : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white cursor-pointer active:scale-95'
                                }`}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Start All ({clubbedMockChapters.reduce((acc, ch) => acc + ch.total, 0)})</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* GK Quick Filter Chips */}
                    {category === 'mockErrors' && selectedSubject === 'General Awareness' && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                        <button
                          onClick={() => setMockGKFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${mockGKFilter === 'all'
                              ? 'bg-slate-900 text-white shadow-xs font-bold'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <span>All GK</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            mockGKFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {aggregatedMockErrorsData.gkCounts?.all || 0}
                          </span>
                        </button>
                        {GK_SUBJECT_LIST.filter(s => s.id !== 'full_tests').map((sub) => {
                          const Icon = GK_ICONS[sub.iconName] || Globe2;
                          const isSelected = mockGKFilter === sub.id;
                          const count = aggregatedMockErrorsData.gkCounts?.[sub.id] || 0;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => setMockGKFilter(sub.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${isSelected
                                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{sub.shortTitle}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {category === 'mockErrors' ? (
                      (mockScopeCounts.all === 0 && mockGKFilter === 'all' && mockTestTypeFilter === 'all') ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-xs">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-400 mb-2">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                          <h3 className="text-xs font-bold text-slate-800">No Mock Errors Recorded</h3>
                          <p className="mt-0.5 text-[11px] text-slate-500 max-w-md">
                            There are currently no mock error questions for {selectedSubject}. Errors captured from mocks will appear here.
                          </p>
                        </div>
                      ) : clubbedMockChapters.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-xs">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 mb-2">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                          <h3 className="text-xs font-bold text-slate-800">
                            {mockGKFilter !== 'all'
                              ? `No ${mockGKFilter.replace('_', ' ').toUpperCase()} Errors`
                              : `No ${mockTestTypeFilter === 'full' ? 'Full Test' : 'Sectional Test'} Errors`}
                          </h3>
                          <p className="mt-0.5 text-[11px] text-slate-500 max-w-md">
                            There are no recorded error questions for {selectedSubject} under this filter combination.
                          </p>
                          <button
                            onClick={() => {
                              setMockTestTypeFilterPersisted('all');
                              setMockGKFilter('all');
                            }}
                            className="mt-3 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-all cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        </div>
                      ) : mockViewMode === 'silly' ? (
                        <SillyMistakesAggregateView
                          subjectRcaData={aggregatedMockErrorsData.subjectRcaData}
                          selectedSubject={selectedSubject}
                          onSelectSubject={(sub) => {
                            if (sub !== 'all') setSelectedSubject(sub);
                          }}
                          onStartPractice={(title, qs) => {
                            if (qs.length === 0) return;
                            if (qs.length > 25) {
                              setSetPickerModal({
                                title,
                                subtitle: `${qs.length} silly mistake questions`,
                                subject: selectedSubject || 'Mathematics',
                                questions: qs
                              });
                              return;
                            }
                            const virtualChapter: Chapter = {
                              chapter_num: 0,
                              chapter_title: title,
                              subject: selectedSubject || 'Mathematics',
                              subject_id: (selectedSubject || 'mathematics').toLowerCase().replace(/\s+/g, '_'),
                              questions: qs.map((q, idx) => ({ ...q, q_num: idx + 1 })),
                              section: 'mockErrors',
                              is_test: true
                            };
                            startQuiz(virtualChapter);
                          }}
                          onBack={() => setMockViewModePersisted('rca')}
                          language="english"
                        />
                      ) : mockViewMode === 'chapters' || mockViewMode === 'rca' ? (
                        /* Minimalist Mock Errors Cockpit (Stitch Design) - Supports Chapters and RCA */
                        <MockErrorsRcaCockpit
                          mode={mockViewMode}
                          quizMode={quizMode}
                          selectedSubject={selectedSubject}
                          clubbedChapters={clubbedMockChapters}
                          filteredChapters={filteredRcaChapters}
                          subjectRcaData={subjectRcaData}
                          mockTestTypeFilter={mockTestTypeFilter}
                          setMockTestTypeFilter={setMockTestTypeFilterPersisted}
                          mockScopeCounts={mockScopeCounts}
                          mockViewMode={mockViewMode}
                          setMockViewMode={setMockViewModePersisted}
                          rcaSelectedFilter={rcaSelectedFilter}
                          setRcaSelectedFilter={setRcaSelectedFilter}
                          rcaSearchQuery={rcaSearchQuery}
                          setRcaSearchQuery={setRcaSearchQuery}
                          onStartClubbedChapterQuiz={startClubbedChapterQuiz}
                          onStartSubjectRcaQuiz={startSubjectRcaQuiz}
                          onStartSubjectErrorTypeQuiz={startSubjectErrorTypeQuiz}
                          onStartAllSubjectQuiz={startAllSubjectQuiz}
                          onAskAiTopic={handleAskAiTopic}
                          onAskAiRca={handleAskAiRca}
                          onAskAiErrorType={handleAskAiErrorType}
                          onAskAiSubject={handleAskAiSubject}
                          onOpenQuestionsReview={openUnclassifiedReview}
                          onOpenChapterModal={(ch, filter) => {
                            setActiveMockChapterModal(ch);
                            setModalErrorFilter(filter || 'all');
                            setModalActiveSet(ch.total > 25 ? 1 : 'all');
                          }}
                        />
                      ) : (
                        /* Original By Error Bucket View */
                        <div className={`grid gap-3.5 ${(currentData[selectedSubject] || []).length === 1
                            ? 'grid-cols-1 max-w-xl mx-auto w-full'
                            : (currentData[selectedSubject] || []).length === 2
                              ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto w-full'
                              : 'grid-cols-1 lg:grid-cols-3 w-full'
                          }`}>
                          {(currentData[selectedSubject] || []).map((chapter, idx) => {
                            const isSpeed = chapter.chapter_title.toLowerCase().includes('speed');
                            const isUnattempted = chapter.chapter_title.toLowerCase().includes('unattempted') || chapter.chapter_title.toLowerCase().includes('skipped');
                            const isWrong = chapter.chapter_title.toLowerCase().includes('wrong');
                            const isAllErrors = chapter.chapter_title.toLowerCase().includes('mock') || chapter.chapter_title.toLowerCase().includes('all');

                            // Filter questions in this bucket by active mockTestTypeFilter and GK filter
                            const filteredBucketQuestions = chapter.questions.filter(q => {
                              if (mockTestTypeFilter !== 'all' && classifyTestType(q) !== mockTestTypeFilter) return false;
                              if (selectedSubject === 'General Awareness' && mockGKFilter !== 'all') {
                                const rawTopic = q.tags?.topic || (q as any).topic || detectTopic(q, selectedSubject);
                                if (getTopicGKSubject(normalizeTopicTitle(rawTopic)) !== mockGKFilter) return false;
                              }
                              return true;
                            });

                            // Compute topic-wise breakdown
                            const topicMap: Record<string, number> = {};
                            filteredBucketQuestions.forEach(q => {
                              const rawTopic = q.tags?.topic || (q as any).topic || detectTopic(q, selectedSubject);
                              const t = normalizeTopicTitle(rawTopic);
                              topicMap[t] = (topicMap[t] || 0) + 1;
                            });

                            const sortedTopics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]);

                            // Theme config per bucket
                            const theme = isSpeed
                              ? {
                                border: 'border-amber-200 hover:border-amber-300',
                                bgHeader: 'from-amber-500/10 via-amber-50/30 to-transparent',
                                iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-200',
                                badge: 'bg-amber-100 text-amber-800 border border-amber-200',
                                topicPill: 'bg-amber-50/80 hover:bg-amber-100 text-amber-950 border-amber-200/80 hover:border-amber-300',
                                topicCount: 'bg-amber-200/70 text-amber-900',
                                btn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs',
                                subText: 'Overtime & Speed Lags',
                                icon: Zap
                              }
                              : isUnattempted
                                ? {
                                  border: 'border-blue-200 hover:border-blue-300',
                                  bgHeader: 'from-blue-500/10 via-blue-50/30 to-transparent',
                                  iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-200',
                                  badge: 'bg-blue-100 text-blue-800 border border-blue-200',
                                  topicPill: 'bg-blue-50/80 hover:bg-blue-100 text-blue-950 border-blue-200/80 hover:border-blue-300',
                                  topicCount: 'bg-blue-200/70 text-blue-900',
                                  btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs',
                                  subText: 'Skipped & Left Out',
                                  icon: AlertCircle
                                }
                                : isAllErrors
                                  ? {
                                    border: 'border-indigo-200 hover:border-indigo-300',
                                    bgHeader: 'from-indigo-500/10 via-indigo-50/30 to-transparent',
                                    iconBg: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-200',
                                    badge: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
                                    topicPill: 'bg-indigo-50/80 hover:bg-indigo-100 text-indigo-950 border-indigo-200/80 hover:border-indigo-300',
                                    topicCount: 'bg-indigo-200/70 text-indigo-900',
                                    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs',
                                    subText: 'All English Mock Errors',
                                    icon: BookOpen
                                  }
                                  : {
                                    border: 'border-rose-200 hover:border-rose-300',
                                    bgHeader: 'from-rose-500/10 via-rose-50/30 to-transparent',
                                    iconBg: 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-200',
                                    badge: 'bg-rose-100 text-rose-800 border border-rose-200',
                                    topicPill: 'bg-rose-50/80 hover:bg-rose-100 text-rose-950 border-rose-200/80 hover:border-rose-300',
                                    topicCount: 'bg-rose-200/70 text-rose-900',
                                    btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
                                    subText: 'Incorrect Answers',
                                    icon: Flame
                                  };

                            const IconComp = theme.icon;

                            return (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`flex flex-col rounded-xl border bg-white shadow-xs transition-all duration-200 hover:shadow-md ${theme.border}`}
                              >
                                {/* Bucket Header */}
                                <div className={`rounded-t-xl bg-gradient-to-b p-3.5 pb-2.5 ${theme.bgHeader}`}>
                                  <div className="flex items-center justify-between">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-xs ${theme.iconBg}`}>
                                      <IconComp className="w-4 h-4" />
                                    </div>
                                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                                      {filteredBucketQuestions.length} {filteredBucketQuestions.length === 1 ? 'Question' : 'Questions'}
                                    </span>
                                  </div>
                                  <h3 className="mt-2 text-sm font-bold text-slate-900">{chapter.chapter_title}</h3>
                                  <p className="text-[11px] font-medium text-slate-500">{theme.subText}</p>
                                </div>

                                {/* Topic Sub-Buckets Breakdown */}
                                <div className="flex-1 p-3.5 pt-2">
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                                      Topic Breakdown ({sortedTopics.length})
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-400">Click to drill</span>
                                  </div>

                                  {sortedTopics.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-6 text-center">
                                      <p className="text-[11px] font-semibold text-slate-400">No questions in this bucket</p>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                                      {sortedTopics.map(([topicName, count]) => (
                                        <button
                                          key={topicName}
                                          onClick={() => startMockTopicQuiz(chapter, topicName)}
                                          className={`group flex items-center justify-between rounded-lg border p-2 px-2.5 text-left text-xs font-semibold transition-all duration-150 ${theme.topicPill}`}
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="truncate">{topicName}</span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0 ml-1.5">
                                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${theme.topicCount}`}>
                                              {count}
                                            </span>
                                            <ChevronRight className="w-3 h-3 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Bucket Practice All Action */}
                                <div className="border-t border-slate-100 p-2.5 bg-slate-50/50 rounded-b-xl flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      const qs = mockTestTypeFilter === 'all'
                                        ? chapter.questions
                                        : filteredBucketQuestions;
                                      const title = mockTestTypeFilter === 'all'
                                        ? chapter.chapter_title
                                        : `${chapter.chapter_title} (${mockTestTypeFilter === 'full' ? 'Full Tests' : 'Sectional'})`;

                                      if (qs.length > 25) {
                                        setSetPickerModal({
                                          title,
                                          subtitle: `${qs.length} questions in this bucket`,
                                          subject: chapter.subject || selectedSubject || 'All Subjects',
                                          questions: qs
                                        });
                                        return;
                                      }

                                      const virtualChapter: Chapter = {
                                        ...chapter,
                                        chapter_title: title,
                                        questions: qs.map((q, qIdx) => ({ ...q, q_num: qIdx + 1 }))
                                      };
                                      startQuiz(virtualChapter);
                                    }}
                                    disabled={filteredBucketQuestions.length === 0}
                                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none ${theme.btn}`}
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    Practice All ({filteredBucketQuestions.length})
                                  </button>
                                  {latestResultByChapter.has(`${chapter.subject}|${chapter.chapter_title}`) && (
                                    <button
                                      onClick={() => {
                                        const r = latestResultByChapter.get(`${chapter.subject}|${chapter.chapter_title}`);
                                        if (r) openReview(r, 'home');
                                      }}
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shadow-xs"
                                      title="Review last attempt"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(() => {
                          const relevantChapters = (currentData[selectedSubject] || []).filter(chapter => {
                            if (selectedSubject === 'Mathematics' && category === 'chapterBank') {
                              return chapter.section === selectedMathSection;
                            }
                            if (selectedSubject === 'English' && category === 'chapterBank') {
                              if (selectedEnglishSection === 'ayush_vocab') {
                                return chapter.section === 'ayush_vocab';
                              } else if (selectedEnglishSection === 'black_book') {
                                return chapter.section === 'black_book';
                              } else {
                                return chapter.section !== 'ayush_vocab' && chapter.section !== 'black_book';
                              }
                            }
                            if (selectedSubject === 'General Awareness' && category === 'chapterBank') {
                              if (selectedGKSubject === 'full_tests') {
                                if (!chapter.is_test && chapter.subject !== 'GK Full Tests') return false;
                                if (selectedGKSubTopic && selectedGKSubTopic !== 'all') {
                                  const chSub = getChapterGKSubject(chapter);
                                  return chSub === selectedGKSubTopic;
                                }
                                return true;
                              }
                              const chSub = getChapterGKSubject(chapter);
                              if (chSub !== selectedGKSubject) return false;
                              if (selectedGKSubTopic && selectedGKSubTopic !== 'all') {
                                if (selectedGKSubTopic === 'tests') return Boolean(chapter.is_test);
                                return chapter.topic_name === selectedGKSubTopic;
                              }
                              return true;
                            }
                            return true;
                          });

                          const isMathSection = selectedSubject === 'Mathematics' && category === 'chapterBank';
                          const isEnglishAyushVocab = selectedSubject === 'English' && category === 'chapterBank' && selectedEnglishSection === 'ayush_vocab';
                          const isEnglishBlackBook = selectedSubject === 'English' && category === 'chapterBank' && selectedEnglishSection === 'black_book';
                          const isEnglishVocabSection = isEnglishAyushVocab || isEnglishBlackBook;
                          const isTopicLevelSection = isMathSection || isEnglishVocabSection;

                          if (isTopicLevelSection && !selectedTopic) {
                            const topics = Array.from(new Set(relevantChapters.map(ch => ch.topic_name).filter(Boolean))) as string[];
                            if (isEnglishVocabSection) {
                              const vocabOrder = ['one_word_substitution', 'synonyms', 'phrasal_verbs', 'antonyms', 'idioms_and_phrases', 'spellings'];
                              topics.sort((a, b) => {
                                const idxA = vocabOrder.indexOf(a);
                                const idxB = vocabOrder.indexOf(b);
                                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                return a.localeCompare(b);
                              });
                            } else {
                              topics.sort((a, b) => a.localeCompare(b));
                            }

                            return topics.map((topic, idx) => {
                              const topicChapters = relevantChapters.filter(ch => ch.topic_name === topic);
                              const totalQuestions = topicChapters.reduce((acc, ch) => acc + (ch.questions?.length || 0), 0);
                              const displayTitle = isEnglishVocabSection
                                ? (topic === 'synonyms' ? 'Synonyms'
                                  : topic === 'antonyms' ? 'Antonyms'
                                    : topic === 'one_word_substitution' ? 'One Word Substitution'
                                      : topic === 'phrasal_verbs' ? 'Phrasal Verbs'
                                        : topic === 'idioms_and_phrases' ? 'Idioms & Phrases'
                                          : topic === 'spellings' ? 'Spellings'
                                            : topic.replace(/_/g, ' '))
                                : topic.replace(/_/g, ' ');

                              const chipGrad = isEnglishBlackBook
                                ? 'from-amber-500 to-orange-600'
                                : isEnglishVocabSection
                                  ? (topic === 'synonyms' ? 'from-emerald-500 to-teal-600'
                                    : topic === 'antonyms' ? 'from-cyan-500 to-blue-600'
                                      : topic === 'one_word_substitution' ? 'from-violet-500 to-purple-600'
                                        : topic === 'idioms_and_phrases' ? 'from-amber-500 to-orange-600'
                                          : 'from-rose-500 to-pink-600')
                                  : 'from-indigo-500 to-violet-600';

                              return (
                                <motion.div
                                  key={idx}
                                  whileHover={{ y: -2 }}
                                  onClick={() => setSelectedTopic(topic)}
                                  className={`group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 transition-all duration-200 ${isEnglishBlackBook ? 'hover:border-amber-300' : isEnglishVocabSection ? 'hover:border-emerald-300' : 'hover:border-indigo-300'
                                    } hover:shadow-md shadow-xs flex flex-col justify-between`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${chipGrad} text-white shadow-xs`}>
                                      {isEnglishBlackBook ? <BookMarked className="w-4 h-4" /> : isEnglishVocabSection ? <Sparkles className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                                        {topicChapters.length} Sets
                                      </span>
                                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${isEnglishBlackBook ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                        {totalQuestions} Qs
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const allQs = topicChapters.flatMap(c => c.questions || []);
                                          handleAskAiTopic(displayTitle, selectedSubject || 'All Subjects', allQs);
                                        }}
                                        className="p-1 rounded-md bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white transition-colors cursor-pointer"
                                        title={`Ask Tommy AI about ${displayTitle}`}
                                      >
                                        <Sparkles className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  <h3 className="mt-2.5 text-xs font-bold capitalize text-slate-800">{displayTitle}</h3>
                                  <div className={`mt-2 flex items-center text-xs font-semibold ${isEnglishBlackBook ? 'text-amber-600' : isEnglishVocabSection ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                    {isEnglishBlackBook ? `View All ${topicChapters.length} Sets (${totalQuestions} Words)` : isEnglishAyushVocab ? 'View Sets (20 Qs each)' : 'View Sets'}
                                    <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                                  </div>
                                </motion.div>
                              );
                            });
                          }

                          let chaptersToRender = isTopicLevelSection && selectedTopic
                            ? relevantChapters.filter(ch => ch.topic_name === selectedTopic)
                            : relevantChapters;

                          if (selectedSubject === 'General Awareness') {
                            chaptersToRender = [...chaptersToRender].sort((a, b) => {
                              if (a.is_test && !b.is_test) return 1;
                              if (!a.is_test && b.is_test) return -1;
                              return (a.chapter_num || 0) - (b.chapter_num || 0);
                            });
                          } else if (isEnglishVocabSection) {
                            chaptersToRender = [...chaptersToRender].sort((a, b) => (a.chapter_num || 0) - (b.chapter_num || 0));
                          } else {
                            chaptersToRender = [...chaptersToRender].sort((a, b) => {
                              const aNum = a.original_chapter_num || a.chapter_num || 0;
                              const bNum = b.original_chapter_num || b.chapter_num || 0;
                              return aNum - bNum;
                            });
                          }

                          if (chaptersToRender.length === 0) {
                            return (
                              <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
                                <p className="text-xs font-bold text-slate-600">No chapters found for this selection.</p>
                              </div>
                            );
                          }

                          return chaptersToRender.map((chapter) => (
                            <motion.div
                              key={`${chapter.chapter_title}|${chapter.section || ''}|${chapter.set_name || ''}`}
                              whileHover={{ y: -2 }}
                              onClick={() => {
                                if (chapter.section === 'grammar' && chapter.questions.length > 50) {
                                  setSetPickerModal({
                                    title: chapter.chapter_title,
                                    subtitle: `Chapter ${chapter.original_chapter_num || chapter.chapter_num} • ${chapter.questions.length} questions • ${Math.ceil(chapter.questions.length / 50)} Sets`,
                                    subject: 'English',
                                    questions: chapter.questions,
                                    setSize: 50,
                                    chapterNum: chapter.original_chapter_num || chapter.chapter_num,
                                    section: 'grammar'
                                  });
                                  return;
                                }
                                startQuiz(chapter);
                              }}
                              className={`group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 transition-all duration-200 ${chapter.section === 'black_book' ? 'hover:border-amber-300' : chapter.section === 'ayush_vocab' ? 'hover:border-emerald-300' : 'hover:border-indigo-300'
                                } hover:shadow-md shadow-xs flex flex-col justify-between`}
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${chapter.section === 'black_book'
                                      ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                                      : chapter.section === 'ayush_vocab'
                                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                                        : chapter.is_test
                                          ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                                          : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                                    } shadow-xs`}>
                                    {chapter.section === 'black_book' ? <BookMarked className="w-4 h-4" /> : chapter.section === 'ayush_vocab' ? <Sparkles className="w-4 h-4" /> : chapter.is_test ? <FileText className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                                  </div>
                                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${chapter.section === 'black_book'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : chapter.section === 'ayush_vocab'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : chapter.section === 'grammar'
                                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                          : chapter.is_test
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : 'bg-slate-50 text-slate-500'
                                    }`}>
                                    {chapter.section === 'black_book' || chapter.section === 'ayush_vocab'
                                      ? `Set ${chapter.chapter_num}`
                                      : chapter.section === 'grammar'
                                        ? `Ch ${chapter.original_chapter_num || chapter.chapter_num}`
                                        : chapter.is_test
                                          ? 'Full Test'
                                          : chapter.set_name
                                            ? `Set ${chapter.set_name.replace('set_', '')}`
                                            : `Ch ${chapter.original_chapter_num || chapter.chapter_num}`}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="mt-2.5 text-xs font-bold text-slate-800 line-clamp-1">{chapter.chapter_title}</h3>
                                  <p className="mt-0.5 text-[11px] text-slate-500">
                                    {chapter.section === 'grammar' && chapter.questions.length > 50
                                      ? `${chapter.questions.length} Questions • ${Math.ceil(chapter.questions.length / 50)} Sets (50 Qs/set)`
                                      : `${chapter.questions.length} Questions ${chapter.topic_name ? `• ${formatGKSubTopicTitle(chapter.topic_name)}` : ''}`}
                                  </p>
                                </div>

                                {chapter.section === 'grammar' && chapter.questions.length > 50 && (
                                  <div className="mt-2 flex flex-wrap gap-1 pt-1.5 border-t border-slate-100">
                                    {Array.from({ length: Math.ceil(chapter.questions.length / 50) }).map((_, sIdx) => {
                                      const sNum = sIdx + 1;
                                      const startQ = sIdx * 50 + 1;
                                      const endQ = Math.min((sIdx + 1) * 50, chapter.questions.length);
                                      const sCount = endQ - startQ + 1;
                                      return (
                                        <button
                                          key={sNum}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const targetQuestions = chapter.questions.slice(sIdx * 50, endQ);
                                            const virtualChapter: Chapter = {
                                              ...chapter,
                                              chapter_num: chapter.original_chapter_num || chapter.chapter_num,
                                              chapter_title: `${chapter.chapter_title} • Set ${sNum} (Q${startQ}-${endQ})`,
                                              questions: targetQuestions.map((q, qIdx) => ({ ...q, q_num: qIdx + 1 }))
                                            };
                                            startQuiz(virtualChapter);
                                          }}
                                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50/80 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200/60 transition-all cursor-pointer shadow-2xs"
                                          title={`Practice Set ${sNum}: Questions ${startQ} to ${endQ} (${sCount} Qs)`}
                                        >
                                          Set {sNum} ({sCount})
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className={`flex items-center text-xs font-semibold ${chapter.section === 'black_book' ? 'text-amber-600' : chapter.section === 'ayush_vocab' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                  {chapter.section === 'grammar' && chapter.questions.length > 50 ? 'Choose Set' : 'Start Set'}
                                  <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {chapter.section === 'grammar' && getGrammarPdfUrl(chapter.original_chapter_num || chapter.chapter_num) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const pdfUrl = getGrammarPdfUrl(chapter.original_chapter_num || chapter.chapter_num);
                                        if (pdfUrl) window.open(pdfUrl, '_blank');
                                      }}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white border border-amber-200 transition-all cursor-pointer shadow-2xs"
                                      title={`Open original book PDF for Chapter ${chapter.original_chapter_num || chapter.chapter_num}`}
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>PDF</span>
                                    </button>
                                  )}
                                  {chapter.cheat_sheet && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCheatSheet(chapter);
                                      }}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200/80 transition-all cursor-pointer shadow-2xs"
                                      title="Open Chapter Revision Cheat Sheet"
                                    >
                                      <BookOpen className="w-3 h-3" />
                                      <span>Cheat Sheet</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAskAiTopic(chapter.chapter_title, chapter.subject, chapter.questions);
                                    }}
                                    className="p-1.5 rounded-md bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white transition-colors cursor-pointer"
                                    title={`Ask Tommy AI about this chapter`}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </button>
                                  {latestResultByChapter.has(`${chapter.subject}|${chapter.chapter_title}`) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const r = latestResultByChapter.get(`${chapter.subject}|${chapter.chapter_title}`);
                                        if (r) openReview(r, 'home');
                                      }}
                                      className="p-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-colors"
                                      title="Review last attempt"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {view === 'quiz' && activeChapter && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full overflow-hidden"
              >
                <React.Suspense fallback={
                  <div className="flex flex-col items-center justify-center py-40">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                    <p className="text-slate-500 font-bold">Loading quiz...</p>
                  </div>
                }>
                  <QuizContainer
                    chapter={activeChapter}
                    category={category}
                    mode={quizMode}
                    onSaveResult={handleSaveQuizResult}
                    onExit={handleQuizExit}
                    onReviewAttempt={handleReviewFromQuiz}
                    bookmarkedIds={new Set(bookmarks.map(b => b.question.question.trim().toLowerCase()))}
                    onBookmarkToggle={toggleBookmark}
                    isAdmin={isAuthorized}
                    onDeleteQuestion={handleDeleteQuestion}
                  />
                </React.Suspense>
              </motion.div>
            )}

            {view === 'bookmarks' && (
              <BookmarksView
                user={user}
                loadingBookmarks={loadingBookmarks}
                bookmarks={bookmarks}
                bookmarksBySubjectAndChapter={bookmarksBySubjectAndChapter}
                selectedBookmarkSubject={selectedBookmarkSubject}
                setSelectedBookmarkSubject={setSelectedBookmarkSubject}
                toggleBookmark={toggleBookmark}
                startSubjectBookmarkQuiz={startSubjectBookmarkQuiz}
                startChapterBookmarkQuiz={startChapterBookmarkQuiz}
                onLogin={handleLogin}
                onNavigateHome={() => setView('home')}
              />
            )}

            {view === 'dashboard' && (
              <PerformanceDashboard
                user={user}
                loadingResults={loadingResults}
                userResults={userResults}
                onClearAllResults={handleClearAllResults}
                onDeleteResult={handleDeleteResult}
                onOpenReview={openReview}
                onReattempt={reattemptFromResult}
                onLogin={handleLogin}
                onNavigateHome={() => setView('home')}
              />
            )}

            {view === 'review' && reviewResult && (
              <React.Suspense fallback={
                <div className="flex flex-col items-center justify-center py-40">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-bold">Loading review...</p>
                </div>
              }>
                <ReviewView
                  result={reviewResult}
                  onReattempt={() => reattemptFromResult(reviewResult)}
                  onReattemptQuestions={(title, qs) => reattemptFilteredQuestions(title, qs, reviewResult.subject)}
                  onBack={() => setView(reviewBackTo)}
                  userName={user?.displayName || 'Candidate'}
                  bookmarkedIds={new Set(bookmarks.map(b => b.question.question.trim().toLowerCase()))}
                  onBookmarkToggle={toggleBookmark}
                  onViewAnalytics={() => setView('dashboard')}
                  onDeleteQuestion={handleDeleteQuestion}
                  onUpdateResult={(updated) => {
                    setUserResults(prev => prev.map(r => r.id === updated.id ? updated : r));
                    setReviewResult(updated);
                  }}
                />
              </React.Suspense>
            )}

            {view === 'drill' && (
              <motion.div
                key="drill"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
              >
                <React.Suspense fallback={
                  <div className="flex flex-col items-center justify-center py-40">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                    <p className="text-slate-500 font-bold">Loading speed drills...</p>
                  </div>
                }>
                  <DrillHub onBack={() => setView('home')} />
                </React.Suspense>
              </motion.div>
            )}

            {view === 'mockScores' && (
              <motion.div
                key="mockScores"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <React.Suspense fallback={
                  <div className="flex flex-col items-center justify-center py-40">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                    <p className="text-slate-500 font-bold">Loading mock score dashboard...</p>
                  </div>
                }>
                  <MockScoreDashboard
                    onBack={() => setView('home')}
                    mockData={mockData}
                    onStartPracticeMock={(chapter: Chapter, mode?: 'practice' | 'mock') => {
                      setCategory('mockErrors');
                      setQuizMode(mode || quizMode || 'practice');
                      startQuiz(chapter);
                    }}
                    onReviewMock={(quizResult: QuizResult) => {
                      openReview(quizResult, 'mockScores');
                    }}
                  />
                </React.Suspense>
              </motion.div>
            )}


            {view === 'botErrors' && (
              <motion.div
                key="botErrors"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <BotMistakesPage
                  onBack={resetToHome}
                  onAskAiTopic={handleAskAiTopic}
                  onStartPractice={(topic, questions) => {
                    const firstQ = questions[0];
                    const rawSub = firstQ?.subject || 'English';
                    const formattedSub = rawSub.charAt(0).toUpperCase() + rawSub.slice(1);
                    setCategory('mockErrors');
                    setQuizMode('practice');

                    if (questions.length > 25) {
                      setSetPickerModal({
                        title: `Mistakes Drill • ${topic}`,
                        subtitle: `${questions.length} mistakes recorded in this topic`,
                        subject: formattedSub,
                        questions: questions
                      });
                      return;
                    }

                    const virtualChapter: Chapter = {
                      chapter_num: 0,
                      chapter_title: `Mistakes Drill • ${topic}`,
                      subject: formattedSub,
                      subject_id: (firstQ?.subject || 'english').toLowerCase().replace(/\s+/g, '_'),
                      questions: questions.map((q, idx) => ({ ...q, q_num: idx + 1 })),
                      section: 'mockErrors',
                      is_test: false
                    };
                    startQuiz(virtualChapter);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Chapter Drill & Questions Preview Modal for Mock Errors */}
        {activeMockChapterModal && (
          <MockChapterErrorsModal
            data={activeMockChapterModal}
            modalErrorFilter={modalErrorFilter}
            setModalErrorFilter={setModalErrorFilter}
            modalActiveSet={modalActiveSet}
            setModalActiveSet={setModalActiveSet}
            mockViewMode={mockViewMode}
            quizMode={quizMode}
            onClose={() => setActiveMockChapterModal(null)}
            onStartPractice={(topic, questions, subType, setNum) => {
              startClubbedChapterQuiz(topic, questions, subType, setNum);
            }}
            onAskAi={(topic, subject, questions, counts, mode, activeFilter) => {
              handleAskAiTopic(topic, subject, questions, counts, mode || mockViewMode, activeFilter || modalErrorFilter);
            }}
          />
        )}

        {/* Set Picker Modal (For Start All or topic drills with > 25 questions) */}
        <SetPickerModal
          modalData={setPickerModal}
          onClose={() => setSetPickerModal(null)}
          onStartQuiz={startQuiz}
        />

        {/* Grammar Chapter Revision Cheat Sheet Modal */}
        <CheatSheetModal
          isOpen={!!selectedCheatSheet}
          onClose={() => setSelectedCheatSheet(null)}
          chapter={selectedCheatSheet}
          onStartPractice={(ch) => {
            setSelectedCheatSheet(null);
            startQuiz(ch);
          }}
        />


      </main>

      {/* Mobile Bottom Navigation Bar */}
      {view !== 'quiz' && view !== 'review' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 py-1.5 flex items-center justify-around shadow-lg safe-bottom">
          <button
            onClick={resetToHome}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              view === 'home' ? 'text-blue-600 bg-blue-50/60' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4 mb-0.5" />
            <span>Practice</span>
          </button>
          <button
            onClick={() => { setView('drill'); setSelectedSubject(null); setSelectedTopic(null); }}
            className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              view === 'drill' ? 'text-blue-600 bg-blue-50/60' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-4 h-4 mb-0.5" />
            <span>Drills</span>
          </button>

          <button
            onClick={() => { setView('bookmarks'); setSelectedBookmarkSubject(null); }}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              view === 'bookmarks' ? 'text-blue-600 bg-blue-50/60' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookmarkIcon className="w-4 h-4 mb-0.5" />
            <span>Saved ({bookmarks.length})</span>
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              view === 'dashboard' ? 'text-blue-600 bg-blue-50/60' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setView('mockScores')}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              view === 'mockScores' ? 'text-blue-600 bg-blue-50/60' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4 mb-0.5" />
            <span>Scores</span>
          </button>
          <button
            onClick={() => setView('botErrors')}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              view === 'botErrors' ? 'text-rose-600 bg-rose-50/60 font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-sm leading-none mb-0.5">📕</span>
            <span>Mistakes</span>
          </button>
        </nav>
      )}

      {/* Floating Tommy AI Assistant - always mounted so Ask Tommy works in Practice and Review modes */}
      <AiMentorChat
        mockReports={mockReportsList}
        mockErrorsData={mockData}
        activeReviewResult={view === 'review' ? reviewResult : null}
        onStartWeakTopicDrill={startWeakTopicDrill}
        hideFloatingTrigger={view === 'quiz'}
      />
    </div>
  );
}

