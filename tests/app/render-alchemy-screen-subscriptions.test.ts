import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.tsx", "utf8");
const renderSource = readFileSync("src/app/render-alchemy-screen.tsx", "utf8");

function uniqueMatches(source: string, pattern: RegExp) {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

function appStateReads() {
  const directReads = uniqueMatches(renderSource, /useAppStore\.getState\(\)\.(\w+)/g);
  const snapshotReads = uniqueMatches(renderSource, /appState\.(\w+)/g).filter((field) => !isAppStoreAction(field));
  return [...new Set([...directReads, ...snapshotReads])].sort();
}

function homesteadStateReads() {
  return uniqueMatches(renderSource, /useHomesteadStore\.getState\(\)\.(\w+)/g).filter(
    (field) => !isHomesteadStoreAction(field),
  );
}

function isAppStoreAction(field: string) {
  return field.startsWith("set") || field.startsWith("handle") || field.startsWith("reset");
}

function isHomesteadStoreAction(field: string) {
  return (
    field.startsWith("construct") ||
    field.startsWith("plant") ||
    field.startsWith("complete") ||
    field.startsWith("bond")
  );
}

describe("render-alchemy-screen store subscription contract", () => {
  it("subscribes in App.tsx to every app-store state field read by render-alchemy-screen.tsx", () => {
    const subscribedFields = uniqueMatches(appSource, /useAppStore\(\(s\) => s\.(\w+)/g);
    const missing = appStateReads().filter((field) => !subscribedFields.includes(field));

    expect(
      missing,
      [
        "Fields read via useAppStore.getState() or appState in render-alchemy-screen.tsx",
        "but not subscribed in App.tsx:",
        ...missing,
      ].join("\n  "),
    ).toEqual([]);
  });

  it("subscribes in App.tsx to every homestead-store state field read by render-alchemy-screen.tsx", () => {
    const subscribedFields = uniqueMatches(appSource, /useHomesteadStore\(\(s\) => s\.(\w+)/g);
    const missing = homesteadStateReads().filter((field) => !subscribedFields.includes(field));

    expect(
      missing,
      [
        "Fields read via useHomesteadStore.getState() in render-alchemy-screen.tsx",
        "but not subscribed in App.tsx:",
        ...missing,
      ].join("\n  "),
    ).toEqual([]);
  });
});
