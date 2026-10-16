import fs from 'fs';
import path from 'path';

function getMockReports(): any[] {
  try {
    const cwd = process.cwd();
    const candidatePaths = [
      path.join(cwd, 'src', 'data', 'mock_reports.json'),
      path.join(cwd, 'data', 'mock_reports.json'),
      path.join(cwd, 'public', 'data', 'mock_reports.json')
    ];

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
      }
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

  try {
    if (req.method === 'GET') {
      const reports = getMockReports();
      res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
      return res.status(200).json(reports);
    }

    if (req.method === 'POST') {
      try {
        const cwd = process.cwd();
        const filePath = path.join(cwd, 'src', 'data', 'mock_reports.json');
        if (fs.existsSync(filePath)) {
          const reports = getMockReports();
          reports.unshift(req.body);
          fs.writeFileSync(filePath, JSON.stringify(reports, null, 2), 'utf-8');
          return res.status(200).json({ success: true, report: req.body });
        }
      } catch (writeErr) {
        // Vercel serverless functions have a read-only filesystem (/var/task)
        console.warn('[api/mock-reports] Serverless read-only filesystem warning:', writeErr);
      }
      return res.status(200).json({ success: true, report: req.body });
    }

    if (req.method === 'DELETE') {
      try {
        const { id } = req.query || {};
        const cwd = process.cwd();
        const filePath = path.join(cwd, 'src', 'data', 'mock_reports.json');
        if (id && fs.existsSync(filePath)) {
          let reports = getMockReports();
          reports = reports.filter((r: any) => r.id !== id);
          fs.writeFileSync(filePath, JSON.stringify(reports, null, 2), 'utf-8');
          return res.status(200).json({ success: true, id });
        }
      } catch (delErr) {
        console.warn('[api/mock-reports] Delete on serverless filesystem warning:', delErr);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[api/mock-reports] Handler error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
