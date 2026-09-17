import React from 'react';
import { Target, Check, Edit3 } from 'lucide-react';
import { RCATagType, RCAClassification } from '../../types';

interface RcaClassifierProps {
  currentRca?: RCAClassification;
  onSelectTag: (tag: RCATagType) => void;
  onClearTag: () => void;
  activeSillyNote: string;
  onSaveSillyNote: (note: string) => void;
  onToggleSillyChip: (chipLabel: string) => void;
}

export const RcaClassifier: React.FC<RcaClassifierProps> = ({
  currentRca,
  onSelectTag,
  onClearTag,
  activeSillyNote,
  onSaveSillyNote,
  onToggleSillyChip
}) => {
  return (
    <div className="my-5 p-3.5 sm:p-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-cyan-50/60 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-600 text-white shadow-xs">
            <Target className="w-3.5 h-3.5" />
          </span>
          <div>
            <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <span>Root-Cause Analysis (RCA) Tag</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  currentRca?.tag === 'C'
                    ? 'bg-purple-100 text-purple-800'
                    : currentRca?.tag === 'A'
                    ? 'bg-rose-100 text-rose-800'
                    : currentRca?.tag === 'T'
                    ? 'bg-amber-100 text-amber-800'
                    : currentRca?.tag === 'G'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {currentRca?.tag ? `[${currentRca.tag}] ${currentRca.tagName}` : 'Not Classified'}
              </span>
            </h4>
            <p className="text-[11px] text-gray-500">
              Classify this mistake to reveal traps in Mock Errors and train Tommy.
            </p>
          </div>
        </div>

        {currentRca?.tag && (
          <button
            type="button"
            onClick={onClearTag}
            className="text-[11px] text-gray-400 hover:text-rose-600 transition-colors cursor-pointer underline decoration-dotted flex items-center gap-1"
          >
            <span>Clear Tag</span>
          </button>
        )}
      </div>

      {/* 4 Classification Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* [C] Conceptual Gap */}
        <button
          type="button"
          onClick={() => onSelectTag('C')}
          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
            currentRca?.tag === 'C'
              ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-300 ring-offset-1'
              : 'bg-white hover:bg-purple-50/80 border-purple-200 text-gray-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <span
                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                  currentRca?.tag === 'C' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-800'
                }`}
              >
                [C]
              </span>
            </div>
            {currentRca?.tag === 'C' && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
          </div>
          <span className="text-xs font-bold">Conceptual Gap</span>
          <span
            className={`text-[10px] mt-0.5 ${
              currentRca?.tag === 'C' ? 'text-purple-100' : 'text-gray-500'
            }`}
          >
            Formula forgotten / Concept unclear
          </span>
        </button>

        {/* [A] Silly Mistake */}
        <button
          type="button"
          onClick={() => onSelectTag('A')}
          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
            currentRca?.tag === 'A'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300 ring-offset-1'
              : 'bg-white hover:bg-rose-50/80 border-rose-200 text-gray-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <span
                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                  currentRca?.tag === 'A' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-800'
                }`}
              >
                [A]
              </span>
            </div>
            {currentRca?.tag === 'A' && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
          </div>
          <span className="text-xs font-bold">Silly Mistake</span>
          <span
            className={`text-[10px] mt-0.5 ${
              currentRca?.tag === 'A' ? 'text-rose-100' : 'text-gray-500'
            }`}
          >
            Calculation, misread, rushed
          </span>
        </button>

        {/* [T] Time / Ego Trap */}
        <button
          type="button"
          onClick={() => onSelectTag('T')}
          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
            currentRca?.tag === 'T'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300 ring-offset-1'
              : 'bg-white hover:bg-amber-50/80 border-amber-200 text-gray-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <span
                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                  currentRca?.tag === 'T' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                [T]
              </span>
            </div>
            {currentRca?.tag === 'T' && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
          </div>
          <span className="text-xs font-bold">Time / Ego Trap</span>
          <span
            className={`text-[10px] mt-0.5 ${
              currentRca?.tag === 'T' ? 'text-amber-100' : 'text-gray-500'
            }`}
          >
            Spent too long / Should skip
          </span>
        </button>

        {/* [G] Guesswork Failed */}
        <button
          type="button"
          onClick={() => onSelectTag('G')}
          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
            currentRca?.tag === 'G'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300 ring-offset-1'
              : 'bg-white hover:bg-blue-50/80 border-blue-200 text-gray-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <span
                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                  currentRca?.tag === 'G' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-800'
                }`}
              >
                [G]
              </span>
            </div>
            {currentRca?.tag === 'G' && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
          </div>
          <span className="text-xs font-bold">Guesswork Failed</span>
          <span
            className={`text-[10px] mt-0.5 ${
              currentRca?.tag === 'G' ? 'text-blue-100' : 'text-gray-500'
            }`}
          >
            50-50 hunch went wrong
          </span>
        </button>
      </div>

      {/* Silly Mistake Writing Box when [A] is selected */}
      {currentRca?.tag === 'A' && (
        <div className="mt-3 p-3 rounded-lg bg-rose-50/80 border border-rose-200 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-rose-600" />
              <span>Quick Reason or Custom Note:</span>
            </label>
            <div className="flex items-center gap-2">
              {activeSillyNote && (
                <button
                  type="button"
                  onClick={() => onSaveSillyNote('')}
                  className="text-[10px] text-rose-600 hover:text-rose-800 underline font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
              <span className="text-[10px] text-rose-500 font-medium">Auto-saved</span>
            </div>
          </div>

          {/* 1-click Quick Toggle Chips */}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {[
              { label: 'Calculation error', icon: '🧮' },
              { label: 'Misread question / options', icon: '👁️' },
              { label: 'Marked wrong option', icon: '🎯' },
              { label: 'Rushed under panic', icon: '⏱️' },
              { label: 'Overlooked NOT / INCORRECT', icon: '⚠️' },
              { label: 'Unit conversion missed', icon: '📐' },
              { label: 'Formula slip / Sign error', icon: '⚡' }
            ].map((chip) => {
              const isSelected = activeSillyNote
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .includes(chip.label.toLowerCase());

              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => onToggleSillyChip(chip.label)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                    isSelected
                      ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs scale-102'
                      : 'bg-white hover:bg-rose-100 text-rose-800 border-rose-200'
                  }`}
                >
                  <span>{chip.icon}</span>
                  <span>{chip.label}</span>
                  {isSelected && <span className="text-[10px] ml-0.5">✓</span>}
                </button>
              );
            })}
          </div>

          <textarea
            value={activeSillyNote}
            onChange={(e) => onSaveSillyNote(e.target.value)}
            placeholder="Or type custom details: e.g. Added 14 instead of 24 in step 2, forgot to divide by 2..."
            rows={2}
            className="w-full text-xs p-2.5 rounded-md border border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-400 bg-white text-gray-800 placeholder-gray-400 outline-none"
          />
        </div>
      )}
    </div>
  );
};
