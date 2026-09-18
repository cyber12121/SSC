import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCw, Sparkles, Plus, BookOpen, Layers, Flame,
  Trophy, CheckCircle2, ChevronRight, Brain, AlertCircle,
  Download, ArrowRight, ShieldCheck, Zap, Target, HelpCircle,
  XCircle, Clock, AlertTriangle, Check
} from 'lucide-react';
import { SRSCard, DeckStatistics } from '../../types/srs';
import {
  getStoredSRSCards,
  saveStoredSRSCards,
  computeDeckStats,
  getDueSRSCards,
  addSRSCardsBatch,
  addSRSCard,
  deleteSRSCard,
  bulkDeleteSRSCards,
  resetSRSCardInterval,
  SRS_UPDATED_EVENT,
  loadCardsFromFirestore,
  isAnkiFlashcard,
  isTestQuestionCard,
  convertQuestionToSRSCard,
  matchesSubject,
  getOverdueCardsCount,
  triageOverdueBacklog,
  getSRSSettings
} from '../../utils/srsEngine';
import { SrsReviewStudio } from './SrsReviewStudio';
import { SrsCardExplorer } from './SrsCardExplorer';
import { SrsCardConfirmModal } from './SrsCardConfirmModal';
import { SrsManualCardModal } from './SrsManualCardModal';
import { SrsAiCreatorModal } from './SrsAiCreatorModal';
import { SrsPacingSettingsModal } from './SrsPacingSettingsModal';

interface SrsHubProps {
  onNavigateHome: () => void;
  rawChapterData?: any;
}

