import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const envPath = resolve(process.cwd(), '.env');
const envExamplePath = resolve(process.cwd(), '.env.example');

if (existsSync(envPath))
  loadEnv({ path: envPath, override: false, quiet: true });
else if (existsSync(envExamplePath))
  loadEnv({ path: envExamplePath, override: false, quiet: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
