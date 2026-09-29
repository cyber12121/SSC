import path from 'path';
import fs from 'fs';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const qPath = path.join(process.cwd(), 'src', 'data', 'mock_questions', `${id}.json`);

  if (req.method === 'POST') {
    try {
      if (req.body && fs.existsSync(qPath)) {
        const existingRaw = fs.readFileSync(qPath, 'utf-8');
        try {
          const existingData = JSON.parse(existingRaw);
          if (Array.isArray(existingData) && Array.isArray(req.body)) {
            // Merge safely: ONLY update RCA tags and enriched solutions, NEVER overwrite original attempt status or options
            const merged = existingData.map((existingItem: any, idx: number) => {
              const incoming = req.body[idx] || {};
              return {
                ...existingItem,
                rca: incoming.rca !== undefined ? incoming.rca : existingItem.rca,
                rcaClassification: incoming.rcaClassification !== undefined ? incoming.rcaClassification : existingItem.rcaClassification,
                sillyMistakeNote: incoming.sillyMistakeNote !== undefined ? incoming.sillyMistakeNote : existingItem.sillyMistakeNote,
                solution: (incoming.solution && (!existingItem.solution || existingItem.solution.length < incoming.solution.length))
                  ? incoming.solution
                  : existingItem.solution
              };
            });
            fs.writeFileSync(qPath, JSON.stringify(merged, null, 2), 'utf-8');
            return res.status(200).json({ success: true, message: 'RCA updated successfully without altering imported answers' });
          }
        } catch {}

        fs.writeFileSync(qPath, JSON.stringify(req.body, null, 2), 'utf-8');
        return res.status(200).json({ success: true, message: 'Saved successfully' });
      }
      return res.status(200).json({ success: true, message: 'Ignored or read-only' });
    } catch (e: any) {
      return res.status(200).json({ success: false, error: e.message });
    }
  }

  try {
    if (fs.existsSync(qPath)) {
      const data = JSON.parse(fs.readFileSync(qPath, 'utf-8'));
      return res.status(200).json(data);
    }
    return res.status(200).json([]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
