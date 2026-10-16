export interface MurphyMapping {
  url: string;
  title: string;
  unitRange: string;
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

export function getMurphyUnitForChapter(chapterNum?: number, title?: string): MurphyMapping {
  if (chapterNum && MURPHY_CHAPTER_MAP[chapterNum]) {
    return MURPHY_CHAPTER_MAP[chapterNum];
  }

  const cleanTitle = (title || '').toLowerCase();
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

  // Default to the full interactive dashboard
  return {
    url: '/murphy/index.html',
    title: 'English Grammar in Use — Interactive Portal',
    unitRange: 'Complete 145 Units',
  };
}
