import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Trophy, GraduationCap, LayoutDashboard, LogIn, LogOut, Loader2, AlertCircle, ListChecks, ChevronRight, ChevronLeft, Play, Layers, Bookmark as BookmarkIcon, Trash2, Shield, Crown, Zap, Flame, Star } from 'lucide-react';
import { Chapter, SubjectData, QuizResult, Bookmark, Question } from './types';
import { QuizContainer } from './components/QuizContainer';
import { ErrorHeatmap } from './components/ErrorHeatmap';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
// Dynamic import of all subject JSON files (recursive)
const subjectModules = import.meta.glob('./data/**/*.json', { eager: true });

const rawMockData: SubjectData = {};
const rawBankData: SubjectData = {};

Object.entries(subjectModules).forEach(([path, module]: [string, any]) => {
  const data = module.default;
  // Determine if it's mockErrors or chapterBank based on the file path
  const isMock = path.includes('/mock_errors/');
  const isBank = path.includes('/chapter_bank/');
  
  // The data could be a single chapter object or an array of chapters
  const chapters = Array.isArray(data) ? data : (data.questions ? [data] : []);
  
  // If the data structure is the old one (with chapterBank/mockErrors keys), handle it too
  if (data.chapterBank) chapters.push(...data.chapterBank);
  if (data.mockErrors) chapters.push(...data.mockErrors);

  // Determine section and topic from path (only applicable to Mathematics in chapter_bank)
  let section: 'spartan' | 'pinnacle' | 'qrb' | 'top500' | undefined = undefined;
  let topic_name: string | undefined = undefined;
  let set_name: string | undefined = undefined;

  if (isBank) {
    if (path.includes('/mathematics/spartan/')) section = 'spartan';
    else if (path.includes('/mathematics/pinnacle/')) section = 'pinnacle';
    else if (path.includes('/mathematics/qrb/')) section = 'qrb';
    else if (path.includes('/mathematics/top500/')) section = 'top500';

    if (section) {
      const parts = path.split(`/${section}/`);
      if (parts.length > 1) {
        const subPath = parts[1]; // e.g., "percentage/set_1.json" or "chapter_1.json"
        const subParts = subPath.split('/');
        if (subParts.length >= 2) {
          topic_name = subParts[0]; // "percentage"
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
    }
  }

  chapters.forEach((chapter: any) => {
    const subject = chapter.subject;
    if (section) {
      chapter.section = section;
    }
    if (topic_name) {
      chapter.topic_name = topic_name;
    }
    if (set_name) {
      chapter.set_name = set_name;
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

const getQuestionId = (chapter: Chapter, question: Question) => {
  return `${chapter.subject}|${chapter.chapter_title}|${question.question}`.replace(/\s+/g, '_');
};

export default function App() {
  const [view, setView] = useState<'home' | 'quiz' | 'dashboard' | 'bookmarks' | 'heatmap'>('home');
  const [category, setCategory] = useState<'mockErrors' | 'chapterBank'>('chapterBank');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedMathSection, setSelectedMathSection] = useState<'spartan' | 'pinnacle' | 'qrb' | 'top500' | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [selectedBookmarkSubject, setSelectedBookmarkSubject] = useState<string | null>(null);

  const toggleChapterExpand = (subject: string, chapter: string) => {
    const key = `${subject}|${chapter}`;
    setExpandedChapters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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

        const key = `${canonicalTitle.trim().toLowerCase()}|${chapter.set_name || ''}`;

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
          if (!deletedIds.has(getQuestionId(chapter, q))) {
            const qTextClean = q.question.trim().toLowerCase();
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

  const mockData = React.useMemo(() => processData(rawMockData, deletedQuestionIds), [deletedQuestionIds]);
  const bankData = React.useMemo(() => processData(rawBankData, deletedQuestionIds), [deletedQuestionIds]);

  const currentData = category === 'mockErrors' ? mockData : bankData;

  const [userResults, setUserResults] = useState<QuizResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Deleted Questions
  useEffect(() => {
    const fetchDeleted = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'deleted_questions'));
        const ids = new Set(querySnapshot.docs.map(doc => doc.data().questionId as string));
        setDeletedQuestionIds(ids);
      } catch (error) {
        console.error('Error fetching deleted questions:', error);
      }
    };
    fetchDeleted();
  }, []);

  // Fetch Results
  useEffect(() => {
    if (user && view === 'dashboard') {
      const fetchResults = async () => {
        setLoadingResults(true);
        try {
          const q = query(
            collection(db, 'results'),
            where('userId', '==', user.uid),
            orderBy('completedAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          const results = querySnapshot.docs.map(doc => doc.data() as QuizResult);
          setUserResults(results);
        } catch (error) {
          console.error('Error fetching results:', error);
        } finally {
          setLoadingResults(false);
        }
      };
      fetchResults();
    }
  }, [user, view]);

  // Fetch Bookmarks
  const fetchBookmarks = async () => {
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
  };

  useEffect(() => {
    if (user && (view === 'bookmarks' || view === 'quiz')) {
      fetchBookmarks();
    }
  }, [user, view]);

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
    if (!user || user.email !== 'cyberdevil0101@gmail.com') return;
    if (!activeChapter) return;

    const qId = getQuestionId(activeChapter, question);
    try {
      await addDoc(collection(db, 'deleted_questions'), {
        questionId: qId,
        deletedBy: user.uid,
        deletedAt: new Date().toISOString()
      });
      setDeletedQuestionIds(prev => {
        const next = new Set(prev);
        next.add(qId);
        return next;
      });

      // Update activeChapter immediately for UI reactivity
      if (activeChapter) {
        const updatedQuestions = activeChapter.questions.filter(q => getQuestionId(activeChapter, q) !== qId);
        setActiveChapter({
          ...activeChapter,
          questions: updatedQuestions.map((q, idx) => ({ ...q, q_num: idx + 1 }))
        });
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question. Check console for details.');
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
      setSelectedTopic(null);
      setSelectedBookmarkSubject(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const startQuiz = (chapter: Chapter) => {
    setActiveChapter(chapter);
    setView('quiz');
  };

  const startAllSubjectQuiz = (subjectName: string) => {
    const allQuestions = currentData[subjectName].flatMap(ch => ch.questions).map((q, idx) => ({
      ...q,
      q_num: idx + 1
    }));
    const virtualChapter: Chapter = {
      chapter_num: 0,
      chapter_title: `All ${subjectName} Questions`,
      subject: subjectName,
      subject_id: subjectName.toLowerCase().replace(/\s+/g, '_'),
      questions: allQuestions
    };
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

  const handleQuizComplete = async (results: Omit<QuizResult, 'userId' | 'completedAt'>) => {
    if (user) {
      try {
        const fullResult: QuizResult = {
          ...results,
          userId: user.uid,
          completedAt: new Date().toISOString(),
        };
        await addDoc(collection(db, 'results'), fullResult);
        console.log('Progress saved successfully');
      } catch (error) {
        console.error('Error saving progress:', error);
      }
    }
    setView('home');
  };

  const isAuthorized = user?.email === 'cyberdevil0101@gmail.com';

  // Group bookmarks by subject and then by chapter
  const bookmarksBySubjectAndChapter = bookmarks.reduce((acc, b) => {
    const subject = b.subject || 'Unknown Subject';
    const chapter = b.chapter_title || 'Unknown Chapter';
    if (!acc[subject]) acc[subject] = {};
    if (!acc[subject][chapter]) acc[subject][chapter] = [];
    acc[subject][chapter].push(b);
    return acc;
  }, {} as Record<string, Record<string, Bookmark[]>>);

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border border-slate-100">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-200">
            <GraduationCap className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4">SSC CGL Practice Pro</h1>
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
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setView('home'); setSelectedSubject(null); setSelectedMathSection(null); setSelectedTopic(null); setSelectedBookmarkSubject(null); }}>
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <GraduationCap className="text-white w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-800">SSC CGL <span className="text-blue-600">PRO</span></span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => { setView('home'); setSelectedSubject(null); setSelectedMathSection(null); setSelectedTopic(null); setSelectedBookmarkSubject(null); }}
                className={`flex items-center font-bold transition-colors ${view === 'home' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Practice
              </button>
              <button 
                onClick={() => { setView('bookmarks'); setSelectedBookmarkSubject(null); }}
                className={`flex items-center font-bold transition-colors ${view === 'bookmarks' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <BookmarkIcon className="w-5 h-5 mr-2" />
                Bookmarks
              </button>
              <button
                onClick={() => setView('dashboard')}
                className={`flex items-center font-bold transition-colors ${view === 'dashboard' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <LayoutDashboard className="w-5 h-5 mr-2" />
                Dashboard
              </button>
              <button
                onClick={() => setView('heatmap')}
                className={`flex items-center font-bold transition-colors ${view === 'heatmap' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Flame className="w-5 h-5 mr-2" />
                Heatmap
              </button>
              {user ? (
                <button 
                  onClick={handleLogout}
                  className="p-3 text-slate-500 hover:text-red-600 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className={view === 'quiz' ? 'w-full' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-500 font-bold">Loading your practice hub...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {/* Header & Category Toggle */}
                <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <h1 className="text-4xl font-black text-slate-900 mb-4 leading-tight">
                      {selectedSubject ? `${selectedSubject}` : `Your Personal Practice Hub`}
                    </h1>
                    <p className="text-xl text-slate-500 max-w-2xl">
                      {selectedSubject ? `Select a chapter or attempt all questions.` : `Master your subjects with focused practice and error analysis.`}
                    </p>
                  </div>
                  
                  {!selectedSubject && (
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                      <button
                        onClick={() => setCategory('chapterBank')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center ${
                          category === 'chapterBank'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <ListChecks className="w-5 h-5 mr-2" />
                        Chapter Bank
                      </button>
                      <button
                        onClick={() => setCategory('mockErrors')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center ${
                          category === 'mockErrors'
                            ? 'bg-white text-red-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <AlertCircle className="w-5 h-5 mr-2" />
                        Mock Errors
                      </button>
                    </div>
                  )}
                </div>

                {/* Subject Selection or Chapter Selection */}
                {!selectedSubject ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Object.keys(currentData).map((subject, idx) => (
                      <motion.div
                        key={idx}
                        whileHover={{ y: -8 }}
                        className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 group cursor-pointer"
                        onClick={() => setSelectedSubject(subject)}
                      >
                        <div className="flex items-start justify-between mb-6">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                            category === 'mockErrors' 
                              ? 'bg-red-50 text-red-600 group-hover:bg-red-600' 
                              : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600'
                          } group-hover:text-white`}>
                            <Layers className="w-7 h-7" />
                          </div>
                          <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full uppercase tracking-wider">
                            {currentData[subject].length} Chapters
                          </span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                          {subject}
                        </h3>
                        <div className={`flex items-center font-bold group-hover:translate-x-2 transition-transform ${
                          category === 'mockErrors' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          View Chapters
                          <ChevronRight className="w-5 h-5 ml-2" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : selectedSubject === 'Mathematics' && category === 'chapterBank' && !selectedMathSection ? (
                  <div className="space-y-8">
                    <button 
                      onClick={() => setSelectedSubject(null)}
                      className="flex items-center text-slate-500 font-bold hover:text-slate-800 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 mr-1" />
                      Back to Subjects
                    </button>

                    <div className="text-center max-w-2xl mx-auto mb-12">
                      <h2 className="text-3xl font-black text-slate-900 mb-4">Mathematics Practice Sections</h2>
                      <p className="text-lg text-slate-500 font-medium">Choose a specialized book or practice series to get started with focused topic revision.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Spartan Card */}
                      <motion.div
                        whileHover={{ y: -8, scale: 1.02 }}
                        onClick={() => setSelectedMathSection('spartan')}
                        className="relative bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 group cursor-pointer overflow-hidden flex flex-col justify-between min-h-[320px]"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-bl-[100px] -z-0 transition-all duration-300 group-hover:scale-110"></div>
                        <div className="relative z-10">
                          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-8 shadow-lg shadow-amber-100 group-hover:bg-gradient-to-br group-hover:from-amber-500 group-hover:to-orange-500 group-hover:text-white transition-all duration-300">
                            <Shield className="w-8 h-8" />
                          </div>
                          <h3 className="text-2xl font-black text-slate-800 mb-3 group-hover:text-amber-600 transition-colors">
                            Spartan Series
                          </h3>
                          <p className="text-slate-500 font-medium leading-relaxed">
                            High-yield, battle-tested challenges and conceptually advanced problem sets.
                          </p>
                        </div>
                        <div className="mt-8 flex items-center justify-between relative z-10">
                          <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                            {currentData['Mathematics']?.filter(ch => ch.section === 'spartan').length || 0} Chapters
                          </span>
                          <div className="flex items-center font-bold text-amber-600 group-hover:translate-x-2 transition-transform">
                            Enter Section
                            <ChevronRight className="w-5 h-5 ml-1" />
                          </div>
                        </div>
                      </motion.div>

                      {/* Pinnacle Card */}
                      <motion.div
                        whileHover={{ y: -8, scale: 1.02 }}
                        onClick={() => setSelectedMathSection('pinnacle')}
                        className="relative bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 group cursor-pointer overflow-hidden flex flex-col justify-between min-h-[320px]"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-bl-[100px] -z-0 transition-all duration-300 group-hover:scale-110"></div>
                        <div className="relative z-10">
                          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-8 shadow-lg shadow-blue-100 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-indigo-500 group-hover:text-white transition-all duration-300">
                            <Crown className="w-8 h-8" />
                          </div>
                          <h3 className="text-2xl font-black text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">
                            Pinnacle Series
                          </h3>
                          <p className="text-slate-500 font-medium leading-relaxed">
                            Comprehensive past year practice sets, exhaustive subject mapping, and exam models.
                          </p>
                        </div>
                        <div className="mt-8 flex items-center justify-between relative z-10">
                          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                            {currentData['Mathematics']?.filter(ch => ch.section === 'pinnacle').length || 0} Chapters
                          </span>
                          <div className="flex items-center font-bold text-blue-600 group-hover:translate-x-2 transition-transform">
                            Enter Section
                            <ChevronRight className="w-5 h-5 ml-1" />
                          </div>
                        </div>
                      </motion.div>

                      {/* QRB Card */}
                      <motion.div
                        whileHover={{ y: -8, scale: 1.02 }}
                        onClick={() => setSelectedMathSection('qrb')}
                        className="relative bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 group cursor-pointer overflow-hidden flex flex-col justify-between min-h-[320px]"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-bl-[100px] -z-0 transition-all duration-300 group-hover:scale-110"></div>
                        <div className="relative z-10">
                          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-8 shadow-lg shadow-emerald-100 group-hover:bg-gradient-to-br group-hover:from-emerald-500 group-hover:to-teal-500 group-hover:text-white transition-all duration-300">
                            <Zap className="w-8 h-8" />
                          </div>
                          <h3 className="text-2xl font-black text-slate-800 mb-3 group-hover:text-emerald-600 transition-colors">
                            QRB Series
                          </h3>
                          <p className="text-slate-500 font-medium leading-relaxed">
                            Quick Revision Book question bank focusing on high-speed formula checks and concepts.
                          </p>
                        </div>
                        <div className="mt-8 flex items-center justify-between relative z-10">
                          <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                            {currentData['Mathematics']?.filter(ch => ch.section === 'qrb').length || 0} Chapters
                          </span>
                          <div className="flex items-center font-bold text-emerald-600 group-hover:translate-x-2 transition-transform">
                            Enter Section
                            <ChevronRight className="w-5 h-5 ml-1" />
                          </div>
                        </div>
                      </motion.div>

                      {/* Top500 Card */}
                      <motion.div
                        whileHover={{ y: -8, scale: 1.02 }}
                        onClick={() => setSelectedMathSection('top500')}
                        className="relative bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 group cursor-pointer overflow-hidden flex flex-col justify-between min-h-[320px]"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-bl-[100px] -z-0 transition-all duration-300 group-hover:scale-110"></div>
                        <div className="relative z-10">
                          <div className="w-16 h-16 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-8 shadow-lg shadow-violet-100 group-hover:bg-gradient-to-br group-hover:from-violet-500 group-hover:to-purple-500 group-hover:text-white transition-all duration-300">
                            <Star className="w-8 h-8" />
                          </div>
                          <h3 className="text-2xl font-black text-slate-800 mb-3 group-hover:text-violet-600 transition-colors">
                            Top 500 Series
                          </h3>
                          <p className="text-slate-500 font-medium leading-relaxed">
                            The most repeated Arithmetic questions for SSC CGL, level-wise to master high-yield exam patterns.
                          </p>
                        </div>
                        <div className="mt-8 flex items-center justify-between relative z-10">
                          <span className="text-sm font-bold text-violet-600 bg-violet-50 px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                            {currentData['Mathematics']?.filter(ch => ch.section === 'top500').length || 0} Chapters
                          </span>
                          <div className="flex items-center font-bold text-violet-600 group-hover:translate-x-2 transition-transform">
                            Enter Section
                            <ChevronRight className="w-5 h-5 ml-1" />
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <button 
                      onClick={() => {
                        if (selectedTopic) {
                          setSelectedTopic(null);
                        } else if (selectedSubject === 'Mathematics' && category === 'chapterBank') {
                          setSelectedMathSection(null);
                        } else {
                          setSelectedSubject(null);
                        }
                      }}
                      className="flex items-center text-slate-500 font-bold hover:text-slate-800 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 mr-1" />
                      {selectedTopic ? 'Back to Topics' : (selectedSubject === 'Mathematics' && category === 'chapterBank' ? 'Back to Math Sections' : 'Back to Subjects')}
                    </button>
 
                    {/* Mock Errors: Attempt All Option */}
                    {category === 'mockErrors' && (
                      <div className="bg-red-50 border border-red-100 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                          <h3 className="text-2xl font-black text-red-800 mb-2">Attempt All {selectedSubject} Errors</h3>
                          <p className="text-red-600 font-medium">Practice all {currentData[selectedSubject].reduce((acc, ch) => acc + ch.questions.length, 0)} questions from all topics at once.</p>
                        </div>
                        <button 
                          onClick={() => startAllSubjectQuiz(selectedSubject)}
                          className="px-8 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-xl shadow-red-200 flex items-center"
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Start All
                        </button>
                      </div>
                    )}
 
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {(() => {
                        const relevantChapters = currentData[selectedSubject].filter(chapter => 
                          !(selectedSubject === 'Mathematics' && category === 'chapterBank') || chapter.section === selectedMathSection
                        );
                        const isMathSection = selectedSubject === 'Mathematics' && category === 'chapterBank';
                        const isGK = selectedSubject === 'General Awareness' && category === 'chapterBank';

                        if ((isMathSection || isGK) && !selectedTopic) {
                          const topics = Array.from(new Set(relevantChapters.map(ch => ch.topic_name).filter(Boolean))) as string[];
                          topics.sort((a, b) => a.localeCompare(b));

                          return topics.map((topic, idx) => {
                            const topicChapters = relevantChapters.filter(ch => ch.topic_name === topic);
                            
                            let displayTitle = topic.replace(/_/g, ' ');
                            if (topic === 'history_ancient') displayTitle = 'Ancient History';
                            else if (topic === 'history_medieval') displayTitle = 'Medieval History';
                            else if (topic === 'history_modern') displayTitle = 'Modern History';
                            else if (topic === 'static_gk') displayTitle = 'Static GK';

                            return (
                              <motion.div
                                key={idx}
                                whileHover={{ y: -8 }}
                                className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 group cursor-pointer"
                                onClick={() => setSelectedTopic(topic)}
                              >
                                <div className="flex items-start justify-between mb-6">
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                                    category === 'mockErrors' 
                                      ? 'bg-red-50 text-red-600 group-hover:bg-red-600' 
                                      : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600'
                                  } group-hover:text-white`}>
                                    <Layers className="w-7 h-7" />
                                  </div>
                                  <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full uppercase tracking-wider">
                                    {topicChapters.length} {isMathSection ? 'Sets' : (topicChapters.length === 1 ? 'Chapter' : 'Chapters')}
                                  </span>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors capitalize">
                                  {displayTitle}
                                </h3>
                                <div className={`flex items-center font-bold group-hover:translate-x-2 transition-transform mt-6 ${
                                  category === 'mockErrors' ? 'text-red-600' : 'text-blue-600'
                                }`}>
                                  {isMathSection ? 'View Sets' : 'View Chapters'}
                                  <ChevronRight className="w-5 h-5 ml-2" />
                                </div>
                              </motion.div>
                            );
                          });
                        }

                        let chaptersToRender = (isMathSection || isGK) && selectedTopic
                          ? relevantChapters.filter(ch => ch.topic_name === selectedTopic)
                          : relevantChapters;

                        if (selectedSubject === 'General Awareness') {
                          chaptersToRender = [...chaptersToRender].sort((a, b) => (a.chapter_num || 0) - (b.chapter_num || 0));
                        }

                        return chaptersToRender.map((chapter, idx) => (
                          <motion.div
                            key={idx}
                            whileHover={{ y: -8 }}
                            className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 group cursor-pointer"
                            onClick={() => startQuiz(chapter)}
                          >
                            <div className="flex items-start justify-between mb-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                                category === 'mockErrors' 
                                  ? 'bg-red-50 text-red-600 group-hover:bg-red-600' 
                                  : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600'
                              } group-hover:text-white`}>
                                <BookOpen className="w-7 h-7" />
                              </div>
                              <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full uppercase tracking-wider">
                                {chapter.set_name ? `Set ${chapter.set_name.replace('set_', '')}` : `Ch ${chapter.chapter_num}`}
                              </span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                              {chapter.set_name ? `${chapter.chapter_title}` : chapter.chapter_title}
                            </h3>
                            <p className="text-slate-500 font-medium mb-6">
                              {chapter.questions.length} Questions
                            </p>
                            <div className={`flex items-center font-bold group-hover:translate-x-2 transition-transform ${
                              category === 'mockErrors' ? 'text-red-600' : 'text-blue-600'
                            }`}>
                              Start Practice
                              <ChevronRight className="w-5 h-5 ml-2" />
                            </div>
                          </motion.div>
                        ));
                      })()}
                    </div>
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
            >
              <QuizContainer 
                chapter={activeChapter} 
                category={category}
                onComplete={handleQuizComplete} 
                bookmarkedIds={new Set(bookmarks.filter(b => b.chapter_title === activeChapter.chapter_title).map(b => b.question.q_num))}
                onBookmarkToggle={toggleBookmark}
                isAdmin={isAuthorized}
                onDeleteQuestion={handleDeleteQuestion}
              />
            </motion.div>
          )}

          {view === 'bookmarks' && (
            <motion.div
              key="bookmarks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              <div className="mb-12">
                <h1 className="text-4xl font-black text-slate-900 mb-4">Bookmarked Questions</h1>
                <p className="text-xl text-slate-500">Review your saved questions across all subjects.</p>
              </div>

              {!user ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-100">
                  <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
                    <LogIn className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4">Login to View Bookmarks</h2>
                  <button onClick={handleLogin} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                    Login with Google
                  </button>
                </div>
              ) : loadingBookmarks ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-bold">Loading bookmarks...</p>
                </div>
              ) : bookmarks.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-100">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookmarkIcon className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4">No Bookmarks Yet</h2>
                  <p className="text-slate-500 mb-8">Bookmark questions during practice to review them later.</p>
                  <button onClick={() => setView('home')} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                    Start Practicing
                  </button>
                </div>
              ) : (
                <div className="space-y-12">
                  {selectedBookmarkSubject === null ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {(Object.entries(bookmarksBySubjectAndChapter) as [string, Record<string, Bookmark[]>][]).map(([subject, chaptersObj]) => {
                        const allSubjectBookmarks = Object.values(chaptersObj).flat();
                        const totalChapters = Object.keys(chaptersObj).length;
                        return (
                          <motion.div
                            key={subject}
                            whileHover={{ y: -8 }}
                            className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 group cursor-pointer flex flex-col justify-between min-h-[220px]"
                            onClick={() => setSelectedBookmarkSubject(subject)}
                          >
                            <div>
                              <div className="flex items-start justify-between mb-6">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                                  <Layers className="w-7 h-7" />
                                </div>
                                <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full uppercase tracking-wider">
                                  {totalChapters} {totalChapters === 1 ? 'Chapter' : 'Chapters'}
                                </span>
                              </div>
                              
                              <h3 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors capitalize">
                                {subject}
                              </h3>
                              <p className="text-slate-500 font-medium mb-6">
                                {allSubjectBookmarks.length} Bookmarked {allSubjectBookmarks.length === 1 ? 'Question' : 'Questions'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                              <div className="flex items-center font-bold text-blue-600 group-hover:translate-x-2 transition-transform">
                                View Chapters
                                <ChevronRight className="w-5 h-5 ml-1" />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startSubjectBookmarkQuiz(subject, allSubjectBookmarks);
                                }}
                                className="p-3 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl font-bold transition-all flex items-center justify-center hover:scale-105"
                                title={`Practice ${subject} Bookmarks`}
                              >
                                <Play className="w-4 h-4 fill-current" />
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
                        <div className="space-y-8">
                          {/* Back Button */}
                          <button 
                            onClick={() => setSelectedBookmarkSubject(null)}
                            className="flex items-center text-slate-500 font-bold hover:text-slate-800 transition-colors"
                          >
                            <ChevronLeft className="w-5 h-5 mr-1" />
                            Back to Bookmarked Subjects
                          </button>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Layers className="w-6 h-6" />
                              </div>
                              <div>
                                <h2 className="text-2xl font-black text-slate-800 capitalize">{subject} Bookmarks</h2>
                                <p className="text-sm text-slate-500 font-medium">{allSubjectBookmarks.length} bookmarked {allSubjectBookmarks.length === 1 ? 'question' : 'questions'}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => startSubjectBookmarkQuiz(subject, allSubjectBookmarks)}
                              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-100 flex items-center justify-center hover:-translate-y-0.5"
                            >
                              <Play className="w-4 h-4 mr-2 fill-current" />
                              Practice Subject
                            </button>
                          </div>

                          {/* Chapters Accordion */}
                          <div className="space-y-6">
                            {Object.entries(chaptersObj).map(([chapterTitle, chapterBookmarks]) => {
                              const key = `${subject}|${chapterTitle}`;
                              // Collapsed by default: expanded only if in state as true
                              const isExpanded = expandedChapters[key] === true;
                              return (
                                <div key={chapterTitle} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                  {/* Accordion Header */}
                                  <div 
                                    onClick={() => toggleChapterExpand(subject, chapterTitle)}
                                    className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                                  >
                                    <div className="flex items-center space-x-4 flex-1">
                                      <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                                        <BookOpen className="w-5 h-5" />
                                      </div>
                                      <div>
                                        <h3 className="font-extrabold text-slate-800 text-lg leading-snug">{chapterTitle}</h3>
                                        <span className="inline-flex items-center text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mt-1">
                                          {chapterBookmarks.length} saved
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                                      {/* Practice Chapter Bookmarks Button */}
                                      <button
                                        onClick={() => startChapterBookmarkQuiz(subject, chapterTitle, chapterBookmarks)}
                                        className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-bold transition-all flex items-center justify-center hover:scale-105"
                                        title={`Practice ${chapterTitle} Bookmarks`}
                                      >
                                        <Play className="w-4 h-4 fill-current" />
                                      </button>
                                      
                                      {/* Toggle Chevron */}
                                      <button
                                        onClick={() => toggleChapterExpand(subject, chapterTitle)}
                                        className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                                      >
                                        <ChevronRight className={`w-6 h-6 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
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
                                        transition={{ duration: 0.2 }}
                                        className="border-t border-slate-50 p-6 bg-slate-50/20"
                                      >
                                        <div className="grid grid-cols-1 gap-6">
                                          {chapterBookmarks.map((bookmark) => (
                                            <motion.div
                                              key={bookmark.id}
                                              className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 relative group"
                                            >
                                              <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center space-x-3">
                                                  <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${
                                                    bookmark.category === 'mockErrors' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                                                  }`}>
                                                    {bookmark.category === 'mockErrors' ? 'Mock Error' : 'Chapter Bank'}
                                                  </span>
                                                </div>
                                                <button
                                                  onClick={() => bookmark.id && toggleBookmark(bookmark.question)}
                                                  className="p-2 text-slate-300 hover:text-red-600 transition-colors"
                                                  title="Remove Bookmark"
                                                >
                                                  <Trash2 className="w-5 h-5" />
                                                </button>
                                              </div>
                                              <h4 className="text-lg font-bold text-slate-800 mb-6 leading-relaxed">
                                                {bookmark.question.question}
                                              </h4>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {Object.entries(bookmark.question.options).map(([key, value]) => (
                                                  <div
                                                    key={key}
                                                    className={`p-4 rounded-xl border-2 flex items-center ${
                                                      bookmark.question.answer === key
                                                        ? 'border-green-500 bg-green-50'
                                                        : 'border-slate-50 bg-slate-50/50'
                                                    }`}
                                                  >
                                                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg mr-4 font-bold ${
                                                      bookmark.question.answer === key ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                                                    }`}>
                                                      {key.toUpperCase()}
                                                    </span>
                                                    <span className="text-slate-700 font-medium">{value}</span>
                                                  </div>
                                                ))}
                                              </div>
                                              {bookmark.question.solution && (
                                                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                                  <p className="text-blue-700 text-sm leading-relaxed">
                                                    <span className="font-bold">Solution:</span> {bookmark.question.solution}
                                                  </p>
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              {!user ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-100">
                  <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
                    <LogIn className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4">Login to Track Progress</h2>
                  <p className="text-slate-500 mb-8">Sign in with Google to save your quiz results and track your performance.</p>
                  <button
                    onClick={handleLogin}
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    Login with Google
                  </button>
                </div>
              ) : loadingResults ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-bold">Fetching your results...</p>
                </div>
              ) : userResults.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-slate-100">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trophy className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4">No Results Yet</h2>
                  <p className="text-slate-500 mb-8">Complete a quiz to see your performance analytics here.</p>
                  <button
                    onClick={() => setView('home')}
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    Start Practicing
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black text-slate-900">Performance Overview</h2>
                    <button
                      onClick={() => setView('home')}
                      className="text-blue-600 font-bold hover:text-blue-700 transition-colors"
                    >
                      Back to Practice
                    </button>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                      <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Total Quizzes</div>
                      <div className="text-3xl font-black text-slate-900">{userResults.length}</div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                      <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Avg. Accuracy</div>
                      <div className="text-3xl font-black text-blue-600">
                        {Math.round(userResults.reduce((acc, r) => acc + (r.score / r.totalQuestions), 0) / userResults.length * 100)}%
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                      <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Total Questions</div>
                      <div className="text-3xl font-black text-purple-600">
                        {userResults.reduce((acc, r) => acc + r.totalQuestions, 0)}
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                      <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Avg. Time/Q</div>
                      <div className="text-3xl font-black text-orange-600">
                        {Math.round(userResults.reduce((acc, r) => acc + r.totalTime, 0) / userResults.reduce((acc, r) => acc + r.totalQuestions, 0))}s
                      </div>
                    </div>
                  </div>

                  {/* Recent Results List */}
                  <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-100">
                      <h3 className="text-xl font-black text-slate-900">Recent Activity</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {userResults.map((result, idx) => (
                        <div key={idx} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start space-x-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                              result.category === 'mockErrors' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                              {result.category === 'mockErrors' ? <AlertCircle className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                            </div>
                            <div>
                              <h4 className="text-lg font-black text-slate-900">{result.chapter_title}</h4>
                              <p className="text-slate-500 font-medium">{result.subject} • {new Date(result.completedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-right">
                              <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">Score</div>
                              <div className="text-xl font-black text-slate-900">{result.score}/{result.totalQuestions}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">Avg/Q</div>
                              <div className="text-xl font-black text-orange-600">{Math.round(result.totalTime / result.totalQuestions)}s</div>
                            </div>
                            <div className="text-right">
                              <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">Total Time</div>
                              <div className="text-xl font-black text-slate-900">{Math.floor(result.totalTime / 60)}m {result.totalTime % 60}s</div>
                            </div>
                            <div className="text-right">
                              <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">Accuracy</div>
                              <div className={`text-xl font-black ${
                                (result.score / result.totalQuestions) >= 0.8 ? 'text-green-600' : 
                                (result.score / result.totalQuestions) >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {Math.round((result.score / result.totalQuestions) * 100)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'heatmap' && (
            <motion.div
              key="heatmap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-12">
                <h1 className="text-4xl font-black text-slate-900 mb-4">Error Heatmap</h1>
                <p className="text-xl text-slate-500">Visualize subject-wise error patterns across your top error-prone chapters.</p>
              </div>
              <ErrorHeatmap mockData={mockData} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </main>
  </div>
);
}

