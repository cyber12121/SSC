import React, { useState, useMemo, useRef } from 'react';
import {
  Search, Filter, Trash2, Edit3, RotateCcw, Plus,
  Sparkles, CheckSquare, Square, Download, BookOpen,
  Calendar, Layers, CheckCircle, AlertTriangle, ArrowLeft,
  Upload, FileText, ChevronDown, Info
} from 'lucide-react';
import { SRSCard, SRSCardStatus } from '../../types/srs';
import {
  formatDayString,
  isAnkiFlashcard,
  isTestQuestionCard,
  matchesSubject,
  exportCardsToJson,
  exportCardsToCsv,
  parseImportedDeckFile,
  isLeechCard
} from '../../utils/srsEngine';
import { SrsFormatGuideModal } from './SrsFormatGuideModal';

interface SrsCardExplorerProps {
  cards: SRSCard[];
  initialSubjectFilter?: string;
  initialChapterFilter?: string;
  onBackToHub: () => void;
  onAddNewCard: () => void;
  onOpenAiCreator: () => void;
  onEditCard: (card: SRSCard) => void;
  onDeleteCard: (cardId: string) => void;
  onBulkDeleteCards: (cardIds: string[]) => void;
  onResetCard: (cardId: string) => void;
  onImportBatch?: (cards: Array<Partial<SRSCard>>) => void;
}

