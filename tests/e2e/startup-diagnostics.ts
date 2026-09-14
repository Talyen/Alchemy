import type { Page, Request, Response } from "@playwright/test";

/** Attach before navigation; share the fixture's bounded log and failure artifact. */
export function collectStartupDiagnostics(
  page: Page,
  context: { mode: "dev" | "preview"; workers: number },
  record: (message: string) => void,
) {
  const pending = new Map<Request, number>();
  let omittedRequests = 0;
  const relevant = (request: Request) => ["document", "script"].includes(request.resourceType());
  const location = (request: Request) => {
    const url = new URL(request.url());
    return `${url.origin}${url.pathname}`.slice(0, 400);
  };
  const started = (request: Request) => {
    if (!relevant(request)) return;
    if (pending.size >= 40) {
      omittedRequests += 1;
      return;
    }
    pending.set(request, performance.now());
  };
  const finished = (request: Request) => {
    pending.delete(request);
  };
  const failed = (request: Request) => {
    if (relevant(request))
      record(`[Request failed] ${location(request)}: ${request.failure()?.errorText ?? "unknown error"}`);
    finished(request);
  };
  const responded = (response: Response) => {
    if (response.status() >= 400 && relevant(response.request()))
      record(`[HTTP ${response.status()}] ${location(response.request())}`);
  };
  page.on("request", started);
  page.on("requestfinished", finished);
  page.on("requestfailed", failed);
  page.on("response", responded);

  return {
    stop() {
      page.off("request", started);
      page.off("requestfinished", finished);
      page.off("requestfailed", failed);
      page.off("response", responded);
    },
    async snapshot() {
      record(
        `[Startup] mode=${context.mode} workers=${context.workers}; ${pending.size} tracked pending document/module requests; ${omittedRequests} requests omitted at capacity`,
      );
      const now = performance.now();
      for (const [request, start] of [...pending].slice(0, 5))
        record(`[Pending ${Math.round(now - start)}ms] ${location(request)}`);
      if (pending.size > 5) record(`[Pending] ${pending.size - 5} more tracked requests omitted from digest`);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const timing = await Promise.race([
          page.evaluate(() => {
            const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
            return navigation
              ? {
                  elapsedMs: Math.round(performance.now()),
                  responseEndMs: Math.round(navigation.responseEnd),
                  domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
                  loadMs: Math.round(navigation.loadEventEnd),
                  readyState: document.readyState,
                }
              : null;
          }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("page did not answer within 2 seconds")), 2_000);
          }),
        ]);
        record(`[Navigation timing] ${timing ? JSON.stringify(timing) : "unavailable"}`);
      } catch (error) {
        record(`[Navigation timing] unavailable: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
