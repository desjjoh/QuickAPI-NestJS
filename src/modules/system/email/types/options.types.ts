export interface SendEmailOptions<TModel extends Record<string, unknown>> {
  to: string;
  subject: string;
  template: string;
  model: TModel;
  tag?: string;
  metadata?: Record<string, string>;
}
