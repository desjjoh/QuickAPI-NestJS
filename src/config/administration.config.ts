export const ADMINISTRATION_REASON_CODES = {
  SECURITY_RESPONSE: 'security_response',
  POLICY_ENFORCEMENT: 'policy_enforcement',
  ACCESS_REVIEW: 'access_review',
  USER_REQUEST: 'user_request',
  DATA_CORRECTION: 'data_correction',
} as const;

export type AdministrationReasonCode =
  (typeof ADMINISTRATION_REASON_CODES)[keyof typeof ADMINISTRATION_REASON_CODES];
