import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Upload, FileText, Image as ImageIcon, X, Loader2, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { SRSCard } from '../../types/srs';

interface SrsAiCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCardsGenerated: (cards: Array<Partial<SRSCard>>) => void;
}

export const SrsAiCreatorModal: React.FC<SrsAiCreatorModalProps> = ({
  isOpen,
  onClose,
  onCardsGenerated
}) => {
  const [prompt, setPrompt] = useState('');
  const [textNotes, setTextNotes] = useState('');
  const [subject, setSubject] = useState('General Awareness');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File upload state (Image or PDF)
  const [fileData, setFileData] = useState<{ name: string; base64: string; mimeType: string; isPdf: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setError('Please upload an image (PNG, JPG, WebP) or a PDF document.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('File size exceeds 8MB limit. Please upload a smaller file or screenshot.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setFileData({
        name: file.name,
        base64,
        mimeType: file.type,
        isPdf
      });
    };
    reader.onerror = () => setError('Failed to read file. Please try another file.');
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const effectivePrompt = prompt.trim() || `Generate ${count} high-yield, top-repeated SSC CGL exam flashcards with key facts, concepts, and memory tricks for ${subject}.`;

    try {
      const payload: any = {
        subject,
        count,
        prompt: effectivePrompt,
        textNotes: textNotes.trim() || undefined
      };

      if (fileData) {
        if (fileData.isPdf) {
          payload.pdfData = { data: fileData.base64, mimeType: fileData.mimeType };
        } else {
          payload.imageData = { data: fileData.base64, mimeType: fileData.mimeType };
        }
      }

      const res = await fetch('/api/srs/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate cards with AI.');
      }

      const cards: Array<Partial<SRSCard>> = data.cards || [];
      if (cards.length === 0) {
        throw new Error('AI could not extract any cards from the provided input.');
      }

      onCardsGenerated(cards);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error communicating with AI service.');
    } finally {
      setLoading(false);
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
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">AI Anki Card Generator</h3>
              <p className="text-xs text-slate-500">Create exam flashcards from prompts, study notes, images, or PDFs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Subject & Card Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Target Subject:</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 font-medium"
              >
                <option value="English">English Vocabulary & Idioms</option>
                <option value="General Awareness">General Knowledge & Awareness</option>
                <option value="Mathematics">Mathematics & Quantitative Aptitude</option>
                <option value="Reasoning">Reasoning & Mental Ability</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">
                  Number of Cards: <strong className="text-purple-600 font-black">{count}</strong>
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">Max 50 cards</span>
              </div>
              <input
                type="range"
                min={3}
                max={50}
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="w-full mt-1 accent-purple-600 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 mt-2">
                {[5, 15, 30, 50].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCount(val)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                      count === val
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-700'
                    }`}
                  >
                    {val} Cards
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Topic or Prompt */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Topic Request or Instructions (Optional):</label>
            <input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. Indian National Congress sessions & presidents, or Most repeated idioms with animal themes"
              className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 font-medium"
            />
          </div>

          {/* Study Notes Textbox */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Paste Study Notes / Text (Optional):</label>
            <textarea
              rows={4}
              value={textNotes}
              onChange={e => setTextNotes(e.target.value)}
              placeholder="Paste any paragraphs from PDFs, summary sheets, formulas, or rules. AI will synthesize them into Anki cards..."
              className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 font-medium text-slate-800"
            />
          </div>

          {/* Image / PDF Upload Attachment */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Attach Image or PDF Document (Optional):</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            {fileData ? (
              <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 font-medium">
                <div className="flex items-center space-x-2 truncate">
                  {fileData.isPdf ? <FileText className="w-5 h-5 text-purple-600 shrink-0" /> : <ImageIcon className="w-5 h-5 text-purple-600 shrink-0" />}
                  <span className="truncate">{fileData.name}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full font-bold uppercase">
                    {fileData.isPdf ? 'PDF' : 'Image'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFileData(null)}
                  className="p-1 hover:bg-purple-200/50 rounded-lg text-purple-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 hover:border-purple-400 hover:bg-purple-50/40 rounded-xl p-3 flex items-center justify-center space-x-2 text-slate-500 hover:text-purple-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Question Screenshot, Diagram Photo, or PDF Notes</span>
              </button>
            )}
          </div>

          {/* Notice */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>You will be able to review, edit, and confirm all cards in the Confirmation Modal before anything is saved.</span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-200 flex items-center space-x-2 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Anki Cards...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Review & Generate ({count} Cards)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
