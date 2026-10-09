import type { Request } from 'express';

const uploads = new WeakMap<Request, Set<string>>();
export const activeUploadPaths = new Set<string>();

export function trackUpload(request: Request, path: string): void {
  const paths = uploads.get(request) ?? new Set<string>();
  paths.add(path);
  uploads.set(request, paths);
  activeUploadPaths.add(path);
}

export function requestUploadPaths(request: Request): string[] {
  return [...(uploads.get(request) ?? [])];
}
