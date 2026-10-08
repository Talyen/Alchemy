import ts from "typescript";
import { expect, it } from "vitest";
import { readText } from "./helpers";

it("keeps battle state contracts independent of executable combat rules", () => {
  const violations: string[] = [];
  for (const path of ["src/lib/battle/types.ts", "src/lib/battle/types/state-types.ts"]) {
    const source = ts.createSourceFile(path, readText(path), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      const typeOnly =
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) ||
        (ts.isExportDeclaration(statement) && statement.isTypeOnly);
      if (!typeOnly) violations.push(`${path}: ${statement.getText(source)}`);
    }
  }
  expect(violations).toEqual([]);
});
