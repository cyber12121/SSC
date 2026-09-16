import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Trophy, GraduationCap, LayoutDashboard, LogIn, LogOut, Loader2, AlertCircle, ListChecks, ChevronRight, ChevronLeft, Play, Layers, Bookmark as BookmarkIcon, Trash2, Shield, Crown, Zap, Flame, Star, History, RotateCcw, Calculator, Compass, Languages, Globe2, Clock, Target, Search, Filter, X, XCircle, Landmark, Scale, TrendingUp, Atom, Sparkles, FileText } from 'lucide-react';
import { Chapter, SubjectData, QuizResult, Bookmark, Question } from './types';
import { detectTopic, normalizeTopicTitle } from './utils/topicDetector';
import { GK_SUBJECT_CONFIGS, GK_SUBJECT_LIST, GKSubjectId, getChapterGKSubject, getTopicGKSubject, formatGKSubTopicTitle } from './utils/gkSubjectHelper';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';

// Lazy load heavier views to minimize initial bundle footprint and speed up first paint
const QuizContainer = React.lazy(() => import('./components/QuizContainer').then(m => ({ default: m.QuizContainer })));
const ReviewView = React.lazy(() => import('./components/Review').then(m => ({ default: m.ReviewView })));
const DrillHub = React.lazy(() => import('./components/drill/DrillHub').then(m => ({ default: m.DrillHub })));
const ErrorHeatmap = React.lazy(() => import('./components/ErrorHeatmap').then(m => ({ default: m.ErrorHeatmap })));
const MockScoreDashboard = React.lazy(() => import('./components/MockScoreDashboard').then(m => ({ default: m.MockScoreDashboard })));
import { MockScoreReport } from './types/mockScore';
import initialMockReports from './data/mock_reports.json';
import { AiMentorChat } from './components/AiMentorChat';
import { safeStorage } from './utils/safeStorage';
import { syncMockReports } from './utils/syncMockReports';
import { FormattedText } from './components/FormattedText';

import { getCachedData, setCachedData } from './utils/cache';

const GK_ICONS: Record<string, any> = {
  Landmark,
  Scale,
  Globe2,
  TrendingUp,
  Atom,
  Sparkles,
  FileText,
};

// Dynamic import of all subject JSON files (recursive) - lazy split chunks!
// Only load the two data folders we actually use — avoids registering mock_questions, drills, etc.
const subjectModules = import.meta.glob('./data/{mock_errors,chapter_bank}/**/*.json');

const loadSubjectData = async (): Promise<{ rawMockData: SubjectData; rawBankData: SubjectData }> => {
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
    const { path, data } = item;
    // Determine if it's mockErrors or chapterBank based on the file path
    const isMock = path.includes('/mock_errors/');
    const isBank = path.includes('/chapter_bank/');

    if (!isMock && !isBank) return;
    
    // The data could be a single chapter object or an array of chapters
    const chapters = Array.isArray(data) ? data : (data.questions ? [data] : []);
    
    // If the data structure is the old one (with chapterBank/mockErrors keys), handle it too
    if (data.chapterBank) chapters.push(...data.chapterBank);
    if (data.mockErrors) chapters.push(...data.mockErrors);

    // Determine section and topic from path (applicable to Mathematics and English in chapter_bank)
    let section: 'spartan' | 'pinnacle' | 'qrb' | 'top500' | 'ayush_vocab' | 'general' | undefined = undefined;
    let topic_name: string | undefined = undefined;
    let set_name: string | undefined = undefined;

    if (isBank) {
      if (path.includes('/mathematics/spartan/')) section = 'spartan';
      else if (path.includes('/mathematics/pinnacle/')) section = 'pinnacle';
      else if (path.includes('/mathematics/qrb/')) section = 'qrb';
      else if (path.includes('/mathematics/top500/')) section = 'top500';
      else if (path.includes('/english/ayush_vocab/')) section = 'ayush_vocab';
      else if (path.includes('/english/')) section = 'general';

      if (section && section !== 'general') {
        const marker = section === 'ayush_vocab' ? '/ayush_vocab/' : `/${section}/`;
        const parts = path.split(marker);
        if (parts.length > 1) {
          const subPath = parts[1]; // e.g., "percentage/set_1.json" or "synonyms/set_1.json"
          const subParts = subPath.split('/');
          if (subParts.length >= 2) {
            topic_name = subParts[0]; // "percentage" or "synonyms"
            set_name = subParts[1].replace('.json', ''); // "set_1"
          }
        }
      } else if (path.includes('/general_awareness/')) {
        const parts = path.split('/general_awareness/');
        if (parts.length > 1) {
          const subPath = parts[1]; // e.g., "chemistry/acid_bases_and_salts_vivid.json"
          const subParts = subPath.split('/');
          if (subParts.length >= 2) {
            topic_name = subParts[0]; // "chemistry"
          }
        }
      } else if (path.includes('/gk_full_tests/')) {
        const fileName = (path.split('/gk_full_tests/')[1] || '').toLowerCase();
        if (fileName.includes('history')) topic_name = 'history';
        else if (fileName.includes('polity')) topic_name = 'polity';
        else if (fileName.includes('geography')) topic_name = 'geography';
        else if (fileName.includes('economics')) topic_name = 'economics';
        else if (fileName.includes('physics')) topic_name = 'physics';
        else if (fileName.includes('chemistry')) topic_name = 'chemistry';
        else if (fileName.includes('biology')) topic_name = 'biology';
        else topic_name = 'tests';
      }
    }

    chapters.forEach((chapter: any) => {
      let subject = chapter.subject;

      // Unify GK Full Tests under General Awareness so all GK is subject-wise
      if (path.includes('/gk_full_tests/')) {
        chapter.is_test = true;
        chapter.subject = 'General Awareness';
        subject = 'General Awareness';
      }

      if (path.includes('/english/')) {
        chapter.subject = 'English';
        subject = 'English';
      }

      if (section) {
        chapter.section = section;
      }
      if (topic_name) {
        chapter.topic_name = topic_name;
      }
      if (set_name) {
        chapter.set_name = set_name;
      }

      // Compute GK Subject
      if (subject === 'General Awareness' || path.includes('/general_awareness/') || path.includes('/gk_full_tests/')) {
        chapter.gk_subject = getChapterGKSubject(chapter);
      }

      if (isMock || (path.includes('mockErrors') && !isBank)) {
        if (!rawMockData[subject]) rawMockData[subject] = [];
        rawMockData[subject].push(chapter);
      } else {
        if (!rawBankData[subject]) rawBankData[subject] = [];
        rawBankData[subject].push(chapter);
      }
    });
  });

  return { rawMockData, rawBankData };
};

const getQuestionId = (chapter: Chapter, question: Question) => {
  if (question.id) return question.id;
  return `${chapter.subject}|${chapter.chapter_title}|${question.question}`.replace(/\s+/g, '_');
};

const getSubjectTheme = (subject: string) => {
  const sub = (subject || '').toLowerCase();
  if (sub.includes('math') || sub.includes('quant') || sub.includes('aptitude')) {
    return {
      name: 'Mathematics',
      icon: Calculator,
      gradient: 'from-violet-600 to-indigo-600',
      textCol: 'text-violet-600',
      bgLight: 'bg-violet-50',
      borderCol: 'border-violet-200',
      badge: 'bg-violet-100 text-violet-800 border-violet-200',
      bar: 'bg-violet-600',
    };
  }
  if (sub.includes('reason') || sub.includes('logic')) {
    return {
      name: 'Reasoning',
      icon: Compass,
      gradient: 'from-purple-600 to-fuchsia-600',
      textCol: 'text-purple-600',
      bgLight: 'bg-purple-50',
      borderCol: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      bar: 'bg-purple-600',
    };
  }
  if (sub.includes('english') || sub.includes('verbal')) {
    return {
      name: 'English',
      icon: Languages,
      gradient: 'from-emerald-500 to-teal-600',
      textCol: 'text-emerald-600',
      bgLight: 'bg-emerald-50',
      borderCol: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      bar: 'bg-emerald-600',
    };
  }
  if (sub.includes('aware') || sub.includes('gk') || sub.includes('gs') || sub.includes('science')) {
    return {
      name: 'General Awareness',
      icon: Globe2,
      gradient: 'from-amber-500 to-orange-500',
      textCol: 'text-amber-600',
      bgLight: 'bg-amber-50',
      borderCol: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      bar: 'bg-amber-500',
    };
  }
  return {
    name: subject || 'General',
    icon: BookOpen,
    gradient: 'from-slate-600 to-slate-700',
    textCol: 'text-slate-600',
    bgLight: 'bg-slate-50',
    borderCol: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    bar: 'bg-slate-600',
  };
};

const formatAttemptDate = (isoStr?: string) => {
  if (!isoStr) return 'Recently';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Recently';
  }
};

