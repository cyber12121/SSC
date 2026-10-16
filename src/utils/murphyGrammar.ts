import { openAiWithScope } from './aiScopeHelper';

export interface MurphyMapping {
  url: string;
  title: string;
  unitRange: string;
}

export interface MurphyUnitMeta {
  n: number;
  title: string;
  sub?: string;
  section: string;
  folder: string;
  url: string;
}

export function getMurphyUnitFolder(n: number): string {
  if (n <= 18) return '01_Present_and_Past';
  if (n <= 25) return '02_Future';
  if (n <= 37) return '03_Modals';
  if (n <= 41) return '04_If_and_Wish';
  if (n <= 46) return '05_Passive';
  if (n <= 48) return '06_Reported_Speech';
  if (n <= 52) return '07_Questions_and_Auxiliary_Verbs';
  if (n <= 68) return '08_Ing_and_To';
  if (n <= 81) return '09_Articles_and_Nouns';
  if (n <= 91) return '10_Pronouns_and_Determiners';
  if (n <= 97) return '11_Relative_Clauses';
  if (n <= 112) return '12_Adjectives_and_Adverbs';
  if (n <= 120) return '13_Conjunctions_and_Prepositions';
  if (n <= 136) return '14_Prepositions';
  return '15_Phrasal_Verbs';
}

export function getMurphyUnitUrl(n: number): string {
  const pad = String(n).padStart(3, '0');
  return `/murphy/units/${getMurphyUnitFolder(n)}/unit-${pad}.html`;
}

