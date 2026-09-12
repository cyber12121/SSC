import React from 'react';
import { ArrowRight, Lightbulb } from 'lucide-react';

interface AdditionHopProps {
  type: 'addition';
  base: number;
  addend: number;
}

interface SubtractionHopProps {
  type: 'subtraction';
  minuend: number;    // The larger number (e.g. 72 or 813)
  subtrahend: number; // The smaller number to subtract (e.g. 38 or 478)
}

type ThoughtHopProps = AdditionHopProps | SubtractionHopProps;

export const ThoughtHopVisualizer: React.FC<ThoughtHopProps> = (props) => {
  if (props.type === 'addition') {
    const { base, addend } = props;
    const tens = Math.floor(addend / 10) * 10;
    const units = addend % 10;

    // Strategy 1: Add units first to reach friendly number, then add tens
    const step1 = base + units;
    const finalAns = step1 + tens;

    return (
      <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 shadow-xs">
        <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-2">
          <Lightbulb className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
          <span>Arun Sharma Thought Process (Number Line Jump):</span>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap font-mono font-bold text-sm bg-white/80 p-2.5 rounded-lg border border-amber-100">
          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 border border-slate-200">
            {base}
          </span>
          <span className="text-emerald-600 text-xs flex items-center font-sans font-bold">
            + {units} units <ArrowRight className="w-3 h-3 ml-0.5" />
          </span>
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
            {step1}
          </span>
          <span className="text-blue-600 text-xs flex items-center font-sans font-bold">
            + {tens} tens <ArrowRight className="w-3 h-3 ml-0.5" />
          </span>
          <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded shadow-xs font-black">
            {finalAns}
          </span>
        </div>

        <p className="text-[11px] text-amber-700/90 mt-2">
          💡 <strong>Mental Cue:</strong> Avoid carrying paper digits. Jump directly: {base} + {units} = {step1}, then + {tens} = {finalAns}.
        </p>
      </div>
    );
  }

  // Subtraction forward milestone hopping
  const { minuend, subtrahend } = props;
  const difference = minuend - subtrahend;

  // Compute hops:
  // Step 1: Hop to match unit or nearest milestone
  let hop1 = 0;
  let midPoint1 = subtrahend;

  if (minuend >= 100 && subtrahend >= 100) {
    // 3-digit milestone matching (e.g. 813 - 478 -> hop to end in 13: 478 + 35 = 513)
    const targetEnd = minuend % 100;
    const subEnd = subtrahend % 100;
    if (targetEnd >= subEnd) {
      hop1 = targetEnd - subEnd;
    } else {
      hop1 = (100 - subEnd) + targetEnd;
    }
    midPoint1 = subtrahend + hop1;
  } else {
    // 2-digit unit match (e.g. 72 - 38 -> jump +4 to 42)
    const targetUnit = minuend % 10;
    const subUnit = subtrahend % 10;
    if (targetUnit >= subUnit) {
      hop1 = targetUnit - subUnit;
    } else {
      hop1 = (10 - subUnit) + targetUnit;
    }
    midPoint1 = subtrahend + hop1;
  }

  const hop2 = minuend - midPoint1;

  return (
    <div className="bg-sky-50/90 border border-sky-200/80 rounded-xl p-3 text-xs text-sky-900 shadow-xs">
      <div className="flex items-center gap-1.5 font-bold text-sky-800 mb-2">
        <Lightbulb className="w-3.5 h-3.5 fill-sky-500 text-sky-600" />
        <span>Forward Distance Thought Process (No Borrowing):</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap font-mono font-bold text-sm bg-white/80 p-2.5 rounded-lg border border-sky-100">
        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 border border-slate-200">
          {subtrahend}
        </span>
        <span className="text-emerald-600 text-xs flex items-center font-sans font-bold">
          + {hop1} <ArrowRight className="w-3 h-3 ml-0.5" />
        </span>
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
          {midPoint1}
        </span>
        <span className="text-blue-600 text-xs flex items-center font-sans font-bold">
          + {hop2} <ArrowRight className="w-3 h-3 ml-0.5" />
        </span>
        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
          {minuend}
        </span>
        <span className="ml-auto text-xs font-sans text-sky-700 bg-sky-100 px-2 py-0.5 rounded font-bold">
          Total Jump = {hop1} + {hop2} = <span className="text-sky-900 font-black text-sm">{difference}</span>
        </span>
      </div>

      <p className="text-[11px] text-sky-700/90 mt-2">
        💡 <strong>Mental Cue:</strong> Subtraction is just the distance from {subtrahend} to {minuend} on a number line.
      </p>
    </div>
  );
};
