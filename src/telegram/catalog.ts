import fs from 'fs';
import path from 'path';
import { sanitizeTelegramQuiz, TelegramQuizQuestion, shuffle } from './quizData';

export interface SetEntry {
  id: string;
  code: string;
  title: string;
  filePath: string;
  totalQuestions: number;
}

export interface TopicEntry {
  id: string;
  code: string;
  title: string;
  sets: SetEntry[];
}

export interface SectionEntry {
  id: string;
  code: string;
  title: string;
  topics: TopicEntry[];
}

import { fileURLToPath } from 'url';

let moduleDir = process.cwd();
try {
  moduleDir = path.dirname(fileURLToPath(import.meta.url));
} catch {}

function resolveDataDir(subPath: string): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'data', subPath),
    path.join(process.cwd(), 'data', subPath),
    path.join(moduleDir, 'src', 'data', subPath),
    path.join(moduleDir, '..', 'src', 'data', subPath),
    path.join(moduleDir, 'data', subPath),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const CHAPTER_BANK_DIR = resolveDataDir('chapter_bank');
const MOCK_ERRORS_DIR = resolveDataDir('mock_errors');

// ----------------------------------------------------
// 1. SCAN AND INDEX CHAPTER BANK
// ----------------------------------------------------

export function getEnglishCatalog(): SectionEntry[] {
  const sections: SectionEntry[] = [];

  // Black Book
  const bbDir = path.join(CHAPTER_BANK_DIR, 'english', 'black_book');
  if (fs.existsSync(bbDir)) {
    const bbTopics: TopicEntry[] = [];
    const topicDefs = [
      { folder: 'synonyms', code: 'syn', label: '🔤 Synonyms' },
      { folder: 'one_word_substitution', code: 'ows', label: '📝 One Word Substitution' },
      { folder: 'phrasal_verbs', code: 'phr', label: '🔄 Phrasal Verbs' },
    ];

    for (const t of topicDefs) {
      const folderPath = path.join(bbDir, t.folder);
      if (fs.existsSync(folderPath)) {
        const files = fs
          .readdirSync(folderPath)
          .filter((f) => f.endsWith('.json'))
          .sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, '') || '0', 10);
            const numB = parseInt(b.replace(/[^0-9]/g, '') || '0', 10);
            return numA - numB;
          });

        const sets: SetEntry[] = [];
        for (const file of files) {
          try {
            const filePath = path.join(folderPath, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const qs = content.questions || [];
            const setNum = file.replace(/[^0-9]/g, '') || '1';
            sets.push({
              id: `${t.code}_${setNum}`,
              code: setNum,
              title: content.chapter_title || `Set ${setNum}`,
              filePath,
              totalQuestions: qs.length,
            });
          } catch {}
        }

        bbTopics.push({
          id: t.folder,
          code: t.code,
          title: t.label,
          sets,
        });
      }
    }

    sections.push({
      id: 'black_book',
      code: 'bb',
      title: '📚 Black Book (Vocabulary)',
      topics: bbTopics,
    });
  }

  // Ayush Vocab
  const ayushDir = path.join(CHAPTER_BANK_DIR, 'english', 'ayush_vocab');
  if (fs.existsSync(ayushDir)) {
    const ayushTopics: TopicEntry[] = [];
    const topicDefs = [
      { folder: 'idioms_and_phrases', code: 'idiom', label: '💬 Idioms & Phrases' },
      { folder: 'antonyms', code: 'ant', label: '🔡 Antonyms' },
      { folder: 'spellings', code: 'spell', label: '✍️ Spellings' },
    ];

    for (const t of topicDefs) {
      const folderPath = path.join(ayushDir, t.folder);
      if (fs.existsSync(folderPath)) {
        const files = fs
          .readdirSync(folderPath)
          .filter((f) => f.endsWith('.json'))
          .sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, '') || '0', 10);
            const numB = parseInt(b.replace(/[^0-9]/g, '') || '0', 10);
            return numA - numB;
          });

        const sets: SetEntry[] = [];
        for (const file of files) {
          try {
            const filePath = path.join(folderPath, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const qs = content.questions || [];
            const setNum = file.replace(/[^0-9]/g, '') || '1';
            sets.push({
              id: `${t.code}_${setNum}`,
              code: setNum,
              title: content.chapter_title || `Set ${setNum}`,
              filePath,
              totalQuestions: qs.length,
            });
          } catch {}
        }

        ayushTopics.push({
          id: t.folder,
          code: t.code,
          title: t.label,
          sets,
        });
      }
    }

    sections.push({
      id: 'ayush_vocab',
      code: 'ayush',
      title: '📖 Ayush Vocab (Idioms & Antonyms)',
      topics: ayushTopics,
    });
  }

  return sections;
}

