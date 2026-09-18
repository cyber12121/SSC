import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  PlusCircle, X, Check, BookOpen, Lightbulb, Zap, HelpCircle,
  Layers, FileText, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Info
} from 'lucide-react';
import { SRSCard, SRSContentType } from '../../types/srs';
import { SrsFormatGuideModal } from './SrsFormatGuideModal';

interface SrsManualCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cardData: Partial<SRSCard>) => void;
  onSaveBatch?: (cards: Array<Partial<SRSCard>>) => void;
  initialCard?: SRSCard | null;
}

export const SrsManualCardModal: React.FC<SrsManualCardModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveBatch,
  initialCard
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // Single card form state
  const [subject, setSubject] = useState<string>('English');
  const [topic, setTopic] = useState<string>('');
  const [front, setFront] = useState<string>('');
  const [back, setBack] = useState<string>('');
  const [mnemonicOrTrick, setMnemonicOrTrick] = useState<string>('');
  const [conceptTested, setConceptTested] = useState<string>('');

  // Bulk import state
  const [bulkSubject, setBulkSubject] = useState<string>('English');
  const [bulkTopic, setBulkTopic] = useState<string>('');
  const [bulkText, setBulkText] = useState<string>('');
  const [delimiter, setDelimiter] = useState<';' | '\t' | '|' | ',' | 'auto'>('auto');
  const [formatGuideOpen, setFormatGuideOpen] = useState(false);

  useEffect(() => {
    if (initialCard) {
      setActiveTab('single');
      setSubject(initialCard.subject || 'English');
      setTopic(initialCard.topic || '');
      setFront(initialCard.front || '');
      setBack(initialCard.back || '');
      setMnemonicOrTrick(initialCard.mnemonic || initialCard.shortcutFormula || '');
      setConceptTested(initialCard.conceptTested || '');
    } else {
      setSubject('English');
      setTopic('');
      setFront('');
      setBack('');
      setMnemonicOrTrick('');
      setConceptTested('');
    }
  }, [initialCard, isOpen]);

  // Parse bulk text into card candidates
  const parsedBulkCards = useMemo(() => {
    if (!bulkText.trim()) return [];

    const raw = bulkText.trim();

    // Check if JSON array
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({
            subject: item.subject || bulkSubject,
            type: (item.type || (bulkSubject.toLowerCase().includes('math') ? 'math' : bulkSubject.toLowerCase().includes('aware') ? 'gk' : bulkSubject.toLowerCase().includes('reason') ? 'reasoning' : 'vocab')) as SRSContentType,
            topic: item.topic || bulkTopic || 'General',
            front: String(item.front || item.question || item.word || '').trim(),
            back: String(item.back || item.answer || item.meaning || '').trim(),
            mnemonic: item.mnemonic || undefined,
            shortcutFormula: item.shortcutFormula || item.shortcut || undefined,
            conceptTested: item.conceptTested || undefined,
            source: 'manual' as const
          })).filter(c => c.front && c.back);
        }
      } catch {}
    }

    // Line-by-line parsing
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));
    const results: Array<Partial<SRSCard>> = [];

    const getSplitParts = (line: string): string[] => {
      if (delimiter !== 'auto') {
        return line.split(delimiter).map(p => p.trim());
      }
      // Auto detect delimiter
      if (line.includes('\t')) return line.split('\t').map(p => p.trim());
      if (line.includes(';')) return line.split(';').map(p => p.trim());
      if (line.includes('|')) return line.split('|').map(p => p.trim());
      if (line.includes(',')) return line.split(',').map(p => p.trim());
      return [line];
    };

    let cardType: SRSContentType = 'vocab';
    if (bulkSubject.toLowerCase().includes('aware') || bulkSubject.toLowerCase().includes('gk')) cardType = 'gk';
    else if (bulkSubject.toLowerCase().includes('math')) cardType = 'math';
    else if (bulkSubject.toLowerCase().includes('reason')) cardType = 'reasoning';

    lines.forEach((line) => {
      const parts = getSplitParts(line);
      if (parts.length >= 2) {
        const frontText = parts[0];
        const backText = parts[1];
        const extraMnemonic = parts[2] || undefined;
        const extraConcept = parts[3] || undefined;

        if (frontText && backText) {
          const isMathOrReason = cardType === 'math' || cardType === 'reasoning';
          results.push({
            subject: bulkSubject,
            type: cardType,
            topic: bulkTopic.trim() || (cardType === 'vocab' ? 'Vocabulary' : bulkSubject),
            front: frontText,
            back: backText,
            mnemonic: !isMathOrReason && extraMnemonic ? extraMnemonic : undefined,
            shortcutFormula: isMathOrReason && extraMnemonic ? extraMnemonic : undefined,
            conceptTested: extraConcept,
            source: 'manual'
          });
        }
      }
    });

    return results;
  }, [bulkText, delimiter, bulkSubject, bulkTopic]);

  if (!isOpen) return null;

  // Submit single card
  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    let type: SRSContentType = 'vocab';
    if (subject.toLowerCase().includes('aware') || subject.toLowerCase().includes('gk')) type = 'gk';
    else if (subject.toLowerCase().includes('math')) type = 'math';
    else if (subject.toLowerCase().includes('reason')) type = 'reasoning';

    const isMathOrReasoning = type === 'math' || type === 'reasoning';

    const cardPayload: Partial<SRSCard> = {
      ...(initialCard || {}),
      subject,
      type,
      topic: topic.trim() || (type === 'vocab' ? 'Vocabulary' : subject),
      front: front.trim(),
      back: back.trim(),
      mnemonic: !isMathOrReasoning && mnemonicOrTrick.trim() ? mnemonicOrTrick.trim() : undefined,
      shortcutFormula: isMathOrReasoning && mnemonicOrTrick.trim() ? mnemonicOrTrick.trim() : undefined,
      conceptTested: conceptTested.trim() || undefined,
      source: initialCard?.source || 'manual'
    };

    onSave(cardPayload);
    onClose();
  };

  // Submit bulk cards
  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedBulkCards.length === 0) return;

    if (onSaveBatch) {
      onSaveBatch(parsedBulkCards);
    } else {
      parsedBulkCards.forEach(c => onSave(c));
    }
    onClose();
  };

  const handleLoadSampleTemplate = () => {
    if (bulkSubject === 'English') {
      setBulkText(
`Ephemeral ; Lasting for a very short time ; Think: Fleeting like an ephemeral whisper
Pugnacious ; Eager or quick to argue ; Think: A pug dog ready to fight
Loquacious ; Tending to talk a great deal ; Root 'loqu' means to speak
Nefarious ; Wicked, villainous, or criminal ; Associates with sinister actions`
      );
      setBulkTopic('Vocabulary Roots');
    } else if (bulkSubject === 'General Awareness') {
      setBulkText(
`Kathakali Dance Origin ; Kerala ; Classical dance drama with elaborate colorful makeup
Brihadisvara Temple Location ; Thanjavur, Tamil Nadu ; Built by Raja Raja Chola I
Article 32 of Indian Constitution ; Right to Constitutional Remedies ; Heart and Soul of Constitution (Ambedkar)
Hornbill Festival State ; Nagaland ; Celebrated every year in early December`
      );
      setBulkTopic('Static GK Facts');
    } else if (bulkSubject === 'Mathematics') {
      setBulkText(
`Pythagorean Triplet with 7 ; 7, 24, 25 ; Formula: 7^2 + 24^2 = 25^2 (49 + 576 = 625)
Sum of first N natural numbers ; N(N + 1) / 2 ; Arithmetic series formula
Discount Equivalent of 20% and 10% ; 28% ; Shortcut: a + b - (ab/100) = 20 + 10 - 2 = 28%
Volume of Cone ; (1/3) * π * r^2 * h ; Exactly one-third of cylinder volume`
      );
      setBulkTopic('Formula Vault');
    } else {
      setBulkText(
`Opposite face in Standard Dice ; Sum of opposite faces is always 7 ; Top 1 -> Bottom 6, Front 2 -> Back 5
Alphabet Position of T ; 20 ; T20 Cricket mnemonic
Order & Ranking Total Formula ; Total = Left + Right - 1 ; Subtract 1 to avoid double counting the person
Mirror Image of B ; Reverses horizontally (curves face left) ; Vertical axis reflection`
      );
      setBulkTopic('Reasoning Tricks');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50/50 to-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                {initialCard ? 'Edit Anki Card' : 'Add Cards Manually'}
              </h3>
              <p className="text-xs text-slate-500">Add individual cards or paste multiple flashcards at once</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        {!initialCard && (
          <div className="px-6 pt-3 border-b border-slate-200 bg-slate-50/60 flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              className={`px-4 py-2 border-b-2 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === 'single'
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Single Card</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bulk')}
              className={`px-4 py-2 border-b-2 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === 'bulk'
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bulk Paste Multiple Cards</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-100 text-purple-700 font-black">
                Fast
              </span>
            </button>
          </div>
        )}

        {/* ── TAB 1: SINGLE CARD FORM ── */}
        {activeTab === 'single' && (
          <form onSubmit={handleSingleSubmit} className="p-6 space-y-4 text-xs">
            {/* Subject Pills */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Subject Domain:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'English Vocab', value: 'English' },
                  { label: 'General Knowledge', value: 'General Awareness' },
                  { label: 'Mathematics', value: 'Mathematics' },
                  { label: 'Reasoning', value: 'Reasoning' }
                ].map(sub => (
                  <button
                    key={sub.value}
                    type="button"
                    onClick={() => setSubject(sub.value)}
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      subject === sub.value
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic & Concept */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Topic Name (Optional):</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Synonyms, Classical Dance, Trigonometry..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Concept Tested (Optional):</label>
                <input
                  type="text"
                  value={conceptTested}
                  onChange={e => setConceptTested(e.target.value)}
                  placeholder="e.g. Root Word 'Mal', Article 32, Triplets..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                />
              </div>
            </div>

            {/* Front Prompt */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Front (Question, Word, or Problem Prompt): <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={front}
                onChange={e => setFront(e.target.value)}
                placeholder="What is asked on the front of the flashcard?"
                className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-900"
              />
            </div>

            {/* Back Answer */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Back (Answer, Meaning, or Step-by-Step Solution): <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={back}
                onChange={e => setBack(e.target.value)}
                placeholder="The correct solution, definition, or answer revealed on flip..."
                className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-900"
              />
            </div>

            {/* Mnemonic / Shortcut trick */}
            <div>
              <label className="font-bold text-amber-800 block mb-1 flex items-center space-x-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {subject === 'Mathematics' || subject === 'Reasoning'
                    ? 'Speed Shortcut / Rule Trick (Optional):'
                    : 'Golden Mnemonic Memory Hook (Optional):'}
                </span>
              </label>
              <input
                type="text"
                value={mnemonicOrTrick}
                onChange={e => setMnemonicOrTrick(e.target.value)}
                placeholder={
                  subject === 'Mathematics' || subject === 'Reasoning'
                    ? 'e.g. Shortcut: a + b - (ab/100)'
                    : 'e.g. Mnemonic: Link "Gregarious" with "Greyhound" playing in groups'
                }
                className="w-full p-2.5 border border-amber-200 bg-amber-50/40 rounded-xl focus:ring-2 focus:ring-amber-500 text-xs font-medium text-amber-950"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{initialCard ? 'Save Changes' : 'Add Card to Queue'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ── TAB 2: BULK IMPORT MULTIPLE CARDS ── */}
        {activeTab === 'bulk' && (
          <form onSubmit={handleBulkSubmit} className="p-6 space-y-4 text-xs">
            {/* Subject & Delimiter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Subject:</label>
                <select
                  value={bulkSubject}
                  onChange={e => setBulkSubject(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="English">English Vocab</option>
                  <option value="General Awareness">General Knowledge</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Reasoning">Reasoning</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Default Topic (Optional):</label>
                <input
                  type="text"
                  value={bulkTopic}
                  onChange={e => setBulkTopic(e.target.value)}
                  placeholder="e.g. Synonyms, Classical Dance..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Delimiter / Separator:</label>
                <select
                  value={delimiter}
                  onChange={e => setDelimiter(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="auto">Auto-Detect (Semicolon ; / Tab / Pipe |)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="&#9;">Tab (\t)</option>
                  <option value="|">Pipe (|)</option>
                  <option value=",">Comma (,)</option>
                </select>
              </div>
            </div>

            {/* Instruction Banner & Template Loader */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800 text-[11px]">
                    Format: <code>Front ; Back ; Mnemonic</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormatGuideOpen(true)}
                    className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center space-x-1 text-[10px] font-bold cursor-pointer"
                    title="View format instructions (Normal, CSV, JSON)"
                  >
                    <Info className="w-3 h-3 text-indigo-600" />
                    <span>Format Guide</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Paste 1 card per line. Supports standard Anki exports, TSV, and CSV.
                </span>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleTemplate}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold shrink-0 transition-colors cursor-pointer"
              >
                Load Sample Template
              </button>
            </div>

            {/* Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Paste Multiple Flashcards (1 per line):</label>
                <span className={`text-[11px] font-black ${parsedBulkCards.length > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {parsedBulkCards.length > 0 ? `✅ ${parsedBulkCards.length} cards detected` : 'No cards parsed yet'}
                </span>
              </div>
              <textarea
                rows={7}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={`Ephemeral ; Lasting for a very short time ; Think "Fleeting like an ephemeral whisper"\nPugnacious ; Eager or quick to argue ; Think "Pug dog ready to fight"\nCapital of Kazakhstan ; Astana ; Renamed from Nur-Sultan in 2022`}
                className="w-full p-3 font-mono text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 leading-relaxed"
              />
            </div>

            {/* Live Parsing Preview Snippet */}
            {parsedBulkCards.length > 0 && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5 max-h-36 overflow-y-auto">
                <div className="flex items-center justify-between text-[10px] font-bold text-emerald-900 uppercase">
                  <span>Detected Cards Preview ({parsedBulkCards.length} total):</span>
                  <span>Safety gate: will open in Confirmation Modal</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  {parsedBulkCards.slice(0, 3).map((c, i) => (
                    <div key={i} className="bg-white p-2 rounded-lg border border-emerald-200 flex items-start justify-between gap-2 shadow-2xs">
                      <div className="min-w-0">
                        <strong className="text-slate-900 truncate block">#{i + 1} {c.front}</strong>
                        <span className="text-slate-600 line-clamp-1">↳ {c.back}</span>
                      </div>
                      {(c.mnemonic || c.shortcutFormula) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0 font-medium truncate max-w-[150px]">
                          💡 {c.shortcutFormula || c.mnemonic}
                        </span>
                      )}
                    </div>
                  ))}
                  {parsedBulkCards.length > 3 && (
                    <p className="text-[10px] text-emerald-800 font-semibold text-center pt-0.5">
                      + {parsedBulkCards.length - 3} more cards ready to confirm
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>You can review & edit every card in the confirmation modal.</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={parsedBulkCards.length === 0}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Preview & Confirm ({parsedBulkCards.length} Cards)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        )}
      </motion.div>

      {/* Upload & Paste Format Guide Modal */}
      <SrsFormatGuideModal
        isOpen={formatGuideOpen}
        onClose={() => setFormatGuideOpen(false)}
      />
    </div>
  );
};
