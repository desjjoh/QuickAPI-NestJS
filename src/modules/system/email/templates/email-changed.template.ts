import { EmailTemplate } from '../models/template.model';

export interface EmailChangeSuccessTemplateContext {
  firstName: string;
  email: string;
}

export const EmailChangeSuccessTemplate = new EmailTemplate({
  key: 'email-change-success',
  subject: 'Your email address was changed',
  tag: 'email-change-success',
  metadata: {
    category: 'account',
    workflow: 'email-change-success',
  },
  html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Your email address was changed</title>
        </head>

        <body style="margin:0;padding:0;background-color:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f7f9;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding:32px 32px 16px 32px;">
                      <h1 style="margin:0;font-size:24px;line-height:1.3;color:#111827;">
                        Your email address was changed
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 24px 32px;">
                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">
                        Hi {{firstName}},
                      </p>

                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">
                        This confirms that the email address for your account was successfully changed to {{email}}.
                      </p>

                      <p style="margin:0;font-size:16px;line-height:1.6;">
                        You can now use this email address to sign in and receive account notifications.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                      <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
                        If you did not make this change, reset your password immediately and contact support.
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
