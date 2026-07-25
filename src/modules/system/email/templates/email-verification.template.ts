import { EmailTemplate } from '../models/template.model';

export interface EmailVerificationTemplateContext {
  firstName: string;
  expiresInMinutes: number;
  mfaCode: string;
}

export const EmailVerificationTemplate = new EmailTemplate({
  key: 'email-verification',
  subject: 'Confirm your new email address',
  tag: 'email-change-verification',
  metadata: {
    category: 'account',
    workflow: 'email-change-verification',
  },
  html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Confirm your new email address</title>
        </head>

        <body style="margin:0;padding:0;background-color:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f7f9;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding:32px 32px 16px 32px;">
                      <h1 style="margin:0;font-size:24px;line-height:1.3;color:#111827;">
                        Confirm your new email address
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 16px 32px;">
                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">
                        Hi {{firstName}},
                      </p>

                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">
                        We received a request to change the email address for your account. Enter the 6-digit verification code in the email change screen to complete the change.
                      </p>

                      <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;">
                        This code expires in {{expiresInMinutes}} minutes.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:0 32px 24px 32px;text-align:center;">
                      <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;text-align:center;">
                        <tr>
                          <td align="center" style="padding:0 0 8px 0;text-align:center;font-size:14px;line-height:1.6;color:#4b5563;">
                            Your verification code is:
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:0;text-align:center;font-size:32px;line-height:1.2;letter-spacing:8px;padding-left:8px;font-weight:bold;color:#111827;">
                            {{mfaCode}}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                      <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
                        If you did not request this email change, you can safely ignore this email.
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
