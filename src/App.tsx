import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Trophy, GraduationCap, LayoutDashboard, LogIn, LogOut, Loader2, AlertCircle, ListChecks, ChevronRight, ChevronLeft, Play, Layers, Bookmark as BookmarkIcon, Trash2 } from 'lucide-react';
import { Chapter, SubjectData, QuizResult, Bookmark, Question } from './types';
import { QuizContainer } from './components/QuizContainer';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
// Dynamic import of all subject JSON files (recursive)
const subjectModules = import.meta.glob('./data/**/*.json', { eager: true });

const mockData: SubjectData = {};
const bankData: SubjectData = {};

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

  chapters.forEach((chapter: any) => {
    const subject = chapter.subject;
    if (isMock || (path.includes('mockErrors') && !isBank)) {
      if (!mockData[subject]) mockData[subject] = [];
      mockData[subject].push(chapter);
    } else {
      if (!bankData[subject]) bankData[subject] = [];
      bankData[subject].push(chapter);
    }
  });
});

export default function App() {
  const [view, setView] = useState<'home' | 'quiz' | 'dashboard' | 'bookmarks'>('home');
  const [category, setCategory] = useState<'mockErrors' | 'chapterBank'>('chapterBank');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

    const existing = bookmarks.find(b => b.question.q_num === question.q_num && b.chapter_title === activeChapter?.chapter_title);

    if (existing && existing.id) {
      try {
        await deleteDoc(doc(db, 'bookmarks', existing.id));
        setBookmarks(prev => prev.filter(b => b.id !== existing.id));
      } catch (error) {
        console.error('Error removing bookmark:', error);
      }
    } else {
      try {
        const newBookmark: Bookmark = {
          userId: user.uid,
          question,
          subject: activeChapter?.subject || 'Unknown',
          chapter_title: activeChapter?.chapter_title || 'Unknown',
          category,
          bookmarkedAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, 'bookmarks'), newBookmark);
        setBookmarks(prev => [{ ...newBookmark, id: docRef.id }, ...prev]);
      } catch (error) {
        console.error('Error adding bookmark:', error);
      }
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

  // Group bookmarks by subject
  const bookmarksBySubject = bookmarks.reduce((acc, b) => {
    if (!acc[b.subject]) acc[b.subject] = [];
    acc[b.subject].push(b);
    return acc;
  }, {} as Record<string, Bookmark[]>);

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
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setView('home'); setSelectedSubject(null); }}>
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <GraduationCap className="text-white w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-800">SSC CGL <span className="text-blue-600">PRO</span></span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => { setView('home'); setSelectedSubject(null); }}
                className={`flex items-center font-bold transition-colors ${view === 'home' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Practice
              </button>
              <button 
                onClick={() => setView('bookmarks')}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
                ) : (
                  <div className="space-y-8">
                    <button 
                      onClick={() => setSelectedSubject(null)}
                      className="flex items-center text-slate-500 font-bold hover:text-slate-800 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 mr-1" />
                      Back to Subjects
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
                      {currentData[selectedSubject].map((chapter, idx) => (
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
                              Ch {chapter.chapter_num}
                            </span>
                          </div>
                          <h3 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                            {chapter.chapter_title}
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
                      ))}
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
                  {(Object.entries(bookmarksBySubject) as [string, Bookmark[]][]).map(([subject, subjectBookmarks]) => (
                    <div key={subject} className="space-y-6">
                      <div className="flex items-center space-x-4">
                        <div className="h-px flex-1 bg-slate-200"></div>
                        <h2 className="text-2xl font-black text-slate-800 px-4">{subject}</h2>
                        <div className="h-px flex-1 bg-slate-200"></div>
                      </div>
                      <div className="grid grid-cols-1 gap-6">
                        {subjectBookmarks.map((bookmark) => (
                          <motion.div
                            key={bookmark.id}
                            className="bg-white rounded-3xl p-8 shadow-lg border border-slate-100 relative group"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center space-x-3">
                                <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${
                                  bookmark.category === 'mockErrors' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                                }`}>
                                  {bookmark.category === 'mockErrors' ? 'Mock Error' : 'Chapter Bank'}
                                </span>
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                  {bookmark.chapter_title}
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
                            <h3 className="text-xl font-bold text-slate-800 mb-6 leading-relaxed">
                              {bookmark.question.question}
                            </h3>
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
                    </div>
                  ))}
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
        </AnimatePresence>
      )}
    </main>
  </div>
);
}

