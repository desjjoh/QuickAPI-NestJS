import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

function sources(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : path.endsWith('.service.ts')
        ? [path]
        : [];
  });
}

describe('service persistence boundaries', () => {
  const databaseMethods = new Set([
    'find',
    'findBy',
    'findOne',
    'findOneBy',
    'findOneOrFail',
    'findOneByOrFail',
    'exists',
    'existsBy',
    'count',
    'countBy',
    'save',
    'insert',
    'update',
    'upsert',
    'delete',
    'remove',
    'create',
    'merge',
    'increment',
    'decrement',
    'query',
    'getRepository',
    'createQueryBuilder',
  ]);

  it.each(['api', 'domain'])(
    '%s services delegate persistence to repositories',
    (layer) => {
      const violations: string[] = [];
      for (const file of sources(join(process.cwd(), 'src/modules', layer))) {
        const source = ts.createSourceFile(
          file,
          readFileSync(file, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        );
        const managers = new Set([
          'manager',
          'transactionManager',
          'entityManager',
        ]);
        function visit(node: ts.Node): void {
          if (
            ts.isParameter(node) &&
            node.type?.getText(source) === 'EntityManager'
          ) {
            managers.add(node.name.getText(source));
          }
          if (
            layer === 'api' &&
            ts.isImportDeclaration(node) &&
            /\/repositories\//.test(node.moduleSpecifier.getText(source))
          ) {
            violations.push(
              `${relative(process.cwd(), file)} imports a repository`,
            );
          }
          if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression)
          ) {
            const call = node.expression;
            if (
              databaseMethods.has(call.name.text) &&
              managers.has(call.expression.getText(source))
            ) {
              violations.push(
                `${relative(process.cwd(), file)} calls ${call.getText(source)}`,
              );
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
      expect(violations).toEqual([]);
    },
  );
});
