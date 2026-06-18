import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com';
const appUrl = process.env.APP_URL || 'http://localhost:5173';
const churchName = process.env.CHURCH_NAME || 'Grace Place';

let resend: Resend | null = null;
if (resendApiKey && !resendApiKey.startsWith('YOUR_')) {
  resend = new Resend(resendApiKey);
} else {
  console.warn('Resend API key is not configured. Email service will run in MOCK mode.');
}

/**
 * Sends onboarding email with temporary password
 */
export async function sendWelcomeEmail(toEmail: string, tempPassword: string): Promise<boolean> {
  const subject = `Welcome to the ${churchName} Report Platform — Complete Onboarding`;
  const htmlContent = `
    <h2>Welcome to the ${churchName} Unit Report Management Platform</h2>
    <p>Your unit head account has been created by the administration. You must log in and complete your onboarding profile.</p>
    <p>Here are your temporary login details:</p>
    <ul>
      <li><strong>Email:</strong> ${toEmail}</li>
      <li><strong>Temporary Password:</strong> <code>${tempPassword}</code></li>
    </ul>
    <p><strong>Note:</strong> You will be required to change this temporary password upon your first login.</p>
    <br/>
    <p><a href="${appUrl}" style="background-color: #3730A3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Log In & Complete Onboarding</a></p>
    <br/>
    <p>Grace & Peace,<br/>${churchName} Administration</p>
  `;

  if (!resend) {
    console.log(`[MOCK EMAIL] Sent Welcome Email to ${toEmail}. Temporary Password: ${tempPassword}`);
    return true;
  }

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: subject,
      html: htmlContent
    });

    if (response.error) {
      console.error('Failed to send welcome email via Resend:', response.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected error sending welcome email:', err);
    return false;
  }
}

/**
 * Sends deadline reminder email to unit head
 */
export async function sendReminderEmail(
  toEmail: string,
  fullName: string,
  unitName: string,
  deadlineDateStr: string,
  daysRemaining: number,
  sequenceNum: number,
  monthLabel: string
): Promise<boolean> {
  const ordinalNames = ['1st', '2nd', '3rd'];
  const seqLabel = ordinalNames[sequenceNum - 1] || `${sequenceNum}th`;
  const subject = `⏰ Reminder [${sequenceNum}/3]: Monthly Report Due in ${daysRemaining} Day(s) — ${monthLabel}`;

  const htmlContent = `
    <div style="font-family: 'Inter', sans-serif; color: #1E1B4B; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; padding: 24px; border-radius: 8px; background-color: #FFFFFF;">
      <p>Hi ${fullName || 'Unit Head'},</p>
      
      <p>This is your <strong>${seqLabel}</strong> reminder that the monthly report for the <strong>${unitName}</strong> is due on <strong>${deadlineDateStr}</strong>.</p>
      
      <p>You have <strong>${daysRemaining}</strong> day(s) remaining.</p>
      
      <div style="margin: 24px 0;">
        <a href="${appUrl}/dashboard/unit-head/report" style="background-color: #3730A3; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">→ Submit Your Report</a>
      </div>
      
      <p style="font-size: 0.875rem; color: #6B7280;">If you have already submitted, please disregard this message.</p>
      
      <p style="margin-top: 32px; border-top: 1px solid #F3F4F6; padding-top: 16px;">
        Grace & Peace,<br/>
        <strong>${churchName} Administration</strong>
      </p>
    </div>
  `;

  if (!resend) {
    console.log(`[MOCK EMAIL] Sent Reminder ${sequenceNum}/3 to ${toEmail} (${fullName}). Unit: ${unitName}. Due: ${deadlineDateStr}. Days left: ${daysRemaining}`);
    return true;
  }

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: subject,
      html: htmlContent
    });

    if (response.error) {
      console.error(`Failed to send reminder ${sequenceNum} to ${toEmail} via Resend:`, response.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Unexpected error sending reminder ${sequenceNum}:`, err);
    return false;
  }
}
