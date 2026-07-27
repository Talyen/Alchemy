#!/usr/bin/env node
// Slow ESLint smoke: lint representative screens under stacked boundary rules.
// Kept out of the default Vitest suite (cold ESLint can exceed unit timeouts in CI).
import { ESLint } from "eslint";

const FILES = [
  "src/features/alchemy/meta/screens/menu-screen.tsx",
  "src/features/alchemy/meta/screens/armory/use-armory-controller.ts",
  "src/features/alchemy/run-loop/screens/destination-screen.tsx",
  "src/features/alchemy/run-loop/shop/create-shop-actions.ts",
];

const eslint = new ESLint();
const results = await eslint.lintFiles(FILES);
const errors = results.flatMap((r) =>
  r.messages.filter((m) => m.severity === 2).map((m) => `${r.filePath}:${m.line}:${m.column} ${m.message}`),
);

if (errors.length > 0) {
  console.error("Architecture ESLint smoke failed:\n" + errors.join("\n"));
  process.exit(1);
}

console.log(`Architecture ESLint smoke clean (${FILES.length} files).`);
