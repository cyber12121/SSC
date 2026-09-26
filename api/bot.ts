import { webhookCallback } from 'grammy';
import { bot } from '../src/telegram/bot';

// Create a Node.js HTTP/Express-compatible handler for Vercel Serverless
const handle = webhookCallback(bot, 'http');

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health-check / ping test in browser
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      message: 'CGL Telegram Bot Webhook endpoint is active and ready 24/7 on Vercel.',
      timestamp: new Date().toISOString(),
    });
  }

  // Process incoming Telegram update
  if (req.method === 'POST') {
    try {
      await handle(req, res);
    } catch (err: any) {
      console.error('[VercelWebhook] Error processing update:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: err?.message || 'Internal Server Error' });
      }
    }
    return;
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