export const SrsCardExplorer: React.FC<SrsCardExplorerProps> = ({
  cards,
  initialSubjectFilter,
  initialChapterFilter,
  onBackToHub,
  onAddNewCard,
  onOpenAiCreator,
  onEditCard,
  onDeleteCard,
  onBulkDeleteCards,
  onResetCard,
  onImportBatch
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deckTypeFilter, setDeckTypeFilter] = useState<'all' | 'anki' | 'test_srs'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>(initialSubjectFilter || 'all');
  const [chapterFilter, setChapterFilter] = useState<string>(initialChapterFilter || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [formatGuideOpen, setFormatGuideOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsedCards = await parseImportedDeckFile(file);
      if (parsedCards.length === 0) {
        alert('Could not parse any valid flashcards from this file.');
      } else if (onImportBatch) {
        onImportBatch(parsedCards);
      }
    } catch (err: any) {
      alert('Error reading file: ' + (err.message || 'Invalid format'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const todayStr = formatDayString();

  const availableChapters = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => {
      if (subjectFilter !== 'all' && !matchesSubject(c.subject, subjectFilter)) return;
      if (c.topic && c.topic !== 'General' && c.topic !== 'All Topics') set.add(c.topic.trim());
      if (c.subtopic && c.subtopic !== 'General') set.add(c.subtopic.trim());
    });
    return Array.from(set).sort();
  }, [cards, subjectFilter]);

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // Deck Type Filter (Anki Flashcards vs SRS Test Revision)
      if (deckTypeFilter === 'anki' && !isAnkiFlashcard(card)) return false;
      if (deckTypeFilter === 'test_srs' && !isTestQuestionCard(card)) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchFront = card.front.toLowerCase().includes(q);
        const matchBack = card.back.toLowerCase().includes(q);
        const matchTopic = (card.topic || '').toLowerCase().includes(q);
        const matchMnemonic = (card.mnemonic || card.shortcutFormula || '').toLowerCase().includes(q);
        if (!matchFront && !matchBack && !matchTopic && !matchMnemonic) return false;
      }

      // Subject Filter
      if (subjectFilter !== 'all' && !matchesSubject(card.subject, subjectFilter)) {
        return false;
      }

      // Chapter / Topic Filter
      if (chapterFilter !== 'all') {
        const normChapter = chapterFilter.toLowerCase().trim();
        const cardTopic = (card.topic || '').toLowerCase().trim();
        const cardSubtopic = (card.subtopic || '').toLowerCase().trim();
        if (cardTopic !== normChapter && cardSubtopic !== normChapter) return false;
      }

      // Status Filter
      if (statusFilter !== 'all') {
        const isDue = card.dueDate <= todayStr;
        const isMastered = card.status === 'mastered' || card.intervalDays >= 45;
        if (statusFilter === 'due' && !isDue) return false;
        if (statusFilter === 'mastered' && !isMastered) return false;
        if (statusFilter === 'learning' && card.stage > 1) return false;
        if (statusFilter === 'leeches' && !isLeechCard(card)) return false;
      }

      return true;
    });
  }, [cards, deckTypeFilter, searchQuery, subjectFilter, chapterFilter, statusFilter, todayStr]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCards.map(c => c.id)));
    }
  };

  const toggleSelectCard = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleConfirmSingleDelete = () => {
    if (deleteConfirmId) {
      onDeleteCard(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleConfirmBulkDelete = () => {
    if (selectedIds.size > 0) {
      onBulkDeleteCards(Array.from(selectedIds));
      setSelectedIds(new Set());
      setBulkDeleteConfirmOpen(false);
    }
  };

  const getSubjectBadge = (subject: string = '') => {
    if (matchesSubject(subject, 'english')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (matchesSubject(subject, 'gk')) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (matchesSubject(subject, 'mathematics')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (matchesSubject(subject, 'reasoning')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToHub}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-2xs transition-colors"
            title="Back to SRS Hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Anki Card Explorer</h1>
            <p className="text-xs text-slate-500 font-medium">Browse, search, edit, or delete from your {cards.length} SRS cards</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Hidden File Input for Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".json,.csv,.tsv"
            className="hidden"
          />

          {/* Import Backup Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
            title="Import deck from JSON or CSV file"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import File</span>
          </button>

          {/* Format Info Guide Button */}
          <button
            onClick={() => setFormatGuideOpen(true)}
            className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
            title="View supported deck upload formats (Text, CSV, JSON)"
          >
            <Info className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Format Guide</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(prev => !prev)}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
              title="Export cards to backup file"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => {
                    exportCardsToJson(filteredCards);
                    setExportMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-indigo-50 hover:text-indigo-700 flex items-center space-x-2 transition-colors font-medium cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <div>
                    <div className="font-bold">Export JSON Backup</div>
                    <div className="text-[10px] text-slate-400">Full backup with SM-2 stats ({filteredCards.length} cards)</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    exportCardsToCsv(filteredCards);
                    setExportMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-emerald-50 hover:text-emerald-700 flex items-center space-x-2 transition-colors font-medium cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-bold">Export Anki CSV</div>
                    <div className="text-[10px] text-slate-400">Compatible with Anki Desktop import</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onOpenAiCreator}
            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>AI Card Creator</span>
          </button>
          <button
            onClick={onAddNewCard}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-md shadow-indigo-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Card</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        {/* Category Switcher: All vs Anki Flashcards vs SRS Test Questions */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit flex-wrap">
          <button
            type="button"
            onClick={() => setDeckTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              deckTypeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Decks ({cards.length})
          </button>
          <button
            type="button"
            onClick={() => setDeckTypeFilter('anki')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              deckTypeFilter === 'anki'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-purple-700'
            }`}
          >
            <span>🎴 Anki Flashcards</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${deckTypeFilter === 'anki' ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {cards.filter(isAnkiFlashcard).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDeckTypeFilter('test_srs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              deckTypeFilter === 'test_srs'
                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            <span>🎯 SRS Test Questions</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${deckTypeFilter === 'test_srs' ? 'bg-amber-600 text-slate-950' : 'bg-slate-200 text-slate-700'}`}>
              {cards.filter(isTestQuestionCard).length}
            </span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by word, question text, concept, or trick..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Subject domain filter */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Subjects' },
              { id: 'english', label: 'English Vocab' },
              { id: 'gk', label: 'General Knowledge' },
              { id: 'mathematics', label: 'Mathematics' },
              { id: 'reasoning', label: 'Reasoning' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSubjectFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${
                  subjectFilter === tab.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chapter / Topic Filter Dropdown */}
        {availableChapters.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-500 flex items-center gap-1.5 shrink-0">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Chapter:</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={chapterFilter}
                onChange={e => setChapterFilter(e.target.value)}
                aria-label="Filter by Chapter"
                className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 max-w-[280px]"
              >
                <option value="all">All Chapters ({availableChapters.length})</option>
                {availableChapters.map(chap => (
                  <option key={chap} value={chap}>{chap}</option>
                ))}
              </select>
              {chapterFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setChapterFilter('all')}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Clear ({chapterFilter})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Status filters */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-400">Status:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'due', label: 'Due Today' },
              { id: 'learning', label: 'Learning' },
              { id: 'mastered', label: 'Mastered' },
              { id: 'leeches', label: '⚠️ Leeches' }
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  statusFilter === st.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center space-x-2 bg-red-50 text-red-700 px-3 py-1 rounded-xl border border-red-200">
              <span className="font-bold">{selectedIds.size} Selected</span>
              <button
                onClick={() => setBulkDeleteConfirmOpen(true)}
                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500">
          <div className="flex items-center space-x-3">
            <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600">
              {selectedIds.size === filteredCards.length && filteredCards.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <span>Showing {filteredCards.length} Cards</span>
          </div>
          <span>Interval / Due</span>
        </div>

        {filteredCards.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <BookOpen className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-600">No Anki cards match your filters</p>
            <p className="text-xs">Create cards manually, batch import Ayush Vocab sets, or use the AI generator.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCards.map(card => {
              const isSelected = selectedIds.has(card.id);
              const isDue = card.dueDate <= todayStr;
              const isMastered = card.status === 'mastered' || card.intervalDays >= 45;

              return (
                <div
                  key={card.id}
                  className={`p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected ? 'bg-indigo-50/30' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleSelectCard(card.id)}
                      className="mt-1 text-slate-400 hover:text-indigo-600 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getSubjectBadge(card.subject)}`}>
                          {card.subject}
                        </span>
                        {isTestQuestionCard(card) ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-300">
                            🎯 Test Question
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-900 border border-purple-300">
                            🎴 Anki Flashcard
                          </span>
                        )}
                        {card.source === 'speed_trap' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <span>⚡ Speed Trap</span>
                            {card.userTimeSpent && (
                              <span className="opacity-75 font-normal">({card.userTimeSpent}s)</span>
                            )}
                          </span>
                        )}
                        {card.topic && (
                          <span className="text-[11px] font-semibold text-slate-500">
                            • {card.topic}
                          </span>
                        )}
                        {card.sourceTitle && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 truncate max-w-[180px]">
                            {card.sourceTitle}
                          </span>
                        )}
                        {isDue && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-black bg-amber-100 text-amber-800 border border-amber-300">
                            Due Today
                          </span>
                        )}
                        {isMastered && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Mastered
                          </span>
                        )}
                        {isLeechCard(card) && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-black bg-rose-100 text-rose-800 border border-rose-300">
                            ⚠️ Leech ({card.lapses || 4} fails)
                          </span>
                        )}
                        {card.coolOffUntil && card.coolOffUntil > todayStr && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-black bg-sky-100 text-sky-800 border border-sky-300">
                            😴 Cooling Off ({card.coolOffUntil})
                          </span>
                        )}
                      </div>

                      {/* Front Prompt */}
                      <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                        {card.front}
                      </p>

                      {/* Back preview */}
                      <p className="text-[11px] text-slate-600 line-clamp-1">
                        {card.back}
                      </p>

                      {/* Mnemonic / Shortcut trick */}
                      {(card.mnemonic || card.shortcutFormula) && (
                        <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 inline-flex items-center space-x-1">
                          <span>{card.shortcutFormula ? '⚡' : '💡'}</span>
                          <span className="truncate max-w-[400px]">{card.shortcutFormula || card.mnemonic}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side stats & action buttons */}
                  <div className="flex items-center justify-between md:justify-end space-x-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-right text-xs">
                      <div className="font-black text-slate-800">{card.intervalDays} {card.intervalDays === 1 ? 'day' : 'days'}</div>
                      <div className="text-[10px] text-slate-400">Due: {card.dueDate}</div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onResetCard(card.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="Reset interval to Day 1"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEditCard(card)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Edit Card"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(card.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Single Card Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Delete this Anki Card?</h4>
              <p className="text-xs text-slate-500 mt-1">This card and its SM-2 review progress will be removed. This action cannot be undone.</p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSingleDelete}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Delete {selectedIds.size} Selected Cards?</h4>
              <p className="text-xs text-slate-500 mt-1">These cards will be permanently removed from your SRS collection.</p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkDelete}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deck Upload Format Guide Modal */}
      <SrsFormatGuideModal
        isOpen={formatGuideOpen}
        onClose={() => setFormatGuideOpen(false)}
      />
    </div>
  );
};
