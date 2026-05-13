import { EmailTemplate } from '../models/template.model';

export interface PasswordResetTemplateContext {
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export const PasswordResetTemplate = new EmailTemplate({
  key: 'password-reset',
  subject: 'Reset your password',
  tag: 'password-reset',
  metadata: {
    category: 'account',
    workflow: 'password-reset',
  },
  html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Reset your password</title>
        </head>

        <body style="margin:0;padding:0;background-color:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f7f9;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding:32px 32px 16px 32px;">
                      <h1 style="margin:0;font-size:24px;line-height:1.3;color:#111827;">
                        Reset your password
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 16px 32px;">
                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">
                        Hi {{firstName}},
                      </p>

                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">
                        We received a request to reset the password for your account.
                      </p>

                      <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;">
                        This link expires in {{expiresInMinutes}} minutes.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:8px 32px 32px 32px;">
                      <a href="{{resetUrl}}" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 22px;border-radius:8px;">
                        Reset password
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 24px 32px;">
                      <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                        If the button does not work, copy and paste this link into your browser:
                      </p>

                      <p style="margin:0;font-size:14px;line-height:1.6;word-break:break-all;color:#374151;">
                        <a href="{{resetUrl}}" style="color:#2563eb;">
                          {{resetUrl}}
                        </a>
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                      <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#6b7280;">
                        If you did not request a password reset, you can safely ignore this email.
                      </p>

                      <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
                        Your password will not be changed unless this link is used.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
});