export function getMathCatalog(): SectionEntry[] {
  const sections: SectionEntry[] = [];

  // Top 500 Chapters
  const top500Dir = path.join(CHAPTER_BANK_DIR, 'mathematics', 'top500');
  if (fs.existsSync(top500Dir)) {
    const topicFolders = fs
      .readdirSync(top500Dir)
      .filter((d) => fs.statSync(path.join(top500Dir, d)).isDirectory());

    const topics: TopicEntry[] = [];
    for (const folder of topicFolders) {
      const folderPath = path.join(top500Dir, folder);
      const files = fs
        .readdirSync(folderPath)
        .filter((f) => f.endsWith('.json'))
        .sort();

      const sets: SetEntry[] = [];
      for (const file of files) {
        try {
          const filePath = path.join(folderPath, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const qs = content.questions || [];
          const setNum = file.replace(/[^0-9]/g, '') || '1';
          sets.push({
            id: `t500_${folder}_${setNum}`,
            code: setNum,
            title: `${folder} - Set ${setNum}`,
            filePath,
            totalQuestions: qs.length,
          });
        } catch {}
      }

      topics.push({
        id: folder,
        code: folder.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toLowerCase(),
        title: `📊 ${folder}`,
        sets,
      });
    }

    sections.push({
      id: 'top500',
      code: 't500',
      title: '🏆 Top 500 Arithmetic & Advance',
      topics,
    });
  }

  return sections;
}

export function getGeneralAwarenessCatalog(): TopicEntry[] {
  const gaDir = path.join(CHAPTER_BANK_DIR, 'general_awareness');
  if (!fs.existsSync(gaDir)) return [];

  const topicDefs = [
    { folder: 'polity', code: 'pol', title: '🏛️ Indian Polity & Constitution' },
    { folder: 'history_modern', code: 'hmod', title: '📜 Modern Indian History' },
    { folder: 'history_ancient', code: 'hanc', title: '🏰 Ancient History' },
    { folder: 'history_medieval', code: 'hmed', title: '⚔️ Medieval History' },
    { folder: 'geography', code: 'geo', title: '🌍 Geography' },
    { folder: 'biology', code: 'bio', title: '🧬 Biology & Life Sciences' },
    { folder: 'chemistry', code: 'chem', title: '⚗️ Chemistry' },
    { folder: 'physics', code: 'phy', title: '⚛️ Physics' },
    { folder: 'economics', code: 'eco', title: '📈 Economics' },
    { folder: 'static_gk', code: 'stat', title: '🎭 Static GK & Culture' },
  ];

  const topics: TopicEntry[] = [];

  for (const t of topicDefs) {
    const folderPath = path.join(gaDir, t.folder);
    if (fs.existsSync(folderPath)) {
      const files = fs
        .readdirSync(folderPath)
        .filter((f) => f.endsWith('.json'))
        .sort();

      const sets: SetEntry[] = [];
      for (const file of files) {
        try {
          const filePath = path.join(folderPath, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const qs = content.questions || [];
          const baseName = file.replace('.json', '');
          sets.push({
            id: `ga_${t.code}_${baseName.slice(0, 15)}`,
            code: baseName,
            title: content.chapter_title || baseName.replace(/_/g, ' '),
            filePath,
            totalQuestions: qs.length,
          });
        } catch {}
      }

      topics.push({
        id: t.folder,
        code: t.code,
        title: t.title,
        sets,
      });
    }
  }

  return topics;
}

// ----------------------------------------------------
// 2. SCAN AND INDEX MOCK ERRORS
// ----------------------------------------------------

export interface MockErrorSubjectEntry {
  subjectId: 'mathematics' | 'reasoning' | 'english' | 'general_awareness';
  code: string;
  title: string;
  totalQuestions: number;
  chapters: {
    title: string;
    count: number;
    chapterNum?: number;
  }[];
}

export function getMockErrorsCatalog(): MockErrorSubjectEntry[] {
  const subjects: {
    id: 'mathematics' | 'reasoning' | 'english' | 'general_awareness';
    code: string;
    title: string;
  }[] = [
    { id: 'mathematics', code: 'math', title: '📐 Mathematics Mistakes' },
    { id: 'reasoning', code: 'reason', title: '🧠 Reasoning Mistakes' },
    { id: 'english', code: 'eng', title: '📖 English Mistakes' },
    { id: 'general_awareness', code: 'ga', title: '🏛️ General Awareness Mistakes' },
  ];

  const result: MockErrorSubjectEntry[] = [];

  for (const s of subjects) {
    const filePath = path.join(MOCK_ERRORS_DIR, `${s.id}.json`);
    let totalQuestions = 0;
    const chapters: { title: string; count: number; chapterNum?: number }[] = [];

    if (fs.existsSync(filePath)) {
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(content)) {
          for (const item of content) {
            const count = (item.questions && item.questions.length) || 0;
            totalQuestions += count;
            chapters.push({
              title: item.chapter_title || item.title || 'Error Group',
              count,
              chapterNum: item.chapter_num,
            });
          }
        }
      } catch {}
    }

    result.push({
      subjectId: s.id,
      code: s.code,
      title: s.title,
      totalQuestions,
      chapters,
    });
  }

  return result;
}

