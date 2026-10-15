import * as React from "react";
import * as compilerRuntime from "react/compiler-runtime";
import babel from "@babel/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useGameTranslation } from "@/components/use-game-translation";
import { displayText, installCatalogs, localization } from "@/lib/localization/runtime";
import catalogs from "@/lib/localization/locales/runtime.json";

afterEach(async () => {
  cleanup();
  await localization.changeLanguage("en");
});

it("refreshes compiler-cached messages, helpers and explicit memo results without remounting", async () => {
  installCatalogs(catalogs);
  const generated = babel.transformSync(
    `
    import * as React from "react";
    import { useGameTranslation } from "./hook";
    import { localizedHelper } from "./helper";
    export function CompiledTranslation() {
      const i18n = useGameTranslation();
      const name = i18n.read(() => localizedHelper());
      const label = React.useMemo(() => i18n.text("options.language", "Language"), [i18n]);
      return React.createElement("button", null, name + " " + label);
    }
  `,
    {
      filename: "localized-fixture.tsx",
      configFile: false,
      babelrc: false,
      plugins: [["babel-plugin-react-compiler", { target: "19" }]],
    },
  )!.code!;
  expect(generated).toContain("react/compiler-runtime");
  const parsed = babel.parseSync(generated, { configFile: false, babelrc: false })!;
  const imports = parsed.program.body.filter((node) => node.type === "ImportDeclaration");
  const compiler = imports.find((node) => node.source.value === "react/compiler-runtime")!;
  const binding = compiler.specifiers[0]!.local.name;
  let executable = generated;
  for (const node of [...imports].reverse())
    executable = executable.slice(0, node.start!) + executable.slice(node.end!);
  executable = executable.replace("export function CompiledTranslation", "function CompiledTranslation");
  // Execute only this literal test fixture with the real compiler cache and hook.
  const create = new Function(
    "React",
    binding,
    "useGameTranslation",
    "localizedHelper",
    executable + "; return CompiledTranslation;",
  ) as (...values: unknown[]) => React.ComponentType;
  const Component = create(
    React,
    (compilerRuntime as unknown as { c: (size: number) => unknown[] }).c,
    useGameTranslation,
    () => displayText("Staff"),
  );
  render(<Component />);
  const button = screen.getByRole("button", { name: "Staff Language" });
  button.focus();
  await act(async () => {
    await localization.changeLanguage("de");
  });
  expect(screen.getByRole("button", { name: "Stab Sprache" })).toBe(button);
  expect(document.activeElement).toBe(button);
  await act(async () => {
    await localization.changeLanguage("en");
  });
  expect(screen.getByRole("button", { name: "Staff Language" })).toBe(button);
});
