import 'tsconfig-paths/register';
import '../../setup-env';

import { closeAllTestDataSources } from './test-database';

export default async function globalTeardown(): Promise<void> {
  await closeAllTestDataSources();
}
