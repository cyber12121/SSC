import React, { useState } from 'react';
import { X, BookOpen, Sparkles, Check, ChevronRight } from 'lucide-react';
import {
  TRIPLETS_DATA,
  SQUARES_17_39,
  CUBES_11_25,
  POWERS_DATA,
  FACTORIALS_DATA,
  CALC_SECTIONS,
  SectionId,
} from '../../data/drills/calculationData';
import fractionsData from '../../data/drills/fractions.json';

type SheetTab = SectionId | 'fractions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SheetTab;
}

export const CalculationCheatSheet: React.FC<Props> = ({ isOpen, onClose, initialSection = 'triplets' }) => {
  const [activeTab, setActiveTab] = useState<SheetTab>(initialSection);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Quick Reference & Memory Sheet</h2>
              <p className="text-xs text-slate-500 font-medium">Instant formula cards for mental calculation revision</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center px-6 py-3 border-b border-slate-100 overflow-x-auto scrollbar-none gap-2 bg-white">
          {CALC_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveTab(sec.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === sec.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {sec.badge}: {sec.shortTitle}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('fractions')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'fractions'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Ref: Fractions %
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Triplets */}
          {activeTab === 'triplets' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs text-blue-900 font-medium">
                <strong>Pythagorean Triplet Formula:</strong> $a^2 + b^2 = c^2$, where $c$ is the longest side (Hypotenuse).
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {TRIPLETS_DATA.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-blue-300 transition-all text-center"
                  >
                    <div className="text-sm font-extrabold text-slate-800">
                      ({t.a}, {t.b}, {t.c})
                    </div>
                    <div className="text-[11px] text-blue-600 mt-1 font-bold">
                      Primitive
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Tables 12 - 24 */}
          {activeTab === 'tables' && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-xs text-emerald-900 font-medium">
                <strong>Multiplication Tables 12 to 24:</strong> High-frequency multiples used throughout Quant & DI.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 13 }, (_, i) => 12 + i).map((tbl) => (
                  <div key={tbl} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                    <div className="font-black text-slate-800 text-sm mb-2.5 pb-1 border-b border-slate-200 flex justify-between items-center">
                      <span>Table of {tbl}</span>
                      <span className="text-emerald-600 text-xs font-bold">12–24</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 font-medium">
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                        <div key={m} className="flex justify-between py-0.5">
                          <span className="text-slate-400">{tbl} × {m}</span>
                          <span className="font-bold text-slate-800">{tbl * m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Squares 17 - 39 */}
          {activeTab === 'squares' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100 text-xs text-amber-900 font-medium">
                <strong>Squares from 17 to 39:</strong> Essential for algebra, compound interest, and mensuration.
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {SQUARES_17_39.map((item) => (
                  <div
                    key={item.n}
                    className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-amber-300 transition-all text-center"
                  >
                    <div className="text-xs text-slate-400 font-bold">{item.n}²</div>
                    <div className="text-base font-black text-amber-600">{item.val}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">√{item.val} = {item.n}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Cubes 11 - 25 */}
          {activeTab === 'cubes' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 text-xs text-purple-900 font-medium">
                <strong>Cubes from 11 to 25:</strong> Memorizing up to 25³ gives you an unfair speed advantage in CI & Sphere problems.
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {CUBES_11_25.map((item) => (
                  <div
                    key={item.n}
                    className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-purple-300 transition-all text-center"
                  >
                    <div className="text-xs text-slate-400 font-bold">{item.n}³</div>
                    <div className="text-base font-black text-purple-600">{item.val.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">∛{item.val} = {item.n}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Powers */}
          {activeTab === 'powers' && (
            <div className="space-y-6">
              <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-100 text-xs text-rose-900 font-medium">
                <strong>Curated Powers:</strong> Powers of 2, 3, 4 up to power 6 & Powers of 5, 6, 7, 8, 9 up to power 4.
              </div>

              {/* Group by base */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[2, 3, 4, 5, 6, 7, 8, 9].map((base) => {
                  const maxExp = base <= 4 ? 6 : 4;
                  const items = POWERS_DATA.filter((p) => p.base === base);
                  return (
                    <div key={base} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                      <div className="font-black text-slate-800 text-sm mb-2 pb-1 border-b border-slate-200 flex justify-between items-center">
                        <span>Base {base}</span>
                        <span className="text-rose-600 text-xs font-bold">up to ^{maxExp}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {items.map((it) => (
                          <div key={it.exp} className="flex justify-between py-0.5 font-medium">
                            <span className="text-slate-500">{it.base}<sup>{it.exp}</sup></span>
                            <span className="font-extrabold text-slate-800">{it.val.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 6: Factorials */}
          {activeTab === 'factorials' && (
            <div className="space-y-4">
              <div className="p-4 bg-cyan-50/60 rounded-2xl border border-cyan-100 text-xs text-cyan-900 font-medium">
                <strong>Factorials 1! to 8!:</strong> Fundamental for Permutations, Combinations & Probability.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {FACTORIALS_DATA.map((item) => (
                  <div
                    key={item.n}
                    className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-cyan-300 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-black text-slate-800">{item.n}!</span>
                      <span className="text-base font-black text-cyan-600">{item.val.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono font-medium">
                      = {item.breakdown}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 7: Fractions & Percentages */}
          {activeTab === 'fractions' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-indigo-900 font-medium flex items-center justify-between">
                <span><strong>Fractions to Percentages (1/2 to 1/25):</strong> High-frequency percentage conversions for Arithmetic & DI.</span>
                <span className="text-[11px] font-bold text-indigo-600 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                  {fractionsData.length} Values
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {fractionsData.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition-all text-center"
                  >
                    <div className="text-base font-black text-slate-900">
                      {item.fraction}
                    </div>
                    <div className="text-sm font-extrabold text-indigo-600 mt-0.5">
                      {item.percentage}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      ≈ {item.decimal}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Done Reviewing
          </button>
        </div>
      </div>
    </div>
  );
};
