export interface SendEmailOptions {
  to: string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  tag?: string;
  metadata?: Record<string, string>;
}
