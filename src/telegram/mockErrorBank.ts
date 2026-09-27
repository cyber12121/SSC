import { TelegramQuizQuestion, sanitizeTelegramQuiz, shuffle } from './quizData';
import englishMockRaw from '../data/mock_errors/english.json';
import mathMockRaw from '../data/mock_errors/mathematics.json';
import reasMockRaw from '../data/mock_errors/reasoning.json';
import gaMockRaw from '../data/mock_errors/general_awareness.json';

export interface MockChapterItem {
  name: string;
  slug: string;
  count: number;
}

export interface MockSubjectInfo {
  id: 'english' | 'mathematics' | 'reasoning' | 'general_awareness';
  shortCode: 'eng' | 'math' | 'reas' | 'ga';
  title: string;
  total: number;
  chapters: MockChapterItem[];
}

const MOCK_RAW_MAP: Record<string, any[]> = {
  english: englishMockRaw as any[],
  mathematics: mathMockRaw as any[],
  reasoning: reasMockRaw as any[],
  general_awareness: gaMockRaw as any[],
};

const parsedMockQuestionsCache = new Map<string, TelegramQuizQuestion[]>();

export function getMockQuestionsForSubject(subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness'): TelegramQuizQuestion[] {
  if (parsedMockQuestionsCache.has(subject)) {
    return parsedMockQuestionsCache.get(subject)!;
  }

  const results: TelegramQuizQuestion[] = [];
  const rawList = MOCK_RAW_MAP[subject] || [];

  for (const chapter of rawList) {
    if (Array.isArray(chapter.questions)) {
      for (let idx = 0; idx < chapter.questions.length; idx++) {
        const q = chapter.questions[idx];
        const qText = (q.question || q.questionText || '').replace(/^\s*\[.*?\]\s*/g, '').trim();
        if (!qText) continue;

        const sanitized = sanitizeTelegramQuiz({
          id: q.id || `mock_${subject}_${idx}`,
          question: qText,
          options: q.options,
          correctOption: q.answer || q.correctOption || q.correct_answer,
          solution: q.solution,
          subject: subject === 'english' ? 'English' : subject === 'mathematics' ? 'Mathematics' : subject === 'reasoning' ? 'Reasoning' : 'General Awareness',
          topic: q.subtopic || q.topic || q.conceptTested || 'Error Bank',
          source: q.testName || '💻 Website Mock Error',
        });
        results.push(sanitized);
      }
    }
  }

  parsedMockQuestionsCache.set(subject, results);
  return results;
}

