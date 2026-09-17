import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Minus,
  X as TimesIcon,
  Percent,
  Superscript,
  Grid3X3,
  BookOpen,
  ChevronDown,
  Sparkles,
  Maximize,
  Minimize,
  X,
  ChevronLeft,
} from 'lucide-react';
import { ChainAdditionDrill } from './ChainAdditionDrill';
import { NumberLineHopDrill } from './NumberLineHopDrill';
import { CrossGridMatrixDrill } from './CrossGridMatrixDrill';
import { MultiplicationDrill } from './MultiplicationDrill';
import { DivisionRatioDrill } from './DivisionRatioDrill';
import { SquaresCubesDrill } from './SquaresCubesDrill';

export type LabSubTab =
  | 'chain_addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'squares_cubes'
  | 'matrix_grid';

interface TabConfig {
  id: LabSubTab;
  keyNum: number;
  label: string;
  subtitle: string;
  badge: string;
  icon: any;
  summary: string;
  coreRule: string;
  example: string;
  levelsOrModes: string;
}

const SUB_TABS: TabConfig[] = [
  {
    id: 'chain_addition',
    keyNum: 1,
    label: 'Addition',
    subtitle: '5–10 Nodes',
    badge: 'L1–L10',
    icon: Plus,
    summary: 'Running left-to-right mental sum (5 to 10 nodes)',
    coreRule:
      'Add units first to hit the nearest ten, then leap forward by tens. Keep one running subtotal in working memory.',
    example: '34 + 28 + 47 ➔ (34 + 20 + 8 = 62) + (40 + 7) = 109',
    levelsOrModes: '10 Progressive Levels',
  },
  {
    id: 'subtraction',
    keyNum: 2,
    label: 'Subtraction',
    subtitle: 'Forward Jumps',
    badge: 'L1–L6',
    icon: Minus,
    summary: 'Forward hops & century crossing (no borrowing)',
    coreRule:
      'Never borrow vertically. Jump forward from the subtrahend to the nearest ten, then leap to the minuend.',
    example: '72 − 38 ➔ Jump 38 to 40 (+2), jump 40 to 72 (+32) ➔ Sum hops: 34',
    levelsOrModes: '6 Jump Tiers',
  },
  {
    id: 'multiplication',
    keyNum: 3,
    label: 'Multiplication',
    subtitle: 'Vedic Criss-Cross',
    badge: 'Base 100',
    icon: TimesIcon,
    summary: 'Base 100, a² − b² midpoint, and Vedic criss-cross',
    coreRule:
      'Base-100 deviations (Num1 + d2 | d1 × d2), midpoint squares (anchor² − diff²), or single-line criss-cross.',
    example: '94 × 96 ➔ (94 − 4) | (−6 × −4) = 90 | 24 = 9024',
    levelsOrModes: '4 Shortcut Tracks',
  },
  {
    id: 'division',
    keyNum: 4,
    label: 'Division',
    subtitle: 'Decimals & %',
    badge: 'Fractions',
    icon: Percent,
    summary: '10% & 1% mental ladder and ratio comparison for DI',
    coreRule: 'Calculate 10% and 1% steps to bracket percentages quickly without manual long division.',
    example: '53 / 81 ➔ 10% is 8.1; 60% = 48.6, 70% = 56.7 ➔ Bracket: 60%–70%',
    levelsOrModes: '2 Practice Tracks',
  },
  {
    id: 'squares_cubes',
    keyNum: 5,
    label: 'Squares & Cubes',
    subtitle: 'Base 50 & 100',
    badge: 'x² / x³',
    icon: Superscript,
    summary: 'Base 50/100, ending in 5, and 4-term GP cubes',
    coreRule:
      '(50 ± x)² = (25 ± x) | x². Ending in 5: N(N+1) | 25. Cubes: 4 terms a³, a²b, ab², b³.',
    example: '54² = (25 + 4) | 4² = 2916; 65² = (6 × 7) | 25 = 4225',
    levelsOrModes: '5 Power Tracks',
  },
  {
    id: 'matrix_grid',
    keyNum: 6,
    label: 'Cross Matrix',
    subtitle: 'Matrix Sprint',
    badge: '3×3 Grid',
    icon: Grid3X3,
    summary: 'Speed cell cross-addition sprint (3x3 to 10x10)',
    coreRule: 'Instant reflex addition of intersecting row and column numbers against the clock.',
    example: 'Row 47 + Col 68 = 115 (Solve all grid cells consecutively)',
    levelsOrModes: '4 Grid Sizes',
  },
];

