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

    const step1 = base + units;
    const finalAns = step1 + tens;

    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-blue-600" />
          <span>Number Line Accumulation:</span>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap font-mono font-semibold text-xs bg-white p-2 rounded-lg border border-slate-200">
          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 border border-slate-200 font-bold">
            {base}
          </span>
          <span className="text-slate-400 text-[11px] flex items-center font-sans">
            +{units} <ArrowRight className="w-3 h-3 ml-0.5" />
          </span>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
            {step1}
          </span>
          <span className="text-slate-400 text-[11px] flex items-center font-sans">
            +{tens} <ArrowRight className="w-3 h-3 ml-0.5" />
          </span>
          <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded font-bold">
            {finalAns}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 mt-2">
          Add units first: {base} + {units} = {step1}, then leap by tens: + {tens} = {finalAns}.
        </p>
      </div>
    );
  }

  // Subtraction forward milestone hopping
  const { minuend, subtrahend } = props;
  const difference = minuend - subtrahend;

  let hop1 = 0;
  let midPoint1 = subtrahend;

  if (minuend >= 100 && subtrahend >= 100) {
    const targetEnd = minuend % 100;
    const subEnd = subtrahend % 100;
    if (targetEnd >= subEnd) {
      hop1 = targetEnd - subEnd;
    } else {
      hop1 = (100 - subEnd) + targetEnd;
    }
    midPoint1 = subtrahend + hop1;
  } else {
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
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
      <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
        <Lightbulb className="w-3.5 h-3.5 text-blue-600" />
        <span>Forward Number Line Leap:</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap font-mono font-semibold text-xs bg-white p-2 rounded-lg border border-slate-200">
        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 border border-slate-200 font-bold">
          {subtrahend}
        </span>
        <span className="text-slate-400 text-[11px] flex items-center font-sans">
          +{hop1} <ArrowRight className="w-3 h-3 ml-0.5" />
        </span>
        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
          {midPoint1}
        </span>
        <span className="text-slate-400 text-[11px] flex items-center font-sans">
          +{hop2} <ArrowRight className="w-3 h-3 ml-0.5" />
        </span>
        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200 font-bold">
          {minuend}
        </span>
        <span className="ml-auto text-[11px] font-sans text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-semibold border border-slate-200">
          Distance = <span className="text-slate-900 font-bold">{difference}</span>
        </span>
      </div>

      <p className="text-[11px] text-slate-500 mt-2">
        Jump forward from {subtrahend} to {midPoint1} (+{hop1}), then to {minuend} (+{hop2}) = {difference}.
      </p>
    </div>
  );
};