export function classifyMockTopic(q: TelegramQuizQuestion, subject: string): { topic: string; slug: string } {
  const text = `${q.question} ${q.explanation || ''} ${q.topic || ''}`.toLowerCase();

  if (subject === 'english') {
    if (text.includes('synonym') || text.includes('similar meaning')) return { topic: '🔤 Synonyms', slug: 'syn' };
    if (text.includes('antonym') || text.includes('opposite')) return { topic: '🔠 Antonyms', slug: 'ant' };
    if (text.includes('one word') || text.includes('ows') || text.includes('substituted')) return { topic: '📝 One Word Substitution', slug: 'ows' };
    if (text.includes('idiom') || text.includes('phrase')) return { topic: '💬 Idioms & Phrases', slug: 'idiom' };
    if (text.includes('spelling') || text.includes('misspelt') || text.includes('correctly spelt')) return { topic: '🔤 Spelling Errors', slug: 'spell' };
    if (text.includes('spotting') || text.includes('grammatical error') || text.includes('error spotting')) return { topic: '🔍 Spotting Errors', slug: 'error' };
    if (text.includes('improvement') || text.includes('filler') || text.includes('blank')) return { topic: '📑 Sentence Improvement', slug: 'improve' };
    if (text.includes('voice') || text.includes('passive')) return { topic: '📢 Active & Passive Voice', slug: 'voice' };
    if (text.includes('narration') || text.includes('direct') || text.includes('indirect')) return { topic: '🗣️ Direct & Indirect Speech', slug: 'narration' };
    if (text.includes('jumble') || text.includes('pqrs') || text.includes('rearrangement')) return { topic: '🧩 Para Jumbles (PQRS)', slug: 'pqrs' };
    if (text.includes('cloze') || text.includes('comprehension')) return { topic: '📖 Cloze & Comprehension', slug: 'cloze' };
    return { topic: '📚 Vocabulary & Grammar', slug: 'vocab' };
  }

  if (subject === 'mathematics') {
    if (text.includes('algebra') || text.includes('polynomial') || text.includes('quadratic')) return { topic: '📐 Algebra & Polynomials', slug: 'algebra' };
    if (text.includes('trigonometr') || text.includes('sin') || text.includes('cos') || text.includes('tan') || text.includes('height')) return { topic: '📐 Trigonometry', slug: 'trigo' };
    if (text.includes('geometry') || text.includes('circle') || text.includes('triangle') || text.includes('chord') || text.includes('tangent')) return { topic: '📐 Geometry & Circles', slug: 'geom' };
    if (text.includes('mensuration') || text.includes('cylinder') || text.includes('cone') || text.includes('sphere') || text.includes('volume') || text.includes('area')) return { topic: '📦 Mensuration (2D/3D)', slug: 'mens' };
    if (text.includes('number system') || text.includes('divisib') || text.includes('remainder') || text.includes('hcf') || text.includes('lcm')) return { topic: '🔢 Number System & HCF/LCM', slug: 'num' };
    if (text.includes('profit') || text.includes('loss') || text.includes('discount') || text.includes('marked price')) return { topic: '🏷️ Profit, Loss & Discount', slug: 'pnl' };
    if (text.includes('percent') || text.includes('percentage')) return { topic: '📊 Percentages', slug: 'pct' };
    if (text.includes('ratio') || text.includes('proportion')) return { topic: '⚖️ Ratio & Proportion', slug: 'ratio' };
    if (text.includes('simple interest') || text.includes('compound interest') || text.includes('ci') || text.includes('si')) return { topic: '💰 Simple & Compound Interest', slug: 'si_ci' };
    if (text.includes('time and work') || text.includes('pipe') || text.includes('cistern')) return { topic: '⏱️ Time, Work & Pipes', slug: 'work' };
    if (text.includes('speed') || text.includes('distance') || text.includes('train') || text.includes('boat') || text.includes('stream')) return { topic: '🚆 Speed, Time & Distance', slug: 'speed' };
    if (text.includes('average') || text.includes('alligation') || text.includes('mixture')) return { topic: '🥣 Average & Mixtures', slug: 'avg' };
    if (text.includes('data interpretation') || text.includes('bar graph') || text.includes('pie chart') || text.includes('table')) return { topic: '📈 Data Interpretation', slug: 'di' };
    return { topic: '🔢 Arithmetic & Quantitative', slug: 'arith' };
  }

  if (subject === 'reasoning') {
    if (text.includes('syllogism') || text.includes('conclusion')) return { topic: '🧠 Syllogism', slug: 'syl' };
    if (text.includes('analogy') || text.includes('related')) return { topic: '🔗 Analogy & Similarity', slug: 'analogy' };
    if (text.includes('coding') || text.includes('decoding')) return { topic: '🔐 Coding & Decoding', slug: 'coding' };
    if (text.includes('series') || text.includes('missing term')) return { topic: '🔢 Number & Letter Series', slug: 'series' };
    if (text.includes('blood relation') || text.includes('mother') || text.includes('father') || text.includes('sister')) return { topic: '👥 Blood Relations', slug: 'blood' };
    if (text.includes('direction') || text.includes('distance') || text.includes('north') || text.includes('south')) return { topic: '🧭 Direction & Distance', slug: 'direction' };
    if (text.includes('venn') || text.includes('diagram')) return { topic: '⭕ Venn Diagrams', slug: 'venn' };
    if (text.includes('paper folding') || text.includes('cube') || text.includes('dice') || text.includes('mirror') || text.includes('embedded')) return { topic: '🎲 Non-Verbal & Pattern', slug: 'nonverbal' };
    return { topic: '🧠 General Reasoning', slug: 'reason_gen' };
  }

  // general_awareness
  if (text.includes('polity') || text.includes('article') || text.includes('constitution') || text.includes('amendment') || text.includes('parliament')) return { topic: '🏛️ Polity & Constitution', slug: 'polity' };
  if (text.includes('history') || text.includes('mughal') || text.includes('delhi') || text.includes('british') || text.includes('battle') || text.includes('gandhi')) return { topic: '📜 Indian History', slug: 'history' };
  if (text.includes('geography') || text.includes('river') || text.includes('mountain') || text.includes('climate') || text.includes('soil') || text.includes('national park')) return { topic: '🌍 Geography & Environment', slug: 'geo' };
  if (text.includes('economy') || text.includes('economic') || text.includes('budget') || text.includes('gdp') || text.includes('inflation') || text.includes('rbi')) return { topic: '💹 Economics & Finance', slug: 'eco' };
  if (text.includes('biology') || text.includes('cell') || text.includes('disease') || text.includes('vitamin') || text.includes('hormone') || text.includes('plant')) return { topic: '🧬 Biology & Life Sciences', slug: 'bio' };
  if (text.includes('physics') || text.includes('motion') || text.includes('optics') || text.includes('energy') || text.includes('gravity')) return { topic: '⚛️ Physics', slug: 'phys' };
  if (text.includes('chemistry') || text.includes('acid') || text.includes('base') || text.includes('metal') || text.includes('compound') || text.includes('reaction')) return { topic: '🧪 Chemistry', slug: 'chem' };
  if (text.includes('dance') || text.includes('music') || text.includes('festival') || text.includes('temple') || text.includes('folk')) return { topic: '🎭 Art, Culture & Dances', slug: 'art' };
  return { topic: '🌐 General Awareness & Static GK', slug: 'gk_static' };
}

