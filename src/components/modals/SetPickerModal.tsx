import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Flame } from 'lucide-react';
import { Question, Chapter } from '../../types';

export interface SetPickerModalData {
  title: string;
  subtitle?: string;
  subject: string;
  questions: Question[];
}

interface SetPickerModalProps {
  modalData: SetPickerModalData | null;
  onClose: () => void;
  onStartQuiz: (chapter: Chapter) => void;
}

export const SetPickerModal: React.FC<SetPickerModalProps> = ({
  modalData,
  onClose,
  onStartQuiz
}) => {
  if (!modalData) return null;

  const totalSets = Math.ceil(modalData.questions.length / 25);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-md inline-block">
                {modalData.subject}
              </span>
              <h3 className="text-lg font-black mt-1.5 leading-snug">{modalData.title}</h3>
              <p className="text-xs text-indigo-100 mt-0.5">
                {modalData.subtitle || `${modalData.questions.length} questions available`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sets List */}
          <div className="p-6 space-y-3 overflow-y-auto flex-1">
            <p className="text-xs text-slate-500 font-medium mb-1">
              Choose a 25-question set to drill under focused exam conditions:
            </p>

            {Array.from({ length: totalSets }).map((_, idx) => {
              const setNum = idx + 1;
              const startQ = idx * 25 + 1;
              const endQ = Math.min((idx + 1) * 25, modalData.questions.length);
              const count = endQ - startQ + 1;

              return (
                <div
                  key={setNum}
                  onClick={() => {
                    onClose();
                    const SET_SIZE = 25;
                    const startIdx = (setNum - 1) * SET_SIZE;
                    const endIdx = Math.min(startIdx + SET_SIZE, modalData.questions.length);
                    const targetQuestions = modalData.questions.slice(startIdx, endIdx);
                    const virtualChapter: Chapter = {
                      chapter_num: setNum,
                      chapter_title: `${modalData.title} • Set ${setNum} (Q${startQ}-${endQ})`,
                      subject: modalData.subject,
                      subject_id: modalData.subject.toLowerCase().replace(/\s+/g, '_'),
                      questions: targetQuestions.map((q, qIdx) => ({ ...q, q_num: qIdx + 1 }))
                    };
                    onStartQuiz(virtualChapter);
                  }}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white font-black text-xs flex items-center justify-center transition-colors">
                      #{setNum}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                        Set {setNum}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Questions {startQ} – {endQ} ({count} questions)
                      </span>
                    </div>
                  </div>
                  <button className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer">
                    <Play className="w-3 h-3 fill-current" />
                    Start Set {setNum}
                  </button>
                </div>
              );
            })}

            {/* Practice All Option */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  onClose();
                  const virtualChapter: Chapter = {
                    chapter_num: 0,
                    chapter_title: modalData.title,
                    subject: modalData.subject,
                    subject_id: modalData.subject.toLowerCase().replace(/\s+/g, '_'),
                    questions: modalData.questions.map((q, qIdx) => ({ ...q, q_num: qIdx + 1 }))
                  };
                  onStartQuiz(virtualChapter);
                }}
                className="w-full py-2.5 rounded-2xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Flame className="w-4 h-4 text-indigo-600" />
                Practice All {modalData.questions.length} Questions Together
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SetPickerModal;
