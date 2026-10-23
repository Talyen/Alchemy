import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

/** Wait without reclaiming an occupied port; the OS owns crash recovery. */
export async function acquireExclusivePort(
  port,
  {
    label,
    timeoutMs = process.env.ALCHEMY_LOCK_WAIT_MS === undefined ? null : Number(process.env.ALCHEMY_LOCK_WAIT_MS),
    signal,
    onWait = console.log,
    canAcquire = () => true,
  } = {},
) {
  if (timeoutMs !== null && (!Number.isFinite(timeoutMs) || timeoutMs < 0))
    throw new Error("Lock wait must be null or a nonnegative number of milliseconds");
  const started = Date.now();
  let announced = false;
  let nextStatus = started;
  for (;;) {
    signal?.throwIfAborted();
    const server = net.createServer((socket) => socket.destroy());
    try {
      if (!canAcquire()) throw Object.assign(new Error("Earlier reservation is waiting"), { code: "EADDRINUSE" });
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
      });
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
      const elapsed = Date.now() - started;
      const remaining = timeoutMs === null ? Infinity : timeoutMs - elapsed;
      if (remaining <= 0)
        throw new Error(
          `${label} busy at 127.0.0.1:${port}; timed out after ${timeoutMs}ms. No work started; inspect the port owner without terminating another session.`,
          { cause: error },
        );
      if (!announced) {
        onWait(
          `${label} occupied; ${timeoutMs === null ? "waiting for release" : `waiting up to ${timeoutMs}ms`} (cancel to stop).`,
        );
        announced = true;
        nextStatus = started + 30_000;
      } else if (Date.now() >= nextStatus) {
        onWait(`${label} still waiting (${Math.round(elapsed / 1000)}s; cancel to stop).`);
        nextStatus = Date.now() + 30_000;
      }
      await delay(Math.min(250, remaining), undefined, { signal });
      continue;
    }
    // Cancellation during bind must not leave a listening socket behind.
    const release = () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    if (signal?.aborted) {
      await release();
      signal.throwIfAborted();
    }
    if (announced) onWait(`${label} acquired after ${Date.now() - started}ms.`);
    return { port: server.address().port, release };
  }
}
