export const GRAMMAR_PDF_MAP: Record<number, string> = {
  1: '01_Noun.pdf',
  2: '02_Pronoun.pdf',
  3: '03_Tense.pdf',
  4: '04_Verb.pdf',
  5: '05_Non_Finite_Verb.pdf',
  6: '06_Modals.pdf',
  7: '07_Subject_Verb_Agreement.pdf',
  8: '08_Article.pdf',
  9: '09_Adjective.pdf',
  10: '10_Adverb.pdf',
  11: '11_Question_Tag.pdf',
  12: '12_Conditional_Sentences.pdf',
  13: '13_Conjunction.pdf',
  14: '14_Preposition.pdf',
  15: '15_Inversion.pdf',
  16: '16_Parallelism.pdf',
  17: '17_Voice.pdf',
  18: '18_Narration.pdf',
  19: '19_Superfluous_Expressions.pdf',
  20: '20_Collocation.pdf',
  21: '21_Eduquity_Based_Practice.pdf',
};

export function getGrammarPdfUrl(chapterNum?: number): string | null {
  if (!chapterNum) return null;
  const filename = GRAMMAR_PDF_MAP[chapterNum];
  return filename ? `/grammar_pdfs/${filename}` : null;
}
