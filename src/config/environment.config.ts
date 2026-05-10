import { ZodError, z } from 'zod';
import { yellow, red, green, dim, bold } from 'colorette';
import { config as loadEnv } from 'dotenv';

import { AppEnv, parseEnv } from './environment.schema';

loadEnv({ quiet: true });

function formatIssue(issue: z.core.$ZodIssue): string {
  const field: string = issue.path.join('.') || '(root)';

  const receivedMatch: RegExpMatchArray | null =
    issue.message.match(/received\s"?(.*?)"?$/);

  const received: string | undefined = receivedMatch
    ? receivedMatch[1]
    : undefined;

  const cleaned: string = issue.message
    .replace(/^Invalid input[:, ]*/, '')
    .replace(/^Invalid enum value[:, ]*/, '')
    .replace(/received\s.*$/, '')
    .trim();

  const msg: string = received
    ? `${yellow(field)} → ${cleaned} (received: ${red(`"${received}"`)})`
    : `${yellow(field)} → ${cleaned}`;

  return `  - ${msg}`;
}

function printEnvErrors(issues: z.core.$ZodIssue[]): void {
  const count: number = issues.length;

  process.stdout.write(
    red(
      bold(
        `❌ Environment validation failed (${count} issue${count !== 1 ? 's' : ''})`,
      ),
    ),
  );

  process.stdout.write('\n\n');

  for (const issue of issues) {
    process.stdout.write(formatIssue(issue) + '\n');
  }

  process.stdout.write('\n');
  process.stdout.write(
    dim(green('Fix the fields above and restart the application…\n\n')),
  );
}

let env: AppEnv;

try {
  env = parseEnv(process.env);
} catch (err: unknown) {
  if (err instanceof ZodError) {
    printEnvErrors(err.issues);
  } else {
    process.stdout.write(
      red(bold('❌ Unexpected error during environment validation\n\n')),
    );
  }

  process.exit(1);
}

export { env };

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

export type { AppEnv };
export const APP_ENV = 'APP_ENV' as const;
