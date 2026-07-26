import 'tsconfig-paths/register';
import '../../load-test-env';

import { closeAllTestDataSources } from './test-database';

export default async function globalTeardown(): Promise<void> {
  await closeAllTestDataSources();
}
