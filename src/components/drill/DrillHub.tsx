import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  Percent,
  Triangle,
  Sparkles,
  Flame,
  Maximize,
  ArrowRight,
  Calculator,
  Play,
  ChevronLeft,
  BookOpen,
} from 'lucide-react';
import { SpeedMathDrill } from './SpeedMathDrill';
import { CalculationStudio } from './CalculationStudio';
import { CalculationCheatSheet } from './CalculationCheatSheet';
import { SectionId } from '../../data/drills/calculationData';
import { ArunSharmaSpeedLab } from './calculation/ArunSharmaSpeedLab';

type DrillTab = 'mental_speed' | 'calculation' | 'math';

interface DrillHubProps {
  onBack?: () => void;
}

export const DrillHub: React.FC<DrillHubProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<DrillTab>('mental_speed');
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [studioInitialSection, setStudioInitialSection] = useState<SectionId>('triplets');
  const [studioInitialMode, setStudioInitialMode] = useState<'routine' | 'free'>('routine');
  const [showCheatSheet, setShowCheatSheet] = useState<boolean>(false);

  const [streak, setStreak] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage?.getItem('calc_drill_streak');
        return saved ? parseInt(saved, 10) : 1;
      }
    } catch {}
    return 1;
  });

  // Track daily visit
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const lastDate = window.localStorage?.getItem('calc_drill_last_date');
        const today = new Date().toDateString();
        if (lastDate !== today) {
          window.localStorage?.setItem('calc_drill_last_date', today);
          const newStreak = parseInt(window.localStorage?.getItem('calc_drill_streak') || '0', 10) + 1;
          window.localStorage?.setItem('calc_drill_streak', newStreak.toString());
          setStreak(newStreak);
        }
      }
    } catch {}
  }, []);

  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // Global Keyboard listener for shortcuts modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowShortcutsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openFullscreenStudio = (mode: 'routine' | 'free' = 'routine', section: SectionId = 'triplets') => {
    setStudioInitialMode(mode);
    setStudioInitialSection(section);
    setIsStudioOpen(true);
  };

  const tabs: { id: DrillTab; label: string; icon: any; tag?: string }[] = [
    { id: 'mental_speed', label: 'Mental Speed Lab', icon: Sparkles, tag: '6-in-1 Matrix' },
    { id: 'calculation', label: 'Calculation Studio', icon: Calculator, tag: 'Full Screen' },
    { id: 'math', label: 'Speed Drill', icon: Zap, tag: 'Sprint' },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Fullscreen Calculation Studio Modal */}
      {isStudioOpen && (
        <CalculationStudio
          onClose={() => setIsStudioOpen(false)}
          initialMode={studioInitialMode}
          initialSection={studioInitialSection}
        />
      )}

      {/* Quick Reference Cheat Sheet Modal */}
      {showCheatSheet && (
        <CalculationCheatSheet
          isOpen={showCheatSheet}
          onClose={() => setShowCheatSheet(false)}
          initialSection="triplets"
        />
      )}

      {/* Minimalist Shortcuts Modal Dialog */}
      <AnimatePresence>
        {showShortcutsModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold font-display text-slate-900">
                  Keyboard Shortcuts
                </h3>
                <button
                  onClick={() => setShowShortcutsModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg leading-none cursor-pointer p-1"
                >
                  ×
                </button>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Switch Disciplines</span>
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-semibold">
                    1 – 6
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Submit Answer</span>
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-semibold">
                    Enter ↵
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Toggle Mental Hint</span>
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-semibold">
                    H
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>Skip / Pause</span>
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-semibold">
                    Space / Esc
                  </span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Help Dialog</span>
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-semibold">
                    ?
                  </span>
                </div>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setShowShortcutsModal(false)}
                  className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Minimalist Top Navigation Header (Calculus Serenum) */}
      <header className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs px-4 sm:px-5 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Mode Identification */}
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                type="button"
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 bg-white transition text-xs font-semibold cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
            <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex items-baseline space-x-2">
              <span className="font-display font-bold text-sm tracking-tight text-slate-900">
                Calculation &amp; Speed Drills
              </span>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                • Studio
              </span>
            </div>
          </div>

          {/* Center Status Indicators */}
          <div className="flex items-center space-x-2.5 text-xs">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 text-slate-600 font-mono text-[11px] font-medium border border-slate-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Session Active</span>
            </div>
            <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-mono text-[11px] font-semibold border border-amber-200/60">
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Day {streak}</span>
            </div>
          </div>

          {/* Right Utilities & Tabs */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCheatSheet(true)}
              type="button"
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 bg-white transition text-xs font-medium cursor-pointer shadow-2xs"
              title="Memory Cheat Sheet"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Cheat Sheet</span>
            </button>
            <button
              onClick={() => setShowShortcutsModal(true)}
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 bg-white transition font-mono text-xs font-semibold cursor-pointer shadow-2xs"
              title="Keyboard Shortcuts (?)"
            >
              ?
            </button>
          </div>
        </div>

        {/* Sub-Header Tabs & Daily Routines */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-100">
          {/* Segmented Mode Selector */}
          <div className="flex items-center space-x-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 text-xs font-semibold">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Daily Quick Routine Pills */}
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="text-[11px] font-medium text-slate-400 hidden lg:inline">Routines:</span>
            <div className="flex items-center space-x-1.5 overflow-x-auto custom-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('mental_speed');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px] transition cursor-pointer shrink-0"
              >
                Mental Speed Circuit
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('math');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px] transition cursor-pointer shrink-0"
              >
                Speed Drill Sprint
              </button>
              <button
                type="button"
                onClick={() => openFullscreenStudio('routine', 'triplets')}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px] transition cursor-pointer shrink-0"
              >
                7-Stage Studio
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div>
        <AnimatePresence mode="wait">
          {activeTab === 'mental_speed' && (
            <motion.div
              key="mental_speed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <ArunSharmaSpeedLab />
            </motion.div>
          )}

          {activeTab === 'calculation' && (
            <motion.div
              key="calculation"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {/* Calculation Modules Toolbar */}
              <div className="flex items-center justify-between gap-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Calculation Workout Modules</span>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                    7 Guided Modules
                  </span>
                </div>

                <button
                  onClick={() => setShowCheatSheet(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:text-blue-600 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  <span>Memory Cheat Sheet</span>
                </button>
              </div>

              {/* Hero Banner for Calculation Workout */}
              <div className="relative overflow-hidden rounded-2xl bg-white p-4 sm:p-5 text-slate-900 shadow-xs mb-3.5 border border-slate-200">
                <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="max-w-xl">
                    <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 mb-2">
                      <Zap className="w-3 h-3 text-blue-600" />
                      <span>7-Stage Routine Workout</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mb-1">
                      Calculation Speed Studio
                    </h2>
                    <p className="text-slate-500 text-xs leading-relaxed mb-2">
                      Sharpen mental math through the guided 7-stage daily routine:
                    </p>
                    {/* Steps Pills */}
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                        1. Triplets
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                        2. Tables 12–24
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                        3. Squares 17–39
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                        4. Cubes 11–25
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                        5. Powers (2–9)
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                        6. Factorials 1–8
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                        7. Fractions %
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                    <button
                      onClick={() => openFullscreenStudio('routine', 'triplets')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center space-x-1.5 active:scale-98 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Daily Routine</span>
                    </button>
                    <button
                      onClick={() => openFullscreenStudio('free', 'triplets')}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs border border-slate-200 transition-all flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer"
                    >
                      <Maximize className="w-3.5 h-3.5 text-blue-600" />
                      <span>Start in Full Screen</span>
                    </button>
                  </div>
                </div>
              </div>

                  {/* Grid of Calculation Modules */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    {/* 1. Triplets */}
                    <div
                      onClick={() => openFullscreenStudio('free', 'triplets')}
                      className="group bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            Step 1
                          </span>
                          <Triangle className="w-4 h-4 text-blue-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-0.5">
                          Pythagorean Triplets
                        </h3>
                        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                          Instant recall for 3-4-5, 5-12-13, 7-24-25, 8-15-17, 20-21-29 &amp; multiples. Find missing legs or hypotenuse.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-blue-600 pt-2 border-t border-slate-100">
                        <span>Practice Triplets</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* 2. Tables 12 - 24 */}
                    <div
                      onClick={() => openFullscreenStudio('free', 'tables')}
                      className="group bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            Step 2
                          </span>
                          <Zap className="w-4 h-4 text-emerald-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors mb-0.5">
                          Tables (12 to 24)
                        </h3>
                        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                          Multiplication drill from table 12 up to 24. Develop reflex memory for high-frequency exam multiples.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-600 pt-2 border-t border-slate-100">
                        <span>Practice Tables 12–24</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* 3. Squares 17 - 39 */}
                    <div
                      onClick={() => openFullscreenStudio('free', 'squares')}
                      className="group bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-amber-300 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                            Step 3
                          </span>
                          <Sparkles className="w-4 h-4 text-amber-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors mb-0.5">
                          Squares (17 to 39)
                        </h3>
                        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                          Targeted square practice from 17² (289) to 39² (1521), including reverse square roots.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-amber-600 pt-2 border-t border-slate-100">
                        <span>Practice Squares 17–39</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* 4. Cubes 11 - 25 */}
                    <div
                      onClick={() => openFullscreenStudio('free', 'cubes')}
                      className="group bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                            Step 4
                          </span>
                          <Sparkles className="w-4 h-4 text-purple-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors mb-0.5">
                          Cubes (11 to 25)
                        </h3>
                        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                          Instant cube recall from 11³ (1331) to 25³ (15625) with cube roots for CI &amp; volume problems.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-purple-600 pt-2 border-t border-slate-100">
                        <span>Practice Cubes 11–25</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* 5. Powers */}
                    <div
                      onClick={() => openFullscreenStudio('free', 'powers')}
                      className="group bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-rose-300 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                            Step 5
                          </span>
                          <Zap className="w-4 h-4 text-rose-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-rose-600 transition-colors mb-0.5">
                          Powers (2–4 to ^6 &amp; 5–9 to ^4)
                        </h3>
                        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                          Bases 2, 3, 4 raised up to 6th power; bases 5, 6, 7, 8, 9 raised up to 4th power.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-rose-600 pt-2 border-t border-slate-100">
                        <span>Practice Powers</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* 6. Factorials 1 - 8 */}
                    <div
                      onClick={() => openFullscreenStudio('free', 'factorials')}
                      className="group bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-cyan-300 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100">
                            Step 6
                          </span>
                          <Calculator className="w-4 h-4 text-cyan-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-cyan-600 transition-colors mb-0.5">
                          Factorials (1! to 8!)
                        </h3>
                        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                          Instant recall for 1! (1) up to 8! (40,320). Invaluable for probability and permutations.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-600 pt-2 border-t border-slate-100">
                        <span>Practice Factorials 1–8</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* 7. Fractions & Percentages */}
                    <div
                      onClick={() => openFullscreenStudio('free', 'fractions')}
                      className="group bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            Step 7
                          </span>
                          <Percent className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mb-0.5">
                          Fractions &amp; Percentages
                        </h3>
                        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                          Instant fraction-to-percentage and percentage-to-fraction recall for 1/2 to 1/25 with decimal equivalents.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-600 pt-2 border-t border-slate-100">
                        <span>Practice Fractions %</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
            </motion.div>
          )}

          {activeTab === 'math' && (
            <motion.div
              key="math"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <SpeedMathDrill />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
