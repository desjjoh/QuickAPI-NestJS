import 'tsconfig-paths/register';
import '../../load-test-env';

import { migrateAndSeedEmptyTestSchema } from './test-database';

export default async function globalSetup(): Promise<void> {
  await migrateAndSeedEmptyTestSchema();
}
