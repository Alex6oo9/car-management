import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendVerificationEmail(toEmail: string, fullName: string | null, token: string): Promise<void> {
  const verifyUrl = `${env.APP_URL}/verify-email?token=${token}`;
  const greeting = fullName ? `Hi ${fullName}` : 'Hi';

  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2>Verify your email</h2>
      <p>${greeting},</p>
      <p>Please verify your email address to continue.</p>
      <p><a href="${verifyUrl}">Verify Email</a></p>
      <p style="color:#666;font-size:14px;">Or copy: ${verifyUrl}</p>
    </div>
  `;

  if (!resend) {
    console.log('\n==== DEV: Verification Email ====');
    console.log(`To: ${toEmail}`);
    console.log(`Link: ${verifyUrl}`);
    console.log('===============================\n');
    return;
  }

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to: toEmail,
    subject: 'Verify your email',
    html,
  });
}

export async function sendPasswordResetEmail(toEmail: string, fullName: string | null, token: string): Promise<void> {
  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
  const greeting = fullName ? `Hi ${fullName}` : 'Hi';

  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>${greeting},</p>
      <p>Click the link below to reset your password.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p style="color:#666;font-size:14px;">Or copy: ${resetUrl}</p>
      <p style="color:#666;font-size:14px;">This link expires in 1 hour.</p>
    </div>
  `;

  if (!resend) {
    console.log('\n==== DEV: Password Reset Email ====');
    console.log(`To: ${toEmail}`);
    console.log(`Link: ${resetUrl}`);
    console.log('===============================\n');
    return;
  }

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to: toEmail,
    subject: 'Reset your password',
    html,
  });
}