import { describe, expect, it } from "vitest";
import { extractBuildResourceUrls } from "../../scripts/smoke-preview.mjs";

describe("extractBuildResourceUrls", () => {
  it("resolves Vite scripts and styles for web builds", () => {
    const html = `
      <link rel="stylesheet" href="/assets/index.css">
      <script type="module" src="/assets/index.js"></script>
    `;

    expect(extractBuildResourceUrls(html, "http://127.0.0.1:4174/")).toEqual([
      "http://127.0.0.1:4174/assets/index.js",
      "http://127.0.0.1:4174/assets/index.css",
    ]);
  });

  it("resolves relative resources emitted by desktop mode", () => {
    const html = `<script type="module" src="./assets/index.js"></script>`;
    expect(extractBuildResourceUrls(html, "http://127.0.0.1:4174/")).toEqual(["http://127.0.0.1:4174/assets/index.js"]);
  });
});
