import path from 'path';
import fs from 'fs';
import { parseSubjectChapter } from '../src/utils/subjectDataLoader';

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
