import { EmailTemplate } from '../models/template.model';

export interface RegistrationVerificationTemplateContext {
  firstName: string;
  verificationUrl: string;
  expiresInMinutes: number;
  mfaCode: string;
}

export const RegistrationVerificationTemplate = new EmailTemplate({
  key: 'registration-verification',
  subject: 'Complete your registration',
  tag: 'registration-verification',
  metadata: {
    category: 'account',
    workflow: 'registration-verification',
  },
  html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Complete your registration</title>
        </head>

        <body style="margin:0;padding:0;background-color:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f7f9;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding:32px 32px 16px 32px;">
                      <h1 style="margin:0;font-size:24px;line-height:1.3;color:#111827;">
                        Complete your registration
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 16px 32px;">
                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">
                        Hi {{firstName}},
                      </p>

                      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">
                        Thanks for creating an account. Please confirm your email address and enter the 6-digit verification code to complete registration.
                      </p>

                      <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;">
                        This link and code expire in {{expiresInMinutes}} minutes.
                      </p>
                    </td>
                  </tr>


                  <tr>
                    <td align="center" style="padding:0 32px 24px 32px;">
                      <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                        Your verification code is:
                      </p>

                      <p style="margin:0;font-size:32px;letter-spacing:8px;font-weight:bold;color:#111827;">
                        {{mfaCode}}
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:8px 32px 32px 32px;">
                      <a href="{{verificationUrl}}" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 22px;border-radius:8px;">
                        Complete registration
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 24px 32px;">
                      <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                        If the button does not work, copy and paste this link into your browser:
                      </p>

                      <p style="margin:0;font-size:14px;line-height:1.6;word-break:break-all;color:#374151;">
                        <a href="{{verificationUrl}}" style="color:#2563eb;">
                          {{verificationUrl}}
                        </a>
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                      <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
                        If you did not create this account, you can safely ignore this email.
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
