export default class PlaywrightRunReporter {
  runId: string;
  onBegin(
    config: unknown,
    suite: { allTests(): Array<{ outcome(): "expected" | "unexpected" | "flaky" | "skipped" }> },
  ): void;
  onEnd(): void;
}
