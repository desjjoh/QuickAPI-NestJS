import path from 'node:path';
import ts from 'typescript';

const strictFlags = [
  'noImplicitAny',
  'noImplicitThis',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictBindCallApply',
  'strictPropertyInitialization',
  'strictBuiltinIteratorReturn',
  'useUnknownInCatchVariables',
  'alwaysStrict',
] as const;

describe('TypeScript compiler protections', () => {
  it.each(['tsconfig.json', 'tsconfig.build.json', 'test/tsconfig.e2e.json'])(
    'keeps full strictness and switch fallthrough protection in %s',
    (configName) => {
      const filename = path.resolve(process.cwd(), configName);
      const file = ts.readConfigFile(filename, ts.sys.readFile);
      expect(file.error).toBeUndefined();
      const config = ts.parseJsonConfigFileContent(
        file.config,
        ts.sys,
        path.dirname(filename),
        undefined,
        filename,
      );
      expect(config.errors).toEqual([]);
      expect(config.options.strict).toBe(true);
      expect(config.options.noFallthroughCasesInSwitch).toBe(true);
      for (const flag of strictFlags) {
        // TypeScript inherits each strict-family option unless explicitly overridden.
        expect(config.options[flag] ?? config.options.strict).toBe(true);
      }
    },
  );
});
