import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { handleTelegramWebhook } from '../services/telegram';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * POST /api/telegram/link
 * Generates a 6-digit link code valid for 10 minutes.
 */
router.post('/link', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  try {
    // Generate secure 6-digit numeric code
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += digits[crypto.randomInt(10)];
    }

    // Code expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store in database
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        telegram_link_code: code,
        telegram_link_code_expires_at: expiresAt,
        telegram_linked: false // Reset in case they are re-linking
      })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to store telegram link code:', error);
      return res.status(500).json({ error: 'Failed to generate link code' });
    }

    return res.status(200).json({
      code,
      expiresAt
    });

  } catch (err) {
    console.error('Unexpected error in telegram link code generator:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/telegram/webhook
 * Receives incoming messages from Telegram Bot API.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verify webhook secret if configured
    if (webhookSecret) {
      const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
      if (secretHeader !== webhookSecret) {
        console.warn('Unauthorized webhook request received (secret token mismatch)');
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Process update asynchronously
    handleTelegramWebhook(req.body);

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Error in telegram webhook endpoint:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
