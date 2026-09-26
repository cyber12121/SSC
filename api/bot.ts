import { webhookCallback } from 'grammy';
import { bot } from '../src/telegram/bot';

const handle = webhookCallback(bot, 'http');

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      message: 'Telegram Webhook is ready 24/7 on Vercel!',
      botName: '@my_cgl_bot',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'POST') {
    try {
      await handle(req, res);
    } catch (err: any) {
      console.error('[VercelWebhook Error]', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: err?.message || String(err) });
      }
    }
    return;
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