export const SrsHub: React.FC<SrsHubProps> = ({ onNavigateHome, rawChapterData }) => {
  const [cards, setCards] = useState<SRSCard[]>(() => getStoredSRSCards());
  const [activeView, setActiveView] = useState<'hub' | 'review' | 'explorer'>('hub');
  const [reviewSubjectFilter, setReviewSubjectFilter] = useState<string | 'all'>('all');
  const [reviewDeckType, setReviewDeckType] = useState<'all' | 'anki' | 'test_srs'>('all');
  const [cramAllOverride, setCramAllOverride] = useState(false);

  // Top Deck Mode: 'anki' (Concept Flashcards) vs 'test_srs' (Mock/Quiz Question Errors)
  const [deckMode, setDeckMode] = useState<'anki' | 'test_srs'>('anki');

  // Modals
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingCards, setPendingCards] = useState<Array<Partial<SRSCard>>>([]);
  const [confirmModalTitle, setConfirmModalTitle] = useState('Confirm New Anki Cards');
  const [confirmModalSource, setConfirmModalSource] = useState<string | undefined>();
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<SRSCard | null>(null);
  const [aiCreatorOpen, setAiCreatorOpen] = useState(false);
  const [pacingModalOpen, setPacingModalOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Sync cards from storage and firestore
  useEffect(() => {
    const handleUpdate = () => setCards(getStoredSRSCards());
    window.addEventListener(SRS_UPDATED_EVENT, handleUpdate);
    loadCardsFromFirestore().then(remoteCards => {
      if (remoteCards && remoteCards.length > 0) setCards(remoteCards);
    });
    return () => window.removeEventListener(SRS_UPDATED_EVENT, handleUpdate);
  }, []);

  // Partition cards into Anki Flashcards vs SRS Test Revision
  const ankiCards = useMemo(() => cards.filter(isAnkiFlashcard), [cards]);
  const testCards = useMemo(() => cards.filter(isTestQuestionCard), [cards]);

  const ankiStats = useMemo(() => computeDeckStats(ankiCards), [ankiCards]);
  const testStats = useMemo(() => computeDeckStats(testCards), [testCards]);

  const activeStats = deckMode === 'anki' ? ankiStats : testStats;
  const activeCards = deckMode === 'anki' ? ankiCards : testCards;

  const srsSettings = useMemo(() => getSRSSettings(), [cards, pacingModalOpen]);
  const overdueCount = useMemo(() => getOverdueCardsCount(cards), [cards]);
  const dailyCap = srsSettings.dailyReviewCap || 30;
  const isPacedSession = dailyCap > 0 && dailyCap < 9999 && activeStats.dueToday > dailyCap;

  // Handle Review session initiation
  const handleStartReview = (subject: string | 'all' = 'all', mode: 'all' | 'anki' | 'test_srs' = deckMode, cramAll: boolean = false) => {
    setCramAllOverride(cramAll);
    let candidateCards = cards;
    if (mode === 'anki') candidateCards = ankiCards;
    else if (mode === 'test_srs') candidateCards = testCards;

    const dueCards = getDueSRSCards(candidateCards, subject);
    if (dueCards.length === 0) {
      // If no cards strictly due today, let user review learning or available cards
      const availableCards = subject === 'all' 
        ? candidateCards.filter(c => c.status !== 'suspended').slice(0, 25)
        : candidateCards.filter(c => c.status !== 'suspended' && matchesSubject(c.subject, subject)).slice(0, 25);

      if (availableCards.length === 0) {
        alert(mode === 'test_srs'
          ? 'No test mistake questions in your revision queue yet. Take a mock test or click "Import Mock Mistakes" below!'
          : 'No Anki cards available in this deck. Add cards with AI or import Ayush Vocab sets!');
        return;
      }
      setReviewSubjectFilter(subject);
      setReviewDeckType(mode);
      setActiveView('review');
      return;
    }
    setReviewSubjectFilter(subject);
    setReviewDeckType(mode);
    setActiveView('review');
  };

  const handleFinishReviewSession = (updatedCards: SRSCard[]) => {
    const updatedMap = new Map(updatedCards.map(c => [c.id, c]));
    const newCards = cards.map(c => updatedMap.get(c.id) || c);
    saveStoredSRSCards(newCards);
    setCards(newCards);
    setActiveView('hub');
  };

  // Pre-Creation Confirmation handler
  const handleConfirmAndAddPendingCards = (confirmedCards: Array<Partial<SRSCard>>) => {
    if (confirmedCards.length > 0) {
      const added = addSRSCardsBatch(confirmedCards);
      setCards(getStoredSRSCards());
      if (added.length > 0) {
        setFeedbackToast(`✅ Successfully added ${added.length} cards to your deck!`);
      } else {
        setFeedbackToast(`ℹ️ All ${confirmedCards.length} cards were already in your deck.`);
      }
      setTimeout(() => setFeedbackToast(null), 5000);
    }
    setConfirmModalOpen(false);
    setPendingCards([]);
  };

  // Batch import existing Ayush Vocab sets
  const handleBatchImportAyushVocab = async () => {
    try {
      const synonymsSet1 = await import('../../data/chapter_bank/english/ayush_vocab/synonyms/set_1.json');
      const rawQs = synonymsSet1?.default?.questions || (synonymsSet1 as any)?.questions || [];

      const candidateCards: Array<Partial<SRSCard>> = rawQs.slice(0, 15).map((q: any) => {
        let mnemonic = '';
        const sol = q.solution || '';
        const match = sol.match(/💡\s*Mnemonic Trick:(.*?)(?:\n|$)/i);
        if (match) mnemonic = match[1].trim();

        return {
          type: 'vocab',
          subject: 'English',
          topic: 'Synonyms',
          subtopic: 'ayush_vocab',
          front: q.question,
          back: sol || `Answer: (${(q.answer || '').toUpperCase()})`,
          mnemonic: mnemonic || undefined,
          source: 'vocab_bank',
          sourceTitle: 'Ayush Vocab - Synonyms Set 1'
        };
      });

      setPendingCards(candidateCards);
      setConfirmModalTitle('Import Ayush Vocab Flashcards');
      setConfirmModalSource('Ayush Vocab (Synonyms Set 1)');
      setConfirmModalOpen(true);
    } catch (err) {
      console.warn('Could not import Ayush Vocab:', err);
    }
  };

  // Batch import Static GK sets
  const handleBatchImportStaticGk = async () => {
    try {
      const danceChapter = await import('../../data/chapter_bank/general_awareness/static_gk/classical_dance.json');
      const rawQs = danceChapter?.default?.questions || (danceChapter as any)?.questions || [];

      const candidateCards: Array<Partial<SRSCard>> = rawQs.slice(0, 15).map((q: any) => {
        const cleanAns = (q.answer || '').toLowerCase();
        const correctText = q.options && cleanAns in q.options ? q.options[cleanAns] : '';
        const back = `**Correct Answer: (${cleanAns.toUpperCase()}) ${correctText}**\n\n${q.solution || ''}`.trim();

        return {
          type: 'gk',
          subject: 'General Awareness',
          topic: 'Classical Dance',
          subtopic: 'static_gk',
          front: q.question,
          back,
          source: 'gk_bank',
          sourceTitle: 'Static GK - Classical Dance'
        };
      });

      setPendingCards(candidateCards);
      setConfirmModalTitle('Import Static GK Flashcards');
      setConfirmModalSource('Classical Dance (15 High-Yield Questions)');
      setConfirmModalOpen(true);
    } catch (err) {
      console.warn('Could not import Static GK:', err);
    }
  };

  // Batch import mock errors into SRS Test Question Revision queue
  const handleBatchImportMockErrors = async (targetSubject?: string) => {
    try {
      const questionsToImport: any[] = [];
      let sourceTitle = 'Mock Test Errors';

      if (!targetSubject || targetSubject === 'English') {
        const eng = await import('../../data/mock_errors/english.json');
        const chapters = eng?.default || eng || [];
        const qs = Array.isArray(chapters) ? chapters.flatMap((c: any) => c.questions || []) : [];
        questionsToImport.push(...qs.slice(0, 12).map((q: any) => ({ ...q, subject: 'English' })));
        if (targetSubject === 'English') sourceTitle = 'English Mock Errors';
      }

      if (!targetSubject || targetSubject === 'General Awareness') {
        const gk = await import('../../data/mock_errors/general_awareness.json');
        const chapters = gk?.default || gk || [];
        const qs = Array.isArray(chapters) ? chapters.flatMap((c: any) => c.questions || []) : [];
        questionsToImport.push(...qs.slice(0, 12).map((q: any) => ({ ...q, subject: 'General Awareness' })));
        if (targetSubject === 'General Awareness') sourceTitle = 'General Awareness Mock Errors';
      }

      if (!targetSubject || targetSubject === 'Mathematics') {
        const math = await import('../../data/mock_errors/mathematics.json');
        const chapters = math?.default || math || [];
        const qs = Array.isArray(chapters) ? chapters.flatMap((c: any) => c.questions || []) : [];
        questionsToImport.push(...qs.slice(0, 12).map((q: any) => ({ ...q, subject: 'Mathematics' })));
        if (targetSubject === 'Mathematics') sourceTitle = 'Mathematics Mock Errors';
      }

      if (!targetSubject || targetSubject === 'Reasoning') {
        const reas = await import('../../data/mock_errors/reasoning.json');
        const chapters = reas?.default || reas || [];
        const qs = Array.isArray(chapters) ? chapters.flatMap((c: any) => c.questions || []) : [];
        questionsToImport.push(...qs.slice(0, 12).map((q: any) => ({ ...q, subject: 'Reasoning' })));
        if (targetSubject === 'Reasoning') sourceTitle = 'Reasoning Mock Errors';
      }

      if (questionsToImport.length === 0) {
        alert('No mock test errors found to import. Take a mock test or complete quiz questions first!');
        return;
      }

      const candidateCards: Array<Partial<SRSCard>> = questionsToImport.slice(0, 25).map(q => {
        return convertQuestionToSRSCard(
          q,
          'mock_error',
          q.testName || 'Mock Test Error Bank',
          q.userAnswer || q.chosenOption
        );
      });

      setPendingCards(candidateCards);
      setConfirmModalTitle('Import Test Questions into SRS Revision');
      setConfirmModalSource(sourceTitle);
      setConfirmModalOpen(true);
    } catch (err) {
      console.warn('Could not import mock errors:', err);
    }
  };

  // Review Studio View
  if (activeView === 'review') {
    let candidateCards = cards;
    if (reviewDeckType === 'anki') candidateCards = ankiCards;
    else if (reviewDeckType === 'test_srs') candidateCards = testCards;

    const srsSettings = getSRSSettings();
    const limit = (!cramAllOverride && srsSettings.dailyReviewCap > 0 && srsSettings.dailyReviewCap < 9999)
      ? srsSettings.dailyReviewCap
      : undefined;

    const activeDueCards = getDueSRSCards(candidateCards, reviewSubjectFilter, limit);
    const reviewCards = activeDueCards.length > 0 
      ? activeDueCards 
      : (reviewSubjectFilter === 'all' 
          ? candidateCards.slice(0, 25) 
          : candidateCards.filter(c => matchesSubject(c.subject, reviewSubjectFilter)).slice(0, 25));

    return (
      <SrsReviewStudio
        cards={reviewCards}
        onFinishSession={handleFinishReviewSession}
        onExit={() => {
          setCramAllOverride(false);
          setActiveView('hub');
        }}
        onDeleteCurrentCard={(id) => {
          deleteSRSCard(id);
          setCards(getStoredSRSCards());
        }}
      />
    );
  }

  // Card Explorer View
  if (activeView === 'explorer') {
    return (
      <SrsCardExplorer
        cards={cards}
        onBackToHub={() => setActiveView('hub')}
        onAddNewCard={() => {
          setEditingCard(null);
          setManualModalOpen(true);
        }}
        onOpenAiCreator={() => setAiCreatorOpen(true)}
        onEditCard={(card) => {
          setEditingCard(card);
          setManualModalOpen(true);
        }}
        onDeleteCard={(id) => {
          deleteSRSCard(id);
          setCards(getStoredSRSCards());
        }}
        onBulkDeleteCards={(ids) => {
          bulkDeleteSRSCards(ids);
          setCards(getStoredSRSCards());
        }}
        onResetCard={(id) => {
          resetSRSCardInterval(id);
          setCards(getStoredSRSCards());
        }}
        onImportBatch={(batch) => {
          setPendingCards(batch);
          setConfirmModalTitle('Review & Confirm Imported Backup Cards');
          setConfirmModalSource('Deck File Import');
          setConfirmModalOpen(true);
        }}
      />
    );
  }

  return (
    <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Confirmation & Preview Modal (Pre-Creation Safety Gate) */}
      <SrsCardConfirmModal
        isOpen={confirmModalOpen}
        cards={pendingCards}
        title={confirmModalTitle}
        sourceLabel={confirmModalSource}
        onConfirm={handleConfirmAndAddPendingCards}
        onCancel={() => {
          setConfirmModalOpen(false);
          setPendingCards([]);
        }}
      />

      {/* Manual Add/Edit Modal */}
      <SrsManualCardModal
        isOpen={manualModalOpen}
        initialCard={editingCard}
        onClose={() => {
          setManualModalOpen(false);
          setEditingCard(null);
        }}
        onSave={(cardData) => {
          if (editingCard) {
            const updated = cards.map(c => c.id === editingCard.id ? { ...c, ...cardData } as SRSCard : c);
            saveStoredSRSCards(updated);
          } else {
            addSRSCard(cardData as any);
          }
          setCards(getStoredSRSCards());
        }}
        onSaveBatch={(batchCards) => {
          setPendingCards(batchCards);
          setConfirmModalTitle('Review & Confirm Manually Imported Cards');
          setConfirmModalSource('Bulk Manual Import');
          setConfirmModalOpen(true);
        }}
      />

      {/* AI Card Creator Modal */}
      <SrsAiCreatorModal
        isOpen={aiCreatorOpen}
        onClose={() => setAiCreatorOpen(false)}
        onCardsGenerated={(generatedCards) => {
          setPendingCards(generatedCards);
          setConfirmModalTitle('Review AI Generated Anki Cards');
          setConfirmModalSource('AI Card Generator');
          setConfirmModalOpen(true);
        }}
      />

      {/* Pacing & Burnout Protection Settings Modal */}
      <SrsPacingSettingsModal
        isOpen={pacingModalOpen}
        onClose={() => setPacingModalOpen(false)}
        cards={cards}
        onCardsUpdated={(updated) => setCards(updated)}
      />

      {/* Toast Notification Banner */}
      <AnimatePresence>
        {feedbackToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-600 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
              <span>{feedbackToast}</span>
            </div>
            <button
              onClick={() => setFeedbackToast(null)}
              className="text-emerald-200 hover:text-white text-xs font-semibold px-2 py-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Memory Retention & SRS Studio</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                SM-2 Pro
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Separate decks for Anki conceptual flashcards and SRS test question error revision
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          <button
            onClick={() => setPacingModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            title="Study Pacing & Burnout Protection Settings"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Pacing & Zen</span>
          </button>
          <button
            onClick={() => setActiveView('explorer')}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Card Explorer ({cards.length})</span>
          </button>
          <button
            onClick={() => setAiCreatorOpen(true)}
            className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>✨ AI Card Creator</span>
          </button>
          <button
            onClick={() => {
              setEditingCard(null);
              setManualModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Card</span>
          </button>
        </div>
      </div>

      {/* Main Deck Mode Switcher: Anki Flashcards vs SRS Test Revision */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl max-w-fit">
          <button
            type="button"
            onClick={() => setDeckMode('anki')}
            className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center space-x-2 cursor-pointer ${
              deckMode === 'anki'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                : 'text-slate-600 hover:text-purple-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>🎴 Anki Flashcard Decks</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              deckMode === 'anki' ? 'bg-purple-800 text-purple-100' : 'bg-slate-200 text-slate-700'
            }`}>
              {ankiCards.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDeckMode('test_srs')}
            className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center space-x-2 cursor-pointer ${
              deckMode === 'test_srs'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-200'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>🎯 SRS Test Questions Revision</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              deckMode === 'test_srs' ? 'bg-amber-600 text-slate-950' : 'bg-slate-200 text-slate-700'
            }`}>
              {testCards.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {deckMode === 'anki' ? (
            <span className="text-purple-700 font-semibold">📚 Active Recall: English Vocab, Static GK facts, Formulas, & Reasoning Patterns</span>
          ) : (
            <span className="text-amber-700 font-semibold">🔍 Error Retention: Re-solving wrong questions, slow time traps, & unattempted items</span>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Due Today */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
            deckMode === 'anki' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            <RotateCw className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Due Today</span>
            <span className="text-2xl font-black text-slate-900">{activeStats.dueToday}</span>
            <span className="text-[10px] text-slate-500 block">Needs review today</span>
          </div>
        </div>

        {/* Total in Active Deck */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
            {deckMode === 'anki' ? <BookOpen className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {deckMode === 'anki' ? 'Total Flashcards' : 'Test Mistake Qs'}
            </span>
            <span className="text-2xl font-black text-slate-900">{activeCards.length}</span>
            <span className="text-[10px] text-slate-500 block">In active queue</span>
          </div>
        </div>

        {/* Mastered / Resolved */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {deckMode === 'anki' ? 'Mastered Cards' : 'Resolved Errors'}
            </span>
            <span className="text-2xl font-black text-slate-900">{activeStats.mastered}</span>
            <span className="text-[10px] text-slate-500 block">&gt;45 day interval</span>
          </div>
        </div>

        {/* Daily Streak */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Daily Streak</span>
            <span className="text-2xl font-black text-slate-900">{activeStats.streakDays} {activeStats.streakDays === 1 ? 'Day' : 'Days'}</span>
            <span className="text-[10px] text-slate-500 block">Consistent habit</span>
          </div>
        </div>
      </div>

      {/* Overdue Backlog Relief Banner */}
      {overdueCount > 10 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Anti-Overwhelm Protection
                </span>
                <span className="text-xs font-black text-amber-950">
                  {overdueCount} Overdue Backlog Cards
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                Missed study days? Don't let a huge card backlog cause stress. Smoothly distribute overdue cards across the next 5 days so you study calmly.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => {
                const updated = triageOverdueBacklog(cards, 5);
                setCards(updated);
                setFeedbackToast(`🏖️ Backlog smoothly spread across 5 days! Enjoy stress-free learning.`);
                setTimeout(() => setFeedbackToast(null), 4000);
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md shadow-amber-200 transition-all cursor-pointer"
            >
              🏖️ Smooth Over 5 Days
            </button>
            <button
              onClick={() => setPacingModalOpen(true)}
              className="px-3 py-2.5 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Pacing Options
            </button>
          </div>
        </div>
      )}

      {/* Primary Hero Action: Start Review */}
      <div className={`rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 ${
        deckMode === 'anki'
          ? 'bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900'
          : 'bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900'
      }`}>
        <div className="space-y-2 text-center md:text-left">
          <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            deckMode === 'anki'
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          }`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{deckMode === 'anki' ? 'Anki Spaced Repetition Engine' : 'SRS Mock Error Retention Studio'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {activeStats.dueToday > 0
              ? `You have ${activeStats.dueToday} ${deckMode === 'anki' ? 'flashcards' : 'test questions'} due for review today!`
              : `Your ${deckMode === 'anki' ? 'Anki flashcard' : 'test revision'} queue is clear for today!`}
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            {deckMode === 'anki'
              ? 'Reviewing flashcards at scientific SM-2 intervals locks vocabulary mnemonics, formulas, and GK facts into permanent long-term memory.'
              : 'Re-solving mistake questions from mocks at calculated intervals permanently fixes mark-leakage and prevents repeat blunders.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          {isPacedSession ? (
            <div className="flex flex-col items-center sm:items-end gap-1.5">
              <button
                onClick={() => handleStartReview('all', deckMode, false)}
                className={`px-6 py-3.5 font-black text-sm rounded-2xl shadow-lg hover:scale-102 transition-all flex items-center space-x-2 cursor-pointer ${
                  deckMode === 'anki'
                    ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-purple-500/20'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                <span>Start Daily Session ({dailyCap} Cards)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleStartReview('all', deckMode, true)}
                className="text-xs font-semibold text-slate-400 hover:text-white underline cursor-pointer"
              >
                Or review entire backlog ({activeStats.dueToday} cards)
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleStartReview('all', deckMode, false)}
              className={`px-6 py-3.5 font-black text-sm rounded-2xl shadow-lg hover:scale-102 transition-all flex items-center space-x-2 cursor-pointer ${
                deckMode === 'anki'
                  ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-purple-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              <span>{activeStats.dueToday > 0 ? `Review Due (${activeStats.dueToday})` : (deckMode === 'anki' ? 'Practice Flashcards' : 'Practice Test Mistakes')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── MODE 1: ANKI FLASHCARD DECKS ── */}
      {deckMode === 'anki' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">Anki Conceptual Decks</h3>
              <p className="text-xs text-slate-500">Subject-wise flashcards with mnemonics, formulas, and shortcuts</p>
            </div>
            <button
              onClick={() => handleStartReview('all', 'anki')}
              className="text-xs font-bold text-purple-600 hover:text-purple-800 hover:underline"
            >
              Review All Anki Decks →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. English Vocab Deck */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                    English
                  </span>
                  {ankiStats.bySubject.english.due > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {ankiStats.bySubject.english.due} Due
                    </span>
                  )}
                </div>
                <h4 className="font-black text-slate-900 text-base">English Vocab</h4>
                <p className="text-xs text-slate-500 mt-1">Synonyms, Antonyms, OWS, and Idioms with mnemonic associative hooks</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  <strong>{ankiStats.bySubject.english.total}</strong> Cards
                </div>
                <button
                  onClick={() => handleStartReview('english', 'anki')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Review Vocab
                </button>
              </div>
            </div>

            {/* 2. General Knowledge Deck */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                    GK & GA
                  </span>
                  {ankiStats.bySubject.gk.due > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {ankiStats.bySubject.gk.due} Due
                    </span>
                  )}
                </div>
                <h4 className="font-black text-slate-900 text-base">General Awareness</h4>
                <p className="text-xs text-slate-500 mt-1">Static GK, Classical Dance, History, Polity, and Science facts</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  <strong>{ankiStats.bySubject.gk.total}</strong> Cards
                </div>
                <button
                  onClick={() => handleStartReview('gk', 'anki')}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Review GK
                </button>
              </div>
            </div>

            {/* 3. Mathematics Deck */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                    Quant
                  </span>
                  {ankiStats.bySubject.mathematics.due > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {ankiStats.bySubject.mathematics.due} Due
                    </span>
                  )}
                </div>
                <h4 className="font-black text-slate-900 text-base">Quant Formulas & Tricks</h4>
                <p className="text-xs text-slate-500 mt-1">Key formulas, arithmetic shortcuts, geometry theorems, & scratchpad</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  <strong>{ankiStats.bySubject.mathematics.total}</strong> Cards
                </div>
                <button
                  onClick={() => handleStartReview('mathematics', 'anki')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Review Math
                </button>
              </div>
            </div>

            {/* 4. Reasoning Deck */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                    Reasoning
                  </span>
                  {ankiStats.bySubject.reasoning.due > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {ankiStats.bySubject.reasoning.due} Due
                    </span>
                  )}
                </div>
                <h4 className="font-black text-slate-900 text-base">Reasoning Patterns</h4>
                <p className="text-xs text-slate-500 mt-1">Series rules, coding-decoding patterns, matrices, & syllogism rules</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  <strong>{ankiStats.bySubject.reasoning.total}</strong> Cards
                </div>
                <button
                  onClick={() => handleStartReview('reasoning', 'anki')}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Review Reasoning
                </button>
              </div>
            </div>
          </div>

          {/* Batch Import Quick Accelerators for Anki */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Download className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Quick Anki Starters</h4>
              </div>
              <span className="text-[11px] text-slate-500">Preview & confirm before adding</span>
            </div>

            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <button
                onClick={handleBatchImportAyushVocab}
                className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>Load Ayush Vocab (Synonyms Set 1)</span>
              </button>
              <button
                onClick={handleBatchImportStaticGk}
                className="px-3.5 py-2 bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-sky-600" />
                <span>Load Static GK (Classical Dance)</span>
              </button>
              <button
                onClick={() => setAiCreatorOpen(true)}
                className="px-3.5 py-2 bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Generate Custom Deck with AI (Up to 50 Cards)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODE 2: SRS TEST QUESTION REVISION ── */}
      {deckMode === 'test_srs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">SRS Test Question Revision</h3>
              <p className="text-xs text-slate-500">Specific exam questions captured from your Mock Tests, Sectionals, & Quizzes</p>
            </div>
            <button
              onClick={() => handleBatchImportMockErrors()}
              className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Import Recent Mock Mistakes</span>
            </button>
          </div>

          {/* 3 Mistake Categories Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Wrong Questions */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Wrong Answers</span>
                </span>
                <p className="text-xs text-slate-600 font-medium">Concept failures & silly errors</p>
              </div>
              <span className="text-2xl font-black text-rose-700">
                {testCards.filter(c => c.source === 'quiz_wrong' || c.source === 'mock_error').length}
              </span>
            </div>

            {/* Speed Traps / Slow Questions */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Speed-Trap Questions</span>
                </span>
                <p className="text-xs text-slate-600 font-medium">Questions exceeding time budget</p>
              </div>
              <span className="text-2xl font-black text-amber-800">
                {testCards.filter(c => (c.topic || '').toLowerCase().includes('speed') || c.sourceTitle?.includes('Speed')).length}
              </span>
            </div>

            {/* Unattempted Questions */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Unattempted Questions</span>
                </span>
                <p className="text-xs text-slate-600 font-medium">Skipped questions needing practice</p>
              </div>
              <span className="text-2xl font-black text-slate-800">
                {testCards.filter(c => c.source === 'quiz_unattempted').length}
              </span>
            </div>
          </div>

          {/* 4 Subject Error Decks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* English Mistakes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                    English Errors
                  </span>
                  {testStats.bySubject.english.due > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {testStats.bySubject.english.due} Due
                    </span>
                  )}
                </div>
                <h4 className="font-black text-slate-900 text-base">English Mock Questions</h4>
                <p className="text-xs text-slate-500 mt-1">Grammar rules, spotting errors, cloze tests, and reading questions</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  <strong>{testStats.bySubject.english.total}</strong> Mistake Qs
                </div>
                <button
                  onClick={() => handleStartReview('english', 'test_srs')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Review Errors
                </button>
              </div>
            </div>

            {/* General Awareness Mistakes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                    GA Errors
                  </span>
                  {testStats.bySubject.gk.due > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {testStats.bySubject.gk.due} Due
                    </span>
                  )}
                </div>
                <h4 className="font-black text-slate-900 text-base">General Awareness Qs</h4>
                <p className="text-xs text-slate-500 mt-1">Facts, dates, articles, and scientific terms missed in mock tests</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  <strong>{testStats.bySubject.gk.total}</strong> Mistake Qs
                </div>
                <button
                  onClick={() => handleStartReview('gk', 'test_srs')}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Review Errors
                </button>
              </div>
            </div>

            {/* Quant Mistakes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                    Quant Errors
                  </span>
                  {testStats.bySubject.mathematics.due > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {testStats.bySubject.mathematics.due} Due
                    </span>
                  )}
                </div>
                <h4 className="font-black text-slate-900 text-base">Quant Questions</h4>
                <p className="text-xs text-slate-500 mt-1">Calculation blunders, trap options, geometry, and arithmetic word problems</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  <strong>{testStats.bySubject.mathematics.total}</strong> Mistake Qs
                </div>
                <button
                  onClick={() => handleStartReview('mathematics', 'test_srs')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Review Errors
                </button>
              </div>
            </div>

            {/* Reasoning Mistakes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                    Reasoning Errors
                  </span>
                  {testStats.bySubject.reasoning.due > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {testStats.bySubject.reasoning.due} Due
                    </span>
                  )}
                </div>
                <h4 className="font-black text-slate-900 text-base">Reasoning Questions</h4>
                <p className="text-xs text-slate-500 mt-1">Number series traps, tricky analogies, statement conclusions, & seating puzzles</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  <strong>{testStats.bySubject.reasoning.total}</strong> Mistake Qs
                </div>
                <button
                  onClick={() => handleStartReview('reasoning', 'test_srs')}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Review Errors
                </button>
              </div>
            </div>
          </div>

          {/* Quick Mock Import Actions */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Download className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Import Subject Mistakes into SRS</h4>
              </div>
              <span className="text-[11px] text-slate-500">Inspect & confirm before adding</span>
            </div>

            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <button
                onClick={() => handleBatchImportMockErrors('English')}
                className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>Import English Mock Errors</span>
              </button>
              <button
                onClick={() => handleBatchImportMockErrors('General Awareness')}
                className="px-3.5 py-2 bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-sky-600" />
                <span>Import GA Mock Errors</span>
              </button>
              <button
                onClick={() => handleBatchImportMockErrors('Mathematics')}
                className="px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Target className="w-3.5 h-3.5 text-amber-600" />
                <span>Import Quant Mock Errors</span>
              </button>
              <button
                onClick={() => handleBatchImportMockErrors('Reasoning')}
                className="px-3.5 py-2 bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5 text-purple-600" />
                <span>Import Reasoning Mock Errors</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
