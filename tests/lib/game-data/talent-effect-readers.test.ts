import ts from "typescript";
import { describe, expect, it } from "vitest";
import { collectTalentEffectReaders } from "../../helpers/talent-effect-readers";

function readersIn(body: string): Set<string> {
  const filename = "/talent-reader-fixture.ts";
  const source = ts.createSourceFile(
    filename,
    `interface Manifest {
      direct: number;
      bracket: number;
      picked: number;
      destructured: number;
      registered: number;
      optional: number;
      missing: number;
    }
    declare const effects: Manifest;
    ${body}`,
    ts.ScriptTarget.Latest,
    true,
  );
  const options: ts.CompilerOptions = { noLib: true, strict: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => (name === filename ? source : undefined);
  const program = ts.createProgram([filename], options, host);
  expect(program.getSemanticDiagnostics()).toEqual([]);
  const checker = program.getTypeChecker();
  const declaration = source.statements[0] as ts.InterfaceDeclaration;
  const manifest = checker.getTypeAtLocation(declaration);
  return collectTalentEffectReaders(checker, manifest, [source]);
}

describe("Talent reader discovery", () => {
  it("recognizes aliases, captured manifests, narrowed helpers, destructuring, and typed key tables", () => {
    const readers = readersIn(`
      const captured = { bonuses: effects };
      const renamed = captured.bonuses;
      const directValue = renamed.direct;
      function readOptional(snapshot: Manifest | undefined) { return snapshot?.optional; }
      const key = "bracket";
      const bracketValue = renamed[key];
      type PickFields<T, K extends keyof T> = { [P in K]: T[P] };
      type Selected = PickFields<Manifest, "picked">;
      function readSelected(snapshot: Selected) { return snapshot.picked; }
      const { destructured: localValue } = renamed;
      const reaction: { chance: keyof Manifest } = { chance: "registered" };
    `);
    expect([...readers].sort()).toEqual(["bracket", "destructured", "direct", "optional", "picked", "registered"]);
    expect(readers.has("missing")).toBe(false);
  });

  it("does not accept comments, strings, unrelated properties, type references, or write-only assignments", () => {
    expect([
      ...readersIn(`
      // talentEffects.direct
      const text = 'talentEffects.bracket';
      const example = { chance: "registered", unrelated: "missing" };
      const other = { picked: 1 };
      const copied = other.picked;
      const { picked: unrelatedAlias } = other;
      type Value = Manifest["destructured"];
      effects.direct = 1;
      effects["bracket"] = 2;
    `),
    ]).toEqual([]);
  });

  it("detects removal of the real consumer even when misleading mentions remain", () => {
    const mentions = `// talentEffects.direct\nconst message = "talentEffects.direct";`;
    expect(readersIn(`${mentions}\nconst result = effects.direct;`).has("direct")).toBe(true);
    expect(readersIn(mentions).has("direct")).toBe(false);
  });
});
