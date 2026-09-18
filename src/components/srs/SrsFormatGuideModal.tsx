import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, FileText, FileSpreadsheet, Code, Sparkles, Info, HelpCircle } from 'lucide-react';

interface SrsFormatGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SrsFormatGuideModal: React.FC<SrsFormatGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'csv' | 'json'>('text');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const textSample = `Ephemeral ; Lasting for a very short time ; Root: Epi + hemera (day)
Ubiquitous ; Present everywhere simultaneously ; Sounds like "you-be-everywhere"
Battle of Plassey ; 1757 AD ; Robert Clive defeated Siraj-ud-Daulah
Article 32 of Indian Constitution ; Right to Constitutional Remedies ; Heart and soul of Constitution (Dr. Ambedkar)
Area of Equilateral Triangle ; (√3 / 4) * a² ; Height is (√3 / 2) * a`;

  const csvSample = `"Front","Back","Mnemonic/Trick","Subject","Topic"
"Who founded the Maurya Empire?","Chandragupta Maurya with Chanakya's guidance","Chanakya guided Chandra","General Awareness","Ancient History"
"Pugnacious","Eager or quick to argue","Think pug dog ready to fight","English","Vocabulary"
"Sum of first n natural numbers","n(n+1)/2","Average is (n+1)/2","Mathematics","Number System"
"Mirror image of CLOCK at 8:20","3:40","Subtract from 11:60 -> 11:60 - 8:20 = 3:40","Reasoning","Clock & Calendar"`;

  const jsonSample = `[
  {
    "front": "Which Article of the Constitution abolishes Untouchability?",
    "back": "Article 17. It is an absolute Fundamental Right under Right to Equality.",
    "mnemonic": "Article 1+7 = 8, sounds like 'Hatao' untouchability",
    "subject": "General Awareness",
    "topic": "Indian Polity"
  },
  {
    "front": "Cacophony",
    "back": "A harsh, discordant mixture of sounds (e.g. traffic noise)",
    "mnemonic": "Caco (bad) + phon (sound)",
    "subject": "English",
    "topic": "Vocabulary"
  }
]`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-purple-50 to-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Supported Deck Upload Formats</h3>
              <p className="text-xs text-slate-500 font-medium">How to import your flashcards via normal paste, CSV, or JSON</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'text'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Normal Text (Paste)</span>
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'csv'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>2. Anki CSV / TSV</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'json'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>3. JSON Deck File</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-indigo-950 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-xs text-indigo-900">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Format Structure (1 card per line)</span>
                </div>
                <code className="block p-2 bg-white/90 rounded-lg text-indigo-800 font-mono text-[11px] font-bold border border-indigo-200/60">
                  Front (Question / Word) ; Back (Answer / Solution) ; Mnemonic Trick (Optional)
                </code>
                <p className="text-[11px] text-indigo-700 leading-relaxed pt-1">
                  Separate the front and back sides using a <strong>semicolon (;)</strong>, <strong>tab (\t)</strong>, or <strong>pipe (|)</strong>. You can paste 50+ cards at once into the <em>Bulk Paste</em> box.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 font-bold text-xs">
                  <span>Example Input:</span>
                  <button
                    onClick={() => handleCopy(textSample, 'text')}
                    className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-bold text-[11px] cursor-pointer"
                  >
                    {copiedTab === 'text' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTab === 'text' ? 'Copied!' : 'Copy Example'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {textSample}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'csv' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-emerald-950 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-xs text-emerald-900">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Anki Desktop & Excel CSV Format</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Export directly from <strong>Anki Desktop</strong> (as Notes in Plain Text) or from <strong>Excel / Google Sheets</strong> as <code>.csv</code> or <code>.tsv</code>.
                </p>
                <div className="text-[11px] text-emerald-700 font-medium">
                  Expected Column Order: <code>Front, Back, Mnemonic, Subject, Topic</code>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 font-bold text-xs">
                  <span>Example CSV Content:</span>
                  <button
                    onClick={() => handleCopy(csvSample, 'csv')}
                    className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-800 font-bold text-[11px] cursor-pointer"
                  >
                    {copiedTab === 'csv' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTab === 'csv' ? 'Copied!' : 'Copy Example'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {csvSample}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl text-purple-950 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-xs text-purple-900">
                  <Code className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Structured JSON Deck Backup</span>
                </div>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  Best for full lossless deck backups created with the <strong>Export JSON Backup</strong> button. Uploading any <code>.json</code> backup file restores all cards and their metadata.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 font-bold text-xs">
                  <span>Example JSON Schema:</span>
                  <button
                    onClick={() => handleCopy(jsonSample, 'json')}
                    className="flex items-center space-x-1 text-purple-600 hover:text-purple-800 font-bold text-[11px] cursor-pointer"
                  >
                    {copiedTab === 'json' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTab === 'json' ? 'Copied!' : 'Copy Example'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-purple-300 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {jsonSample}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">All uploads pass through a Safety Preview before saving.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </motion.div>
    </div>
  );
};
