import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  Percent,
  Triangle,
  Bookmark,
  Sparkles,
  Flame,
  Maximize,
  ArrowRight,
  Calculator,
  Play,
} from 'lucide-react';
import { SpeedMathDrill } from './SpeedMathDrill';
import { FractionDrill } from './FractionDrill';
import { PowerDrill } from './PowerDrill';
import { TripletDrill } from './TripletDrill';
import { FormulaVault } from './FormulaVault';
import { CalculationStudio } from './CalculationStudio';
import { SectionId } from '../../data/drills/calculationData';

type DrillTab = 'calculation' | 'math' | 'fractions' | 'powers' | 'triplets' | 'formulas';

export const DrillHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DrillTab>('calculation');
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [studioInitialSection, setStudioInitialSection] = useState<SectionId>('triplets');
  const [studioInitialMode, setStudioInitialMode] = useState<'routine' | 'free'>('routine');

  const [streak, setStreak] = useState<number>(() => {
    const saved = localStorage.getItem('calc_drill_streak');
    return saved ? parseInt(saved, 10) : 1;
  });

  // Track daily visit
  useEffect(() => {
    const lastDate = localStorage.getItem('calc_drill_last_date');
    const today = new Date().toDateString();
    if (lastDate !== today) {
      localStorage.setItem('calc_drill_last_date', today);
      const newStreak = parseInt(localStorage.getItem('calc_drill_streak') || '0', 10) + 1;
      localStorage.setItem('calc_drill_streak', newStreak.toString());
      setStreak(newStreak);
    }
  }, []);

  const openFullscreenStudio = (mode: 'routine' | 'free' = 'routine', section: SectionId = 'triplets') => {
    setStudioInitialMode(mode);
    setStudioInitialSection(section);
    setIsStudioOpen(true);
  };

  const tabs: { id: DrillTab; label: string; icon: any; tag?: string }[] = [
    { id: 'calculation', label: 'Calculation Tab', icon: Calculator, tag: 'Full Screen' },
    { id: 'math', label: 'Speed Math', icon: Zap, tag: '80% 2/3-Digit' },
    { id: 'fractions', label: 'Fractions %', icon: Percent },
    { id: 'powers', label: 'Squares & Cubes', icon: Sparkles },
    { id: 'triplets', label: 'Triplets', icon: Triangle },
    { id: 'formulas', label: 'Formulas', icon: Bookmark },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      {/* Fullscreen Calculation Studio Modal */}
      {isStudioOpen && (
        <CalculationStudio
          onClose={() => setIsStudioOpen(false)}
          initialMode={studioInitialMode}
          initialSection={studioInitialSection}
        />
      )}

      {/* Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Calculation & Speed Drills
            </h1>
            <div className="flex items-center text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full">
              <Flame className="w-3.5 h-3.5 mr-1 fill-amber-500 text-amber-500" />
              Day {streak}
            </div>
          </div>
          <p className="text-slate-500 text-sm">
            High-speed mental arithmetic, targeted speed drills, and formula recall for SSC CGL & Banking.
          </p>
        </div>

        {/* Minimalist Segmented Tabs */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto scrollbar-none self-start sm:self-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 mr-1.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero Banner for Fullscreen Calculation Workout */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-7 text-white shadow-xl mb-8 border border-slate-800">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-10 left-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl"></div>

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30 mb-3">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>Full Screen Routine Workout</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
              Full Screen Calculation Studio
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-3">
              Sharpen mental math through the guided 6-stage daily routine:
            </p>
            {/* Steps Pills */}
            <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-300">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                1. Triplets
              </span>
              <span className="text-slate-500">→</span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                2. Tables 12–24
              </span>
              <span className="text-slate-500">→</span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                3. Squares 17–39
              </span>
              <span className="text-slate-500">→</span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                4. Cubes 11–25
              </span>
              <span className="text-slate-500">→</span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                5. Powers (2–9)
              </span>
              <span className="text-slate-500">→</span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                6. Factorials 1–8
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={() => openFullscreenStudio('routine', 'triplets')}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 active:scale-98"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Daily Routine</span>
            </button>
            <button
              onClick={() => openFullscreenStudio('free', 'triplets')}
              className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl font-bold text-sm border border-slate-700 transition-all flex items-center justify-center space-x-2"
            >
              <Maximize className="w-4 h-4 text-blue-400" />
              <span>Enter Full Screen</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-2">
        <AnimatePresence mode="wait">
          {activeTab === 'calculation' && (
            <motion.div
              key="calculation"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {/* Grid of the 6 Calculation Modules */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {/* 1. Triplets */}
                <div
                  onClick={() => openFullscreenStudio('free', 'triplets')}
                  className="group bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                        Step 1
                      </span>
                      <Triangle className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
                      Pythagorean Triplets
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Instant recall for 3-4-5, 5-12-13, 7-24-25, 8-15-17, 20-21-29 & multiples. Find missing legs or hypotenuse.
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-blue-600 pt-3 border-t border-slate-100">
                    <span>Practice Triplets</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 2. Tables 12 - 24 */}
                <div
                  onClick={() => openFullscreenStudio('free', 'tables')}
                  className="group bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        Step 2
                      </span>
                      <Zap className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition-colors mb-1">
                      Tables (12 to 24)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Multiplication drill from table 12 up to 24. Develop reflex memory for high-frequency exam multiples.
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-600 pt-3 border-t border-slate-100">
                    <span>Practice Tables 12–24</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 3. Squares 17 - 39 */}
                <div
                  onClick={() => openFullscreenStudio('free', 'squares')}
                  className="group bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                        Step 3
                      </span>
                      <Sparkles className="w-5 h-5 text-amber-600" />
                    </div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-amber-600 transition-colors mb-1">
                      Squares (17 to 39)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Targeted square practice from 17² (289) to 39² (1521), including reverse square roots.
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-amber-600 pt-3 border-t border-slate-100">
                    <span>Practice Squares 17–39</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 4. Cubes 11 - 25 */}
                <div
                  onClick={() => openFullscreenStudio('free', 'cubes')}
                  className="group bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
                        Step 4
                      </span>
                      <Sparkles className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-purple-600 transition-colors mb-1">
                      Cubes (11 to 25)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Instant cube recall from 11³ (1331) to 25³ (15625) with cube roots for CI & volume problems.
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-purple-600 pt-3 border-t border-slate-100">
                    <span>Practice Cubes 11–25</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 5. Powers */}
                <div
                  onClick={() => openFullscreenStudio('free', 'powers')}
                  className="group bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                        Step 5
                      </span>
                      <Zap className="w-5 h-5 text-rose-600" />
                    </div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-rose-600 transition-colors mb-1">
                      Powers (2–4 to ^6 & 5–9 to ^4)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Bases 2, 3, 4 raised up to 6th power; bases 5, 6, 7, 8, 9 raised up to 4th power.
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-rose-600 pt-3 border-t border-slate-100">
                    <span>Practice Powers</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 6. Factorials 1 - 8 */}
                <div
                  onClick={() => openFullscreenStudio('free', 'factorials')}
                  className="group bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-cyan-300 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-cyan-600 bg-cyan-50 px-2.5 py-1 rounded-full">
                        Step 6
                      </span>
                      <Calculator className="w-5 h-5 text-cyan-600" />
                    </div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-cyan-600 transition-colors mb-1">
                      Factorials (1! to 8!)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Instant recall for 1! (1) up to 8! (40,320). Invaluable for probability and permutations.
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-600 pt-3 border-t border-slate-100">
                    <span>Practice Factorials 1–8</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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

          {activeTab === 'fractions' && (
            <motion.div
              key="fractions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <FractionDrill />
            </motion.div>
          )}

          {activeTab === 'powers' && (
            <motion.div
              key="powers"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <PowerDrill />
            </motion.div>
          )}

          {activeTab === 'triplets' && (
            <motion.div
              key="triplets"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <TripletDrill />
            </motion.div>
          )}

          {activeTab === 'formulas' && (
            <motion.div
              key="formulas"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <FormulaVault />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
