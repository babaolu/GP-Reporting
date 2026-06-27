import TelegramBot from 'node-telegram-bot-api';
import { supabaseAdmin } from './supabase';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'GracePlaceReportBot';
const appUrl = process.env.APP_URL || 'http://localhost:5173';

let bot: TelegramBot | null = null;

if (token && !token.startsWith('YOUR_')) {
  const isProduction = process.env.NODE_ENV === 'production';
  const usePolling = process.env.TELEGRAM_USE_POLLING === 'true' || !isProduction;

  if (usePolling) {
    bot = new TelegramBot(token, { polling: true });
    console.log(`Telegram Bot service initialized for @${botUsername} (polling mode)`);
  } else {
    bot = new TelegramBot(token, { polling: false });
    console.log(`Telegram Bot service initialized for @${botUsername} (webhook mode)`);

    // Auto-register webhook in webhook mode
    const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3000';
    let webhookBase = backendUrl;
    if (webhookBase.includes('localhost:5173')) {
      webhookBase = webhookBase.replace('5173', '3000');
    }
    const webhookUrl = `${webhookBase}/api/telegram/webhook`;
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    bot.setWebHook(webhookUrl, secretToken ? { secret_token: secretToken } : undefined)
      .then(() => {
        console.log(`Telegram Webhook registered successfully at: ${webhookUrl}`);
      })
      .catch(err => {
        console.error(`Failed to register Telegram Webhook:`, err);
      });
  }
  
  // Register message handler
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text?.trim();

    if (!text) return;

    if (text === '/start') {
      await sendTelegramMessage(chatId, `Welcome to the Grace Place Report Platform Bot! ⏰\n\nTo link your account, please paste the 6-digit code generated from your Settings → Notifications page.`);
      return;
    }

    // Match 6-digit numeric codes anywhere in the message
    const codeMatch = text.match(/\b\d{6}\b/);
    if (codeMatch) {
      const code = codeMatch[0];
      await handleLinkCode(chatId, code, msg.chat.username || '');
    } else {
      await sendTelegramMessage(chatId, `I didn't recognize that code. Please send a valid 6-digit code from the settings panel to link your account.`);
    }
  });
} else {
  console.warn('Telegram token is not configured. Telegram service will run in MOCK mode.');
}

/**
 * Feeds webhook updates from Express router to TelegramBot
 */
export function handleTelegramWebhook(update: any) {
  if (bot) {
    bot.processUpdate(update);
  } else {
    console.log('[MOCK TELEGRAM] Received webhook update:', JSON.stringify(update));
  }
}

/**
 * Handles account linking when a user inputs a 6-digit code
 */
async function handleLinkCode(chatId: string, code: string, tgUsername: string) {
  try {
    const nowStr = new Date().toISOString();

    // Query profiles to find user with active, unexpired code
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('telegram_link_code', code)
      .gt('telegram_link_code_expires_at', nowStr)
      .single();

    if (error || !profile) {
      await sendTelegramMessage(chatId, `❌ Link code is invalid or has expired. Please generate a new code from the Settings page in the web app and try again.`);
      return;
    }

    // Link account in database
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        telegram_chat_id: chatId,
        telegram_linked: true,
        telegram_link_code: null,
        telegram_link_code_expires_at: null
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Error updating profile with telegram_chat_id:', updateError);
      await sendTelegramMessage(chatId, `❌ An error occurred while linking your account. Please try again later.`);
      return;
    }

    const welcomeMsg = `🎉 *Account Linked Successfully!*\n\nHi *${profile.full_name || 'Unit Head'}*, your Telegram account has been linked to *${profile.email}*.\n\nYou will now receive report reminders here. You can manage notifications anytime in the web app.`;
    await sendTelegramMessage(chatId, welcomeMsg);
    console.log(`Telegram account linked: ${profile.email} -> chat_id: ${chatId}`);
  } catch (err) {
    console.error('Error in handleLinkCode:', err);
    await sendTelegramMessage(chatId, `❌ An unexpected error occurred. Please try again.`);
  }
}

/**
 * Helper to send a message to a specific chat
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!bot) {
    console.log(`[MOCK TELEGRAM] Message sent to ${chatId}: ${text}`);
    return true;
  }
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    return true;
  } catch (err) {
    console.error(`Error sending Telegram message to ${chatId}:`, err);
    return false;
  }
}

/**
 * Sends report reminder message to unit head
 */
export async function sendTelegramReminder(
  chatId: string,
  fullName: string,
  unitName: string,
  daysRemaining: number,
  deadlineDateStr: string,
  sequenceNum: number
): Promise<boolean> {
  const message = `⏰ *Report Reminder [${sequenceNum}/3]*\n\nHi ${fullName || 'Unit Head'}, your monthly report for *${unitName}* is due in *${daysRemaining} day(s)* (by ${deadlineDateStr}).\n\n👉 [Submit here: ${appUrl}/dashboard/unit-head/report]\n\nIf you've already submitted, ignore this. 🙏`;
  return sendTelegramMessage(chatId, message);
}

/**
 * Sends unit rename notification message to unit head via Telegram
 */
export async function sendUnitRenameTelegram(
  chatId: string,
  fullName: string,
  oldUnitName: string,
  newUnitName: string
): Promise<boolean> {
  const message = `📋 *Department Name Update*

Hi ${fullName || 'Unit Head'}, your department has been renamed by the administration.

*Previous Name:* ${oldUnitName}
*New Name:* ${newUnitName}

All your submitted reports and history remain intact. 🙏`;
  return sendTelegramMessage(chatId, message);
}