export const MURPHY_SECTIONS: { name: string; units: { n: number; title: string; sub?: string }[] }[] = [
  {
    name: 'Present and past',
    units: [
      { n: 1, title: 'Present continuous', sub: 'I am doing' },
      { n: 2, title: 'Present simple', sub: 'I do' },
      { n: 3, title: 'Present continuous and present simple 1', sub: 'I am doing and I do' },
      { n: 4, title: 'Present continuous and present simple 2', sub: 'I am doing and I do' },
      { n: 5, title: 'Past simple', sub: 'I did' },
      { n: 6, title: 'Past continuous', sub: 'I was doing' },
      { n: 7, title: 'Present perfect 1', sub: 'I have done' },
      { n: 8, title: 'Present perfect 2', sub: 'I have done' },
      { n: 9, title: 'Present perfect continuous', sub: 'I have been doing' },
      { n: 10, title: 'Present perfect continuous and simple', sub: 'I have been doing and I have done' },
      { n: 11, title: 'how long have you (been) …?', sub: '' },
      { n: 12, title: 'for and since · when …? · how long …?', sub: '' },
      { n: 13, title: 'Present perfect and past 1', sub: 'I have done and I did' },
      { n: 14, title: 'Present perfect and past 2', sub: 'I have done and I did' },
      { n: 15, title: 'Past perfect', sub: 'I had done' },
      { n: 16, title: 'Past perfect continuous', sub: 'I had been doing' },
      { n: 17, title: 'have and have got', sub: '' },
      { n: 18, title: 'used to (do)', sub: '' },
    ]
  },
  {
    name: 'Future',
    units: [
      { n: 19, title: 'Present tenses for the future', sub: 'I am doing / I do' },
      { n: 20, title: "I'm going to (do)", sub: '' },
      { n: 21, title: 'will and shall 1', sub: '' },
      { n: 22, title: 'will and shall 2', sub: '' },
      { n: 23, title: "I will and I'm going to", sub: '' },
      { n: 24, title: 'will be doing and will have done', sub: '' },
      { n: 25, title: "when I do and when I've done · if and when", sub: '' },
    ]
  },
  {
    name: 'Modals',
    units: [
      { n: 26, title: 'can, could and (be) able to', sub: '' },
      { n: 27, title: 'could (do) and could have (done)', sub: '' },
      { n: 28, title: "must and can't", sub: '' },
      { n: 29, title: 'may and might 1', sub: '' },
      { n: 30, title: 'may and might 2', sub: '' },
      { n: 31, title: 'have to and must', sub: '' },
      { n: 32, title: "must · mustn't · needn't", sub: '' },
      { n: 33, title: 'should 1', sub: '' },
      { n: 34, title: 'should 2', sub: '' },
      { n: 35, title: "I'd better … · it's time …", sub: '' },
      { n: 36, title: 'would', sub: '' },
      { n: 37, title: 'can/could/would you …? etc.', sub: 'Requests, offers, permission and invitations' },
    ]
  },
  {
    name: 'if and wish',
    units: [
      { n: 38, title: 'if I do … and if I did …', sub: '' },
      { n: 39, title: 'if I knew … I wish I knew …', sub: '' },
      { n: 40, title: 'if I had known … I wish I had known …', sub: '' },
      { n: 41, title: 'wish', sub: '' },
    ]
  },
  {
    name: 'Passive',
    units: [
      { n: 42, title: 'Passive 1', sub: 'is done / was done' },
      { n: 43, title: 'Passive 2', sub: 'be done / been done / being done' },
      { n: 44, title: 'Passive 3', sub: '' },
      { n: 45, title: 'it is said that … · he is said to … · he is supposed to …', sub: '' },
      { n: 46, title: 'have something done', sub: '' },
    ]
  },
  {
    name: 'Reported speech',
    units: [
      { n: 47, title: 'Reported speech 1', sub: 'he said that …' },
      { n: 48, title: 'Reported speech 2', sub: '' },
    ]
  },
  {
    name: 'Questions and auxiliary verbs',
    units: [
      { n: 49, title: 'Questions 1', sub: '' },
      { n: 50, title: 'Questions 2', sub: 'do you know where …? / he asked me where …' },
      { n: 51, title: 'Auxiliary verbs (have/do/can etc.)', sub: 'I think so / I hope so etc.' },
      { n: 52, title: 'Question tags', sub: "do you? isn't it? etc." },
    ]
  },
  {
    name: '-ing and to …',
    units: [
      { n: 53, title: 'Verb + -ing', sub: 'enjoy doing / stop doing etc.' },
      { n: 54, title: 'Verb + to …', sub: 'decide to … / forget to … etc.' },
      { n: 55, title: 'Verb (+ object) + to …', sub: 'I want you to …' },
      { n: 56, title: 'Verb + -ing or to … 1', sub: 'remember, regret etc.' },
      { n: 57, title: 'Verb + -ing or to … 2', sub: 'try, need, help' },
      { n: 58, title: 'Verb + -ing or to … 3', sub: 'like / would like etc.' },
      { n: 59, title: 'prefer and would rather', sub: '' },
      { n: 60, title: 'Preposition + -ing', sub: 'in/for/about etc.' },
      { n: 61, title: 'be/get used to …', sub: "I'm used to …" },
      { n: 62, title: 'Verb + preposition + -ing', sub: 'succeed in -ing / insist on -ing etc.' },
      { n: 63, title: "there's no point in -ing, it's worth -ing etc.", sub: '' },
      { n: 64, title: 'to …, for … and so that …', sub: '' },
      { n: 65, title: 'Adjective + to …', sub: '' },
      { n: 66, title: 'to … (afraid to do) and preposition + -ing (afraid of -ing)', sub: '' },
      { n: 67, title: 'see somebody do and see somebody doing', sub: '' },
      { n: 68, title: '-ing clauses', sub: 'He hurt his knee playing football.' },
    ]
  },
  {
    name: 'Articles and nouns',
    units: [
      { n: 69, title: 'Countable and uncountable 1', sub: '' },
      { n: 70, title: 'Countable and uncountable 2', sub: '' },
      { n: 71, title: 'Countable nouns with a/an and some', sub: '' },
      { n: 72, title: 'a/an and the', sub: '' },
      { n: 73, title: 'the 1', sub: '' },
      { n: 74, title: 'the 2', sub: 'school / the school etc.' },
      { n: 75, title: 'the 3', sub: 'children / the children' },
      { n: 76, title: 'the 4', sub: 'the giraffe / the telephone / the old etc.' },
      { n: 77, title: 'Names with and without the 1', sub: '' },
      { n: 78, title: 'Names with and without the 2', sub: '' },
      { n: 79, title: 'Singular and plural', sub: '' },
      { n: 80, title: 'Noun + noun', sub: 'a bus driver / a headache' },
      { n: 81, title: "-'s (your sister's name) and of …", sub: 'the name of the book' },
    ]
  },
  {
    name: 'Pronouns and determiners',
    units: [
      { n: 82, title: 'myself/yourself/themselves etc.', sub: '' },
      { n: 83, title: 'a friend of mine · my own house · on my own / by myself', sub: '' },
      { n: 84, title: 'there … and it …', sub: '' },
      { n: 85, title: 'some and any', sub: '' },
      { n: 86, title: 'no/none/any · nothing/nobody etc.', sub: '' },
      { n: 87, title: 'much, many, little, few, a lot, plenty', sub: '' },
      { n: 88, title: 'all / all of · most / most of · no / none of etc.', sub: '' },
      { n: 89, title: 'both / both of · neither / neither of · either / either of', sub: '' },
      { n: 90, title: 'all · every · whole', sub: '' },
      { n: 91, title: 'each and every', sub: '' },
    ]
  },
  {
    name: 'Relative clauses',
    units: [
      { n: 92, title: 'Relative clauses 1', sub: 'clauses with who/that/which' },
      { n: 93, title: 'Relative clauses 2', sub: 'clauses with and without who/that/which' },
      { n: 94, title: 'Relative clauses 3', sub: 'whose/whom/where' },
      { n: 95, title: 'Relative clauses 4', sub: 'extra information clauses (1)' },
      { n: 96, title: 'Relative clauses 5', sub: 'extra information clauses (2)' },
      { n: 97, title: '-ing and -ed clauses', sub: 'the woman talking to Tom, the boy injured in the accident' },
    ]
  },
  {
    name: 'Adjectives and adverbs',
    units: [
      { n: 98, title: 'Adjectives ending in -ing and -ed', sub: 'boring/bored etc.' },
      { n: 99, title: 'Adjectives', sub: 'a nice new house, you look tired' },
      { n: 100, title: 'Adjectives and adverbs 1', sub: 'quick/quickly' },
      { n: 101, title: 'Adjectives and adverbs 2', sub: 'well, fast, late, hard/hardly' },
      { n: 102, title: 'so and such', sub: '' },
      { n: 103, title: 'enough and too', sub: '' },
      { n: 104, title: 'quite, pretty, rather and fairly', sub: '' },
      { n: 105, title: 'Comparative 1', sub: 'cheaper, more expensive etc.' },
      { n: 106, title: 'Comparative 2', sub: 'much better / any better etc.' },
      { n: 107, title: 'Comparative 3', sub: 'as … as / than' },
      { n: 108, title: 'Superlative', sub: 'the longest, the most enjoyable etc.' },
      { n: 109, title: 'Word order 1', sub: 'verb + object; place and time' },
      { n: 110, title: 'Word order 2', sub: 'adverbs with the verb' },
      { n: 111, title: 'still · any more · yet · already', sub: '' },
      { n: 112, title: 'even', sub: '' },
    ]
  },
  {
    name: 'Conjunctions and prepositions',
    units: [
      { n: 113, title: 'although · though · even though · in spite of · despite', sub: '' },
      { n: 114, title: 'in case', sub: '' },
      { n: 115, title: 'unless · as long as · provided', sub: '' },
      { n: 116, title: 'as', sub: 'as I walked … / as I was … etc.' },
      { n: 117, title: 'like and as', sub: '' },
      { n: 118, title: 'like · as if', sub: '' },
      { n: 119, title: 'during · for · while', sub: '' },
      { n: 120, title: 'by and until · by the time …', sub: '' },
    ]
  },
  {
    name: 'Prepositions',
    units: [
      { n: 121, title: 'at/on/in (time)', sub: '' },
      { n: 122, title: 'on time and in time · at the end and in the end', sub: '' },
      { n: 123, title: 'in/at/on (position) 1', sub: '' },
      { n: 124, title: 'in/at/on (position) 2', sub: '' },
      { n: 125, title: 'in/at/on (position) 3', sub: '' },
      { n: 126, title: 'to, at, in and into', sub: '' },
      { n: 127, title: 'in/on/at (other uses)', sub: '' },
      { n: 128, title: 'by', sub: '' },
      { n: 129, title: 'Noun + preposition', sub: 'reason for, cause of etc.' },
      { n: 130, title: 'Adjective + preposition 1', sub: '' },
      { n: 131, title: 'Adjective + preposition 2', sub: '' },
      { n: 132, title: 'Verb + preposition 1', sub: 'to and at' },
      { n: 133, title: 'Verb + preposition 2', sub: 'about/for/of/after' },
      { n: 134, title: 'Verb + preposition 3', sub: 'about and of' },
      { n: 135, title: 'Verb + preposition 4', sub: 'of/for/from/on' },
      { n: 136, title: 'Verb + preposition 5', sub: 'in/into/with/to/on' },
    ]
  },
  {
    name: 'Phrasal verbs',
    units: [
      { n: 137, title: 'Phrasal verbs 1', sub: 'Introduction' },
      { n: 138, title: 'Phrasal verbs 2', sub: 'in/out' },
      { n: 139, title: 'Phrasal verbs 3', sub: 'out' },
      { n: 140, title: 'Phrasal verbs 4', sub: 'on/off (1)' },
      { n: 141, title: 'Phrasal verbs 5', sub: 'on/off (2)' },
      { n: 142, title: 'Phrasal verbs 6', sub: 'up/down' },
      { n: 143, title: 'Phrasal verbs 7', sub: 'up (1)' },
      { n: 144, title: 'Phrasal verbs 8', sub: 'up (2)' },
      { n: 145, title: 'Phrasal verbs 9', sub: 'away/back' },
    ]
  }
];

