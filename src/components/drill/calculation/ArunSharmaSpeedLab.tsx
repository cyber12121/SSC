import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCcw,
  Sparkles,
  Zap,
  ArrowRight,
  Compass,
  Grid3X3,
  BookOpen
} from 'lucide-react';
import { ChainAdditionDrill } from './ChainAdditionDrill';
import { NumberLineHopDrill } from './NumberLineHopDrill';
import { CrossGridMatrixDrill } from './CrossGridMatrixDrill';

type LabSubTab = 'chain_addition' | 'subtraction' | 'matrix_grid';

export const ArunSharmaSpeedLab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<LabSubTab>('chain_addition');

  const subTabs = [
    {
      id: 'chain_addition' as LabSubTab,
      label: 'Circular Chain Addition',
      subtitle: '5 & 10 Nodes Alternating (Levels 1–10)',
      icon: Zap,
      badge: 'Page 2 Benchmark'
    },
    {
      id: 'subtraction' as LabSubTab,
      label: 'Forward Jump Subtraction',
      subtitle: 'Number-Line Distance (Levels 1–6)',
      icon: Compass,
      badge: 'No Borrowing'
    },
    {
      id: 'matrix_grid' as LabSubTab,
      label: 'Cross-Grid Matrix',
      subtitle: '3x3 up to 10x10 Master Table',
      icon: Grid3X3,
      badge: 'Page 3 Matrix'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Subtab Navigation Pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                isActive
                  ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isActive ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.badge}
                </span>
              </div>
              <div>
                <h3 className={`text-xs font-bold leading-tight ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                  {tab.label}
                </h3>
                <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium">
                  {tab.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Drill View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeSubTab === 'chain_addition' && <ChainAdditionDrill />}
          {activeSubTab === 'subtraction' && <NumberLineHopDrill />}
          {activeSubTab === 'matrix_grid' && <CrossGridMatrixDrill />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
