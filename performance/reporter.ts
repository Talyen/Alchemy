import type { FullConfig, FullResult, Reporter, Suite } from "@playwright/test/reporter";
import { finalizePerformanceReport, SCENARIO_IDS } from "./fixtures";

/**
 * After all performance scenarios finish, assemble summary.md / results.json.
 */
class PerformanceReporter implements Reporter {
  private scenarios = new Set<string>();

  onBegin(_config: FullConfig, suite: Suite) {
    for (const test of suite.allTests()) {
      for (const id of SCENARIO_IDS) {
        if (test.title.includes(id) || test.location.file.includes(id)) {
          this.scenarios.add(id);
        }
      }
    }
  }

  onEnd(_result: FullResult) {
    const filter = process.env.PERF_SCENARIO;
    const list = this.scenarios.size > 0 ? [...this.scenarios] : filter ? [filter] : [...SCENARIO_IDS];
    try {
      const summary = finalizePerformanceReport(list);
      console.log(`\nPerformance report: ${summary}`);
    } catch (error) {
      console.warn("Could not finalize performance report:", error);
    }
  }
}

export default PerformanceReporter;
