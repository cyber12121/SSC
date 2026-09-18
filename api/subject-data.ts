import path from 'path';
import fs from 'fs';

function getChapterGKSubject(chapter: any): string {
  if (chapter.gk_subject) return chapter.gk_subject;
  const topic = (chapter.topic_name || '').toLowerCase();
  const title = (chapter.chapter_title || '').toLowerCase();

  if (topic.includes('history') || title.includes('history')) return 'history';
  if (topic.includes('polity') || title.includes('polity') || title.includes('constitution')) return 'polity';
  if (topic.includes('geography') || title.includes('geography')) return 'geography';
  if (topic.includes('economics') || title.includes('economics')) return 'economics';
  if (
    topic.includes('physics') || topic.includes('chemistry') || topic.includes('biology') ||
    title.includes('physics') || title.includes('chemistry') || title.includes('biology')
  ) {
    return 'science';
  }
  if (topic.includes('static') || title.includes('dance') || title.includes('festival') || title.includes('music')) {
    return 'static_gk';
  }
  if (chapter.is_test || chapter.subject === 'GK Full Tests' || title.includes('test')) {
    return 'full_tests';
  }
  return 'static_gk';
}

export function parseSubjectChapter(
  rawPath: string,
  data: any,
  rawMockData: Record<string, any[]>,
  rawBankData: Record<string, any[]>
): void {
  if (!data) return;

  const normalizedPath = rawPath.replace(/\\/g, '/');
  const isMock = normalizedPath.includes('/mock_errors/');
  const isBank = normalizedPath.includes('/chapter_bank/');

  if (!isMock && !isBank) return;

  const chapters = Array.isArray(data) ? data : (data.questions ? [data] : []);
  if (data.chapterBank) chapters.push(...data.chapterBank);
  if (data.mockErrors) chapters.push(...data.mockErrors);

  let section: string | undefined = undefined;
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

let cachedSubjectData: { rawMockData: any; rawBankData: any } | null = null;

export function buildServerSubjectData(): { rawMockData: any; rawBankData: any } {
  const rawMockData: any = {};
  const rawBankData: any = {};
  const cwd = process.cwd();

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.name.endsWith('.json')) {
        const normPath = fullPath.replace(/\\/g, '/');
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          parseSubjectChapter(normPath, content, rawMockData, rawBankData);
        } catch (e) {
          console.error('[buildServerSubjectData] Error parsing', normPath, e);
        }
      }
    }
  }

  scan(path.join(cwd, 'src', 'data', 'mock_errors'));
  scan(path.join(cwd, 'src', 'data', 'chapter_bank'));
  return { rawMockData, rawBankData };
}

export function getOrBuildSubjectData() {
  if (!cachedSubjectData) {
    cachedSubjectData = buildServerSubjectData();
  }
  return cachedSubjectData;
}

export function invalidateSubjectDataCache() {
  cachedSubjectData = null;
}

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const data = getOrBuildSubjectData();
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
