import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Plus, Trash2, AlertTriangle, Clock, GitBranch, Zap } from 'lucide-react';
import { MockMistake, MistakeCategory } from '../types';

interface MockMistakesViewProps {
  mistakes: MockMistake[];
  onAdd: (mistake: Omit<MockMistake, 'id' | 'userId' | 'createdAt'>) => void;
  onDelete: (id: string) => void;
  user: unknown;
  onLogin: () => void;
}

const SUBJECTS = ['Mathematics', 'Reasoning', 'English', 'GK/GS', 'Other'];

const CATEGORIES: { key: MistakeCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'concept-gap', label: 'Concept Gap', icon: <AlertTriangle className="w-4 h-4" />, color: 'border-red-200 bg-red-50' },
  { key: 'time-speed', label: 'Time / Speed Issue', icon: <Clock className="w-4 h-4" />, color: 'border-amber-200 bg-amber-50' },
  { key: 'decision-gap', label: 'Decision Gap', icon: <GitBranch className="w-4 h-4" />, color: 'border-violet-200 bg-violet-50' },
  { key: 'careless', label: 'Careless Mistake', icon: <Zap className="w-4 h-4" />, color: 'border-emerald-200 bg-emerald-50' },
];

export const MockMistakesView: React.FC<MockMistakesViewProps> = ({ mistakes, onAdd, onDelete, user, onLogin }) => {
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-slate-800 mb-2">Mock Mistakes</h2>
        <p className="text-slate-500 mb-6">Login to log your mistakes by subject and category.</p>
        <button onClick={onLogin} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
          Login with Google
        </button>
      </div>
    );
  }

  const handleAdd = (subject: string, category: MistakeCategory) => {
    const key = `${subject}|${category}`;
    const note = notes[key]?.trim();
    if (!note) return;
    onAdd({ subject, category, note });
    setNotes(prev => ({ ...prev, [key]: '' }));
  };

  const mistakesFor = (subject: string, category: MistakeCategory) =>
    mistakes.filter(m => m.subject === subject && m.category === category);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-900 mb-2">Mock Mistakes</h1>
        <p className="text-slate-500">Classify each mistake by subject and the four categories.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {SUBJECTS.map(subject => (
          <div key={subject} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-black text-slate-900">{subject}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
              {CATEGORIES.map(cat => {
                const items = mistakesFor(subject, cat.key);
                const key = `${subject}|${cat.key}`;
                return (
                  <div key={cat.key} className={`rounded-xl border p-3 ${cat.color}`}>
                    <div className="flex items-center gap-2 font-bold text-slate-800 mb-2">
                      {cat.icon}
                      <span className="text-sm">{cat.label}</span>
                    </div>
                    <div className="space-y-1.5 mb-2 max-h-40 overflow-y-auto">
                      <AnimatePresence initial={false}>
                        {items.map(item => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="group flex items-start gap-2 bg-white/70 rounded-lg px-2 py-1.5"
                          >
                            <span className="text-xs text-slate-700 flex-1">{item.note}</span>
                            <button
                              onClick={() => item.id && onDelete(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {items.length === 0 && (
                        <div className="text-xs text-slate-400 italic px-1">No mistakes yet</div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        value={notes[key] || ''}
                        onChange={e => setNotes(prev => ({ ...prev, [key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(subject, cat.key); }}
                        placeholder="Add mistake..."
                        className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <button
                        onClick={() => handleAdd(subject, cat.key)}
                        className="px-2 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                        title="Add"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
