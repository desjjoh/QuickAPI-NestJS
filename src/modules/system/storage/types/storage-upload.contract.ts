/** Safe client-facing message: provider responses may contain credentials or private URLs. */
export const STORAGE_UPLOAD_FAILURE = 'Storage upload failed. Please retry.';
export const STORAGE_UPLOAD_RETRY_DESCRIPTION =
  'The storage upload failed. No image mutation was committed and this failed attempt is not cached for idempotent replay. Retry the same payload and Idempotency-Key; uncertain uploaded bytes are reconciled asynchronously.';
