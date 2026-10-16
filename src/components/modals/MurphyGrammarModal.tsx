import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Maximize2, Minimize2, BookOpen, RotateCw, Layers, Sparkles } from 'lucide-react';
import {
  MurphyMapping,
  FULL_MURPHY_PORTAL,
  openMurphyAiUnit,
  getMurphyUnitMeta
} from '../../utils/murphyGrammar';

interface MurphyGrammarModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapping: MurphyMapping | null;
}

function extractUnitNum(url?: string): number | null {
  if (!url) return null;
  const match = url.match(/unit-(\d+)\.html/i);
  return match ? parseInt(match[1], 10) : null;
}

export const MurphyGrammarModal: React.FC<MurphyGrammarModalProps> = ({
  isOpen,
  onClose,
  mapping,
}) => {
  const [activeMapping, setActiveMapping] = useState<MurphyMapping | null>(mapping);
  const [currentUnitNum, setCurrentUnitNum] = useState<number | null>(() => extractUnitNum(mapping?.url));
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setActiveMapping(mapping);
    const num = extractUnitNum(mapping?.url);
    setCurrentUnitNum(num);
  }, [mapping]);

  // Sync active unit to window so global Tommy button is aware of the current unit
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isOpen && currentUnitNum) {
        const meta = getMurphyUnitMeta(currentUnitNum);
        (window as any).__CGL_ACTIVE_MURPHY_UNIT__ = {
          unitNum: currentUnitNum,
          title: meta?.title,
          sub: meta?.sub
        };
      } else {
        (window as any).__CGL_ACTIVE_MURPHY_UNIT__ = null;
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__CGL_ACTIVE_MURPHY_UNIT__ = null;
      }
    };
  }, [isOpen, currentUnitNum]);

  // Listen to postMessage from iframe (unit catalogues or unit pages)
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'CGL_OPEN_AI_MURPHY_UNIT') {
        const { unitNum, title, sub } = e.data;
        if (unitNum) {
          const num = Number(unitNum);
          setCurrentUnitNum(num);
          openMurphyAiUnit(num, title, sub);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Close on Escape key and reset to fullscreen on open
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
  }, [isOpen, activeMapping?.url]);

  if (!isOpen || !activeMapping) return null;

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(k => k + 1);
  };

  const handleOpenExternal = () => {
    let targetUrl = activeMapping.url;
    try {
      const iframePath = iframeRef.current?.contentWindow?.location.pathname;
      if (iframePath && iframePath.includes('/murphy/')) {
        targetUrl = iframePath;
      }
    } catch {}

    const uNum = extractUnitNum(targetUrl) || currentUnitNum;
    const targetParams = new URLSearchParams();
    targetParams.set('murphyUrl', targetUrl);
    if (uNum) targetParams.set('murphyUnit', String(uNum));

    window.open(`/?${targetParams.toString()}`, '_blank');
  };

  const handleShowAllUnits = () => {
    setIsLoading(true);
    setCurrentUnitNum(null);
    setActiveMapping(FULL_MURPHY_PORTAL);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    try {
      const iframeWindow = iframeRef.current?.contentWindow;
      const iframeDoc = iframeRef.current?.contentDocument;

      if (iframeWindow && iframeWindow.location) {
        const pathname = iframeWindow.location.pathname;
        const detectedNum = extractUnitNum(pathname);
        if (detectedNum) {
          setCurrentUnitNum(detectedNum);
        } else if (pathname.includes('index.html')) {
          setCurrentUnitNum(null);
        }
      }

      // Inject bridge into iframe document so units can trigger AI directly
      if (iframeDoc && iframeWindow) {
        (iframeWindow as any).openAiForUnit = (n: number, title?: string, sub?: string) => {
          openMurphyAiUnit(n, title, sub);
        };

        // Remove any legacy injected floating button to prevent collision with Tommy's global button
        const existingBtn = iframeDoc.getElementById('murphy-embedded-ai-btn');
        if (existingBtn) {
          existingBtn.remove();
        }
      }
    } catch {
      // Ignore cross-origin access restriction if any
    }
  };

  const isFullIndex = activeMapping.url === FULL_MURPHY_PORTAL.url;
  const unitMeta = currentUnitNum ? getMurphyUnitMeta(currentUnitNum) : null;
  const displayTitle = unitMeta
    ? `Unit ${currentUnitNum}: ${unitMeta.title}`
    : activeMapping.title;

  return (
    <AnimatePresence>
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md ${isFullscreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`relative flex flex-col bg-stone-50 dark:bg-stone-900 overflow-hidden transition-all duration-200 ${
            isFullscreen
              ? 'w-screen h-[100dvh] rounded-none border-0'
              : 'w-full max-w-6xl h-[92vh] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl'
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-stone-900/90 border-b border-stone-200 dark:border-stone-800 select-none">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-sm border border-teal-500/20 shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 truncate">
                    {displayTitle}
                  </h3>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                    {currentUnitNum ? `Unit ${currentUnitNum}` : activeMapping.unitRange}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1 truncate">
                  <span>English Grammar in Use (5th Edition) · Cambridge</span>
                  <span className="text-stone-300 dark:text-stone-700">·</span>
                  <span className="text-teal-600 dark:text-teal-400 font-medium">Interactive Practice</span>
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
              {/* Unit-Scoped AI Feature */}
              {currentUnitNum ? (
                <button
                  type="button"
                  onClick={() => openMurphyAiUnit(currentUnitNum, unitMeta?.title, unitMeta?.sub)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-900 dark:text-teal-100 bg-gradient-to-r from-teal-500/15 via-emerald-500/15 to-teal-500/20 hover:from-teal-500/25 hover:to-emerald-500/30 border border-teal-500/40 rounded-lg shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title={`Ask Tommy AI Mentor strictly about Unit ${currentUnitNum}`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 animate-pulse" />
                  <span className="font-semibold">Ask AI (Unit {currentUnitNum})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openMurphyAiUnit(1)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-900 dark:text-teal-100 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-300 dark:border-teal-700/80 rounded-lg shadow-sm transition-all cursor-pointer"
                  title="Ask AI Mentor about Murphy Grammar"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Ask AI Tutor</span>
                </button>
              )}

              {!isFullIndex && (
                <button
                  type="button"
                  onClick={handleShowAllUnits}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors cursor-pointer"
                  title="Browse all 145 Units"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All 145 Units</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReload}
                className="p-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                title="Refresh exercise frame"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleOpenExternal}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800/60 rounded-lg transition-colors cursor-pointer"
                title="Open in new full tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Tab</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(f => !f)}
                className="p-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                title={isFullscreen ? 'Restore window size' : 'Expand full screen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <div className="w-px h-5 bg-stone-200 dark:bg-stone-800 mx-0.5" />

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                title="Close modal (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Iframe Viewport */}
          <div className="relative flex-1 w-full h-full bg-[#f7f5f0] overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#f7f5f0]">
                <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs font-medium text-stone-600">Loading interactive Murphy exercises...</p>
              </div>
            )}
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={activeMapping.url}
              className="w-full h-full border-0 select-text"
              title="Murphy Grammar Unit"
              onLoad={handleIframeLoad}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
