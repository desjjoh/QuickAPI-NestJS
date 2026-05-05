import { EmailTemplate } from '../models/template.model';

export const TestEmailTemplate = new EmailTemplate({
  key: 'generic-test-email',
  subject: 'Hello from Postmark',
  html: '<strong>Hello</strong> dear Postmark user.',
  tag: 'system',
});
