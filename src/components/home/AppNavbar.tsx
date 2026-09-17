import React from 'react';
import {
  GraduationCap,
  BookOpen,
  Zap,
  Bookmark as BookmarkIcon,
  LayoutDashboard,
  Trophy,
  Flame,
  LogOut,
  LogIn
} from 'lucide-react';

interface AppNavbarProps {
  view: string;
  quizMode: 'practice' | 'mock';
  user: any;
  resetToHome: () => void;
  setView: (view: 'home' | 'dashboard' | 'bookmarks' | 'mockScores' | 'heatmap' | 'drill') => void;
  setSelectedSubject: (subject: string | null) => void;
  setSelectedTopic: (topic: string | null) => void;
  setSelectedBookmarkSubject: (subject: string | null) => void;
  setQuizModePersisted: (mode: 'practice' | 'mock') => void;
  handleLogin: () => void;
  handleLogout: () => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  view,
  quizMode,
  user,
  resetToHome,
  setView,
  setSelectedSubject,
  setSelectedTopic,
  setSelectedBookmarkSubject,
  setQuizModePersisted,
  handleLogin,
  handleLogout
}) => {
  return (
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
              className={`flex items-center font-bold text-sm transition-colors cursor-pointer ${
                view === 'home' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4 mr-1.5" />
              Practice
            </button>
            <button
              onClick={() => {
                setView('drill');
                setSelectedSubject(null);
                setSelectedTopic(null);
              }}
              className={`flex items-center font-bold text-sm transition-colors cursor-pointer ${
                view === 'drill' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap className="w-4 h-4 mr-1.5" />
              Speed Drill
            </button>
            <button
              onClick={() => {
                setView('bookmarks');
                setSelectedBookmarkSubject(null);
              }}
              className={`flex items-center font-bold text-sm transition-colors cursor-pointer ${
                view === 'bookmarks' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BookmarkIcon className="w-4 h-4 mr-1.5" />
              Bookmarks
            </button>
            <button
              onClick={() => setView('dashboard')}
              className={`flex items-center font-bold text-sm transition-colors cursor-pointer ${
                view === 'dashboard' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 mr-1.5" />
              Dashboard
            </button>
            <button
              onClick={() => setView('mockScores')}
              className={`flex items-center font-bold text-sm transition-colors cursor-pointer ${
                view === 'mockScores' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Trophy className="w-4 h-4 mr-1.5" />
              Mock Scores
            </button>
            <button
              onClick={() => setView('heatmap')}
              className={`flex items-center font-bold text-sm transition-colors cursor-pointer ${
                view === 'heatmap' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Flame className="w-4 h-4 mr-1.5" />
              Heatmap
            </button>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold" title="Quiz mode">
              <button
                onClick={() => setQuizModePersisted('practice')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center cursor-pointer ${
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
                className="p-2 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleLogin}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center text-xs cursor-pointer"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
export default AppNavbar;
