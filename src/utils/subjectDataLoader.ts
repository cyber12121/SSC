import { SubjectData } from '../types';
import { getChapterGKSubject } from './gkSubjectHelper';

/**
 * Parses and categorizes a single chapter file into rawMockData and rawBankData maps.
 * Compatible with both Node.js (server-side aggregation) and browser environments.
 */
export function parseSubjectChapter(
  path: string,
  data: any,
  rawMockData: SubjectData,
  rawBankData: SubjectData
): void {
  if (!data) return;

  const normalizedPath = path.replace(/\\/g, '/');
  const isMock = normalizedPath.includes('/mock_errors/');
  const isBank = normalizedPath.includes('/chapter_bank/');

  if (!isMock && !isBank) return;

  // The data could be a single chapter object or an array of chapters
  const chapters = Array.isArray(data) ? data : (data.questions ? [data] : []);

  // If data has chapterBank or mockErrors wrapper keys
  if (data.chapterBank) chapters.push(...data.chapterBank);
  if (data.mockErrors) chapters.push(...data.mockErrors);

  // Determine section and topic from path
  let section: 'spartan' | 'pinnacle' | 'qrb' | 'top500' | 'ayush_vocab' | 'black_book' | 'general' | undefined = undefined;
  let topic_name: string | undefined = undefined;
  let set_name: string | undefined = undefined;

  if (isBank) {
    if (normalizedPath.includes('/mathematics/spartan/')) section = 'spartan';
    else if (normalizedPath.includes('/mathematics/pinnacle/')) section = 'pinnacle';
    else if (normalizedPath.includes('/mathematics/qrb/')) section = 'qrb';
    else if (normalizedPath.includes('/mathematics/top500/')) section = 'top500';
    else if (normalizedPath.includes('/english/ayush_vocab/')) section = 'ayush_vocab';
    else if (normalizedPath.includes('/english/black_book/')) section = 'black_book';
    else if (normalizedPath.includes('/english/')) section = 'general';

    if (section && section !== 'general') {
      const marker = `/${section}/`;
      const parts = normalizedPath.split(marker);
      if (parts.length > 1) {
        const subPath = parts[1];
        const subParts = subPath.split('/');
        if (subParts.length >= 2) {
          topic_name = subParts[0];
          set_name = subParts[1].replace('.json', '');
        }
      }
    } else if (normalizedPath.includes('/general_awareness/')) {
      const parts = normalizedPath.split('/general_awareness/');
      if (parts.length > 1) {
        const subPath = parts[1];
        const subParts = subPath.split('/');
        if (subParts.length >= 2) {
          topic_name = subParts[0];
        }
      }
    } else if (normalizedPath.includes('/gk_full_tests/')) {
      const fileName = (normalizedPath.split('/gk_full_tests/')[1] || '').toLowerCase();
      if (fileName.includes('history')) topic_name = 'history';
      else if (fileName.includes('polity')) topic_name = 'polity';
      else if (fileName.includes('geography')) topic_name = 'geography';
      else if (fileName.includes('economics')) topic_name = 'economics';
      else if (fileName.includes('physics')) topic_name = 'physics';
      else if (fileName.includes('chemistry')) topic_name = 'chemistry';
      else if (fileName.includes('biology')) topic_name = 'biology';
      else topic_name = 'tests';
    }
  }

  chapters.forEach((chapter: any) => {
    let subject = chapter.subject;

    // Unify GK Full Tests under General Awareness so all GK is subject-wise
    if (normalizedPath.includes('/gk_full_tests/')) {
      chapter.is_test = true;
      chapter.subject = 'General Awareness';
      subject = 'General Awareness';
    }

    if (normalizedPath.includes('/english/')) {
      chapter.subject = 'English';
      subject = 'English';
    }

    if (section) {
      chapter.section = section;
    }
    if (topic_name) {
      chapter.topic_name = topic_name;
    }
    if (set_name) {
      chapter.set_name = set_name;
    }

    // Compute GK Subject
    if (subject === 'General Awareness' || normalizedPath.includes('/general_awareness/') || normalizedPath.includes('/gk_full_tests/')) {
      chapter.gk_subject = getChapterGKSubject(chapter);
    }

    if (isMock || (normalizedPath.includes('mockErrors') && !isBank)) {
      if (!rawMockData[subject]) rawMockData[subject] = [];
      rawMockData[subject].push(chapter);
    } else {
      if (!rawBankData[subject]) rawBankData[subject] = [];
      rawBankData[subject].push(chapter);
    }
  });
}
