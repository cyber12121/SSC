import fs from 'fs';
import path from 'path';
import { sanitizeTelegramQuiz, TelegramQuizQuestion, shuffle } from './quizData';

export interface SetEntry {
  id: string;
  title: string;
  filePath: string;
  totalQuestions: number;
}

export interface TopicEntry {
  id: string;
  title: string;
  sets: SetEntry[];
}

export interface SectionEntry {
  id: string;
  title: string;
  topics: TopicEntry[];
}

export interface SubjectEntry {
  id: string;
  title: string;
  sections?: SectionEntry[];
  topics?: TopicEntry[];
}

const ROOT_DIR = process.cwd();
const CHAPTER_BANK_DIR = path.join(ROOT_DIR, 'src', 'data', 'chapter_bank');
const MOCK_ERRORS_DIR = path.join(ROOT_DIR, 'src', 'data', 'mock_errors');
const DRILLS_DIR = path.join(ROOT_DIR, 'src', 'data', 'drills');

// Central action registry to bypass Telegram's 64-byte callback_data limit
const actionRegistry = new Map<string, any>();
let nextActionId = 1;

export function registerAction(data: any): string {
  const id = `a_${nextActionId++}`;
  actionRegistry.set(id, data);
  return id;
}

export function getAction(id: string): any {
  return actionRegistry.get(id);
}

// ----------------------------------------------------
// 1. SCAN AND INDEX CHAPTER BANK
// ----------------------------------------------------

export function getEnglishCatalog(): SectionEntry[] {
  const sections: SectionEntry[] = [];

  // Black Book
  const bbDir = path.join(CHAPTER_BANK_DIR, 'english', 'black_book');
  if (fs.existsSync(bbDir)) {
    const bbTopics: TopicEntry[] = [];

    const topicMap: Record<string, string> = {
      synonyms: '🔤 Synonyms',
      one_word_substitution: '📝 One Word Substitution',
      phrasal_verbs: '🔄 Phrasal Verbs',
    };

    for (const [folderName, label] of Object.entries(topicMap)) {
      const folderPath = path.join(bbDir, folderName);
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
            sets.push({
              id: `${folderName}_${file.replace('.json', '')}`,
              title: content.chapter_title || file.replace('.json', '').replace('_', ' ').toUpperCase(),
              filePath,
              totalQuestions: qs.length,
            });
          } catch {}
        }

        bbTopics.push({
          id: folderName,
          title: label,
          sets,
        });
      }
    }

    sections.push({
      id: 'black_book',
      title: '📚 Black Book (Vocabulary)',
      topics: bbTopics,
    });
  }

  // Ayush Vocab
  const ayushDir = path.join(CHAPTER_BANK_DIR, 'english', 'ayush_vocab');
  if (fs.existsSync(ayushDir)) {
    const ayushTopics: TopicEntry[] = [];
    const topicMap: Record<string, string> = {
      idioms_and_phrases: '💬 Idioms & Phrases',
      antonyms: '🔡 Antonyms',
      spellings: '✍️ Spellings',
    };

    for (const [folderName, label] of Object.entries(topicMap)) {
      const folderPath = path.join(ayushDir, folderName);
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
            sets.push({
              id: `ayush_${folderName}_${file.replace('.json', '')}`,
              title: content.chapter_title || file.replace('.json', '').replace('_', ' ').toUpperCase(),
              filePath,
              totalQuestions: qs.length,
            });
          } catch {}
        }

        ayushTopics.push({
          id: folderName,
          title: label,
          sets,
        });
      }
    }

    sections.push({
      id: 'ayush_vocab',
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
          sets.push({
            id: `top500_${folder}_${file.replace('.json', '')}`,
            title: `${folder} - ${file.replace('.json', '').replace('_', ' ').toUpperCase()}`,
            filePath,
            totalQuestions: qs.length,
          });
        } catch {}
      }

      topics.push({
        id: `math_${folder}`,
        title: `📊 ${folder}`,
        sets,
      });
    }

    sections.push({
      id: 'top500',
      title: '🏆 Top 500 Arithmetic & Advance',
      topics,
    });
  }

  // Pinnacle Math
  const pinnacleDir = path.join(CHAPTER_BANK_DIR, 'mathematics', 'pinnacle');
  if (fs.existsSync(pinnacleDir)) {
    const topicFolders = fs
      .readdirSync(pinnacleDir)
      .filter((d) => fs.statSync(path.join(pinnacleDir, d)).isDirectory());

    const topics: TopicEntry[] = [];
    for (const folder of topicFolders) {
      const folderPath = path.join(pinnacleDir, folder);
      const files = fs.readdirSync(folderPath).filter((f) => f.endsWith('.json'));

      const sets: SetEntry[] = [];
      for (const file of files) {
        try {
          const filePath = path.join(folderPath, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const qs = content.questions || [];
          sets.push({
            id: `pinnacle_${folder}_${file.replace('.json', '')}`,
            title: `${folder.replace('_', ' ').toUpperCase()} - ${file.replace('.json', '')}`,
            filePath,
            totalQuestions: qs.length,
          });
        } catch {}
      }

      topics.push({
        id: `pinnacle_${folder}`,
        title: `🏔️ ${folder.replace('_', ' ').toUpperCase()}`,
        sets,
      });
    }

    if (topics.length > 0) {
      sections.push({
        id: 'pinnacle',
        title: '🏔️ Pinnacle Mathematics',
        topics,
      });
    }
  }

  return sections;
}

export function getGeneralAwarenessCatalog(): TopicEntry[] {
  const gaDir = path.join(CHAPTER_BANK_DIR, 'general_awareness');
  if (!fs.existsSync(gaDir)) return [];

  const topicDisplayNames: Record<string, string> = {
    polity: '🏛️ Indian Polity & Constitution',
    history_modern: '📜 Modern Indian History',
    history_ancient: '🏰 Ancient History',
    history_medieval: '⚔️ Medieval History',
    geography: '🌍 Geography (Physical & Indian)',
    biology: '🧬 Biology & Life Sciences',
    chemistry: '⚗️ Chemistry',
    physics: '⚛️ Physics',
    economics: '📈 Economics',
    static_gk: '🎭 Static GK & Culture',
  };

  const topics: TopicEntry[] = [];

  for (const [folder, title] of Object.entries(topicDisplayNames)) {
    const folderPath = path.join(gaDir, folder);
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
          sets.push({
            id: `ga_${folder}_${file.replace('.json', '')}`,
            title: content.chapter_title || file.replace('.json', '').replace(/_/g, ' '),
            filePath,
            totalQuestions: qs.length,
          });
        } catch {}
      }

      topics.push({
        id: folder,
        title,
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
    title: string;
  }[] = [
    { id: 'mathematics', title: '📐 Mathematics Mistakes' },
    { id: 'reasoning', title: '🧠 Reasoning Mistakes' },
    { id: 'english', title: '📖 English Mistakes' },
    { id: 'general_awareness', title: '🏛️ General Awareness Mistakes' },
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
      title: s.title,
      totalQuestions,
      chapters,
    });
  }

  return result;
}

// ----------------------------------------------------
// 3. LOAD QUESTIONS FOR ANY SET
// ----------------------------------------------------

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
