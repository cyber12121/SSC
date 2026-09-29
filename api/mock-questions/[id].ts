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
