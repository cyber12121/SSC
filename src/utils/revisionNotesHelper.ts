import { safeStorage } from './safeStorage';

export interface RevisionNoteItem {
  id: string;
  type: 'tommy_insight' | 'user_note' | 'concept';
  subject?: string;
  topic?: string;
  questionId?: string;
  questionText?: string;
  questionSnippet?: string;
  text: string;
  createdAt: string;
  tags?: string[];
}

export interface SillyNotebookItem {
  id: string;
  reason: string;
  chipLabel?: string;
  subject?: string;
  topic?: string;
  questionId?: string;
  questionText?: string;
  createdAt: string;
}

const REVISION_NOTES_KEY = 'cgl_revision_notes';
const SILLY_NOTEBOOK_KEY = 'cgl_silly_notebook';
export const REVISION_NOTEBOOK_EVENT = 'cgl_revision_notebook_updated';

function notifyNotebookUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REVISION_NOTEBOOK_EVENT));
  }
}

/**
 * Normalizes question key for lookup
 */
export function normalizeKey(str: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/[\$\\\{\}\_\^\s\.,\-\?!;:'"()\[\]]/g, '');
}

/**
 * Returns all user notes and Tommy insights
 */
export function getAllRevisionNotes(): RevisionNoteItem[] {
  try {
    const raw = safeStorage.getItem(REVISION_NOTES_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {
    console.warn('[revisionNotesHelper] Failed to read revision notes:', e);
  }
  return [];
}

/**
 * Saves or updates a revision note
 */
export function saveRevisionNote(entry: {
  id?: string;
  text: string;
  type?: 'tommy_insight' | 'user_note' | 'concept';
  subject?: string;
  topic?: string;
  questionId?: string;
  questionText?: string;
  questionSnippet?: string;
  tags?: string[];
}): RevisionNoteItem {
  const current = getAllRevisionNotes();
  const cleanText = (entry.text || '').trim();
  const noteId = entry.id || (entry.questionId ? `note_q_${entry.questionId}` : `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);

  // Check if updating existing note
  const existingIdx = current.findIndex(n => n.id === noteId || (entry.questionId && n.questionId === entry.questionId));

  const noteItem: RevisionNoteItem = {
    id: existingIdx >= 0 ? current[existingIdx].id : noteId,
    type: entry.type || (existingIdx >= 0 ? current[existingIdx].type : 'user_note'),
    subject: entry.subject || (existingIdx >= 0 ? current[existingIdx].subject : 'General'),
    topic: entry.topic || (existingIdx >= 0 ? current[existingIdx].topic : 'Revision'),
    questionId: entry.questionId || (existingIdx >= 0 ? current[existingIdx].questionId : undefined),
    questionText: entry.questionText || (existingIdx >= 0 ? current[existingIdx].questionText : undefined),
    questionSnippet: entry.questionSnippet || (existingIdx >= 0 ? current[existingIdx].questionSnippet : undefined),
    text: cleanText,
    createdAt: existingIdx >= 0 ? current[existingIdx].createdAt : new Date().toISOString(),
    tags: entry.tags || (existingIdx >= 0 ? current[existingIdx].tags : [])
  };

  if (existingIdx >= 0) {
    current[existingIdx] = noteItem;
  } else {
    current.unshift(noteItem);
  }

  try {
    safeStorage.setItem(REVISION_NOTES_KEY, JSON.stringify(current));
    notifyNotebookUpdate();
  } catch (e) {
    console.error('[revisionNotesHelper] Error saving revision note:', e);
  }

  return noteItem;
}

/**
 * Updates text of an existing revision note
 */
export function updateRevisionNote(id: string, text: string): void {
  const current = getAllRevisionNotes();
  const idx = current.findIndex(n => n.id === id);
  if (idx >= 0) {
    current[idx].text = text.trim();
    try {
      safeStorage.setItem(REVISION_NOTES_KEY, JSON.stringify(current));
      notifyNotebookUpdate();
    } catch (e) {
      console.error('[revisionNotesHelper] Error updating revision note:', e);
    }
  }
}

/**
 * Deletes a revision note
 */
export function deleteRevisionNote(id: string): void {
  const current = getAllRevisionNotes();
  const filtered = current.filter(n => n.id !== id);
  try {
    safeStorage.setItem(REVISION_NOTES_KEY, JSON.stringify(filtered));
    notifyNotebookUpdate();
  } catch (e) {
    console.error('[revisionNotesHelper] Error deleting revision note:', e);
  }
}

/**
 * Gets note attached to a specific question
 */
export function getNoteForQuestion(questionId?: string, questionText?: string): RevisionNoteItem | undefined {
  if (!questionId && !questionText) return undefined;
  const list = getAllRevisionNotes();
  if (questionId) {
    const found = list.find(n => n.questionId === questionId || n.id === `note_q_${questionId}`);
    if (found) return found;
  }
  if (questionText) {
    const norm = normalizeKey(questionText);
    const found = list.find(n => n.questionText && normalizeKey(n.questionText) === norm);
    if (found) return found;
  }
  return undefined;
}

/**
 * Returns all silly notebook entries (custom entries + harvested from RCA store)
 */
export function getAllSillyNotebookItems(): SillyNotebookItem[] {
  const items: SillyNotebookItem[] = [];
  const seen = new Set<string>();

  // 1. Load explicitly created notebook entries
  try {
    const raw = safeStorage.getItem(SILLY_NOTEBOOK_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((it: SillyNotebookItem) => {
          const key = it.reason?.trim().toLowerCase();
          if (key && !seen.has(key)) {
            seen.add(key);
            items.push(it);
          }
        });
      }
    }
  } catch (e) {
    console.warn('[revisionNotesHelper] Error reading silly notebook:', e);
  }

  // 2. Harvest from global RCA store if not already present
  try {
    const rawRca = safeStorage.getItem('cgl_rca_global_store');
    if (rawRca) {
      const rcaMap = JSON.parse(rawRca);
      Object.entries(rcaMap).forEach(([k, val]: [string, any]) => {
        if (val && (val.tag === 'S' || val.tag === 'A') && val.sillyMistakeNote) {
          const noteText = String(val.sillyMistakeNote).trim();
          if (noteText.length > 1) {
            const key = noteText.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              items.push({
                id: `silly_rca_${k}`,
                reason: noteText,
                subject: val.subject || 'General',
                topic: val.topic || 'Silly Mistake',
                questionId: k,
                createdAt: val.classifiedAt || new Date().toISOString()
              });
            }
          }
        }
      });
    }
  } catch {}

  return items;
}

/**
 * Adds a new silly mistake entry to the notebook
 */
export function addSillyNotebookItem(entry: {
  id?: string;
  reason: string;
  chipLabel?: string;
  subject?: string;
  topic?: string;
  questionId?: string;
  questionText?: string;
}): SillyNotebookItem {
  const rawList: SillyNotebookItem[] = [];
  try {
    const raw = safeStorage.getItem(SILLY_NOTEBOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rawList.push(...parsed);
    }
  } catch {}

  const newItem: SillyNotebookItem = {
    id: entry.id || `silly_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    reason: entry.reason.trim(),
    chipLabel: entry.chipLabel,
    subject: entry.subject || 'General',
    topic: entry.topic || 'Silly Mistake',
    questionId: entry.questionId,
    questionText: entry.questionText,
    createdAt: new Date().toISOString()
  };

  rawList.unshift(newItem);

  try {
    safeStorage.setItem(SILLY_NOTEBOOK_KEY, JSON.stringify(rawList));
    notifyNotebookUpdate();
  } catch (e) {
    console.error('[revisionNotesHelper] Error adding silly notebook item:', e);
  }

  return newItem;
}

/**
 * Updates a silly mistake reason
 */
export function updateSillyNotebookItem(id: string, reason: string): void {
  const rawList: SillyNotebookItem[] = [];
  try {
    const raw = safeStorage.getItem(SILLY_NOTEBOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rawList.push(...parsed);
    }
  } catch {}

  const idx = rawList.findIndex(it => it.id === id);
  if (idx >= 0) {
    rawList[idx].reason = reason.trim();
    try {
      safeStorage.setItem(SILLY_NOTEBOOK_KEY, JSON.stringify(rawList));
      notifyNotebookUpdate();
    } catch {}
  }
}

/**
 * Deletes a silly mistake entry from the notebook
 */
export function deleteSillyNotebookItem(id: string): void {
  const rawList: SillyNotebookItem[] = [];
  try {
    const raw = safeStorage.getItem(SILLY_NOTEBOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rawList.push(...parsed);
    }
  } catch {}

  const filtered = rawList.filter(it => it.id !== id);
  try {
    safeStorage.setItem(SILLY_NOTEBOOK_KEY, JSON.stringify(filtered));
    notifyNotebookUpdate();
  } catch {}
}
