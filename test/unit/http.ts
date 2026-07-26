import type { Response } from 'express';

export type MockCookieResponse = jest.Mocked<
  Pick<Response, 'clearCookie' | 'cookie'>
>;

export const mockCookieResponse = (): MockCookieResponse => {
  const response = {
    clearCookie: jest.fn(),
    cookie: jest.fn(),
  } as MockCookieResponse;

  response.clearCookie.mockReturnValue(response as unknown as Response);
  response.cookie.mockReturnValue(response as unknown as Response);

  return response;
};