// ----------------------------------------------------
// 3. STATELSS SET RESOLVERS & QUESTION LOADERS
// ----------------------------------------------------

export function resolveEnglishSetFile(secCode: string, topicCode: string, setCode: string): { filePath: string; title: string; total: number } | null {
  const catalog = getEnglishCatalog();
  const sec = catalog.find((s) => s.code === secCode);
  const topic = sec?.topics.find((t) => t.code === topicCode);
  const set = topic?.sets.find((s) => s.code === setCode);
  if (!set) return null;
  return { filePath: set.filePath, title: set.title, total: set.totalQuestions };
}

export function resolveMathSetFile(topicCode: string, setCode: string): { filePath: string; title: string; total: number } | null {
  const catalog = getMathCatalog();
  for (const sec of catalog) {
    const topic = sec.topics.find((t) => t.code === topicCode || t.id.toLowerCase() === topicCode.toLowerCase());
    if (topic) {
      const set = topic.sets.find((s) => s.code === setCode);
      if (set) return { filePath: set.filePath, title: set.title, total: set.totalQuestions };
    }
  }
  return null;
}

export function resolveGASetFile(topicCode: string, setCode: string): { filePath: string; title: string; total: number } | null {
  const catalog = getGeneralAwarenessCatalog();
  const topic = catalog.find((t) => t.code === topicCode || t.id === topicCode);
  const set = topic?.sets.find((s) => s.code === setCode);
  if (!set) return null;
  return { filePath: set.filePath, title: set.title, total: set.totalQuestions };
}

export function loadQuestionsFromSet(
  filePath: string,
  mode: 'all' | '10' = 'all'
): TelegramQuizQuestion[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rawQs: any[] = content.questions || [];
    if (rawQs.length === 0) return [];

    let chosen = rawQs;
    if (mode === '10' && rawQs.length > 10) {
      chosen = shuffle(rawQs).slice(0, 10);
    }

    return chosen.map((q, idx) =>
      sanitizeTelegramQuiz({
        id: q.id || `set_q_${idx}_${Date.now()}`,
        question: q.question || q.questionText,
        options: q.options,
        correctOption: q.answer || q.correctOption || q.correct_answer,
        solution: q.solution,
        subject: content.subject,
        topic: content.topic_name || content.chapter_title,
        source: content.chapter_title || path.basename(filePath, '.json'),
      })
    );
  } catch (e) {
    console.error(`Error loading questions from ${filePath}:`, e);
    return [];
  }
}

export function loadMockErrorsForSubject(
  subjectId: 'mathematics' | 'reasoning' | 'english' | 'general_awareness',
  chapterNum?: number,
  mode: 'all' | '10' = 'all'
): TelegramQuizQuestion[] {
  try {
    const filePath = path.join(MOCK_ERRORS_DIR, `${subjectId}.json`);
    if (!fs.existsSync(filePath)) return [];
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let matchedQs: any[] = [];

    if (Array.isArray(content)) {
      for (const item of content) {
        if (chapterNum !== undefined) {
          if (item.chapter_num === chapterNum && item.questions) {
            matchedQs.push(...item.questions);
          }
        } else if (item.questions) {
          matchedQs.push(...item.questions);
        }
      }
    }

    if (matchedQs.length === 0) return [];

    let chosen = matchedQs;
    if (mode === '10' && matchedQs.length > 10) {
      chosen = shuffle(matchedQs).slice(0, 10);
    }

    const subTitle = subjectId.charAt(0).toUpperCase() + subjectId.slice(1).replace('_', ' ');

    return chosen.map((q, idx) =>
      sanitizeTelegramQuiz({
        id: `mock_err_${subjectId}_${idx}_${Date.now()}`,
        question: `🎯 [${subTitle} Mistake]\n${q.question || q.questionText}`,
        options: q.options,
        correctOption: q.answer || q.correctOption || q.correct_answer,
        solution: q.solution,
        subject: subTitle,
        topic: q.topic || q.conceptTested || 'Error Bank',
        source: q.testName || 'Mock Error Bank',
      })
    );
  } catch (e) {
    console.error(`Error loading mock errors for ${subjectId}:`, e);
    return [];
  }
}
