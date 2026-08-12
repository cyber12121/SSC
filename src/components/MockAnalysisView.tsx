import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, Plus, Trash2, TrendingUp, Award, Layers } from 'lucide-react';
import { MockRecord } from '../types';

interface MockAnalysisViewProps {
  mocks: MockRecord[];
  onAdd: (mock: Omit<MockRecord, 'id' | 'userId' | 'createdAt'>) => void;
  onDelete: (id: string) => void;
  user: unknown;
  onLogin: () => void;
}

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

const PERCENTILE_COLORS = (p: number) =>
  p >= 99 ? 'from-emerald-500 to-green-600' :
  p >= 90 ? 'from-blue-500 to-indigo-600' :
  p >= 75 ? 'from-violet-500 to-purple-600' :
  'from-slate-400 to-slate-500';

export const MockAnalysisView: React.FC<MockAnalysisViewProps> = ({ mocks, onAdd, onDelete, user, onLogin }) => {
  const [mockName, setMockName] = useState('');
  const [marks, setMarks] = useState<number | ''>('');
  const [percentile, setPercentile] = useState<number | ''>('');
  const [activeTab, setActiveTab] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-slate-800 mb-2">Mock Analysis</h2>
        <p className="text-slate-500 mb-6">Login to track your mock marks and percentile.</p>
        <button onClick={onLogin} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
          Login with Google
        </button>
      </div>
    );
  }

  const totalMocks = mocks.length;
  const avgPercentile = totalMocks ? Math.round(mocks.reduce((a, m) => a + (m.percentile || 0), 0) / totalMocks) : 0;
  const highestMarks = mocks.reduce((max, m) => Math.max(max, m.marks || 0), 0);

  const handleAdd = () => {
    if (!mockName.trim() || marks === '' || percentile === '') return;
    onAdd({
      mockName: mockName.trim(),
      marks: Number(marks),
      percentile: Number(percentile)
    });
    setMockName('');
    setMarks('');
    setPercentile('');
  };

  const sorted = [...mocks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const active = sorted.find(m => m.id === activeTab) || sorted[0] || null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-900 mb-2">Mock Analysis</h1>
        <p className="text-slate-500">Track your marks and percentile for every SSC CGL mock.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Layers className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalMocks}</div>
            <div className="text-sm text-slate-500 font-medium">Mocks taken</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{avgPercentile}%</div>
            <div className="text-sm text-slate-500 font-medium">Avg percentile</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <Award className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{highestMarks}</div>
            <div className="text-sm text-slate-500 font-medium">Highest marks</div>
          </div>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-8">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" /> Add a mock
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            placeholder="Mock name"
            value={mockName}
            onChange={e => setMockName(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <input
            type="number"
            placeholder="Marks"
            value={marks}
            onChange={e => setMarks(e.target.value === '' ? '' : Number(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <input
            type="number"
            placeholder="Percentile"
            value={percentile}
            onChange={e => setPercentile(e.target.value === '' ? '' : Number(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={handleAdd}
            disabled={!mockName.trim() || marks === '' || percentile === ''}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-400 font-medium">No mocks added yet. Add your first mock above.</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Tabs - one per mock */}
          <div className="flex gap-2 overflow-x-auto p-3 border-b border-slate-100 bg-slate-50">
            {sorted.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id || null)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  active?.id === m.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                }`}
              >
                {m.mockName}
              </button>
            ))}
          </div>

          {active && (
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{active.mockName}</h3>
                  <p className="text-sm text-slate-400">{fmtDate(active.createdAt)}</p>
                </div>
                <button
                  onClick={() => onDelete(active.id!)}
                  className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                  title="Delete mock"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className={`rounded-2xl bg-gradient-to-br ${PERCENTILE_COLORS(active.percentile)} p-6 text-white`}>
                  <div className="text-sm font-medium opacity-80">Percentile</div>
                  <div className="text-5xl font-black mt-1">{active.percentile}%</div>
                </div>
                <div className="rounded-2xl bg-slate-900 p-6 text-white flex flex-col justify-center">
                  <div className="text-sm font-medium text-slate-400">Marks</div>
                  <div className="text-5xl font-black mt-1">{active.marks}</div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
