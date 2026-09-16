import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('the simulation runtime dependency graph has no renderer or browser imports', () => {
  const seen = new Set<string>(), external = new Set<string>();
  function inspect(path: string) {
    if (seen.has(path)) return; seen.add(path);
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    expect(path.endsWith('.tsx'), path).toBe(false);
    for (const statement of source.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) continue;
      if (ts.isExportDeclaration(statement) && statement.isTypeOnly) continue;
      const specifier = statement.moduleSpecifier.text;
      if (!specifier.startsWith('.')) { external.add(specifier); continue; }
      const base = resolve(dirname(path), specifier), target = [base, `${base}.ts`, `${base}/index.ts`].find(candidate => existsSync(candidate) && candidate.endsWith('.ts'));
      if (!target) throw new Error(`Unresolved runtime module ${base}`); inspect(target);
    }
  }
  inspect(fileURLToPath(new URL('../src/index.ts', import.meta.url)));
  expect([...external].sort()).toEqual(['@dimforge/rapier3d-compat', '@kerala-story/protocol', 'node:crypto']);
  expect(seen.size).toBeGreaterThan(15);
});
