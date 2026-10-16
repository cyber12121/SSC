import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Maximize2, Minimize2, BookOpen, RotateCw, Layers } from 'lucide-react';
import { MurphyMapping, FULL_MURPHY_PORTAL } from '../../utils/murphyGrammar';

interface MurphyGrammarModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapping: MurphyMapping | null;
}

export const MurphyGrammarModal: React.FC<MurphyGrammarModalProps> = ({
  isOpen,
  onClose,
  mapping,
}) => {
  const [activeMapping, setActiveMapping] = useState<MurphyMapping | null>(mapping);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    setActiveMapping(mapping);
  }, [mapping]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
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
    window.open(activeMapping.url, '_blank');
  };

  const handleShowAllUnits = () => {
    setIsLoading(true);
    setActiveMapping(FULL_MURPHY_PORTAL);
  };

  const isFullIndex = activeMapping.url === FULL_MURPHY_PORTAL.url;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`relative flex flex-col bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
            isFullscreen
              ? 'w-full h-full rounded-none'
              : 'w-full max-w-6xl h-[92vh]'
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-stone-900/90 border-b border-stone-200 dark:border-stone-800 select-none">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-sm border border-teal-500/20 shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 truncate">
                    {activeMapping.title}
                  </h3>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                    {activeMapping.unitRange}
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
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-2">
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
              key={iframeKey}
              src={activeMapping.url}
              className="w-full h-full border-0 select-text"
              title="Murphy Grammar Unit"
              onLoad={() => setIsLoading(false)}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
