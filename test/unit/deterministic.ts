export const DEFAULT_TEST_TIME = new Date('2025-01-02T03:04:05.000Z');

export interface DeterministicGenerators {
  code: jest.MockedFunction<() => string>;
  token: jest.MockedFunction<() => string>;
}

export const useDeterministicClock = (now: Date = DEFAULT_TEST_TIME): void => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
};

export const deterministicGenerators = (
  overrides: Partial<{ code: string; token: string }> = {},
): DeterministicGenerators => ({
  code: jest.fn(() => overrides.code ?? '123456'),
  token: jest.fn(() => overrides.token ?? 'deterministic-test-token'),
});

/** Use from a suite's `afterEach` hook so mocks and timers cannot leak. */
export const resetUnitTestState = (): void => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.useRealTimers();
};
