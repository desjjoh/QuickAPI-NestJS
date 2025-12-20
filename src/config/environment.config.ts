import { z, ZodError } from 'zod';
import { createRequire } from 'module';
import path from 'path';
import { yellow, red, green, dim, bold } from 'colorette';
import { config as loadEnv } from 'dotenv';

import { rootPath } from '@/helpers/path.helper';

loadEnv();

const req: NodeJS.Require = createRequire(path.join(rootPath, 'package.json'));

const pkgPath: string = path.join(rootPath, 'package.json');
const pkg = req(pkgPath);

const EnvSchema = z.object({
  APP_NAME: z.string().default(pkg.name),
  APP_VERSION: z
    .string()
    .regex(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/,
      'APP_VERSION must follow full SemVer (e.g., 1.2.3 or 1.2.3-beta+001)',
    )
    .default(pkg.version),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number(),
  LOG_LEVEL: z.enum([
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ]),

  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_DATABASE: z.string(),
});

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

let env: z.infer<typeof EnvSchema>;

try {
  env = EnvSchema.parse(process.env);
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

export type AppEnv = z.infer<typeof EnvSchema>;
export const APP_ENV = 'APP_ENV' as const;
