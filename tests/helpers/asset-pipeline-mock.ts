import path from "node:path";
import { pathToFileURL } from "node:url";
import { vi } from "vitest";

// Set before importing an optimizer: its module-level paths belong to this root.
const assetPipelineFixture = vi.hoisted(() => ({ root: "" }));
export { assetPipelineFixture };
vi.mock("../../scripts/lib/repository-paths.mjs", () => ({
  get REPO_ROOT() {
    return assetPipelineFixture.root;
  },
}));
vi.mock("../../scripts/assets/asset-pipeline-runner.mjs", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../scripts/assets/asset-pipeline-runner.mjs")>();
  return {
    ...original,
    resolveRootDir: () => assetPipelineFixture.root,
    // The original closes over its resolver; supply a URL in the isolated root.
    resolvePipelinePaths: (_url: string, options: Parameters<typeof original.resolvePipelinePaths>[1]) =>
      original.resolvePipelinePaths(
        pathToFileURL(path.join(assetPipelineFixture.root, "scripts/mock-entry.mjs")).href,
        options,
      ),
  };
});
