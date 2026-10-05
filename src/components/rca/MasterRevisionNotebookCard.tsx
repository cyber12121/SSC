import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Flame,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  StickyNote,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import {
  getAllRevisionNotes,
  saveRevisionNote,
  updateRevisionNote,
  deleteRevisionNote,
  getAllSillyNotebookItems,
  addSillyNotebookItem,
  updateSillyNotebookItem,
  deleteSillyNotebookItem,
  RevisionNoteItem,
  SillyNotebookItem,
  REVISION_NOTEBOOK_EVENT
} from '../../utils/revisionNotesHelper';
import { FormattedAiNote } from '../FormattedAiNote';

interface MasterRevisionNotebookCardProps {
  currentSubject?: string;
  defaultTab?: 'silly' | 'notes';
  onReviewQuestion?: (questionId: string) => void;
  className?: string;
  isStandalonePage?: boolean;
  onBack?: () => void;
}

export const MasterRevisionNotebookCard: React.FC<MasterRevisionNotebookCardProps> = ({
  currentSubject,
  defaultTab = 'silly',
  onReviewQuestion,
  className = '',
  isStandalonePage = false,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'silly' | 'notes'>(defaultTab);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Data states
  const [notes, setNotes] = useState<RevisionNoteItem[]>([]);
  const [sillyItems, setSillyItems] = useState<SillyNotebookItem[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [noteTypeFilter, setNoteTypeFilter] = useState<'all' | 'tommy' | 'user'>('all');

  // New item inputs
  const [newSillyText, setNewSillyText] = useState('');
  const [newSillySubject, setNewSillySubject] = useState(currentSubject || 'Mathematics');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteSubject, setNewNoteSubject] = useState(currentSubject || 'General');

  // Editing states
  const [editingSillyId, setEditingSillyId] = useState<string | null>(null);
  const [editSillyText, setEditSillyText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  // Reload data
  const reloadData = () => {
    setNotes(getAllRevisionNotes());
    setSillyItems(getAllSillyNotebookItems());
  };

  useEffect(() => {
    reloadData();
    const handleUpdate = () => reloadData();
    window.addEventListener(REVISION_NOTEBOOK_EVENT, handleUpdate);
    window.addEventListener('cgl_rca_updated', handleUpdate);
    return () => {
      window.removeEventListener(REVISION_NOTEBOOK_EVENT, handleUpdate);
      window.removeEventListener('cgl_rca_updated', handleUpdate);
    };
  }, []);

  // Quick chips for silly mistakes
  const sillyChips = [
    'Calculation slip',
    'Misread question / condition',
    'Marked wrong option in hurry',
    'Unit conversion missed',
    'Formula slip / Sign error'
  ];

  // Handlers for Silly Notebook
  const handleAddSilly = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSillyText.trim()) return;
    addSillyNotebookItem({
      reason: newSillyText.trim(),
      subject: newSillySubject
    });
    setNewSillyText('');
    reloadData();
  };

  const handleChipClick = (chip: string) => {
    if (!newSillyText) {
      setNewSillyText(chip);
    } else if (!newSillyText.includes(chip)) {
      setNewSillyText(`${newSillyText}, ${chip}`);
    }
  };

  const handleSaveEditSilly = (id: string) => {
    if (editSillyText.trim()) {
      updateSillyNotebookItem(id, editSillyText.trim());
      setEditingSillyId(null);
      setEditSillyText('');
      reloadData();
    }
  };

  const handleDeleteSilly = (id: string) => {
    deleteSillyNotebookItem(id);
    reloadData();
  };

  // Handlers for Revision Notes
  const handleAddNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newNoteText.trim()) return;
    saveRevisionNote({
      text: newNoteText.trim(),
      type: 'concept',
      subject: newNoteSubject
    });
    setNewNoteText('');
    reloadData();
  };

  const handleSaveEditNote = (id: string) => {
    if (editNoteText.trim()) {
      updateRevisionNote(id, editNoteText.trim());
      setEditingNoteId(null);
      setEditNoteText('');
      reloadData();
    }
  };

  const handleDeleteNote = (id: string) => {
    deleteRevisionNote(id);
    reloadData();
  };

  // Filtered lists
  const filteredSilly = useMemo(() => {
    return sillyItems.filter(item => {
      if (selectedSubjectFilter !== 'all') {
        const sub = (item.subject || '').toLowerCase();
        if (!sub.includes(selectedSubjectFilter.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.reason.toLowerCase().includes(q) ||
          (item.topic && item.topic.toLowerCase().includes(q)) ||
          (item.subject && item.subject.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [sillyItems, selectedSubjectFilter, searchQuery]);

  const filteredNotes = useMemo(() => {
    return notes.filter(item => {
      if (selectedSubjectFilter !== 'all') {
        const sub = (item.subject || '').toLowerCase();
        if (!sub.includes(selectedSubjectFilter.toLowerCase())) return false;
      }
      if (noteTypeFilter === 'tommy' && item.type !== 'tommy_insight') return false;
      if (noteTypeFilter === 'user' && item.type === 'tommy_insight') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.text.toLowerCase().includes(q) ||
          (item.topic && item.topic.toLowerCase().includes(q)) ||
          (item.subject && item.subject.toLowerCase().includes(q)) ||
          (item.questionSnippet && item.questionSnippet.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [notes, selectedSubjectFilter, noteTypeFilter, searchQuery]);

  const subjects = ['all', 'Mathematics', 'Reasoning', 'English', 'General Awareness'];

  const getSubjectBadgeStyle = (subject?: string) => {
    const s = (subject || '').toLowerCase();
    if (s.includes('math')) return 'bg-amber-100 text-amber-900 border-amber-200';
    if (s.includes('reason')) return 'bg-purple-100 text-purple-900 border-purple-200';
    if (s.includes('eng')) return 'bg-sky-100 text-sky-900 border-sky-200';
    if (s.includes('gen') || s.includes('ga') || s.includes('gk')) return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const getSubjectShort = (subject?: string) => {
    const s = (subject || '').toLowerCase();
    if (s.includes('math')) return 'Maths';
    if (s.includes('reason')) return 'Reasoning';
    if (s.includes('eng')) return 'English';
    if (s.includes('gen') || s.includes('ga') || s.includes('gk')) return 'GA';
    return subject || 'General';
  };

  return (
    <div className={`mb-4 rounded-xl border border-stone-300/90 bg-[#faf8f5] shadow-xs overflow-hidden transition-all ${className}`}>
      {/* ─── NOTEBOOK BINDER & TABS HEADER ─── */}
      <div className="bg-[#24292e] text-white px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-stone-800">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mr-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-stone-700"
              title="Back to Mistakes"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          {/* Notebook Spiral Accent */}
          <div className="flex items-center gap-1 opacity-70">
            <span className="w-1.5 h-3 rounded-full bg-stone-400" />
            <span className="w-1.5 h-3 rounded-full bg-stone-400" />
            <span className="w-1.5 h-3 rounded-full bg-stone-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="text-xs sm:text-sm font-bold tracking-tight text-stone-100">
              Revision Notebook
            </span>
          </div>
        </div>

        {/* Notebook Index Tabs */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-stone-800/90 p-0.5 rounded-lg border border-stone-700">
            <button
              type="button"
              onClick={() => { setActiveTab('silly'); setIsCollapsed(false); }}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'silly'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span>Silly Slips</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'silly' ? 'bg-black/30 text-white' : 'bg-stone-700 text-stone-300'
              }`}>
                {sillyItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('notes'); setIsCollapsed(false); }}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5 text-indigo-200" />
              <span>Notes & Tommy</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'notes' ? 'bg-black/30 text-white' : 'bg-stone-700 text-stone-300'
              }`}>
                {notes.length}
              </span>
            </button>
          </div>

          {/* Minimize / Expand */}
          {!isStandalonePage && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 text-stone-400 hover:text-white hover:bg-stone-800 rounded transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand Notebook' : 'Collapse Notebook'}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* ─── NOTEBOOK PAGE BODY (RULED PAPER DESIGN) ─── */}
      {(!isCollapsed || isStandalonePage) && (
        <div className="bg-[#fcfbf9] border-t border-stone-200/80">
          {/* Compact Ruled Filter Line */}
          <div className="px-3 sm:px-4 py-1.5 bg-[#f5f3ee] border-b border-stone-200/90 flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Subject Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-0.5 shrink-0 flex items-center gap-0.5">
                <Filter className="w-2.5 h-2.5" />
                <span>Subject:</span>
              </span>
              {subjects.map(s => {
                const isSelected = selectedSubjectFilter.toLowerCase() === s.toLowerCase();
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSubjectFilter(s)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-stone-800 text-white font-bold shadow-2xs'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {s === 'all' ? 'All' : getSubjectShort(s)}
                  </button>
                );
              })}
            </div>

            {/* Note Sub-filter (on Notes tab) */}
            {activeTab === 'notes' && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setNoteTypeFilter('all')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-semibold cursor-pointer ${
                    noteTypeFilter === 'all' ? 'bg-indigo-100 text-indigo-900 font-bold border border-indigo-200' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  All ({notes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNoteTypeFilter('tommy')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-semibold cursor-pointer flex items-center gap-1 ${
                    noteTypeFilter === 'tommy' ? 'bg-purple-100 text-purple-900 font-bold border border-purple-200' : 'text-stone-500 hover:text-purple-700'
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                  <span>Tommy ({notes.filter(n => n.type === 'tommy_insight').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNoteTypeFilter('user')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-semibold cursor-pointer ${
                    noteTypeFilter === 'user' ? 'bg-blue-100 text-blue-900 font-bold border border-blue-200' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  My Notes ({notes.filter(n => n.type !== 'tommy_insight').length})
                </button>
              </div>
            )}

            {/* Compact Search Bar */}
            <div className="relative min-w-[140px] sm:min-w-[180px] ml-auto">
              <Search className="w-3 h-3 text-stone-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'silly' ? 'Search slips...' : 'Search notes...'}
                className="w-full text-[11px] pl-6 pr-5 py-0.5 rounded border border-stone-300 bg-white text-stone-800 focus:outline-none focus:border-stone-500 placeholder-stone-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════ */}
          {/* TAB 1: SILLY MISTAKES NOTEBOOK PAGE (RULED LINES)        */}
          {/* ════════════════════════════════════════════════════════ */}
          {activeTab === 'silly' && (
            <div className="divide-y divide-stone-200/90">
              {/* Compact Inline Add Slip Bar */}
              <form onSubmit={handleAddSilly} className="px-3 sm:px-4 py-2 bg-[#f8f6f0] flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-rose-700 shrink-0 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Add Slip:</span>
                  </span>
                  <input
                    type="text"
                    value={newSillyText}
                    onChange={e => setNewSillyText(e.target.value)}
                    placeholder="Quick slip reason: e.g. Divided by 3 instead of 4, misread not prime..."
                    className="flex-1 text-xs px-2.5 py-1 rounded border border-stone-300 bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:border-rose-400"
                  />
                  <select
                    value={newSillySubject}
                    onChange={e => setNewSillySubject(e.target.value)}
                    className="text-[11px] py-1 px-1.5 rounded border border-stone-300 bg-white text-stone-700 outline-none shrink-0"
                  >
                    <option value="Mathematics">Maths</option>
                    <option value="Reasoning">Reasoning</option>
                    <option value="English">English</option>
                    <option value="General Awareness">GA</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!newSillyText.trim()}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Append</span>
                  </button>
                </div>

                {/* Quick chip presets */}
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pt-0.5">
                  <span className="text-[10px] text-stone-400 font-medium shrink-0">Presets:</span>
                  {sillyChips.map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      className="text-[10px] px-2 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors shrink-0 cursor-pointer font-medium"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </form>

              {/* Ruled Notebook Entries (High Density, No Wasted Gap) */}
              {filteredSilly.length === 0 ? (
                <div className="py-8 text-center bg-white">
                  <Flame className="w-6 h-6 text-rose-300 mx-auto mb-1" />
                  <p className="text-xs font-bold text-stone-700">No silly slips recorded yet</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Append your slips above or tag questions as [S] Silly in the test review!
                  </p>
                </div>
              ) : (
                <div className="bg-[#fcfbf9] divide-y divide-stone-200/80">
                  {filteredSilly.map((item, idx) => {
                    const isEditing = editingSillyId === item.id;
                    const dateFormatted = item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : '';

                    return (
                      <div
                        key={item.id || idx}
                        className="group flex items-start justify-between gap-3 px-3 sm:px-4 py-2 hover:bg-[#f5f3ec] transition-colors relative border-l-[3px] border-l-rose-400/80"
                      >
                        {/* Left Side: Number, Subject Badge, Topic & Slip Reason */}
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {/* Ruled Entry Number */}
                          <span className="text-[10px] font-mono text-stone-400 select-none w-5 pt-0.5 text-right shrink-0">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${getSubjectBadgeStyle(item.subject)}`}>
                                {getSubjectShort(item.subject)}
                              </span>
                              {item.topic && (
                                <span className="text-[10px] text-stone-500 font-medium">
                                  {item.topic}
                                </span>
                              )}
                              {dateFormatted && (
                                <span className="text-[10px] text-stone-400 ml-auto sm:ml-0">
                                  · {dateFormatted}
                                </span>
                              )}
                            </div>

                            {/* The Note / Reason Line */}
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <input
                                  type="text"
                                  value={editSillyText}
                                  onChange={e => setEditSillyText(e.target.value)}
                                  className="flex-1 text-xs px-2 py-1 rounded border border-rose-300 bg-white text-stone-900 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditSilly(item.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                  title="Save"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSillyId(null)}
                                  className="p-1 text-stone-400 hover:text-stone-600 rounded cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-stone-800 font-medium leading-relaxed mt-0.5 select-text">
                                <span className="text-rose-600 font-bold mr-1">“</span>
                                {item.reason}
                                <span className="text-rose-600 font-bold ml-1">”</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right Side: Quick Action Icons */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {item.questionId && onReviewQuestion && (
                            <button
                              type="button"
                              onClick={() => onReviewQuestion(item.questionId!)}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-indigo-50 cursor-pointer"
                              title="Jump to question"
                            >
                              <span>Q</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSillyId(item.id);
                                setEditSillyText(item.reason);
                              }}
                              className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded cursor-pointer transition-colors"
                              title="Edit slip reason"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteSilly(item.id)}
                            className="p-1 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* TAB 2: NOTES & TOMMY INSIGHTS (RULED NOTEBOOK PAGE)      */}
          {/* ════════════════════════════════════════════════════════ */}
          {activeTab === 'notes' && (
            <div className="divide-y divide-stone-200/90">
              {/* Compact Inline Add Note Bar */}
              <form onSubmit={handleAddNote} className="px-3 sm:px-4 py-2 bg-[#f8f6f0] flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-indigo-700 shrink-0 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Add Note:</span>
                  </span>
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    placeholder="Key takeaway, formula or concept: e.g. For x + 1/x = k, x³ + 1/x³ = k³ - 3k..."
                    className="flex-1 text-xs px-2.5 py-1 rounded border border-stone-300 bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:border-indigo-400"
                  />
                  <select
                    value={newNoteSubject}
                    onChange={e => setNewNoteSubject(e.target.value)}
                    className="text-[11px] py-1 px-1.5 rounded border border-stone-300 bg-white text-stone-700 outline-none shrink-0"
                  >
                    <option value="Mathematics">Maths</option>
                    <option value="Reasoning">Reasoning</option>
                    <option value="English">English</option>
                    <option value="General Awareness">GA</option>
                    <option value="General">General</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!newNoteText.trim()}
                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                </div>
              </form>

              {/* Ruled Notes Entries */}
              {filteredNotes.length === 0 ? (
                <div className="py-8 text-center bg-white">
                  <FileText className="w-6 h-6 text-indigo-300 mx-auto mb-1" />
                  <p className="text-xs font-bold text-stone-700">No notes or Tommy insights saved yet</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Save insights using the "📌 Save to Notes & Concept" chip in Tommy chat or write notes on questions!
                  </p>
                </div>
              ) : (
                <div className="bg-[#fcfbf9] divide-y divide-stone-200/80">
                  {filteredNotes.map((item, idx) => {
                    const isEditing = editingNoteId === item.id;
                    const isTommy = item.type === 'tommy_insight';
                    const dateFormatted = item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : '';

                    return (
                      <div
                        key={item.id || idx}
                        className={`group flex items-start justify-between gap-3 px-3 sm:px-4 py-2.5 hover:bg-[#f5f3ec] transition-colors relative border-l-[3px] ${
                          isTommy ? 'border-l-purple-500' : 'border-l-indigo-500'
                        }`}
                      >
                        {/* Left Side: Number, Type Badge, Subject Badge, Topic & Note */}
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {/* Ruled Entry Number */}
                          <span className="text-[10px] font-mono text-stone-400 select-none w-5 pt-0.5 text-right shrink-0">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isTommy ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-900 font-bold border border-purple-200 flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                  <span>Tommy AI</span>
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-900 font-semibold border border-indigo-200 flex items-center gap-0.5">
                                  <StickyNote className="w-2.5 h-2.5 text-indigo-500" />
                                  <span>Note</span>
                                </span>
                              )}

                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${getSubjectBadgeStyle(item.subject)}`}>
                                {getSubjectShort(item.subject)}
                              </span>

                              {item.topic && (
                                <span className="text-[10px] text-stone-500 font-medium">
                                  {item.topic}
                                </span>
                              )}

                              {dateFormatted && (
                                <span className="text-[10px] text-stone-400 ml-auto sm:ml-0">
                                  · {dateFormatted}
                                </span>
                              )}
                            </div>

                            {/* Question snippet reference if any */}
                            {item.questionSnippet && (
                              <div className="mt-1 px-2.5 py-1 bg-stone-100/90 rounded text-[11px] text-stone-600 border border-stone-200/50">
                                <span className="font-bold text-stone-700 mr-1.5">Q:</span>
                                <FormattedAiNote content={item.questionSnippet} className="inline" />
                              </div>
                            )}

                            {/* The Note Body */}
                            {isEditing ? (
                              <div className="mt-1.5 space-y-1">
                                <textarea
                                  value={editNoteText}
                                  onChange={e => setEditNoteText(e.target.value)}
                                  rows={4}
                                  className="w-full text-xs p-2.5 rounded-lg border border-indigo-300 bg-white text-stone-900 outline-none leading-relaxed font-sans"
                                />
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditNote(item.id)}
                                    className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-indigo-700 transition-colors shadow-2xs"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Save</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoteId(null)}
                                    className="px-2.5 py-1 text-stone-600 hover:bg-stone-200 rounded text-xs cursor-pointer transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-stone-800 font-normal leading-relaxed mt-1.5 select-text overflow-hidden">
                                <FormattedAiNote content={item.text} variant="notebook" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Side: Quick Action Icons */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {item.questionId && onReviewQuestion && (
                            <button
                              type="button"
                              onClick={() => onReviewQuestion(item.questionId!)}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-indigo-50 cursor-pointer"
                              title="Go to Question"
                            >
                              <span>Q</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(item.id);
                                setEditNoteText(item.text);
                              }}
                              className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded cursor-pointer transition-colors"
                              title="Edit note"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteNote(item.id)}
                            className="p-1 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
