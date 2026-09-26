import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getUserMistakes,
  getMistakeStats,
  getTotalMistakesSummary,
  deleteMistake,
  syncDeletedQuestions,
  getDeletedQuestionIds,
  getAllRecordedMistakes,
} from '../src/telegram/mistakeStore';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch mistakes and deleted list
  if (req.method === 'GET') {
    try {
      const { filter = 'all', subject, topicSlug, userId } = req.query;
      const numUserId = userId ? Number(userId) : undefined;

      const mistakes = getAllRecordedMistakes(filter as any, subject as any, topicSlug as string);
      const stats = getMistakeStats(numUserId || 0, filter as any);
      const summary = getTotalMistakesSummary(numUserId || 0);
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

  // POST: Delete or sync deleted questions
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, questionId, questionText, userId, ids } = body || {};

      if (action === 'delete') {
        if (!questionId && !questionText) {
          return res.status(400).json({ error: 'questionId or questionText is required' });
        }
        deleteMistake(userId ? Number(userId) : undefined, questionId, questionText);
        return res.status(200).json({
          success: true,
          message: 'Question deleted from mistake bank and synced across all devices.',
          deletedQuestionId: questionId,
        });
      }

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
