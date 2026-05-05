export type EmailTemplateOptions = {
  key: string;
  subject: string;
  html: string;
  tag: string;
  metadata?: Record<string, string>;
};

export class EmailTemplate {
  public readonly key: string;
  public readonly subject: string;
  public readonly html: string;
  public readonly tag: string;
  public readonly metadata: Record<string, string>;

  public constructor(options: EmailTemplateOptions) {
    this.key = options.key;
    this.subject = options.subject;
    this.html = options.html;
    this.tag = options.tag;
    this.metadata = options.metadata ?? {};
  }
}