export const MURPHY_UNITS_MAP: Record<number, MurphyUnitMeta> = (() => {
  const map: Record<number, MurphyUnitMeta> = {};
  for (const sec of MURPHY_SECTIONS) {
    for (const u of sec.units) {
      map[u.n] = {
        n: u.n,
        title: u.title,
        sub: u.sub,
        section: sec.name,
        folder: getMurphyUnitFolder(u.n),
        url: getMurphyUnitUrl(u.n)
      };
    }
  }
  return map;
})();

export function getMurphyUnitMeta(n: number): MurphyUnitMeta | undefined {
  return MURPHY_UNITS_MAP[n];
}

export function openMurphyAiUnit(unitNum: number, customTitle?: string, customSub?: string) {
  const meta = getMurphyUnitMeta(unitNum);
  const title = customTitle || meta?.title || `Unit ${unitNum}`;
  const sub = customSub || meta?.sub || '';
  const section = meta?.section || 'English Grammar in Use';

  openAiWithScope({
    type: 'topic',
    title: `Murphy Unit ${unitNum}: ${title}`,
    subject: 'English',
    sourceScope: 'subject_wise',
    sourceScopeLabel: `Raymond Murphy Grammar (Cambridge) • Unit ${unitNum}`,
    summaryText: `Unit ${unitNum}: ${title}${sub ? ` (${sub})` : ''} [Section: ${section}].
CRITICAL SCOPE MANDATE: You are Tommy, an elite English grammar tutor specializing in Raymond Murphy's Cambridge curriculum for SSC CGL.
You must strictly focus on Unit ${unitNum} (${title}) only.
1. Teach the core grammar rules, structural formulas, and real-life usage distinctions of Unit ${unitNum}.
2. Break down the most frequent SSC CGL error spotting and sentence improvement traps tested on this unit.
3. Solve exercise doubts and explain why specific options are correct/wrong for Unit ${unitNum}.
Do not drift into other unrelated grammar units or topics unless directly comparing structures required by this unit.`
  });
}

