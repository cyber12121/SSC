import {
  getUserMistakes,
  getMistakeStats,
  getTotalMistakesSummary,
  deleteMistake,
  syncDeletedQuestions,
  getDeletedQuestionIds,
  getAllRecordedMistakes,
  recordMistake,
} from './mistakeStore';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch live quiz mistakes
  if (req.method === 'GET') {
    try {
      const { filter = 'all', subject, topicSlug, userId } = req.query || {};
      const numUserId = userId ? Number(userId) : 0;

      const mistakes = getAllRecordedMistakes(filter as any, subject as any, topicSlug as string);
      const stats = getMistakeStats(numUserId, filter as any);
      const summary = getTotalMistakesSummary(numUserId);
      const deletedIds = getDeletedQuestionIds();

      return res.status(200).json({
        success: true,
        summary,
        stats,
        mistakes,
        deletedIds,
        total: mistakes.length,
      });
    } catch (err: any) {
      console.error('[api/mistakes GET] Error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }

  // POST: Record a live quiz mistake, delete, or sync
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, questionId, questionText, userId, ids, questionData } = body || {};

      // Record a new quiz mistake from website quiz
      if (action === 'record') {
        if (!questionData || !questionData.question) {
          return res.status(400).json({ error: 'questionData is required' });
        }
        let opts: string[] = [];
        if (Array.isArray(questionData.options)) {
          opts = questionData.options.map(String);
        } else if (questionData.options && typeof questionData.options === 'object') {
          opts = Object.values(questionData.options).map(String);
        }
        let correctOpt = String(questionData.correctOption || questionData.answer || '');
        if (['a', 'b', 'c', 'd'].includes(correctOpt.toLowerCase())) {
          const idx = ['a', 'b', 'c', 'd'].indexOf(correctOpt.toLowerCase());
          if (opts[idx]) {
            correctOpt = opts[idx];
          }
        }
        const correctIndex = opts.indexOf(correctOpt) >= 0 ? opts.indexOf(correctOpt) : 0;
        recordMistake(
          userId ? Number(userId) : 0,
          {
            id: String(questionData.id || `web_quiz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
            question: questionData.question,
            options: opts,
            correctOptionIndex: correctIndex,
            explanation: questionData.explanation || questionData.solution || '',
            subject: questionData.subject || 'general_awareness',
            topic: questionData.topic || questionData.subtopic || 'Quiz Practice',
            source: '💻 Website Quiz Mistake',
          },
          'website_quiz',
          false
        );
        return res.status(200).json({
          success: true,
          message: 'Quiz mistake recorded successfully.',
        });
      }

      // Delete a mistake
      if (action === 'delete') {
        if (!questionId && !questionText) {
          return res.status(400).json({ error: 'questionId or questionText is required' });
        }
        deleteMistake(userId ? Number(userId) : undefined, questionId, questionText);
        return res.status(200).json({
          success: true,
          message: 'Question deleted from mistake bank.',
          deletedQuestionId: questionId,
        });
      }

      // Bulk sync deleted question IDs from local/app state
      if (action === 'sync_deleted') {
        if (Array.isArray(ids)) {
          syncDeletedQuestions(ids);
          return res.status(200).json({
            success: true,
            syncedCount: ids.length,
          });
        }
        return res.status(400).json({ error: 'ids array required for sync_deleted' });
      }

      return res.status(400).json({ error: 'Unknown action' });
    } catch (err: any) {
      console.error('[api/mistakes POST] Error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
