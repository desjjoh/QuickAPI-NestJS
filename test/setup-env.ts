import { jest } from '@jest/globals';

import './load-test-env';

// nanoid is ESM-only; unit tests do not need cryptographic IDs and run through
// ts-jest's CommonJS runtime. Keep entity imports isolated from that runtime
// concern while retaining deterministic IDs in specifications.
jest.mock('nanoid', () => ({
  customAlphabet: () => () => '0000000000000000',
}));
