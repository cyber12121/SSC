import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  Compass,
  Grid3X3,
  XSquare,
  Divide,
  Superscript,
  Percent,
  Sparkles
} from 'lucide-react';
import { ChainAdditionDrill } from './ChainAdditionDrill';
import { NumberLineHopDrill } from './NumberLineHopDrill';
import { CrossGridMatrixDrill } from './CrossGridMatrixDrill';
import { MultiplicationDrill } from './MultiplicationDrill';
import { DivisionRatioDrill } from './DivisionRatioDrill';
import { SquaresCubesDrill } from './SquaresCubesDrill';

type LabSubTab = 
  | 'chain_addition' 
  | 'subtraction' 
  | 'matrix_grid' 
  | 'multiplication' 
  | 'division' 
  | 'squares_cubes';

export const ArunSharmaSpeedLab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<LabSubTab>('chain_addition');

  const subTabs = [
    {
      id: 'chain_addition' as LabSubTab,
      label: 'Chain Addition',
      subtitle: '5 & 10 Nodes (L1–L10)',
      icon: Zap,
      badge: 'Ch. 1 - Page 2'
    },
    {
      id: 'subtraction' as LabSubTab,
      label: 'Number Line Subtraction',
      subtitle: 'Forward Jumps (L1–L6)',
      icon: Compass,
      badge: 'Ch. 1 - Page 4'
    },
    {
      id: 'matrix_grid' as LabSubTab,
      label: 'Cross-Grid Matrix',
      subtitle: '3x3 up to 10x10 Blitz',
      icon: Grid3X3,
      badge: 'Ch. 1 - Page 3'
    },
    {
      id: 'multiplication' as LabSubTab,
      label: 'Multiplication Lab',
      subtitle: 'Base 100, a²-b², Criss-Cross',
      icon: Sparkles,
      badge: 'Ch. 2 - Page 5'
    },
    {
      id: 'division' as LabSubTab,
      label: 'Divisions & Ratios',
      subtitle: 'Decimal % & Ratio Face-Off',
      icon: Percent,
      badge: 'Ch. 3 - Page 10'
    },
    {
      id: 'squares_cubes' as LabSubTab,
      label: 'Squares & Cubes',
      subtitle: 'Base 50/100, Ending 5, GP',
      icon: Superscript,
      badge: 'Ch. 4 - Page 12'
    }
  ];

  return (
    <div className="space-y-4">
      {/* 6 Subtab Navigation Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                isActive
                  ? 'bg-white border-blue-600 shadow-md ring-2 ring-blue-600/20'
                  : 'bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                  isActive ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.badge}
                </span>
              </div>
              <div>
                <h3 className={`text-xs font-bold leading-tight truncate ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                  {tab.label}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">
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
          {activeSubTab === 'multiplication' && <MultiplicationDrill />}
          {activeSubTab === 'division' && <DivisionRatioDrill />}
          {activeSubTab === 'squares_cubes' && <SquaresCubesDrill />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
