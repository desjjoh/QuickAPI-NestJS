import { EmailTemplate } from '../models/template.model';

export interface EmailVerificationTemplateContext {
  firstName: string;
  verificationUrl: string;
  expiresInMinutes: number;
}

export const EmailVerificationTemplate = new EmailTemplate({
  key: 'email-verification',
  subject: 'Verify your email address',
  tag: 'account-verification',
  html: `
      <p>Hi {{firstName}},</p>

      <p>Thanks for creating an account. Please verify your email address to activate your account.</p>

      <p>
        <a href="{{verificationUrl}}">Verify your email address</a>
      </p>

      <p>This link expires in {{expiresInMinutes}} minutes.</p>

      <p>If the link above does not work, copy and paste this URL into your browser:</p>

      <p>{{verificationUrl}}</p>

      <p>If you did not create this account, you can safely ignore this email.</p>
    `,
});
