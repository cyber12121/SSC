import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ExternalLink,
  Maximize2,
  Minimize2,
  BookOpen,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ListFilter
} from 'lucide-react';
import {
  Rule120ChapterMeta,
  RULES_120_CATALOG
} from '../../utils/rules120Grammar';

interface Rules120ModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialChapter?: Rule120ChapterMeta | null;
}

export const Rules120Modal: React.FC<Rules120ModalProps> = ({
  isOpen,
  onClose,
  initialChapter
}) => {
  const [activeChapter, setActiveChapter] = useState<Rule120ChapterMeta>(() => {
    return initialChapter || RULES_120_CATALOG[0];
  });
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (initialChapter) {
      setActiveChapter(initialChapter);
      setIsLoading(true);
    }
  }, [initialChapter]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      setIsFullscreen(true);
      window.addEventListener('keydown', handleKeyDown);
      setIsLoading(true);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeChapter?.url]);

  if (!isOpen || !activeChapter) return null;

  const currentIndex = RULES_120_CATALOG.findIndex(
    c => c.chapterNum === activeChapter.chapterNum
  );

  const handlePrev = () => {
    if (currentIndex > 0) {
      setActiveChapter(RULES_120_CATALOG[currentIndex - 1]);
      setIsLoading(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < RULES_120_CATALOG.length - 1) {
      setActiveChapter(RULES_120_CATALOG[currentIndex + 1]);
      setIsLoading(true);
    }
  };

  const handleSelectChapter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chapNum = parseInt(e.target.value, 10);
    const found = RULES_120_CATALOG.find(c => c.chapterNum === chapNum);
    if (found) {
      setActiveChapter(found);
      setIsLoading(true);
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(k => k + 1);
  };

  const handleOpenExternal = () => {
    window.open(activeChapter.url, '_blank');
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <AnimatePresence>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md ${
          isFullscreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'
        }`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`relative flex flex-col bg-slate-900 text-slate-100 overflow-hidden transition-all duration-200 ${
            isFullscreen
              ? 'w-screen h-[100dvh] rounded-none border-0'
              : 'w-full max-w-6xl h-[92vh] rounded-2xl border border-amber-500/30 shadow-2xl'
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-slate-950/95 border-b border-amber-500/20 select-none">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30 shrink-0 shadow-inner">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm md:text-base font-bold text-amber-300 truncate">
                    {activeChapter.title}
                  </h3>
                  <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                    {activeChapter.ruleCount} Rules (Rules {activeChapter.rules.join(', ')})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                  <span className="font-medium text-amber-200/90">Nimisha Bansal 120 Rules of Grammar</span>
                  <span className="text-slate-600">·</span>
                  <span className="hidden sm:inline text-slate-400 truncate">{activeChapter.subtitle}</span>
                </p>
              </div>
            </div>

            {/* Chapter Selector & Actions */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
              {/* Dropdown Select */}
              <div className="relative flex items-center">
                <ListFilter className="w-3.5 h-3.5 text-amber-400 absolute left-2 pointer-events-none hidden sm:block" />
                <select
                  value={activeChapter.chapterNum}
                  onChange={handleSelectChapter}
                  className="bg-slate-900 border border-amber-500/30 rounded-lg text-xs font-semibold text-amber-200 pl-2 sm:pl-7 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                  title="Jump to Chapter"
                >
                  {RULES_120_CATALOG.map(c => (
                    <option key={c.chapterNum} value={c.chapterNum}>
                      Ch {c.chapterNum}: {c.title.replace(/^Chapter \d+:\s*/, '')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prev / Next buttons */}
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-amber-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
                title="Previous Chapter"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex >= RULES_120_CATALOG.length - 1}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-amber-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
                title="Next Chapter"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleReload}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Reload chapter"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleOpenExternal}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
                title="Open standalone HTML in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>New Tab</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(f => !f)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title={isFullscreen ? 'Restore window size' : 'Expand full screen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <div className="w-px h-5 bg-slate-800 mx-0.5" />

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                title="Close modal (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Iframe Viewport */}
          <div className="relative flex-1 w-full h-full bg-[#0f172a] overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950">
                <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3 shadow-lg" />
                <p className="text-xs font-semibold text-amber-300">Loading {activeChapter.title}...</p>
                <p className="text-[11px] text-slate-500 mt-1">Nimisha Bansal 120 Rules of Grammar</p>
              </div>
            )}
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={activeChapter.url}
              className="w-full h-full border-0 select-text"
              title={activeChapter.title}
              onLoad={handleIframeLoad}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
