export interface Rule120ChapterMeta {
  chapterNum: number;
  title: string;
  subtitle: string;
  rules: number[];
  ruleCount: number;
  fileName: string;
  url: string;
  grammarTopics: string[]; // Related grammar topics in chapter_bank
}

export const RULES_120_CATALOG: Rule120ChapterMeta[] = [
  {
    chapterNum: 1,
    title: 'Chapter 1: Pronoun Cases & Relatives',
    subtitle: 'Subjective vs Objective case, Relative Pronouns (Who/Whom/Which/That), Order 231 vs 123',
    rules: [3, 19, 20, 41, 42, 68, 115, 116],
    ruleCount: 8,
    fileName: 'Chapter_01_Pronoun_Cases_Relatives.html',
    url: '/120_rules/Chapter_01_Pronoun_Cases_Relatives.html',
    grammarTopics: ['pronoun', 'relative pronouns']
  },
  {
    chapterNum: 2,
    title: 'Chapter 2: Reflexive & Indefinite Pronouns',
    subtitle: 'Verbs taking reflexive pronouns, Indefinite pronouns concord (one/everyone)',
    rules: [1, 2, 15, 16, 22],
    ruleCount: 5,
    fileName: 'Chapter_02_Reflexive_Indefinite_Pronouns.html',
    url: '/120_rules/Chapter_02_Reflexive_Indefinite_Pronouns.html',
    grammarTopics: ['pronoun', 'reflexive']
  },
  {
    chapterNum: 3,
    title: 'Chapter 3: Possessives & Gerunds',
    subtitle: 'Possessive adjectives before gerunds, each other vs one another, apostrophe with gerunds',
    rules: [11, 21, 96, 110, 114, 118, 119],
    ruleCount: 7,
    fileName: 'Chapter_03_Possessives_Gerunds.html',
    url: '/120_rules/Chapter_03_Possessives_Gerunds.html',
    grammarTopics: ['pronoun', 'non_finite_verb', 'gerund']
  },
  {
    chapterNum: 4,
    title: 'Chapter 4: Subject-Verb Agreement',
    subtitle: 'Proximity rule, neither/nor, along with, as well as, collective nouns concord',
    rules: [17, 30, 35, 37, 51, 56, 65, 84, 85, 88, 89, 93],
    ruleCount: 12,
    fileName: 'Chapter_04_Subject_Verb_Agreement.html',
    url: '/120_rules/Chapter_04_Subject_Verb_Agreement.html',
    grammarTopics: ['subject_verb_agreement', 'syntax']
  },
  {
    chapterNum: 5,
    title: 'Chapter 5: Articles & Determiners',
    subtitle: 'Definite article the, omission of articles, few/a few, little/a little',
    rules: [5, 13, 25, 40, 61, 62, 63, 64, 86, 98, 111],
    ruleCount: 11,
    fileName: 'Chapter_05_Articles_Determiners.html',
    url: '/120_rules/Chapter_05_Articles_Determiners.html',
    grammarTopics: ['article', 'determiners']
  },
  {
    chapterNum: 6,
    title: 'Chapter 6: Adjectives & Comparisons',
    subtitle: 'Comparative & superlative rules, preferable to, mutually exclusive comparisons',
    rules: [6, 8, 24, 28, 32, 33, 36, 46, 112, 113, 120],
    ruleCount: 11,
    fileName: 'Chapter_06_Adjectives_Comparisons.html',
    url: '/120_rules/Chapter_06_Adjectives_Comparisons.html',
    grammarTopics: ['adjective', 'comparison']
  },
  {
    chapterNum: 7,
    title: 'Chapter 7: Tenses & Time',
    subtitle: 'Since vs for, conditional tenses, simple past vs present perfect, universal truths',
    rules: [7, 9, 10, 29, 39, 45, 48, 52, 70, 79],
    ruleCount: 10,
    fileName: 'Chapter_07_Tenses_Time.html',
    url: '/120_rules/Chapter_07_Tenses_Time.html',
    grammarTopics: ['tense', 'time and tense']
  },
  {
    chapterNum: 8,
    title: 'Chapter 8: Conditionals, Inversion & Modals',
    subtitle: 'Type 0, 1, 2, 3 conditionals, inversion with negative adverbs, subjunctive mood',
    rules: [4, 12, 14, 23, 78, 95],
    ruleCount: 6,
    fileName: 'Chapter_08_Conditionals_Inversion_Modals.html',
    url: '/120_rules/Chapter_08_Conditionals_Inversion_Modals.html',
    grammarTopics: ['conditional_sentences', 'inversion', 'modals']
  },
  {
    chapterNum: 9,
    title: 'Chapter 9: Prepositions',
    subtitle: 'In/On/At, Between/Among, Beside/Besides, Angry with/at, Die of/from',
    rules: [31, 53, 57, 58, 59, 76, 81, 101, 102, 107],
    ruleCount: 10,
    fileName: 'Chapter_09_Prepositions.html',
    url: '/120_rules/Chapter_09_Prepositions.html',
    grammarTopics: ['preposition', 'fixed prepositions']
  },
  {
    chapterNum: 10,
    title: 'Chapter 10: Conjunctions, Connectors & Narration',
    subtitle: 'Although...yet, Doubt that/whether, Parallelism, Both...and, Narration word order',
    rules: [27, 34, 38, 55, 77, 80, 97, 117],
    ruleCount: 8,
    fileName: 'Chapter_10_Conjunctions_Connectors_Narration.html',
    url: '/120_rules/Chapter_10_Conjunctions_Connectors_Narration.html',
    grammarTopics: ['conjunction', 'narration', 'parallelism']
  },
  {
    chapterNum: 11,
    title: 'Chapter 11: Question Tags',
    subtitle: 'Aren\'t I, Negative polarity tags, Indefinite pronouns (they), Collective nouns (it/they), Shall we',
    rules: [69, 70, 71, 72, 73, 74, 75],
    ruleCount: 7,
    fileName: 'Chapter_11_Question_Tags.html',
    url: '/120_rules/Chapter_11_Question_Tags.html',
    grammarTopics: ['question_tag']
  },
  {
    chapterNum: 12,
    title: 'Chapter 12: Verbs & Verb Forms',
    subtitle: 'Advice/Advise, Know how to, Prepositional to + V1+ing, Lie vs Lay, Fly vs Flow, Hung vs Hanged',
    rules: [18, 54, 60, 90, 91, 99, 100, 103],
    ruleCount: 8,
    fileName: 'Chapter_12_Verbs_Verb_Forms.html',
    url: '/120_rules/Chapter_12_Verbs_Verb_Forms.html',
    grammarTopics: ['verb', 'non_finite_verb', 'voice']
  },
  {
    chapterNum: 13,
    title: 'Chapter 13: Adverbs & Placement',
    subtitle: 'Verbs taking "as", Too much vs Much too, MPT order, Very vs Much, Placement before objects',
    rules: [26, 47, 82, 87, 104, 105, 106],
    ruleCount: 7,
    fileName: 'Chapter_13_Adverbs_Placement.html',
    url: '/120_rules/Chapter_13_Adverbs_Placement.html',
    grammarTopics: ['adverb']
  },
  {
    chapterNum: 14,
    title: 'Chapter 14: Nouns & Spelling Rules',
    subtitle: 'Apostrophe laws, Joint vs Split possession, Its vs It\'s, Compound plurals, Plural-only nouns, Meaning shifts with "-s"',
    rules: [44, 49, 50, 66, 67, 83, 92, 94, 108],
    ruleCount: 9,
    fileName: 'Chapter_14_Nouns_Spelling_Rules.html',
    url: '/120_rules/Chapter_14_Nouns_Spelling_Rules.html',
    grammarTopics: ['noun']
  },
  {
    chapterNum: 15,
    title: 'Chapter 15: Common Errors & Superfluousness',
    subtitle: 'Superfluous catalog (return back, suppose if, bag and baggage), Colloquial misnomers (teacher of English, cousin, room)',
    rules: [43, 109],
    ruleCount: 2,
    fileName: 'Chapter_15_Common_Errors_Superfluousness.html',
    url: '/120_rules/Chapter_15_Common_Errors_Superfluousness.html',
    grammarTopics: ['superfluous_expressions', 'common_errors']
  }
];

