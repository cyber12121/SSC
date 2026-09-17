import React from 'react';
import { X, BookOpen, AlertTriangle, Clock, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';

interface RcaRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RcaRulesModal: React.FC<RcaRulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const rules = [
    {
      tag: 'C',
      code: '[C] Concept Gap',
      title: 'Conceptual / Formula Gap',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: BookOpen,
      iconColor: 'text-purple-600',
      definition: 'You did not know the required formula, theorem, or foundational logic to solve this problem.',
      action: 'Do not just re-solve. Open the formula sheet or theory notes, write the core rule down, and solve 3 similar textbook variations.',
      triggerCriteria: 'Blank mind on seeing the question, wrong formula applied, or guessed theorem.'
    },
    {
      tag: 'S',
      code: '[S] Silly Mistake',
      title: 'Calculation Slip / Misread',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: AlertTriangle,
      iconColor: 'text-rose-600',
      definition: 'You knew the concept and approach, but made an arithmetic slip, misread the question requirement (e.g., diameter vs radius, ratio order), or clicked the wrong option.',
      action: 'Flag your scratchpad habit. Write the final ask clearly with unit at the top of your rough sheet before starting calculations.',
      triggerCriteria: 'Arithmetic error (+, -, ×, ÷), misread numbers/units, or rushed selection.'
    },
    {
      tag: 'T',
      code: '[T] Time Trap',
      title: 'Time Pressure / Ego Trap',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Clock,
      iconColor: 'text-amber-600',
      definition: 'You spent over 90 seconds attempting this question and still got it wrong or ran out of time.',
      action: 'Strictly enforce the 45-second bailout rule: If no clear calculation path appears within 45s, skip immediately and bookmark for Round 2.',
      triggerCriteria: 'Time spent > 90 seconds resulting in incorrect or skipped answer.'
    },
    {
      tag: 'G',
      code: '[G] Guesswork',
      title: 'Unverified Elimination / Guess',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: HelpCircle,
      iconColor: 'text-sky-600',
      definition: 'You were not sure of the exact mathematical solution and gambled based on intuition or a 50-50 elimination.',
      action: 'Elimination without mathematical verification is a net negative in SSC CGL. Guess only if you can eliminate at least 2 options with 100% certainty.',
      triggerCriteria: 'Pure intuition guess or partial elimination gamble.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Root Cause Analysis (RCA) Framework</h3>
              <p className="text-xs text-slate-500 font-medium">Cognitive tagging standards for mock error remediation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-indigo-950 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Why Tag Mistakes?</strong> Simply reviewing solutions produces an illusion of competence. Categorizing mistakes reveals your cognitive failure patterns (e.g. calculation drift under time pressure vs genuine formula gaps).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {rules.map(rule => {
              const Icon = rule.icon;
              return (
                <div
                  key={rule.tag}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${rule.badgeClass}`}>
                      <Icon className={`w-3 h-3 ${rule.iconColor}`} />
                      {rule.code}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700">{rule.title}</span>
                  </div>
                  <p className="text-slate-600 leading-snug">{rule.definition}</p>
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-baseline gap-1 text-[11px]">
                    <span className="font-semibold text-indigo-600 shrink-0">Remediation Action:</span>
                    <span className="text-slate-500">{rule.action}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            Got it, Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
