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

  const openFullscreenStudio = (mode: 'routine' | 'free' = 'routine', section: SectionId = 'triplets') => {
    setStudioInitialMode(mode);
    setStudioInitialSection(section);
    setIsStudioOpen(true);
  };

  const tabs: { id: DrillTab; label: string; icon: any; tag?: string }[] = [
    { id: 'mental_speed', label: 'Mental Speed Lab', icon: Sparkles, tag: 'Arun Sharma' },
    { id: 'calculation', label: 'Calculation Studio', icon: Calculator, tag: 'Full Screen' },
    { id: 'math', label: 'Speed Math', icon: Zap, tag: '80% 2/3-Digit' },
  ];

  return (
    <div className="w-full">
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

      {/* Minimalist Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-xs mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors mr-1"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
              Back
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                Calculation & Speed Drills
              </h1>
              <div className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2 py-0.2 rounded-full">
                <Flame className="w-3 h-3 mr-0.5 fill-amber-500 text-amber-500" />
                Day {streak}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              High-speed mental arithmetic, guided calculation routines, and targeted speed drills
            </p>
          </div>
        </div>

        {/* Segmented Tabs */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs font-semibold self-start sm:self-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center whitespace-nowrap px-3 py-1 rounded-md text-xs transition-all ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 mr-1 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

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

              {/* Hero Banner for Fullscreen Calculation Workout */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white shadow-md mb-3.5 border border-slate-800">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl"></div>
                <div className="pointer-events-none absolute -bottom-10 left-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl"></div>

                <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="max-w-xl">
                    <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30 mb-2">
                      <Zap className="w-3 h-3 text-blue-400" />
                      <span>Full Screen Routine Workout</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mb-1">
                      Full Screen Calculation Studio
                    </h2>
                    <p className="text-slate-300 text-xs leading-relaxed mb-2">
                      Sharpen mental math through the guided 7-stage daily routine:
                    </p>
                    {/* Steps Pills */}
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-300">
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                        1. Triplets
                      </span>
                      <span className="text-slate-500">→</span>
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                        2. Tables 12–24
                      </span>
                      <span className="text-slate-500">→</span>
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                        3. Squares 17–39
                      </span>
                      <span className="text-slate-500">→</span>
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                        4. Cubes 11–25
                      </span>
                      <span className="text-slate-500">→</span>
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                        5. Powers (2–9)
                      </span>
                      <span className="text-slate-500">→</span>
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                        6. Factorials 1–8
                      </span>
                      <span className="text-slate-500">→</span>
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                        7. Fractions %
                      </span>
                    </div>
                  </div>

                      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                        <button
                          onClick={() => openFullscreenStudio('routine', 'triplets')}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-xs transition-all flex items-center justify-center space-x-1.5 active:scale-98"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start Daily Routine</span>
                        </button>
                        <button
                          onClick={() => openFullscreenStudio('free', 'triplets')}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center space-x-1.5"
                        >
                          <Maximize className="w-3.5 h-3.5 text-blue-400" />
                          <span>Enter Full Screen</span>
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