/**
 * Maps a Pinnacle 60-days grammar chapter number / title to its most relevant 120 Rules chapter.
 */
export function get120RulesForGrammarChapter(
  chapterNum?: number,
  chapterTitle?: string
): Rule120ChapterMeta | null {
  const title = (chapterTitle || '').toLowerCase();
  
  if (title.includes('noun')) return RULES_120_CATALOG[13]; // Ch 14: Nouns
  if (title.includes('pronoun')) return RULES_120_CATALOG[0]; // Ch 1: Pronouns
  if (title.includes('tense')) return RULES_120_CATALOG[6]; // Ch 7: Tenses
  if (title.includes('non finite') || title.includes('non-finite')) return RULES_120_CATALOG[11]; // Ch 12: Verbs (Gerunds/Infinitives)
  if (title.includes('verb')) return RULES_120_CATALOG[11]; // Ch 12: Verbs
  if (title.includes('subject verb') || title.includes('agreement')) return RULES_120_CATALOG[3]; // Ch 4: SVA
  if (title.includes('article')) return RULES_120_CATALOG[4]; // Ch 5: Articles
  if (title.includes('adjective')) return RULES_120_CATALOG[5]; // Ch 6: Adjectives
  if (title.includes('adverb')) return RULES_120_CATALOG[12]; // Ch 13: Adverbs
  if (title.includes('question tag') || title.includes('tag')) return RULES_120_CATALOG[10]; // Ch 11: Question Tags
  if (title.includes('conditional')) return RULES_120_CATALOG[7]; // Ch 8: Conditionals
  if (title.includes('conjunction')) return RULES_120_CATALOG[9]; // Ch 10: Conjunctions
  if (title.includes('preposition')) return RULES_120_CATALOG[8]; // Ch 9: Prepositions
  if (title.includes('inversion')) return RULES_120_CATALOG[7]; // Ch 8: Inversion
  if (title.includes('parallelism')) return RULES_120_CATALOG[9]; // Ch 10: Parallelism (Rule 80)
  if (title.includes('narration') || title.includes('direct')) return RULES_120_CATALOG[9]; // Ch 10: Narration (Rule 34)
  if (title.includes('superfluous') || title.includes('slang')) return RULES_120_CATALOG[14]; // Ch 15: Superfluous

  // Fallback by chapter number from pinnacle 60 days
  if (chapterNum === 1) return RULES_120_CATALOG[13]; // Noun
  if (chapterNum === 2) return RULES_120_CATALOG[0];  // Pronoun
  if (chapterNum === 3) return RULES_120_CATALOG[6];  // Tense
  if (chapterNum === 4 || chapterNum === 5) return RULES_120_CATALOG[11]; // Verb
  if (chapterNum === 6) return RULES_120_CATALOG[7];  // Modals
  if (chapterNum === 7) return RULES_120_CATALOG[3];  // Subject Verb Agreement
  if (chapterNum === 8) return RULES_120_CATALOG[4];  // Article
  if (chapterNum === 9) return RULES_120_CATALOG[5];  // Adjective
  if (chapterNum === 10) return RULES_120_CATALOG[12]; // Adverb
  if (chapterNum === 11) return RULES_120_CATALOG[10]; // Question Tag
  if (chapterNum === 12) return RULES_120_CATALOG[7];  // Conditionals
  if (chapterNum === 13) return RULES_120_CATALOG[9];  // Conjunction
  if (chapterNum === 14) return RULES_120_CATALOG[8];  // Preposition
  if (chapterNum === 15) return RULES_120_CATALOG[7];  // Inversion
  if (chapterNum === 16) return RULES_120_CATALOG[9];  // Parallelism
  if (chapterNum === 18) return RULES_120_CATALOG[9];  // Narration
  if (chapterNum === 19) return RULES_120_CATALOG[14]; // Superfluous

  return null;
}
