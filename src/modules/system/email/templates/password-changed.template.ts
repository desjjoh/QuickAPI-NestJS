import { EmailTemplate } from '../models/template.model';

export interface AccountPasswordChangedTemplateContext {
  firstName: string;
}

export const AccountPasswordChangedTemplate = new EmailTemplate({
  key: 'account-password-changed',
  subject: 'Your password was changed',
  tag: 'account-password-changed',
  metadata: {
    category: 'account',
    workflow: 'account-password-changed',
  },
  html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Your password was changed</title>
        </head>

        <body style="margin:0;padding:0;background-color:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f7f9;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding:32px 32px 16px 32px;">
                      <h1 style="margin:0;font-size:24px;line-height:1.3;color:#111827;">
                        Your password was changed
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 24px 32px;">
                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">
                        Hi {{firstName}},
                      </p>

                      <p style="margin:0;font-size:16px;line-height:1.6;">
                        This confirms that your password was changed successfully.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                      <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
                        If you did not change your password, reset it immediately and contact support.
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
