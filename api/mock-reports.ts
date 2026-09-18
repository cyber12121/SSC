import fs from 'fs';
import path from 'path';

function getMockReports(): any[] {
  try {
    const cwd = process.cwd();
    const filePath = path.join(cwd, 'src', 'data', 'mock_reports.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[api/mock-reports] Error reading mock_reports.json:', err);
  }
  return [];
}

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json(getMockReports());
  }

  return res.status(200).json({ success: true });
}
