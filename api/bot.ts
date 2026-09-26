export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { bot } = await import('../src/telegram/bot');
    const { webhookCallback } = await import('grammy');

    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'online',
        message: 'Telegram Webhook is ready 24/7 on Vercel!',
        botName: '@my_cgl_bot',
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === 'POST') {
      const handle = webhookCallback(bot, 'http');
      return await handle(req, res);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[VercelWebhook Error]', err);
    return res.status(200).json({
      status: 'error',
      error: err?.message || String(err),
      stack: err?.stack,
    });
  }
}