export default function App() {
  const [view, setView] = useState<'home' | 'quiz' | 'dashboard' | 'bookmarks' | 'heatmap' | 'review' | 'drill' | 'mockScores'>('home');
  const [mockReportsList, setMockReportsList] = useState<MockScoreReport[]>(() => {
    let list: MockScoreReport[] = [];
    try {
      const saved = safeStorage.getItem('cgl_mock_score_reports');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      }
    } catch (e) {}
    const synced = syncMockReports(list, initialMockReports as MockScoreReport[]);
    try {
      safeStorage.setItem('cgl_mock_score_reports', JSON.stringify(synced));
    } catch {}
    return synced;
  });

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
          } catch {}
        }
      })
      .catch(() => {});

    const handleStorage = () => {
      try {
        const saved = safeStorage.getItem('cgl_mock_score_reports');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const synced = syncMockReports(parsed, initialMockReports as MockScoreReport[]);
            setMockReportsList(synced);
          }
        }
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('cgl_mock_reports_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('cgl_mock_reports_updated', handleStorage);
    };
  }, []);
  const [reviewResult, setReviewResult] = useState<QuizResult | null>(null);
  const [reviewBackTo, setReviewBackTo] = useState<'home' | 'dashboard'>('dashboard');
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
    try { localStorage.setItem('quizMode', mode); } catch {}
  };
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedMathSection, setSelectedMathSection] = useState<'spartan' | 'pinnacle' | 'qrb' | 'top500' | null>(null);
  const [selectedEnglishSection, setSelectedEnglishSection] = useState<'ayush_vocab' | 'general' | null>(null);
  const [selectedGKSubject, setSelectedGKSubject] = useState<GKSubjectId | null>(null);
  const [selectedGKSubTopic, setSelectedGKSubTopic] = useState<string>('all');
  const [mockGKFilter, setMockGKFilter] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<Set<string>>(() => {
    try {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('cgl_deleted_question_ids') : null;
      if (cached) return new Set(JSON.parse(cached));
    } catch {}
    return new Set();
  });
  const [selectedBookmarkSubject, setSelectedBookmarkSubject] = useState<string | null>(null);

  // Dashboard filter states
  const [dashCategoryFilter, setDashCategoryFilter] = useState<'all' | 'chapterBank' | 'mockErrors'>('all');
  const [dashSubjectFilter, setDashSubjectFilter] = useState<string>('all');
  const [dashSearchQuery, setDashSearchQuery] = useState<string>('');
  const [dashSort, setDashSort] = useState<'newest' | 'accuracy-desc' | 'accuracy-asc'>('newest');

  // Mock Error View Mode: 'chapters' (clubbed chapter-wise) vs 'buckets' (by error type)
  const [mockViewMode, setMockViewMode] = useState<'chapters' | 'buckets'>(() => {
    try {
      const saved = localStorage.getItem('mockViewMode');
      return saved === 'buckets' ? 'buckets' : 'chapters';
    } catch {
      return 'chapters';
    }
  });

  const setMockViewModePersisted = (mode: 'chapters' | 'buckets') => {
    setMockViewMode(mode);
    try { localStorage.setItem('mockViewMode', mode); } catch {}
  };

  const [activeMockChapterModal, setActiveMockChapterModal] = useState<{
    topic: string;
    subject: string;
    total: number;
    slow: number;
    unattempted: number;
    wrong: number;
    questions: (Question & { errorType: 'speed_issue' | 'unattempted' | 'wrong' })[];
    slowQuestions: Question[];
    unattemptedQuestions: Question[];
    wrongQuestions: Question[];
  } | null>(null);

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
            chapter_title: canonicalTitle,
            questions: []
          };
        }

        const existingQs = mergedChaptersMap[key].questions;
        const existingQTexts = new Set(existingQs.map(q => q.question.trim().toLowerCase()));

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
        return {
          ...chapter,
          chapter_num: chIdx + 1,
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
      .catch(() => {});

    loadSubjectData()
      .then(data => {
        if (isMounted) {
          setRawData(data);
          setDataLoading(false);
          setCachedData(data).catch(() => {});
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

  const [userResults, setUserResults] = useState<QuizResult[]>([]);
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
    // Track the newest saved attempt per chapter
    userResults.forEach(r => {
      const key = `${r.subject}|${r.chapter_title}`;
      if (!map.has(key)) map.set(key, r);
    });
    return map;
  }, [userResults]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
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
            localStorage.setItem('cgl_deleted_question_ids', JSON.stringify(Array.from(merged)));
          } catch {}
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
    if (!user) return;
    setLoadingResults(true);
    try {
      const q = query(
        collection(db, 'results'),
        where('userId', '==', user.uid),
        orderBy('completedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as QuizResult[];

      // Filter out cleared history and individually deleted items
      let clearedAt: string | null = null;
      let hiddenIds = new Set<string>();
      try {
        if (typeof window !== 'undefined') {
          clearedAt = window.localStorage?.getItem('activity_cleared_at_' + user.uid) || null;
          hiddenIds = new Set(JSON.parse(window.localStorage?.getItem('hidden_result_ids_' + user.uid) || '[]'));
        }
      } catch (e) {}

      const filtered = results.filter(r => {
        if (hiddenIds.has(r.id)) return false;
        if (clearedAt && r.completedAt && r.completedAt <= clearedAt) return false;
        return true;
      });

      setUserResults(filtered);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoadingResults(false);
    }
  }, [user]);

  // Only refetch results when the authenticated user changes — not on every view navigation
  useEffect(() => {
    fetchResults();
  }, [user, fetchResults]);

  // Fetch Bookmarks — wrapped in useCallback to prevent stale closure issues
  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
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
    if (user && (view === 'bookmarks' || view === 'quiz')) {
      fetchBookmarks();
    }
  }, [user, view, fetchBookmarks]);

  const toggleBookmark = async (question: Question) => {
    if (!user) return;

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
    const qTextClean = question.question.trim().toLowerCase();
    const qId = activeChapter ? getQuestionId(activeChapter, question) : (question.id || qTextClean);

    // 1. Immediately update deletedQuestionIds set & localStorage so it's deleted everywhere
    setDeletedQuestionIds(prev => {
      const next = new Set(prev);
      next.add(qId);
      next.add(qTextClean);
      if (question.id) next.add(question.id);
      try {
        localStorage.setItem('cgl_deleted_question_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    // 2. Remove from activeChapter immediately for instant UI reactivity
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

    // 3. Also remove from bookmarks if present
    setBookmarks(prev => prev.filter(b => b.question.question.trim().toLowerCase() !== qTextClean));

    // 4. Persist to Firestore deleted_questions collection
    try {
      await addDoc(collection(db, 'deleted_questions'), {
        questionId: qId,
        questionText: qTextClean,
        chapter_title: activeChapter?.chapter_title || 'Unknown',
        subject: activeChapter?.subject || 'Unknown',
        deletedBy: user?.uid || 'user',
        deletedAt: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Could not sync deleted question to remote DB (offline/rules):', error);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
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
        el.requestFullscreen().catch(() => {});
      }
    }
  };

  const startAllSubjectQuiz = (subjectName: string) => {
    const allQuestions = (currentData[subjectName] || []).flatMap(ch => ch.questions).map((q, idx) => ({
      ...q,
      q_num: idx + 1
    }));
    if (allQuestions.length === 0) {
      alert(`No questions available in ${subjectName} yet.`);
      return;
    }
    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `All ${subjectName} Questions`,
      subject: subjectName,
      subject_id: subjectName.toLowerCase().replace(/\s+/g, '_'),
      questions: allQuestions
    };
    startQuiz(virtualChapter);
  };

  const startMockTopicQuiz = (chapter: Chapter, topicName: string) => {
    const filteredQuestions = chapter.questions
      .filter(q => {
        const raw = q.tags?.topic || (q as any).topic || detectTopic(q, chapter.subject || '');
        return normalizeTopicTitle(raw) === topicName;
      })
      .map((q, idx) => ({
        ...q,
        q_num: idx + 1
      }));
    if (filteredQuestions.length === 0) {
      alert(`No questions available in topic "${topicName}" yet.`);
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

    if (!user) {
      const guestSaved = { ...fullResult, id: 'guest-' + Date.now() };
      try {
        const guestHistory = JSON.parse(localStorage.getItem('guest_results') || '[]');
        localStorage.setItem('guest_results', JSON.stringify([guestSaved, ...guestHistory].slice(0, 50)));
      } catch {}
      return guestSaved;
    }

    try {
      // Deep sanitize to strip any undefined properties that Firestore rejects
      const sanitizedDoc = JSON.parse(JSON.stringify(fullResult));
      const docRef = await addDoc(collection(db, 'results'), sanitizedDoc);
      const saved = { ...fullResult, id: docRef.id };

      // Optimistically update recent activity state immediately — no extra fetchResults() to avoid race condition
      setUserResults(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
      return saved;
    } catch (error) {
      console.error('Error saving progress to Firestore:', error);
      // Fallback local storage so test attempt is never lost
      const localSaved = { ...fullResult, id: 'local-' + Date.now() };
      try {
        const localHistory = JSON.parse(localStorage.getItem('offline_results_' + user.uid) || '[]');
        localStorage.setItem('offline_results_' + user.uid, JSON.stringify([localSaved, ...localHistory].slice(0, 50)));
      } catch {}
      setUserResults(prev => [localSaved, ...prev.filter(r => r.id !== localSaved.id)]);
      return localSaved;
    }
  };

  const handleQuizExit = () => {
    setView('home');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleReviewFromQuiz = (result: QuizResult) => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    openReview(result, 'home');
  };

  const handleClearAllResults = async () => {
    if (!user) {
      alert('Please log in to manage your activity history.');
      return;
    }
    if (userResults.length === 0) {
      alert('No recent activity records to clear.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete all ${userResults.length} records from your Recent Activity history? This action cannot be undone.`)) {
      return;
    }
    setLoadingResults(true);

    // 1. Immediately record cleared timestamp in localStorage so UI is instantly and permanently cleared
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem('activity_cleared_at_' + user.uid, nowIso);
    } catch {}

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

  const openReview = (result: QuizResult, backTo: 'home' | 'dashboard' = 'dashboard') => {
    let resultToReview = result;
    if (!result.questionDetails || result.questionDetails.length === 0) {
      const primaryData = result.category === 'mockErrors' ? mockData : bankData;
      const secondaryData = result.category === 'mockErrors' ? bankData : mockData;
      const chapter = (primaryData[result.subject] || []).find(ch => ch.chapter_title === result.chapter_title)
        || (secondaryData[result.subject] || []).find(ch => ch.chapter_title === result.chapter_title);
      if (chapter && chapter.questions) {
        resultToReview = {
          ...result,
          questionDetails: chapter.questions.map(q => ({
            q_num: q.q_num,        // required by QuestionProgress
            question: q,
            selectedAnswer: '',    // required by QuestionProgress
            isCorrect: false,
            timeSpent: 0
          }))
        };
      }
    }
    setReviewResult(resultToReview);
    setReviewBackTo(backTo);
    setView('review');
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

  const handleDeleteResult = async (resultId?: string) => {
    if (!resultId) return;
    if (!window.confirm('Are you sure you want to delete this quiz attempt from your history?')) return;
    
    // Store in hidden list so it immediately and permanently disappears
    if (user) {
      try {
        const key = 'hidden_result_ids_' + user.uid;
        const hidden: string[] = JSON.parse(localStorage.getItem(key) || '[]');
        if (!hidden.includes(resultId)) {
          hidden.push(resultId);
          localStorage.setItem(key, JSON.stringify(hidden));
        }
      } catch {}
    }
    
    setUserResults(prev => prev.filter(r => r.id !== resultId));

    try {
      await deleteDoc(doc(db, 'results', resultId));
    } catch (error) {
      console.warn('Firestore deleteDoc notice (handled via local filter):', error);
    }
  };

  const dashboardStats = useMemo(() => {
    if (!userResults || userResults.length === 0) {
      return {
        totalQuizzes: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        overallAccuracy: 0,
        totalTimeSeconds: 0,
        avgTimePerQ: 0,
        mockCount: 0,
        practiceCount: 0,
        subjectStats: {
          'Mathematics': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
          'Reasoning': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
          'English': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
          'General Awareness': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 }
        } as Record<string, { totalQ: number; correct: number; quizzes: number; totalTime: number; accuracy: number; avgTime: number }>
      };
    }

    let totalQ = 0;
    let totalCorrect = 0;
    let totalTime = 0;
    let mockCount = 0;
    let practiceCount = 0;

    const subjectStats: Record<string, { totalQ: number; correct: number; quizzes: number; totalTime: number; accuracy: number; avgTime: number }> = {
      'Mathematics': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
      'Reasoning': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
      'English': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 },
      'General Awareness': { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 }
    };

    userResults.forEach(r => {
      const qCount = Number(r.totalQuestions) || 0;
      const score = Number(r.score) || 0;
      const time = Number(r.totalTime) || 0;

      totalQ += qCount;
      totalCorrect += score;
      totalTime += time;

      if (r.mode === 'mock') mockCount++;
      else practiceCount++;

      const theme = getSubjectTheme(r.subject);
      const subKey = theme.name;

      if (!subjectStats[subKey]) {
        subjectStats[subKey] = { totalQ: 0, correct: 0, quizzes: 0, totalTime: 0, accuracy: 0, avgTime: 0 };
      }
      subjectStats[subKey].quizzes += 1;
      subjectStats[subKey].totalQ += qCount;
      subjectStats[subKey].correct += score;
      subjectStats[subKey].totalTime += time;
    });

    Object.keys(subjectStats).forEach(sub => {
      const s = subjectStats[sub];
      s.accuracy = s.totalQ > 0 ? Math.round((s.correct / s.totalQ) * 100) : 0;
      s.avgTime = s.totalQ > 0 ? Math.round(s.totalTime / s.totalQ) : 0;
    });

    const overallAccuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
    const avgTimePerQ = totalQ > 0 ? Math.round(totalTime / totalQ) : 0;

    return {
      totalQuizzes: userResults.length,
      totalQuestions: totalQ,
      totalCorrect,
      overallAccuracy,
      totalTimeSeconds: totalTime,
      avgTimePerQ,
      mockCount,
      practiceCount,
      subjectStats
    };
  }, [userResults]);

  const filteredUserResults = useMemo(() => {
    return userResults
      .filter(r => {
        if (dashCategoryFilter !== 'all' && r.category !== dashCategoryFilter) return false;
        if (dashSubjectFilter !== 'all') {
          const theme = getSubjectTheme(r.subject);
          if (theme.name !== dashSubjectFilter && r.subject !== dashSubjectFilter) return false;
        }
        if (dashSearchQuery.trim()) {
          const q = dashSearchQuery.toLowerCase();
          const matchTitle = (r.chapter_title || '').toLowerCase().includes(q);
          const matchSub = (r.subject || '').toLowerCase().includes(q);
          if (!matchTitle && !matchSub) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (dashSort === 'newest') {
          return new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime();
        }
        const accA = a.totalQuestions > 0 ? a.score / a.totalQuestions : 0;
        const accB = b.totalQuestions > 0 ? b.score / b.totalQuestions : 0;
        if (dashSort === 'accuracy-desc') return accB - accA;
        if (dashSort === 'accuracy-asc') return accA - accB;
        return 0;
      });
  }, [userResults, dashCategoryFilter, dashSubjectFilter, dashSearchQuery, dashSort]);

  // Clubbed Mock Error Chapters: group all questions chapter-wise across Slow, Unattempted, and Wrong
  const clubbedMockChapters = useMemo(() => {
    if (category !== 'mockErrors' || !selectedSubject) return [];
    const chapters = currentData[selectedSubject] || [];
    const map: Record<string, {
      topic: string;
      subject: string;
      total: number;
      slow: number;
      unattempted: number;
      wrong: number;
      questions: (Question & { errorType: 'speed_issue' | 'unattempted' | 'wrong' })[];
      slowQuestions: Question[];
      unattemptedQuestions: Question[];
      wrongQuestions: Question[];
    }> = {};

    chapters.forEach(ch => {
      const titleLower = ch.chapter_title.toLowerCase();
      let errorType: 'speed_issue' | 'unattempted' | 'wrong' = 'wrong';
      if (titleLower.includes('speed') || titleLower.includes('slow')) {
        errorType = 'speed_issue';
      } else if (titleLower.includes('unattempted') || titleLower.includes('skipped') || titleLower.includes('left')) {
        errorType = 'unattempted';
      } else if (titleLower.includes('wrong') || titleLower.includes('incorrect')) {
        errorType = 'wrong';
      }

      ch.questions.forEach(q => {
        const topic = normalizeTopicTitle(detectTopic(q, selectedSubject));
        if (selectedSubject === 'General Awareness' && mockGKFilter !== 'all') {
          if (getTopicGKSubject(topic) !== mockGKFilter) return;
        }

        if (!map[topic]) {
          map[topic] = {
            topic,
            subject: selectedSubject,
            total: 0,
            slow: 0,
            unattempted: 0,
            wrong: 0,
            questions: [],
            slowQuestions: [],
            unattemptedQuestions: [],
            wrongQuestions: []
          };
        }
        map[topic].total += 1;
        const qWithError = { ...q, errorType };
        map[topic].questions.push(qWithError);

        if (errorType === 'speed_issue') {
          map[topic].slow += 1;
          map[topic].slowQuestions.push(q);
        } else if (errorType === 'unattempted') {
          map[topic].unattempted += 1;
          map[topic].unattemptedQuestions.push(q);
        } else {
          map[topic].wrong += 1;
          map[topic].wrongQuestions.push(q);
        }
      });
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [category, selectedSubject, currentData, mockGKFilter]);

  const startClubbedChapterQuiz = (
    topicName: string,
    questions: Question[],
    subType?: 'slow' | 'unattempted' | 'wrong'
  ) => {
    if (!selectedSubject) return;
    if (!questions || questions.length === 0) {
      alert(`No questions available for this drill.`);
      return;
    }
    const label = subType === 'slow' ? ' • Slow' : subType === 'unattempted' ? ' • Skipped' : subType === 'wrong' ? ' • Wrong' : '';
    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `${topicName}${label}`,
      subject: selectedSubject,
      subject_id: selectedSubject.toLowerCase().replace(/\s+/g, '_'),
      questions: questions.map((q, idx) => ({ ...q, q_num: idx + 1 }))
    };
    startQuiz(virtualChapter);
  };

  const isAuthorized = user?.email === 'cyberdevil0101@gmail.com';

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
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Login with Google
          </button>
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
    <div className={`font-sans text-slate-900 ${view === 'quiz' || view === 'review' ? 'h-screen overflow-hidden bg-white' : 'min-h-screen bg-slate-100'}`}>
      {/* Navigation */}
      {view !== 'quiz' && view !== 'review' && (
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={resetToHome}>
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                <GraduationCap className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-black tracking-tight text-slate-800">mock</span>
              <a
                href="https://cat-nu-ruby.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 px-2.5 py-1 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-all shadow-md shadow-purple-200 text-xs flex items-center"
                title="Open CAT practice"
              >
                CAT
              </a>
            </div>
            
            <div className="hidden md:flex items-center space-x-6">
              <button 
                onClick={resetToHome}
                className={`flex items-center font-bold text-sm transition-colors ${view === 'home' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <BookOpen className="w-4 h-4 mr-1.5" />
                Practice
              </button>
              <button 
                onClick={() => { setView('drill'); setSelectedSubject(null); setSelectedTopic(null); }}
                className={`flex items-center font-bold text-sm transition-colors ${view === 'drill' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Zap className="w-4 h-4 mr-1.5" />
                Speed Drill
              </button>
              <button 
                onClick={() => { setView('bookmarks'); setSelectedBookmarkSubject(null); }}
                className={`flex items-center font-bold text-sm transition-colors ${view === 'bookmarks' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <BookmarkIcon className="w-4 h-4 mr-1.5" />
                Bookmarks
              </button>
              <button
                onClick={() => setView('dashboard')}
                className={`flex items-center font-bold text-sm transition-colors ${view === 'dashboard' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                Dashboard
              </button>
              <button
                onClick={() => setView('mockScores')}
                className={`flex items-center font-bold text-sm transition-colors ${view === 'mockScores' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Trophy className="w-4 h-4 mr-1.5" />
                Mock Scores
              </button>
              <button
                onClick={() => setView('heatmap')}
                className={`flex items-center font-bold text-sm transition-colors ${view === 'heatmap' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Flame className="w-4 h-4 mr-1.5" />
                Heatmap
              </button>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold" title="Quiz mode">
                <button
                  onClick={() => setQuizModePersisted('practice')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center ${
                    quizMode === 'practice'
                      ? 'bg-white text-emerald-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                  Practice
                </button>
                <button
                  onClick={() => setQuizModePersisted('mock')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center ${
                    quizMode === 'mock'
                      ? 'bg-white text-red-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 mr-1" />
                  Mock
                </button>
              </div>
              {user ? (
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-red-600 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center text-xs"
                >
                  <LogIn className="w-4 h-4 mr-1.5" />
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
      )}

      <main className={view === 'quiz' || view === 'review' ? 'w-full h-full overflow-hidden' : 'max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5'}>
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
                    {/* Hero */}
                    <section className="relative mb-3.5 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 px-4 py-3 sm:px-5 sm:py-3.5 shadow-xs">
                      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl"></div>
                      <div className="pointer-events-none absolute -bottom-24 left-8 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
                      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-xl">
                          <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.2 text-[10px] font-bold text-white ring-1 ring-white/20">
                            SSC CGL Prep
                          </span>
                          <h1 className="mt-1 text-base sm:text-lg font-bold tracking-tight text-white">
                            Practice smart. Beat the competition.
                          </h1>
                          <p className="mt-0.5 text-xs text-indigo-100">
                            Curated chapter banks and focused mock-error drills — pick a subject and start solving.
                          </p>
                        </div>
                        <div className="inline-flex shrink-0 rounded-lg border border-white/20 bg-white/10 p-0.5 backdrop-blur">
                          <button
                            onClick={() => {
                              setCategory('chapterBank');
                              // Reset sub-section selections so stale filters don't persist
                              setSelectedMathSection(null);
                              setSelectedEnglishSection(null);
                              setSelectedGKSubject(null);
                              setSelectedGKSubTopic('all');
                              setSelectedTopic(null);
                            }}
                            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors flex items-center ${
                              category === 'chapterBank' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-white hover:bg-white/10'
                            }`}
                          >
                            <ListChecks className="w-3.5 h-3.5 mr-1" />
                            Chapter Bank
                          </button>
                          <button
                            onClick={() => {
                              setCategory('mockErrors');
                              // Reset sub-section selections so stale filters don't persist
                              setSelectedMathSection(null);
                              setSelectedEnglishSection(null);
                              setSelectedGKSubject(null);
                              setSelectedGKSubTopic('all');
                              setSelectedTopic(null);
                            }}
                            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors flex items-center ${
                              category === 'mockErrors' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-white hover:bg-white/10'
                            }`}
                          >
                            <AlertCircle className="w-3.5 h-3.5 mr-1" />
                            Mock Errors
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* Subjects: 4 Columns on desktop for perfect balance */}
                    {dataLoading ? (
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-3 animate-pulse">
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
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        {Object.keys(currentData)
                          .filter(s => s !== 'GK Full Tests')
                          .map((subject) => {
                          const chip = (
                            {
                              Mathematics: 'from-blue-500 to-indigo-600',
                              Reasoning: 'from-violet-500 to-purple-600',
                              English: 'from-emerald-500 to-teal-600',
                              'General Awareness': 'from-amber-500 to-orange-600',
                              'GK/GS': 'from-pink-500 to-rose-600',
                            } as Record<string, string>
                          )[subject] || 'from-slate-500 to-slate-600';
                          return (
                            <motion.div
                              key={subject}
                              whileHover={{ y: -2 }}
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
                              className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:border-indigo-300 shadow-xs flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${chip} text-white shadow-xs`}>
                                    <Layers className="w-4 h-4" />
                                  </div>
                                  <span className="rounded bg-slate-50 px-1.5 py-0.2 text-[10px] font-bold text-slate-500 border border-slate-100">
                                    {currentData[subject]?.length || 0} Ch
                                  </span>
                                </div>
                                <h3 className="mt-2 text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{subject}</h3>
                                <div className="mt-1 flex items-center text-[11px] font-semibold text-indigo-600">
                                  View Chapters
                                  <ChevronRight className="w-3 h-3 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                                </div>
                              </div>

                              {subject === 'General Awareness' && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                                  {GK_SUBJECT_LIST.filter(s => s.id !== 'full_tests').map((sub) => (
                                    <button
                                      key={sub.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSubject('General Awareness');
                                        setSelectedGKSubject(sub.id);
                                        setSelectedGKSubTopic('all');
                                      }}
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-100 transition-colors"
                                      title={`Open ${sub.title}`}
                                    >
                                      {sub.shortTitle}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {subject === 'English' && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSubject('English');
                                      setSelectedEnglishSection('ayush_vocab');
                                      setSelectedTopic(null);
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 transition-colors"
                                    title="Open SSC 2025 Vocabs by Ayush"
                                  >
                                    Vocab 2025 ({(bankData['English'] || []).filter(ch => ch.section === 'ayush_vocab').reduce((sum, ch) => sum + (ch.questions?.length || 0), 0)} Qs)
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSubject('English');
                                      setSelectedEnglishSection('general');
                                      setSelectedTopic(null);
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-100 transition-colors"
                                    title="Open Grammar & Practice"
                                  >
                                    Grammar
                                  </button>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* ─── High-Yield Practice Hub & Feature Cards ─── */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {/* Speed Drill */}
                      <div 
                        onClick={() => setView('drill')}
                        className="group bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-105 transition-transform">
                            <Zap className="w-3.5 h-3.5 fill-amber-500/20 text-amber-600" />
                          </div>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            Speed Studio
                          </span>
                        </div>
                        <div className="mt-2">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">Calculation & Speed Drill</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Powers, cubes, fraction conversions, and Pythagorean triplets calculation drill.
                          </p>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-amber-600">
                          <span>Open Studio</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>

                      {/* Error Heatmap */}
                      <div 
                        onClick={() => setView('heatmap')}
                        className="group bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs hover:border-red-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100 group-hover:scale-105 transition-transform">
                            <Flame className="w-3.5 h-3.5 fill-red-500/20 text-red-600" />
                          </div>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                            Weak Spot Matrix
                          </span>
                        </div>
                        <div className="mt-2">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-red-700 transition-colors">Error Pattern Heatmap</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Analyze wrong answers, negative marks, and speed bottlenecks across mock tests.
                          </p>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-red-600">
                          <span>Analyze Errors</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>

                      {/* Bookmarks */}
                      <div 
                        onClick={() => setView('bookmarks')}
                        className="group bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition-transform">
                            <BookmarkIcon className="w-3.5 h-3.5 fill-blue-500/20 text-blue-600" />
                          </div>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                            Saved Vault
                          </span>
                        </div>
                        <div className="mt-2">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">Bookmarked Questions</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Quick-revision bank of tricky questions, formula tricks, and flagged problems.
                          </p>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-blue-600">
                          <span>Review Vault</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>

                    {/* ─── Recent Activity & Prep Readiness ─── */}
                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                      {/* Left: Recent Activity or Starter Chapters (2 cols) */}
                      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                              <History className="w-3.5 h-3.5" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-900">
                              {userResults.length > 0 ? 'Recent Practice Activity' : 'Recommended Starting Chapters'}
                            </h4>
                          </div>
                          {userResults.length > 0 && (
                            <div className="flex items-center gap-2.5">
                              <button 
                                onClick={handleClearAllResults}
                                disabled={loadingResults}
                                className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                                title="Clear all recent activity"
                              >
                                <Trash2 className="w-3 h-3" />
                                Clear History
                              </button>
                              <button 
                                onClick={() => setView('dashboard')}
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                              >
                                View All ({userResults.length}) →
                              </button>
                            </div>
                          )}
                        </div>

                        {userResults.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {userResults.slice(0, 4).map((r, idx) => {
                              const acc = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
                              return (
                                <div key={idx} className="py-2 flex items-center justify-between gap-2.5">
                                  <div className="min-w-0 flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
                                      {r.subject}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-800 truncate">{r.chapter_title}</p>
                                      <p className="text-[10px] text-slate-400">
                                        {r.score}/{r.totalQuestions} correct • {r.mode === 'mock' ? 'Mock Mode' : 'Practice'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                      acc >= 75 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                      acc >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                      'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                      {acc}%
                                    </span>
                                    <button
                                      onClick={() => openReview(r, 'home')}
                                      className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-2 py-0.5 bg-slate-50 hover:bg-indigo-50 rounded-md transition-colors"
                                    >
                                      Review
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                              { sub: 'Mathematics', title: 'Percentage & Profit Loss', count: 'High Yield', icon: Calculator, color: 'text-blue-600 bg-blue-50' },
                              { sub: 'Reasoning', title: 'Coding-Decoding & Analogy', count: 'High Yield', icon: Compass, color: 'text-purple-600 bg-purple-50' },
                              { sub: 'English', title: 'SSC 2025 Vocabs (by Ayush)', count: '914 High-Yield Qs', icon: Sparkles, color: 'text-emerald-600 bg-emerald-50' },
                              { sub: 'General Awareness', title: 'Indian Polity & Constitution', count: 'Frequent', icon: Globe2, color: 'text-amber-600 bg-amber-50' },
                            ].map((s, idx) => {
                              const SIcon = s.icon;
                              return (
                                <div 
                                  key={idx}
                                  onClick={() => setSelectedSubject(s.sub)}
                                  className="p-2 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between group"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                                      <SIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-900 truncate">{s.title}</p>
                                      <span className="text-[10px] text-slate-400 font-medium">{s.sub} • {s.count}</span>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Right: Prep Readiness Summary (1 col) */}
                      <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Target className="w-3.5 h-3.5" />
                              </div>
                              <h4 className="text-xs font-bold text-slate-900">Exam Readiness</h4>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                              SSC CGL
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                            <div className="bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Solved</span>
                              <p className="text-base font-bold text-slate-900 mt-0.5">{dashboardStats.totalQuestions}</p>
                            </div>
                            <div className="bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Accuracy</span>
                              <p className="text-base font-bold text-emerald-600 mt-0.5">{dashboardStats.overallAccuracy}%</p>
                            </div>
                            <div className="bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Quizzes</span>
                              <p className="text-base font-bold text-indigo-600 mt-0.5">{dashboardStats.totalQuizzes}</p>
                            </div>
                            <div className="bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Avg Time</span>
                              <p className="text-base font-bold text-amber-600 mt-0.5">{dashboardStats.avgTimePerQ}s</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => setView('dashboard')}
                            className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <LayoutDashboard className="w-3 h-3" />
                            Open Detailed Analytics
                          </button>
                        </div>
                      </div>
                    </div>
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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {([
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
                          chip: 'from-blue-500 to-indigo-600',
                          badge: 'Grammar & Core',
                          title: 'Grammar & Chapter Practice',
                          desc: 'Topic-wise grammar fundamentals, rule revisions, and chapter-wise question bank.',
                          count: `${(currentData['English'] || []).filter(ch => ch.section !== 'ayush_vocab').length} Chapters`
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
                              : selectedSubject}
                          </h2>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {category === 'mockErrors'
                              ? 'Mock error remediation & weak topic drills'
                              : selectedSubject === 'General Awareness' && category === 'chapterBank' && selectedGKSubject
                              ? GK_SUBJECT_CONFIGS[selectedGKSubject]?.desc
                              : selectedSubject === 'English' && category === 'chapterBank' && selectedEnglishSection === 'ayush_vocab'
                              ? '914 High-Yield SSC 2025 vocabulary questions in sets of 20'
                              : 'Comprehensive chapter-wise question vault'}
                          </p>
                        </div>
                      </div>
                      <span className={`self-start sm:self-auto rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        category === 'mockErrors' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}>
                        {category === 'mockErrors' ? 'Mock Errors' : 'Chapter Bank'}
                      </span>
                    </div>

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
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{sub.shortTitle}</span>
                                <span className={`px-1.5 py-0.2 text-[10px] rounded font-bold ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
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
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                                  selectedGKSubTopic === st.key
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

                    {/* Mock Errors: Attempt All Option & View Mode Toggle */}
                    {category === 'mockErrors' && (currentData[selectedSubject] || []).length > 0 && (
                      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:flex-row sm:items-center sm:justify-between shadow-xs">
                        <div>
                          <h3 className="text-xs font-bold text-slate-800">Practice {selectedSubject} Mock Errors</h3>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {clubbedMockChapters.reduce((acc, ch) => acc + ch.total, 0)} error questions recorded across {clubbedMockChapters.length} chapters.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Toggle Mode: Chapter-Wise vs By Error Bucket */}
                          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold">
                            <button
                              onClick={() => setMockViewModePersisted('chapters')}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                mockViewMode === 'chapters'
                                  ? 'bg-white text-indigo-700 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title="Club all questions chapter-wise across Slow, Unattempted, and Wrong"
                            >
                              <ListChecks className="w-3.5 h-3.5" />
                              Chapter-Wise
                            </button>
                            <button
                              onClick={() => setMockViewModePersisted('buckets')}
                              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                mockViewMode === 'buckets'
                                  ? 'bg-white text-indigo-700 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title="View questions grouped into Speed Issue, Unattempted, and Wrong buckets"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              By Error Type
                            </button>
                          </div>

                          <button
                            onClick={() => startAllSubjectQuiz(selectedSubject)}
                            className="inline-flex shrink-0 items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1 text-xs font-semibold text-white shadow-xs transition-all hover:shadow-sm"
                          >
                            <Play className="w-3.5 h-3.5 mr-1" />
                            Start All ({clubbedMockChapters.reduce((acc, ch) => acc + ch.total, 0)})
                          </button>
                        </div>
                      </div>
                    )}

                    {category === 'mockErrors' && selectedSubject === 'General Awareness' && (currentData[selectedSubject] || []).length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                        <button
                          onClick={() => setMockGKFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                            mockGKFilter === 'all'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          All GK
                        </button>
                        {GK_SUBJECT_LIST.filter(s => s.id !== 'full_tests').map((sub) => {
                          const Icon = GK_ICONS[sub.iconName] || Globe2;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => setMockGKFilter(sub.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                                mockGKFilter === sub.id
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{sub.shortTitle}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {category === 'mockErrors' ? (
                      (currentData[selectedSubject] || []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-xs">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-500 mb-2">
                            <Flame className="h-5 w-5" />
                          </div>
                          <h3 className="text-xs font-bold text-slate-800">No Mock Errors Recorded</h3>
                          <p className="mt-0.5 text-[11px] text-slate-500 max-w-md">
                            There are currently no mock error questions for {selectedSubject}. Errors captured from mocks will appear here.
                          </p>
                        </div>
                      ) : mockViewMode === 'chapters' ? (
                        /* Chapter-Wise Clubbed View (Compact List Format) */
                        <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
                          {/* List Header */}
                          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <div className="flex items-center gap-2">
                              <span>Chapter Name ({clubbedMockChapters.length})</span>
                              <span className="text-[10px] text-slate-400 font-medium normal-case hidden sm:inline">(Ranked in descending order of total)</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 text-right">
                              <span className="w-12 sm:w-14 text-amber-600">⚡ Slow</span>
                              <span className="w-12 sm:w-14 text-rose-600">❌ Wrong</span>
                              <span className="w-12 sm:w-14 text-blue-600">◯ Skipped</span>
                              <span className="w-12 sm:w-14 text-indigo-700">🔥 Total</span>
                              <span className="w-16 sm:w-20 text-center hidden sm:inline">Action</span>
                            </div>
                          </div>

                          {/* Rows */}
                          <div className="divide-y divide-slate-100">
                            {clubbedMockChapters.map((ch, idx) => (
                              <div
                                key={ch.topic}
                                onClick={() => setActiveMockChapterModal(ch)}
                                className="group px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-indigo-50/30 transition-all cursor-pointer"
                              >
                                {/* Left details */}
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className="w-5 h-5 rounded-md bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-700 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors">
                                    #{idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                      {ch.topic}
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-medium sm:hidden">
                                      Click to view {ch.total} questions
                                    </span>
                                  </div>
                                </div>

                                {/* Right counts & practice button */}
                                <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-4 shrink-0">
                                  {/* Slow */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (ch.slow > 0) startClubbedChapterQuiz(ch.topic, ch.slowQuestions, 'slow');
                                    }}
                                    disabled={ch.slow === 0}
                                    className={`w-12 sm:w-14 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                                      ch.slow > 0
                                        ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                        : 'text-slate-300 bg-slate-50 cursor-default'
                                    }`}
                                    title={ch.slow > 0 ? `Practice ${ch.slow} slow questions` : 'No slow questions'}
                                  >
                                    <Zap className="w-3 h-3 shrink-0" />
                                    <span>{ch.slow}</span>
                                  </button>

                                  {/* Wrong */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (ch.wrong > 0) startClubbedChapterQuiz(ch.topic, ch.wrongQuestions, 'wrong');
                                    }}
                                    disabled={ch.wrong === 0}
                                    className={`w-12 sm:w-14 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                                      ch.wrong > 0
                                        ? 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                                        : 'text-slate-300 bg-slate-50 cursor-default'
                                    }`}
                                    title={ch.wrong > 0 ? `Practice ${ch.wrong} wrong questions` : 'No wrong questions'}
                                  >
                                    <XCircle className="w-3 h-3 shrink-0" />
                                    <span>{ch.wrong}</span>
                                  </button>

                                  {/* Skipped */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (ch.unattempted > 0) startClubbedChapterQuiz(ch.topic, ch.unattemptedQuestions, 'unattempted');
                                    }}
                                    disabled={ch.unattempted === 0}
                                    className={`w-12 sm:w-14 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                                      ch.unattempted > 0
                                        ? 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                                        : 'text-slate-300 bg-slate-50 cursor-default'
                                    }`}
                                    title={ch.unattempted > 0 ? `Practice ${ch.unattempted} skipped questions` : 'No skipped questions'}
                                  >
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    <span>{ch.unattempted}</span>
                                  </button>

                                  {/* Total */}
                                  <div className="w-12 sm:w-14 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center gap-1">
                                    <Flame className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span>{ch.total}</span>
                                  </div>

                                  {/* Practice All Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startClubbedChapterQuiz(ch.topic, ch.questions);
                                    }}
                                    className="w-16 sm:w-20 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs flex items-center justify-center gap-1"
                                    title={`Start quiz with all ${ch.total} questions for ${ch.topic}`}
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current" />
                                    Practice
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* Original By Error Bucket View */
                        <div className={`grid gap-3.5 ${
                          (currentData[selectedSubject] || []).length === 1
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

                            // Compute topic-wise breakdown
                            const topicMap: Record<string, number> = {};
                            chapter.questions.forEach(q => {
                              const rawTopic = q.tags?.topic || (q as any).topic || detectTopic(q, selectedSubject);
                              const t = normalizeTopicTitle(rawTopic);
                              if (selectedSubject === 'General Awareness' && mockGKFilter !== 'all') {
                                if (getTopicGKSubject(t) !== mockGKFilter) return;
                              }
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
                                      {chapter.questions.length} {chapter.questions.length === 1 ? 'Question' : 'Questions'}
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
                                            <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${theme.topicCount}`}>
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
                                    onClick={() => startQuiz(chapter)}
                                    disabled={chapter.questions.length === 0}
                                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none ${theme.btn}`}
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    Practice All ({chapter.questions.length})
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
                              } else {
                                return chapter.section !== 'ayush_vocab';
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
                          const isEnglishVocabSection = selectedSubject === 'English' && category === 'chapterBank' && selectedEnglishSection === 'ayush_vocab';
                          const isTopicLevelSection = isMathSection || isEnglishVocabSection;

                          if (isTopicLevelSection && !selectedTopic) {
                            const topics = Array.from(new Set(relevantChapters.map(ch => ch.topic_name).filter(Boolean))) as string[];
                            if (isEnglishVocabSection) {
                              const vocabOrder = ['synonyms', 'antonyms', 'one_word_substitution', 'idioms_and_phrases', 'spellings'];
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
                                  : topic === 'idioms_and_phrases' ? 'Idioms & Phrases'
                                  : topic === 'spellings' ? 'Spellings'
                                  : topic.replace(/_/g, ' '))
                                : topic.replace(/_/g, ' ');

                              const chipGrad = isEnglishVocabSection
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
                                  className={`group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 transition-all duration-200 ${
                                    isEnglishVocabSection ? 'hover:border-emerald-300' : 'hover:border-indigo-300'
                                  } hover:shadow-md shadow-xs flex flex-col justify-between`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${chipGrad} text-white shadow-xs`}>
                                      {isEnglishVocabSection ? <Sparkles className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                                        {topicChapters.length} Sets
                                      </span>
                                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                                        {totalQuestions} Qs
                                      </span>
                                    </div>
                                  </div>
                                  <h3 className="mt-2.5 text-xs font-bold capitalize text-slate-800">{displayTitle}</h3>
                                  <div className={`mt-2 flex items-center text-xs font-semibold ${isEnglishVocabSection ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                    View Sets (20 Qs each)
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
                              onClick={() => startQuiz(chapter)}
                              className={`group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 transition-all duration-200 ${
                                chapter.section === 'ayush_vocab' ? 'hover:border-emerald-300' : 'hover:border-indigo-300'
                              } hover:shadow-md shadow-xs flex flex-col justify-between`}
                            >
                              <div className="flex items-center justify-between">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                  chapter.section === 'ayush_vocab'
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                                    : chapter.is_test
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                                    : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                                } shadow-xs`}>
                                  {chapter.section === 'ayush_vocab' ? <Sparkles className="w-4 h-4" /> : chapter.is_test ? <FileText className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                                </div>
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  chapter.section === 'ayush_vocab'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : chapter.is_test
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-50 text-slate-500'
                                }`}>
                                  {chapter.section === 'ayush_vocab'
                                    ? `Set ${chapter.chapter_num}`
                                    : chapter.is_test
                                    ? 'Full Test'
                                    : chapter.set_name
                                    ? `Set ${chapter.set_name.replace('set_', '')}`
                                    : `Ch ${chapter.chapter_num}`}
                                </span>
                              </div>
                              <div>
                                <h3 className="mt-2.5 text-xs font-bold text-slate-800 line-clamp-1">{chapter.chapter_title}</h3>
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {chapter.questions.length} Questions {chapter.topic_name ? `• ${formatGKSubTopicTitle(chapter.topic_name)}` : ''}
                                </p>
                              </div>
                              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className={`flex items-center text-xs font-semibold ${chapter.section === 'ayush_vocab' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                  Start Set
                                  <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                                </div>
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
            <motion.div
              key="bookmarks"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-xs mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <BookmarkIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-sm font-bold text-slate-900 tracking-tight">Bookmarked Questions</h1>
                    <p className="text-[11px] text-slate-500 font-medium">Review your saved questions across all subjects</p>
                  </div>
                </div>
                {selectedBookmarkSubject === null && (
                  <button
                    onClick={() => setView('home')}
                    className="self-start sm:self-auto flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                    Back to Practice
                  </button>
                )}
              </div>

              {!user ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-xs border border-slate-200/90 max-w-md mx-auto">
                  <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <LogIn className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mb-1">Login to View Bookmarks</h2>
                  <p className="text-slate-500 text-xs mb-3.5">Save tricky questions to cloud storage across devices</p>
                  <button onClick={handleLogin} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-xs">
                    Login with Google
                  </button>
                </div>
              ) : loadingBookmarks ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                  <p className="text-slate-500 font-semibold text-xs">Loading bookmarks...</p>
                </div>
              ) : bookmarks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-xs border border-slate-200/90 max-w-md mx-auto">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <BookmarkIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mb-1">No Bookmarks Yet</h2>
                  <p className="text-slate-500 text-xs mb-3.5">Bookmark questions during practice to review them later.</p>
                  <button onClick={() => setView('home')} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-xs">
                    Start Practicing
                  </button>
                </div>
              ) : (
                <div>
                  {selectedBookmarkSubject === null ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {(Object.entries(bookmarksBySubjectAndChapter) as [string, Record<string, Bookmark[]>][]).map(([subject, chaptersObj]) => {
                        const allSubjectBookmarks = Object.values(chaptersObj).flat();
                        const totalChapters = Object.keys(chaptersObj).length;
                        return (
                          <motion.div
                            key={subject}
                            whileHover={{ y: -2 }}
                            className="bg-white rounded-xl p-3 shadow-xs border border-slate-200/80 group cursor-pointer flex flex-col justify-between hover:border-blue-300 transition-all"
                            onClick={() => setSelectedBookmarkSubject(subject)}
                          >
                            <div>
                              <div className="flex items-start justify-between mb-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                  <Layers className="w-4 h-4" />
                                </div>
                                <span className="px-1.5 py-0.2 bg-slate-50 text-slate-500 text-[9px] font-bold rounded border border-slate-100 uppercase tracking-wider">
                                  {totalChapters} Ch
                                </span>
                              </div>
                              
                              <h3 className="text-xs font-bold text-slate-800 mb-0.5 group-hover:text-blue-600 transition-colors capitalize">
                                {subject}
                              </h3>
                              <p className="text-[11px] text-slate-400 font-medium mb-3">
                                {allSubjectBookmarks.length} Bookmarked {allSubjectBookmarks.length === 1 ? 'Question' : 'Questions'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 text-xs">
                              <div className="flex items-center font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform text-[11px]">
                                View Chapters
                                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startSubjectBookmarkQuiz(subject, allSubjectBookmarks);
                                }}
                                className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg font-bold transition-all flex items-center justify-center"
                                title={`Practice ${subject} Bookmarks`}
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    (() => {
                      const subject = selectedBookmarkSubject as string;
                      const chaptersObj: Record<string, Bookmark[]> = bookmarksBySubjectAndChapter[subject] || {};
                      const allSubjectBookmarks: Bookmark[] = Object.values(chaptersObj).flat() as Bookmark[];
                      return (
                        <div className="space-y-3">
                          {/* Back & Subject Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                            <div className="flex items-center space-x-3">
                              <button 
                                onClick={() => setSelectedBookmarkSubject(null)}
                                className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                title="Back to Bookmarked Subjects"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Layers className="w-4 h-4" />
                              </div>
                              <div>
                                <h2 className="text-xs font-bold text-slate-800 capitalize leading-tight">{subject} Bookmarks</h2>
                                <p className="text-[10px] text-slate-400 font-medium">{allSubjectBookmarks.length} bookmarked {allSubjectBookmarks.length === 1 ? 'question' : 'questions'}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => startSubjectBookmarkQuiz(subject, allSubjectBookmarks)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center self-start sm:self-auto"
                            >
                              <Play className="w-3 h-3 mr-1.5 fill-current" />
                              Practice All {subject}
                            </button>
                          </div>

                          {/* Chapters Accordion */}
                          <div className="space-y-2.5">
                            {Object.entries(chaptersObj).map(([chapterTitle, chapterBookmarks]) => {
                              const key = `${subject}|${chapterTitle}`;
                              const isExpanded = expandedChapters[key] === true;
                              return (
                                <div key={chapterTitle} className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs hover:border-slate-300 transition-all">
                                  {/* Accordion Header */}
                                  <div 
                                    onClick={() => toggleChapterExpand(subject, chapterTitle)}
                                    className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                                  >
                                    <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
                                        <BookOpen className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0">
                                        <h3 className="font-bold text-slate-800 text-xs leading-tight truncate">{chapterTitle}</h3>
                                        <span className="inline-flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded mt-0.5">
                                          {chapterBookmarks.length} saved
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                                      {/* Practice Chapter Bookmarks Button */}
                                      <button
                                        onClick={() => startChapterBookmarkQuiz(subject, chapterTitle, chapterBookmarks)}
                                        className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg transition-all flex items-center justify-center"
                                        title={`Practice ${chapterTitle} Bookmarks`}
                                      >
                                        <Play className="w-3 h-3 fill-current" />
                                      </button>
                                      
                                      {/* Toggle Chevron */}
                                      <button
                                        onClick={() => toggleChapterExpand(subject, chapterTitle)}
                                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                      >
                                        <ChevronRight className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Accordion Content */}
                                  <AnimatePresence initial={false}>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="border-t border-slate-100 p-3 bg-slate-50/20"
                                      >
                                        <div className="grid grid-cols-1 gap-2.5">
                                          {chapterBookmarks.map((bookmark) => (
                                            <motion.div
                                              key={bookmark.id}
                                              className="bg-white rounded-xl p-3 shadow-xs border border-slate-200/80 relative group"
                                            >
                                              <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center space-x-2">
                                                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${
                                                    bookmark.category === 'mockErrors' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                                                  }`}>
                                                    {bookmark.category === 'mockErrors' ? 'Mock Error' : 'Chapter Bank'}
                                                  </span>
                                                </div>
                                                <button
                                                  onClick={() => bookmark.id && toggleBookmark(bookmark.question)}
                                                  className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                                                  title="Remove Bookmark"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                              <div className="text-xs font-bold text-slate-800 mb-2.5 leading-relaxed">
                                                <FormattedText text={bookmark.question.question} as="div" />
                                              </div>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {Object.entries(bookmark.question.options).map(([key, value]) => (
                                                  <div
                                                    key={key}
                                                    className={`p-2 rounded-lg border flex items-center ${
                                                      bookmark.question.answer === key
                                                        ? 'border-emerald-500 bg-emerald-50/60'
                                                        : 'border-slate-200 bg-slate-50/40'
                                                    }`}
                                                  >
                                                    <span className={`w-5 h-5 flex items-center justify-center rounded text-xs mr-2 font-bold ${
                                                      bookmark.question.answer === key ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                                                    }`}>
                                                      {key.toUpperCase()}
                                                    </span>
                                                    <FormattedText text={value} className="text-slate-700 text-xs font-medium" />
                                                  </div>
                                                ))}
                                              </div>
                                              {bookmark.question.solution && (
                                                <div className="mt-2.5 p-2 bg-blue-50/60 rounded-lg border border-blue-100 text-xs">
                                                  <div className="text-blue-900 leading-relaxed">
                                                    <span className="font-bold text-blue-700">Solution: </span>
                                                    <FormattedText text={bookmark.question.solution} />
                                                  </div>
                                                </div>
                                              )}
                                            </motion.div>
                                          ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </motion.div>
          )}

          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-4"
            >
              {!user ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-100">
                  <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
                    <LogIn className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4">Login to Track Progress</h2>
                  <p className="text-slate-500 mb-8 max-w-md mx-auto">Sign in with Google to store your quiz attempts, view detailed performance metrics, and track your SSC CGL preparation journey.</p>
                  <button
                    onClick={handleLogin}
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    Login with Google
                  </button>
                </div>
              ) : loadingResults ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-bold text-lg">Fetching your performance analytics...</p>
                </div>
              ) : userResults.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Trophy className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-3">No Results Recorded Yet</h2>
                  <p className="text-slate-500 mb-8 max-w-lg mx-auto">Complete a practice quiz or mock error drill to see your accuracy, speed breakdown, and subject-level insights here.</p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <button
                      onClick={() => setView('home')}
                      className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      Start Chapter Practice
                    </button>
                    <button
                      onClick={() => setView('heatmap')}
                      className="px-8 py-3.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl font-bold hover:bg-rose-100 transition-all"
                    >
                      View Error Heatmap
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Dashboard Top Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[9px] font-bold uppercase tracking-wider">SSC CGL Analytics</span>
                        <h2 className="text-xs font-bold text-slate-900 leading-none">Performance Dashboard</h2>
                      </div>
                      <p className="text-slate-400 text-[10px] font-medium mt-0.5">
                        Comprehensive overview of your accuracy, pacing, and subject strengths.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setView('heatmap')}
                        className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition-colors flex items-center gap-1 border border-rose-100 shadow-xs"
                      >
                        <Flame className="w-3 h-3 text-rose-600" />
                        Heatmap
                      </button>
                      <button
                        onClick={() => setView('home')}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-[11px] transition-all shadow-xs flex items-center gap-1"
                      >
                        <BookOpen className="w-3 h-3" />
                        Practice Hub
                      </button>
                    </div>
                  </div>

                  {/* Summary KPI Cards (Single-Row Compact) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
                    {/* Total Quizzes */}
                    <div className="bg-white px-2.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Trophy className="w-3 h-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 leading-none">{dashboardStats.totalQuizzes}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Quizzes</div>
                      </div>
                    </div>

                    {/* Overall Accuracy */}
                    <div className="bg-white px-2.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80 flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        dashboardStats.overallAccuracy >= 75 ? 'bg-emerald-50 text-emerald-600' :
                        dashboardStats.overallAccuracy >= 50 ? 'bg-amber-50 text-amber-600' :
                        'bg-rose-50 text-rose-600'
                      }`}>
                        <Target className="w-3 h-3" />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-bold leading-none ${
                          dashboardStats.overallAccuracy >= 75 ? 'text-emerald-600' :
                          dashboardStats.overallAccuracy >= 50 ? 'text-amber-600' :
                          'text-rose-600'
                        }`}>
                          {dashboardStats.overallAccuracy}%
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Accuracy</div>
                      </div>
                    </div>

                    {/* Total Questions */}
                    <div className="bg-white px-2.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <ListChecks className="w-3 h-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-purple-600 leading-none">{dashboardStats.totalQuestions}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Questions Solved</div>
                      </div>
                    </div>

                    {/* Avg Time per Question */}
                    <div className="bg-white px-2.5 py-1.5 rounded-lg shadow-xs border border-slate-200/80 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                        <Clock className="w-3 h-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-orange-600 leading-none">{dashboardStats.avgTimePerQ}s</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Avg Time / Q</div>
                      </div>
                    </div>
                  </div>

                  {/* Subject-Wise Performance Breakdown */}
                  <div className="bg-white rounded-lg shadow-xs border border-slate-200/80 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 leading-none">Subject Breakdown</h3>
                        <p className="text-slate-400 text-[10px] font-medium mt-0.5">Click any subject to filter recent attempts</p>
                      </div>
                      {dashSubjectFilter !== 'all' && (
                        <button
                          onClick={() => setDashSubjectFilter('all')}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded transition-colors"
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {['Mathematics', 'Reasoning', 'English', 'General Awareness'].map((subName) => {
                        const theme = getSubjectTheme(subName);
                        const Icon = theme.icon;
                        const stat = dashboardStats.subjectStats[subName] || { totalQ: 0, correct: 0, quizzes: 0, accuracy: 0, avgTime: 0 };
                        const isSelected = dashSubjectFilter === subName;

                        return (
                          <div
                            key={subName}
                            onClick={() => setDashSubjectFilter(isSelected ? 'all' : subName)}
                            className={`cursor-pointer p-2.5 rounded-lg border transition-all duration-150 ${
                              isSelected
                                ? 'ring-1 ring-blue-500 shadow-xs bg-blue-50/20 border-blue-200'
                                : 'bg-slate-50/50 hover:bg-white hover:shadow-xs border-slate-200/80'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br ${theme.gradient} text-white shadow-xs`}>
                                <Icon className="w-3 h-3" />
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                stat.accuracy >= 75 ? 'bg-emerald-100 text-emerald-800' :
                                stat.accuracy >= 50 ? 'bg-amber-100 text-amber-800' :
                                stat.totalQ > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {stat.totalQ > 0 ? `${stat.accuracy}% Acc` : 'No data'}
                              </span>
                            </div>

                            <h4 className="font-bold text-slate-900 text-xs mb-1 leading-none">{subName}</h4>

                            {/* Accuracy Bar */}
                            <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden mb-1.5">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${theme.bar}`}
                                style={{ width: `${stat.accuracy}%` }}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div>
                                <span className="text-slate-400 block font-medium">Questions:</span>
                                <span className="font-bold text-slate-700">{stat.totalQ} ({stat.correct} ✓)</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block font-medium">Avg Time:</span>
                                <span className="font-bold text-slate-700">{stat.avgTime}s/Q</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Activity Section */}
                  <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
                    {/* Header with Filters */}
                    <div className="p-3 sm:p-3.5 border-b border-slate-100 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-900">Recent Activity</h3>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                            {filteredUserResults.length} {filteredUserResults.length === 1 ? 'Attempt' : 'Attempts'}
                          </span>
                          {userResults.length > 0 && (
                            <button
                              onClick={handleClearAllResults}
                              disabled={loadingResults}
                              className="flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md text-[10px] font-bold transition-all disabled:opacity-50"
                              title="Clear all recent activity records"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear History</span>
                            </button>
                          )}
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full sm:w-60">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={dashSearchQuery}
                            onChange={(e) => setDashSearchQuery(e.target.value)}
                            placeholder="Search chapter or topic..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      {/* Filter Controls Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {/* Category Tabs */}
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/70 text-[11px] font-semibold">
                          <button
                            onClick={() => setDashCategoryFilter('all')}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              dashCategoryFilter === 'all'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            All Modes
                          </button>
                          <button
                            onClick={() => setDashCategoryFilter('chapterBank')}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              dashCategoryFilter === 'chapterBank'
                                ? 'bg-white text-blue-600 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Chapter Bank
                          </button>
                          <button
                            onClick={() => setDashCategoryFilter('mockErrors')}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              dashCategoryFilter === 'mockErrors'
                                ? 'bg-white text-rose-600 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Mock Errors
                          </button>
                        </div>

                        {/* Subject and Sort dropdowns */}
                        <div className="flex items-center gap-2">
                          <select
                            value={dashSubjectFilter}
                            onChange={(e) => setDashSubjectFilter(e.target.value)}
                            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="all">All Subjects</option>
                            <option value="Mathematics">Mathematics</option>
                            <option value="Reasoning">Reasoning</option>
                            <option value="English">English</option>
                            <option value="General Awareness">General Awareness</option>
                          </select>

                          <select
                            value={dashSort}
                            onChange={(e) => setDashSort(e.target.value as any)}
                            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="newest">Newest First</option>
                            <option value="accuracy-desc">Highest Accuracy</option>
                            <option value="accuracy-asc">Lowest Accuracy</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Results List */}
                    {filteredUserResults.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-slate-500 font-bold text-xs mb-2">No activity matching your current filter.</p>
                        <button
                          onClick={() => {
                            setDashCategoryFilter('all');
                            setDashSubjectFilter('all');
                            setDashSearchQuery('');
                          }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-semibold text-xs hover:bg-blue-100 transition-colors"
                        >
                          Clear Filters
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredUserResults.map((result, idx) => {
                          const theme = getSubjectTheme(result.subject);
                          const Icon = theme.icon;
                          const accuracyRate = result.totalQuestions > 0
                            ? Math.round((result.score / result.totalQuestions) * 100)
                            : 0;
                          const avgQ = result.totalQuestions > 0
                            ? Math.round(result.totalTime / result.totalQuestions)
                            : 0;
                          const hasStoredQuestions = Boolean(result.questionDetails && result.questionDetails.length > 0);

                          return (
                            <div
                              key={result.id || `${result.completedAt}|${result.chapter_title}`}
                              className="p-3 sm:p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                            >
                              {/* Left details */}
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs bg-gradient-to-br ${theme.gradient} text-white`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${theme.badge}`}>
                                      {theme.name}
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-semibold border ${
                                      result.category === 'mockErrors'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                      {result.category === 'mockErrors' ? 'Mock Errors' : 'Chapter Bank'}
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-semibold border ${
                                      result.mode === 'mock'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}>
                                      {result.mode === 'mock' ? 'Mock Test' : 'Practice Drill'}
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-bold text-slate-900 truncate" title={result.chapter_title}>
                                    {result.chapter_title}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    {formatAttemptDate(result.completedAt)}
                                  </p>
                                </div>
                              </div>

                              {/* Right Metrics & Actions */}
                              <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 sm:gap-4 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                                <div className="text-left sm:text-right min-w-[55px]">
                                  <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Score</div>
                                  <div className="text-xs font-bold text-slate-900">
                                    {result.score}/{result.totalQuestions}
                                  </div>
                                </div>

                                <div className="text-left sm:text-right min-w-[55px]">
                                  <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Avg/Q</div>
                                  <div className="text-xs font-bold text-orange-600">
                                    {avgQ}s
                                  </div>
                                </div>

                                <div className="text-left sm:text-right min-w-[65px]">
                                  <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Time</div>
                                  <div className="text-xs font-bold text-slate-700">
                                    {Math.floor(result.totalTime / 60)}m {result.totalTime % 60}s
                                  </div>
                                </div>

                                <div className="text-left sm:text-right min-w-[60px]">
                                  <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Accuracy</div>
                                  <div className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-xs font-bold border ${
                                    accuracyRate >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    accuracyRate >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    {accuracyRate}%
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => openReview(result)}
                                    className="px-2.5 py-1.5 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    title="Review questions & solutions"
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>Review</span>
                                  </button>
                                  <button
                                    onClick={() => reattemptFromResult(result)}
                                    className="p-1.5 rounded-lg font-bold bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-all shadow-xs flex items-center justify-center cursor-pointer"
                                    title="Reattempt this quiz"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                  {result.id && (
                                    <button
                                      onClick={() => handleDeleteResult(result.id)}
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-400 hover:text-white font-bold transition-all shadow-xs flex items-center justify-center"
                                      title="Delete this attempt"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
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
                onBack={() => setView(reviewBackTo)}
                userName={user?.displayName || 'Candidate'}
                bookmarkedIds={new Set(bookmarks.map(b => b.question.question.trim().toLowerCase()))}
                onBookmarkToggle={toggleBookmark}
                onViewAnalytics={() => setView('dashboard')}
                onDeleteQuestion={handleDeleteQuestion}
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

          {view === 'heatmap' && (
            <motion.div
              key="heatmap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex items-center justify-between gap-2.5 bg-white px-3.5 py-1.5 rounded-lg border border-slate-200/80 shadow-xs mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
                    <Flame className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div>
                    <h1 className="text-xs font-bold text-slate-900 tracking-tight leading-none">Error Heatmap</h1>
                    <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Visualize subject-wise error patterns across your top error-prone chapters</p>
                  </div>
                </div>
                <button
                  onClick={() => setView('home')}
                  className="flex items-center text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-md transition-colors shrink-0"
                >
                  <ChevronLeft className="w-3 h-3 mr-0.5" />
                  Back to Practice
                </button>
              </div>
              <React.Suspense fallback={
                <div className="flex flex-col items-center justify-center py-40">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-bold">Loading error heatmap...</p>
                </div>
              }>
                <ErrorHeatmap mockData={mockData} />
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
                    setReviewResult(quizResult);
                    setReviewBackTo('mockScores');
                    setView('review');
                  }}
                />
              </React.Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Chapter Drill & Questions Preview Modal for Mock Errors */}
      <AnimatePresence>
        {activeMockChapterModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="bg-white w-full sm:max-w-3xl max-h-[90vh] sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 text-white rounded-t-3xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {activeMockChapterModal.subject}
                      </span>
                      <span className="text-white/70 text-xs font-semibold">
                        {activeMockChapterModal.total} total error questions
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-white leading-tight">{activeMockChapterModal.topic}</h2>

                    {/* Breakdown Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {activeMockChapterModal.wrong > 0 && (
                        <span className="bg-rose-500/30 border border-rose-300/40 text-rose-100 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" /> {activeMockChapterModal.wrong} Wrong
                        </span>
                      )}
                      {activeMockChapterModal.slow > 0 && (
                        <span className="bg-amber-500/30 border border-amber-300/40 text-amber-100 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" /> {activeMockChapterModal.slow} Slow
                        </span>
                      )}
                      {activeMockChapterModal.unattempted > 0 && (
                        <span className="bg-blue-500/30 border border-blue-300/40 text-blue-100 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> {activeMockChapterModal.unattempted} Skipped
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveMockChapterModal(null)}
                    className="w-9 h-9 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Drill Action Buttons in Header */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-white/15">
                  <button
                    onClick={() => {
                      const topic = activeMockChapterModal.topic;
                      const qs = activeMockChapterModal.questions;
                      setActiveMockChapterModal(null);
                      startClubbedChapterQuiz(topic, qs);
                    }}
                    className="px-4 py-2 bg-white text-indigo-900 rounded-xl text-xs font-black hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Practice All ({activeMockChapterModal.total})
                  </button>

                  {activeMockChapterModal.wrong > 0 && (
                    <button
                      onClick={() => {
                        const topic = activeMockChapterModal.topic;
                        const qs = activeMockChapterModal.wrongQuestions;
                        setActiveMockChapterModal(null);
                        startClubbedChapterQuiz(topic, qs, 'wrong');
                      }}
                      className="px-3.5 py-2 bg-rose-500/40 hover:bg-rose-500/60 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Wrong Only ({activeMockChapterModal.wrong})
                    </button>
                  )}

                  {activeMockChapterModal.slow > 0 && (
                    <button
                      onClick={() => {
                        const topic = activeMockChapterModal.topic;
                        const qs = activeMockChapterModal.slowQuestions;
                        setActiveMockChapterModal(null);
                        startClubbedChapterQuiz(topic, qs, 'slow');
                      }}
                      className="px-3.5 py-2 bg-amber-500/40 hover:bg-amber-500/60 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Slow Only ({activeMockChapterModal.slow})
                    </button>
                  )}

                  {activeMockChapterModal.unattempted > 0 && (
                    <button
                      onClick={() => {
                        const topic = activeMockChapterModal.topic;
                        const qs = activeMockChapterModal.unattemptedQuestions;
                        setActiveMockChapterModal(null);
                        startClubbedChapterQuiz(topic, qs, 'unattempted');
                      }}
                      className="px-3.5 py-2 bg-blue-500/40 hover:bg-blue-500/60 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Skipped Only ({activeMockChapterModal.unattempted})
                    </button>
                  )}
                </div>
              </div>

              {/* Questions List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeMockChapterModal.questions.map((q, qIdx) => {
                  const isWrong = q.errorType === 'wrong';
                  const isSlow = q.errorType === 'speed_issue';

                  return (
                    <div key={q.id || qIdx} className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                      {/* Question header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-400">Q{qIdx + 1}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          isWrong ? 'bg-red-100 text-red-700' :
                          isSlow ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {isWrong ? '✗ Wrong Answer' : isSlow ? '⚡ Speed Issue' : '◯ Skipped / Left'}
                        </span>
                      </div>

                      <div className="p-4 space-y-3">
                        <p className="text-sm font-semibold text-slate-900 whitespace-pre-line leading-relaxed">
                          {q.question}
                        </p>

                        {/* Options */}
                        {q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(['a', 'b', 'c', 'd'] as const).map(optKey => {
                              const optText = q.options[optKey];
                              if (!optText) return null;
                              const isCorrect = q.answer === optKey;
                              return (
                                <div
                                  key={optKey}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <span className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center font-black text-[11px] uppercase ${
                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {optKey}
                                  </span>
                                  <span className="truncate">{optText}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Solution */}
                        {q.solution && (
                          <details className="group">
                            <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 select-none">
                              <BookOpen className="w-3.5 h-3.5" />
                              View Solution
                              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                            </summary>
                            <div className="mt-2 text-xs font-medium text-slate-700 whitespace-pre-line leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200">
                              {q.solution}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {activeMockChapterModal.questions.length} questions in this chapter
                </span>
                <button
                  onClick={() => setActiveMockChapterModal(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>

    {/* Floating Tommy AI Assistant - enabled in practice mode solutions and across all portal views; hidden only during timed mock exam */}
    {(view !== 'quiz' || quizMode === 'practice') && (
      <AiMentorChat 
        mockReports={mockReportsList} 
        mockErrorsData={mockData} 
        activeReviewResult={view === 'review' ? reviewResult : null}
        onStartWeakTopicDrill={startWeakTopicDrill}
      />
    )}
  </div>
);
}

