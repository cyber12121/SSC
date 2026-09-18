import path from 'path';
import fs from 'fs';

let cachedBundledQuestions: any[] | null = null;

export function buildServerBundledMockQuestions(): any[] {
  const all: any[] = [];
  const cwd = process.cwd();
  const qDir = path.join(cwd, 'src', 'data', 'mock_questions');
  if (!fs.existsSync(qDir)) return all;

  const files = fs.readdirSync(qDir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const fullPath = path.join(qDir, f);
    try {
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const list = Array.isArray(raw) ? raw : (raw?.questions || raw?.data || []);
      const fileId = f.replace('.json', '');
      if (Array.isArray(list) && list.length > 0) {
        list.forEach((q: any) => {
          all.push({
            ...q,
            mockId: q.mockId || q.testId || fileId,
            isFromBundledMock: true
          });
        });
      }
    } catch (e) {
      console.error('[buildServerBundledMockQuestions] Failed to parse', f, e);
    }
  }

  return all;
}

export function getOrBuildBundledMockQuestions(): any[] {
  if (!cachedBundledQuestions) {
    cachedBundledQuestions = buildServerBundledMockQuestions();
  }
  return cachedBundledQuestions;
}

export function invalidateBundledMockQuestionsCache() {
  cachedBundledQuestions = null;
}

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const data = getOrBuildBundledMockQuestions();
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