export const MURPHY_CHAPTER_MAP: Record<number, MurphyMapping> = {
  3: {
    url: '/murphy/units/01_Present_and_Past/unit-001.html',
    title: 'Present & Past Tenses',
    unitRange: 'Units 1–18',
  },
  4: {
    url: '/murphy/units/01_Present_and_Past/unit-001.html',
    title: 'Verbs & Tenses',
    unitRange: 'Units 1–18',
  },
  5: {
    url: '/murphy/units/08_Ing_and_To/unit-053.html',
    title: 'Non-Finite Verbs (-ing & to …)',
    unitRange: 'Units 53–68',
  },
  6: {
    url: '/murphy/units/03_Modals/unit-026.html',
    title: 'Modals (Can, Could, Must, Should, etc.)',
    unitRange: 'Units 26–37',
  },
  11: {
    url: '/murphy/units/07_Questions_and_Auxiliary_Verbs/unit-052.html',
    title: 'Question Tags & Auxiliaries',
    unitRange: 'Units 49–52',
  },
  12: {
    url: '/murphy/units/04_If_and_Wish/unit-038.html',
    title: 'Conditional Sentences (If & Wish)',
    unitRange: 'Units 38–41',
  },
  15: {
    url: '/murphy/units/07_Questions_and_Auxiliary_Verbs/unit-049.html',
    title: 'Auxiliary Verbs & Inversion',
    unitRange: 'Units 49–52',
  },
  17: {
    url: '/murphy/units/05_Passive/unit-042.html',
    title: 'Active & Passive Voice',
    unitRange: 'Units 42–46',
  },
  18: {
    url: '/murphy/units/06_Reported_Speech/unit-047.html',
    title: 'Reported Speech (Narration)',
    unitRange: 'Units 47–48',
  },
};