export function getMockErrorSubjectsSummary(): MockSubjectInfo[] {
  const subjects: Array<{ id: 'english' | 'mathematics' | 'reasoning' | 'general_awareness'; shortCode: 'eng' | 'math' | 'reas' | 'ga'; title: string }> = [
    { id: 'english', shortCode: 'eng', title: '📖 English' },
    { id: 'mathematics', shortCode: 'math', title: '📐 Mathematics' },
    { id: 'reasoning', shortCode: 'reas', title: '🧠 Reasoning' },
    { id: 'general_awareness', shortCode: 'ga', title: '🏛️ General Awareness' },
  ];

  return subjects.map((sub) => {
    const questions = getMockQuestionsForSubject(sub.id);
    const chapterMap = new Map<string, MockChapterItem>();

    for (const q of questions) {
      const { topic, slug } = classifyMockTopic(q, sub.id);
      const existing = chapterMap.get(slug) || { name: topic, slug, count: 0 };
      existing.count++;
      chapterMap.set(slug, existing);
    }

    const chapters = Array.from(chapterMap.values()).sort((a, b) => b.count - a.count);

    return {
      id: sub.id,
      shortCode: sub.shortCode,
      title: sub.title,
      total: questions.length,
      chapters,
    };
  });
}

export function getMockErrorQuestions(
  subject: 'english' | 'mathematics' | 'reasoning' | 'general_awareness',
  chapterSlug?: string,
  mode: 'all' | '10' = 'all'
): TelegramQuizQuestion[] {
  const allQs = getMockQuestionsForSubject(subject);
  let matched = allQs;

  if (chapterSlug && chapterSlug !== '_') {
    matched = allQs.filter((q) => {
      const { slug } = classifyMockTopic(q, subject);
      return slug === chapterSlug;
    });
  }

  if (mode === '10' && matched.length > 10) {
    return shuffle(matched).slice(0, 10);
  }

  return matched;
}
