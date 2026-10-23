#!/usr/bin/env node
import path from "node:path";
import { createVitest } from "vitest/node";
import { defineScript } from "./lib/script-run.mjs";
import { unitSelection } from "./lib/verification/unit-selection.mjs";

defineScript(import.meta.url, async () => {
  const { related, selectors } = JSON.parse(process.argv[2]);
  unitSelection(["run", ...selectors], process.cwd());
  process.env.TEST = "true";
  process.env.VITEST = "true";
  process.env.NODE_ENV ??= "test";
  const ctx = await createVitest("test", {
    watch: false,
    related: related.length ? related.map((file) => path.resolve(file)) : undefined,
  });
  try {
    await ctx.standalone();
    const explicit = selectors.length ? await ctx.globTestSpecifications(selectors) : [];
    if (selectors.length && !explicit.length) throw new Error("No unit tests matched explicit selections");
    const owned = new Set(explicit.map((spec) => spec.taskId));
    const remaining = related.length
      ? (await ctx.globTestSpecifications()).filter((spec) => !owned.has(spec.taskId))
      : [];
    const dependent = remaining.length
      ? await ctx.getRelevantTestSpecifications(remaining.map((spec) => spec.moduleId))
      : [];
    const unique = new Map([...explicit, ...dependent].map((spec) => [spec.taskId, spec]));
    console.log(`Unit selection: ${unique.size} files; one discovery session and reservation.`);
    if (!unique.size) return 0;
    const result = await ctx.runTestSpecifications([...unique.values()]);
    return result.unhandledErrors.length || result.testModules.some((module) => module.state() === "failed") ? 1 : 0;
  } finally {
    await ctx.close();
  }
});
