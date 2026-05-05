import { EmailTemplate } from '../models/template.model';

export interface SendEmailOptions<TModel extends Record<string, unknown>> {
  to: string;
  template: EmailTemplate;
  model?: TModel;
  tag?: string;
  metadata?: Record<string, string>;
}