export const ArunSharmaSpeedLab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<LabSubTab>('chain_addition');
  const [showMethodDrawer, setShowMethodDrawer] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen handling
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isFullscreen]);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  // Global keydown listeners (1–6 to switch tabs, Escape to exit fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
        setIsFullscreen(false);
        return;
      }

      const activeTag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;

      if (e.key === '1') setActiveSubTab('chain_addition');
      else if (e.key === '2') setActiveSubTab('subtraction');
      else if (e.key === '3') setActiveSubTab('multiplication');
      else if (e.key === '4') setActiveSubTab('division');
      else if (e.key === '5') setActiveSubTab('squares_cubes');
      else if (e.key === '6') setActiveSubTab('matrix_grid');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const currentTab = SUB_TABS.find((t) => t.id === activeSubTab) || SUB_TABS[0];

  // ==========================================
  // 1. FULL SCREEN MODE (Clean White Light Theme)
  // ==========================================
  if (isFullscreen) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-slate-50 text-slate-900 flex flex-col justify-between overflow-y-auto select-none font-sans"
      >
        {/* Studio Top Header with Mental Math Practice Switcher */}
        <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-white/95 border-b border-slate-200/90 backdrop-blur-md shrink-0 shadow-2xs gap-3">
          {/* Left: Back Button & Branding */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              onClick={toggleFullscreen}
              type="button"
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 bg-white transition text-xs font-semibold cursor-pointer shadow-2xs"
              title="Back"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="hidden lg:flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white shadow-xs">
                <Sparkles className="w-3.5 h-3.5 fill-white" />
              </div>
              <div>
                <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight block leading-tight">Mental Math</span>
                <span className="text-[10px] text-blue-600 font-medium">Questions Studio</span>
              </div>
            </div>
          </div>

          {/* Center: Top Practice Switcher (Addition, Subtraction, Multiplication, etc.) */}
          <div className="flex items-center space-x-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold overflow-x-auto custom-scrollbar max-w-full">
            {SUB_TABS.map((tab) => {
              const isActive = activeSubTab === tab.id;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  type="button"
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap text-xs ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                  title={`Practice ${tab.label} (Key ${tab.keyNum})`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <button
              onClick={() => setShowMethodDrawer((prev) => !prev)}
              type="button"
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center space-x-1.5 ${
                showMethodDrawer
                  ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs'
              }`}
              title="Toggle Technique Guide"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">
                {showMethodDrawer ? 'Hide Technique' : 'Technique'}
              </span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              title="Exit Full Screen (Esc)"
            >
              <Minimize className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
              title="Close Full Screen Studio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Technique Drawer in Fullscreen */}
        <AnimatePresence>
          {showMethodDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-2xs"
            >
              <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-blue-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    {currentTab.label} Technique
                  </span>
                  <p className="text-slate-600 leading-relaxed max-w-3xl font-sans">
                    {currentTab.coreRule}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-[11px] font-mono text-slate-800 shrink-0 shadow-2xs">
                  <span className="text-slate-400 mr-1.5 uppercase font-sans text-[10px]">
                    Example:
                  </span>
                  {currentTab.example}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen Main Drill Area (Directly Questions) */}
        <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full flex flex-col justify-start">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSubTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12 }}
            >
              {activeSubTab === 'chain_addition' && <ChainAdditionDrill autoStart={true} />}
              {activeSubTab === 'subtraction' && <NumberLineHopDrill autoStart={true} />}
              {activeSubTab === 'multiplication' && <MultiplicationDrill autoStart={true} />}
              {activeSubTab === 'division' && <DivisionRatioDrill autoStart={true} />}
              {activeSubTab === 'squares_cubes' && <SquaresCubesDrill autoStart={true} />}
              {activeSubTab === 'matrix_grid' && <CrossGridMatrixDrill autoStart={true} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Fullscreen Footer */}
        <footer className="px-4 sm:px-6 py-2.5 bg-white border-t border-slate-200 text-center text-xs text-slate-500 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span>
              Keys <span className="font-mono text-slate-700 font-bold">1–6</span> Switch Practice
            </span>
            <span>•</span>
            <span>
              Press <span className="font-mono text-slate-700 font-bold">Esc</span> to Exit Full Screen
            </span>
            <span>•</span>
            <span>
              Press <span className="font-mono text-slate-700 font-bold">Enter ↵</span> to Submit
            </span>
          </div>
          <div className="hidden sm:block text-slate-400 font-medium">
            Mental Math Question Drill • {currentTab.label}
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // 2. INLINE MODE (Standard DrillHub tab)
  // ==========================================
  return (
    <div className="w-full space-y-4">
      {/* 6-in-1 Unified Module Selector (Stitch Minimalist Cockpit) */}
      <section className="space-y-2" data-purpose="module-selector">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold tracking-wider uppercase text-[10px] text-slate-500">
              Mental Calculation Modules
            </span>
            <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-mono font-medium border border-blue-100">
              6 Disciplines
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowMethodDrawer((prev) => !prev)}
              type="button"
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                showMethodDrawer
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>{showMethodDrawer ? 'Hide Technique' : 'Technique Guide'}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  showMethodDrawer ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* The 6 Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                type="button"
                className={`group relative p-3 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer ${
                  isActive
                    ? 'border-2 border-blue-600 bg-blue-50/60 shadow-sm'
                    : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2.5">
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-mono font-bold ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200'
                    }`}
                  >
                    {tab.keyNum}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-medium ${
                      isActive
                        ? 'text-blue-700 bg-blue-100/80 font-bold'
                        : 'text-slate-400 bg-slate-50'
                    }`}
                  >
                    {isActive ? 'Active' : tab.badge}
                  </span>
                </div>
                <div>
                  <h3
                    className={`font-display font-semibold text-xs leading-snug ${
                      isActive ? 'text-blue-950' : 'text-slate-700 group-hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </h3>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      isActive ? 'text-blue-700 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {tab.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Collapsible Shortcut Guide */}
        <AnimatePresence>
          {showMethodDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-t border-slate-100 pt-2"
            >
              <div className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/80 text-xs text-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      {currentTab.label} Technique
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {currentTab.summary}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed max-w-2xl font-sans">
                    {currentTab.coreRule}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-slate-800 shrink-0 shadow-2xs">
                  <span className="text-slate-400 mr-1.5 text-[10px] uppercase tracking-wider font-sans">
                    Example:
                  </span>
                  {currentTab.example}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Active Drill Header with dedicated Full Screen Questions button */}
      <div className="flex items-center justify-between px-1 pt-1 pb-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-xs sm:text-sm">
            {currentTab.label}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
            {currentTab.badge}
          </span>
          <span className="text-slate-400 text-xs hidden sm:inline">
            • {currentTab.summary}
          </span>
        </div>
        <button
          onClick={toggleFullscreen}
          type="button"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 bg-white text-xs font-semibold transition cursor-pointer shadow-2xs"
          title={`Practice ${currentTab.label} in Full Screen`}
        >
          <Maximize className="w-3.5 h-3.5 text-blue-600" />
          <span>Full Screen</span>
        </button>
      </div>

      {/* Active Drill View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
        >
          {activeSubTab === 'chain_addition' && <ChainAdditionDrill />}
          {activeSubTab === 'subtraction' && <NumberLineHopDrill />}
          {activeSubTab === 'multiplication' && <MultiplicationDrill />}
          {activeSubTab === 'division' && <DivisionRatioDrill />}
          {activeSubTab === 'squares_cubes' && <SquaresCubesDrill />}
          {activeSubTab === 'matrix_grid' && <CrossGridMatrixDrill />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
