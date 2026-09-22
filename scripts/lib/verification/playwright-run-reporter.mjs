import { ensureRunId } from "./current-run.mjs";

export default class PlaywrightRunReporter {
  constructor() {
    this.runId = ensureRunId("playwright");
    this.suite = null;
  }

  onBegin(_config, suite) {
    this.suite = suite;
    console.log(`Playwright run: ${this.runId}`);
  }

  onEnd() {
    const counts = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
    for (const test of this.suite?.allTests() ?? []) counts[test.outcome()] += 1;
    console.log(
      `playwright — ${counts.expected} passed, ${counts.unexpected} failed, ${counts.flaky} flaky, ` +
        `${counts.skipped} skipped (run ${this.runId})`,
    );
  }
}
