import type { Request } from 'express';

export interface SessionInfo {
  browser: string | null;
  browser_version: string | null;
  device: string | null;
  os: string | null;
  os_version: string | null;
  ip_address: string | null;
  user_agent: string | null;
  language: string | null;
  origin: string | null;
}

export function createSessionInfoFromRequest(
  req: Request | undefined,
): SessionInfo | null {
  if (!req) return null;

  const userAgent = req.get('user-agent') ?? null;
  const forwardedFor = req.get('x-forwarded-for');
  const ipAddress =
    forwardedFor?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    null;

  return {
    browser: getBrowser(userAgent),
    browser_version: getBrowserVersion(userAgent),
    device: getDevice(userAgent),
    os: getOs(userAgent),
    os_version: getOsVersion(userAgent),
    ip_address: ipAddress,
    user_agent: userAgent,
    language: getPreferredLanguage(req.get('accept-language') ?? null),
    origin: req.get('origin') ?? null,
  };
}

export function getBrowser(userAgent: string | null): string | null {
  if (!userAgent) return null;
  if (/Edg\//.test(userAgent)) return 'Microsoft Edge';
  if (/OPR\//.test(userAgent)) return 'Opera';
  if (/Chrome\//.test(userAgent)) return 'Chrome';
  if (/Safari\//.test(userAgent) && /Version\//.test(userAgent))
    return 'Safari';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  return 'Unknown';
}

export function getBrowserVersion(userAgent: string | null): string | null {
  if (!userAgent) return null;

  const patterns = [
    /Edg\/(\S+)/,
    /OPR\/(\S+)/,
    /Chrome\/(\S+)/,
    /Version\/(\S+)/,
    /Firefox\/(\S+)/,
  ];
  return getFirstMatch(userAgent, patterns);
}

export function getDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent)) return 'Tablet';
  if (/Mobile|Android|iPhone|iPod|IEMobile|BlackBerry/i.test(userAgent))
    return 'Mobile';
  return 'Desktop';
}

export function getOs(userAgent: string | null): string | null {
  if (!userAgent) return null;
  if (/Windows NT/i.test(userAgent)) return 'Windows';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Mac OS X/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Unknown';
}

export function getOsVersion(userAgent: string | null): string | null {
  if (!userAgent) return null;

  const windowsVersion = /Windows NT ([^;)]+)/.exec(userAgent)?.[1] ?? null;
  if (windowsVersion) return windowsVersion;

  const androidVersion = /Android ([^;)]+)/.exec(userAgent)?.[1] ?? null;
  if (androidVersion) return androidVersion;

  const iosVersion = /OS ([\d_]+) like Mac OS X/.exec(userAgent)?.[1] ?? null;
  if (iosVersion) return iosVersion.replace(/_/g, '.');

  const macVersion = /Mac OS X ([\d_]+)/.exec(userAgent)?.[1] ?? null;
  if (macVersion) return macVersion.replace(/_/g, '.');

  return null;
}

export function getPreferredLanguage(
  acceptLanguage: string | null,
): string | null {
  return acceptLanguage?.split(',')[0]?.trim() || null;
}

function getFirstMatch(userAgent: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(userAgent)?.[1] ?? null;
    if (match) return match;
  }

  return null;
}
