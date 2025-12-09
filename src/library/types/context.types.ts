export type RequestContextStore = {
  requestId: string;
  method: string;
  path: string;
  ip: string | undefined;
};
