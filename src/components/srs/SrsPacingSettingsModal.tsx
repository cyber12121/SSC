import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ShieldCheck, Zap, Calendar, Heart } from 'lucide-react';
import { SRSSettings, SRSCard } from '../../types/srs';
import { getSRSSettings, saveSRSSettings, triageOverdueBacklog, getOverdueCardsCount } from '../../utils/srsEngine';

interface SrsPacingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: SRSCard[];
  onCardsUpdated: (updatedCards: SRSCard[]) => void;
}

export const SrsPacingSettingsModal: React.FC<SrsPacingSettingsModalProps> = ({
  isOpen,
  onClose,
  cards,
  onCardsUpdated
}) => {
  const [settings, setSettings] = useState<SRSSettings>(getSRSSettings());
  const [triageFeedback, setTriageFeedback] = useState<string | null>(null);

  const overdueCount = getOverdueCardsCount(cards);

  const handleSave = () => {
    saveSRSSettings(settings);
    onClose();
  };

  const handleTriageBacklog = (days: number = 5) => {
    const updated = triageOverdueBacklog(cards, days);
    onCardsUpdated(updated);
    setTriageFeedback(`🏖️ Done! Rescheduled ${overdueCount} overdue cards smoothly across the next ${days} days.`);
    setTimeout(() => setTriageFeedback(null), 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Study Pacing & Burnout Protection</h2>
              <p className="text-xs text-indigo-200">Keep daily cognitive load manageable and stress-free</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Overdue Backlog Triage Banner */}
          <div className={`p-4 rounded-2xl border ${overdueCount > 0 ? 'bg-amber-50/80 border-amber-200' : 'bg-emerald-50/80 border-emerald-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start space-x-2.5">
                <Calendar className={`w-5 h-5 shrink-0 mt-0.5 ${overdueCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                <div>
                  <h4 className={`text-xs font-black uppercase tracking-wider ${overdueCount > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
                    Backlog Health Status
                  </h4>
                  <p className="text-xs font-medium text-slate-600 mt-0.5 leading-relaxed">
                    {overdueCount > 0
                      ? `You have ${overdueCount} overdue cards from missed study days.`
                      : 'Zero overdue backlog! Your review schedule is completely on track.'}
                  </p>
                </div>
              </div>
            </div>

            {overdueCount > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-200/70 flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-semibold text-amber-900">Spread overdue cards smoothly:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleTriageBacklog(3)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriageBacklog(5)}
                    className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    5 Days (Best)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriageBacklog(7)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    7 Days
                  </button>
                </div>
              </div>
            )}

            {triageFeedback && (
              <div className="mt-2 text-xs font-bold text-emerald-700 bg-emerald-100 p-2 rounded-xl">
                {triageFeedback}
              </div>
            )}
          </div>

          {/* Setting 1: Daily Review Cap */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Daily Review Intake Cap</span>
              </label>
              <span className="text-xs font-bold text-indigo-700">
                {settings.dailyReviewCap === 0 || settings.dailyReviewCap >= 9999 ? 'Unlimited' : `${settings.dailyReviewCap} Cards / Day`}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Caps how many due cards load into your primary daily review session so you never face a terrifying wall.
            </p>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[
                { val: 15, label: '15 Cards', hint: 'Light' },
                { val: 30, label: '30 Cards', hint: 'Recommended' },
                { val: 50, label: '50 Cards', hint: 'Intense' },
                { val: 9999, label: 'Unlimited', hint: 'All Due' }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, dailyReviewCap: opt.val }))}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    settings.dailyReviewCap === opt.val
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-black shadow-xs ring-1 ring-indigo-600'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 font-medium'
                  }`}
                >
                  <div className="text-xs font-black">{opt.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Setting 2: Micro-Sprint Batch Size */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>Micro-Sprint Batch Size</span>
              </label>
              <span className="text-xs font-bold text-rose-700">
                {settings.sprintBatchSize} Cards per round
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Splits long review queues into bite-sized sprints with an optional 1-minute breathing & rest checkpoint.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { val: 5, label: '5 Cards', hint: 'Gentle Pacing' },
                { val: 10, label: '10 Cards', hint: 'Balanced Sprint' },
                { val: 15, label: '15 Cards', hint: 'Longer Rounds' }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, sprintBatchSize: opt.val }))}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    settings.sprintBatchSize === opt.val
                      ? 'border-rose-500 bg-rose-50/70 text-rose-950 font-black shadow-xs ring-1 ring-rose-500'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 font-medium'
                  }`}
                >
                  <div className="text-xs font-black">{opt.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Setting 3: Leech Card Protection */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <span className="text-xs font-black text-slate-900 block">
                Leech Card Cooling-Off Protection
              </span>
              <p className="text-[11px] text-slate-500 leading-snug">
                Suggests a 48h cool-off pause when a card is failed 4+ times so you don't hit a wall.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings(s => ({ ...s, autoCoolOffLeeches: !s.autoCoolOffLeeches }))}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                settings.autoCoolOffLeeches ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Setting 4: Zen Mode Default */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <span className="text-xs font-black text-slate-900 block">
                🧘 Zen Focus Mode Default
              </span>
              <p className="text-[11px] text-slate-500 leading-snug">
                Hides progress bars, counts, and stats during reviews for zero performance anxiety.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings(s => ({ ...s, zenModeDefault: !s.zenModeDefault }))}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                settings.zenModeDefault ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-200 transition-all cursor-pointer"
          >
            Save Pacing Preferences
          </button>
        </div>
      </motion.div>
    </div>
  );
};