export const FULL_MURPHY_PORTAL: MurphyMapping = {
  url: '/murphy/index.html',
  title: 'English Grammar in Use — Raymond Murphy',
  unitRange: 'Complete 145 Units',
};

export function getMurphyUnitForChapter(chapterNum?: number, title?: string): MurphyMapping {
  if (chapterNum && MURPHY_CHAPTER_MAP[chapterNum]) {
    return MURPHY_CHAPTER_MAP[chapterNum];
  }

  const cleanTitle = (title || '').toLowerCase();
  if (cleanTitle.includes('future') || cleanTitle.includes('will')) {
    return {
      url: '/murphy/units/02_Future/unit-019.html',
      title: 'Future (Will, Going to, etc.)',
      unitRange: 'Units 19–25',
    };
  }
  if (cleanTitle.includes('tense')) {
    return MURPHY_CHAPTER_MAP[3];
  }
  if (cleanTitle.includes('modal')) {
    return MURPHY_CHAPTER_MAP[6];
  }
  if (cleanTitle.includes('voice') || cleanTitle.includes('passive')) {
    return MURPHY_CHAPTER_MAP[17];
  }
  if (cleanTitle.includes('narration') || cleanTitle.includes('speech')) {
    return MURPHY_CHAPTER_MAP[18];
  }
  if (cleanTitle.includes('condition') || cleanTitle.includes('wish')) {
    return MURPHY_CHAPTER_MAP[12];
  }
  if (cleanTitle.includes('tag')) {
    return MURPHY_CHAPTER_MAP[11];
  }
  if (cleanTitle.includes('inversion')) {
    return MURPHY_CHAPTER_MAP[15];
  }
  if (cleanTitle.includes('verb')) {
    return MURPHY_CHAPTER_MAP[4];
  }

  // Default to the full interactive dashboard
  return FULL_MURPHY_PORTAL;
}
