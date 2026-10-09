export type EmailJobPayload = {
  to: string;
  subject: string;
  htmlBody: string;
  messageStream: string;
  tag?: string;
  metadata?: Record<string, string>;
};

export type EmailDeadLetterPayload = {
  originalData: EmailQueuePayload;
  meta: {
    jobId: string | undefined;
    attemptsMade: number;
    failedReason: string;
    stacktrace: string[];
    timestamp: number;
    queueName: string;
  };
};

export type EmailQueuePayload = EmailJobPayload | { deliveryId: string };
