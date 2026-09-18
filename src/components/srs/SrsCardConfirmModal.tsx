import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Sparkles, BookOpen, AlertCircle, Edit3, Trash2, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { SRSCard } from '../../types/srs';
import { matchesSubject } from '../../utils/srsEngine';

interface SrsCardConfirmModalProps {
  isOpen: boolean;
  cards: Array<Partial<SRSCard>>;
  title?: string;
  description?: string;
  sourceLabel?: string;
  onConfirm: (confirmedCards: Array<Partial<SRSCard>>) => void;
  onCancel: () => void;
}

export const SrsCardConfirmModal: React.FC<SrsCardConfirmModalProps> = ({
  isOpen,
  cards: initialCards,
  title = "Review & Confirm Anki Cards",
  description = "Inspect the cards below before adding them to your Spaced Repetition queue. You can modify text or uncheck any cards you don't want.",
  sourceLabel,
  onConfirm,
  onCancel
}) => {
  const [editableCards, setEditableCards] = useState<Array<Partial<SRSCard>>>(initialCards);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set(initialCards.map((_, i) => i)));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Sync state if initialCards change
  React.useEffect(() => {
    setEditableCards(initialCards);
    setSelectedIndices(new Set(initialCards.map((_, i) => i)));
  }, [initialCards]);

  if (!isOpen || initialCards.length === 0) return null;

  const toggleSelectAll = () => {
    if (selectedIndices.size === editableCards.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(editableCards.map((_, i) => i)));
    }
  };

  const toggleSelect = (idx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleFieldChange = (idx: number, field: keyof SRSCard, value: any) => {
    setEditableCards(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleRemoveCard = (idx: number) => {
    setEditableCards(prev => prev.filter((_, i) => i !== idx));
    const nextSelected = new Set<number>();
    selectedIndices.forEach(i => {
      if (i < idx) nextSelected.add(i);
      else if (i > idx) nextSelected.add(i - 1);
    });
    setSelectedIndices(nextSelected);
  };

  const handleConfirmSubmit = () => {
    const confirmed = editableCards.filter((_, idx) => selectedIndices.has(idx));
    onConfirm(confirmed);
  };

  const selectedCount = selectedIndices.size;

  const getSubjectColor = (subject: string = '') => {
    if (matchesSubject(subject, 'english')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (matchesSubject(subject, 'gk')) return 'bg-sky-100 text-sky-800 border-sky-300';
    if (matchesSubject(subject, 'mathematics')) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (matchesSubject(subject, 'reasoning')) return 'bg-purple-100 text-purple-800 border-purple-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/40 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-slate-900">{title}</h3>
                {sourceLabel && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                    {sourceLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar (Select all toggle + counter) */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <button
            onClick={toggleSelectAll}
            className="flex items-center space-x-2 font-bold text-slate-700 hover:text-indigo-600 transition-colors"
          >
            {selectedIndices.size === editableCards.length ? (
              <CheckSquare className="w-4 h-4 text-indigo-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Select All ({editableCards.length})</span>
          </button>
          <span className="font-semibold text-slate-700">
            Selected: <strong className="text-indigo-600 font-bold">{selectedCount}</strong> of {editableCards.length}
          </span>
        </div>

        {/* Cards Scroll List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 divide-y divide-slate-100">
          {editableCards.map((card, idx) => {
            const isSelected = selectedIndices.has(idx);
            const isEditing = editingIndex === idx;

            return (
              <div
                key={idx}
                className={`pt-4 first:pt-0 transition-all rounded-xl p-4 border ${
                  isSelected ? 'bg-white border-slate-300 shadow-xs' : 'bg-slate-100/60 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center space-x-2.5">
                    <button
                      onClick={() => toggleSelect(idx)}
                      className="text-indigo-600 hover:scale-110 transition-transform"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    <span className="font-bold text-xs text-slate-500">#{idx + 1}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getSubjectColor(card.subject)}`}>
                      {card.subject || 'General'}
                    </span>
                    {card.topic && (
                      <span className="text-[11px] font-medium text-slate-500 truncate max-w-[200px]">
                        • {card.topic}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setEditingIndex(isEditing ? null : idx)}
                      className={`p-1 rounded text-xs transition-colors ${
                        isEditing ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-700'
                      }`}
                      title={isEditing ? "Done Editing" : "Edit Card"}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveCard(idx)}
                      className="p-1 rounded text-xs text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete from list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                {isEditing ? (
                  <div className="space-y-3 text-xs mt-3 bg-indigo-50/40 p-3 rounded-lg border border-indigo-100">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Front (Prompt / Word / Question):</label>
                      <textarea
                        value={card.front || ''}
                        onChange={e => handleFieldChange(idx, 'front', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs font-sans focus:ring-2 focus:ring-indigo-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Back (Answer / Explanation):</label>
                      <textarea
                        value={card.back || ''}
                        onChange={e => handleFieldChange(idx, 'back', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs font-sans focus:ring-2 focus:ring-indigo-500"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="font-bold text-amber-800 block mb-1">💡 Mnemonic or ⚡ Shortcut Formula (Optional):</label>
                      <input
                        type="text"
                        value={card.mnemonic || card.shortcutFormula || ''}
                        onChange={e => {
                          const val = e.target.value;
                          handleFieldChange(idx, card.subject === 'Mathematics' || card.subject === 'Reasoning' ? 'shortcutFormula' : 'mnemonic', val);
                        }}
                        className="w-full p-2 border border-amber-300 rounded-lg text-xs bg-amber-50/50"
                        placeholder="e.g. Memory trick or shortcut formula"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-800">Front: </span>
                      <span className="text-slate-700 font-medium">{card.front}</span>
                    </div>
                    <div>
                      <span className="font-bold text-emerald-800">Back: </span>
                      <span className="text-slate-600 whitespace-pre-line">{card.back}</span>
                    </div>
                    {(card.mnemonic || card.shortcutFormula) && (
                      <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/80 text-amber-900 font-medium flex items-start space-x-1.5 text-[11px]">
                        <span>{card.shortcutFormula ? '⚡' : '💡'}</span>
                        <span>{card.shortcutFormula || card.mnemonic}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSubmit}
            disabled={selectedCount === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center space-x-1.5 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Confirm & Add {selectedCount} {selectedCount === 1 ? 'Card' : 'Cards'} to SRS</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
