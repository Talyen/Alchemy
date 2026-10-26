import { expect, it, vi } from "vitest";
import { CloudSaveMirror } from "@/lib/cloud-save-mirror";
import { TimerGroup } from "@/lib/animation/game-timer";
import { createNotificationChannel } from "@/features/alchemy/shared/stores/session/notification-channel";
import { createSessionLifetime } from "@/features/alchemy/shared/stores/session/session-lifetime";
import { driveAutoplay } from "@/features/alchemy/run-loop/battle/autoplay-driver";
import { createGameSession } from "@/features/alchemy/shared/stores/session/game-session";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session/session-runtime";
import { deferred } from "../helpers/deferred";

it("Cloud upload callbacks cannot start a second upload before the first completes", async () => {
  const mirror = new CloudSaveMirror();
  const finish = deferred<boolean>();
  const started = deferred<void>();
  const nextStarted = deferred<void>();
  const order: string[] = [];
  mirror.enqueue("primary", async () => {
    order.push("first-start");
    mirror.enqueue("recovery", async () => {
      order.push("second-start");
      nextStarted.resolve();
      return true;
    });
    started.resolve();
    await finish.promise;
    order.push("first-end");
    return true;
  });
  await started.promise;
  const beforeCompletion = [...order];
  finish.resolve(true);
  await nextStarted.promise;
  await mirror.clear(async () => true);
  expect(beforeCompletion).toEqual(["first-start"]);
  expect(order).toEqual(["first-start", "first-end", "second-start"]);
});

it("one subscription cleanup does not remove a second registration of the same callback", () => {
  const channel = createNotificationChannel<[]>(() => {});
  const listener = vi.fn();
  const release = channel.subscribe(listener);
  const releaseOther = channel.subscribe(listener);
  release();
  channel.publish();
  expect(listener).toHaveBeenCalledTimes(1);
  releaseOther();
  channel.publish();
  expect(listener).toHaveBeenCalledTimes(1);
});

it("zero-delay autoplay retries yield to host events so cancellation can run", async () => {
  const controller = new AbortController();
  let searches = 0;
  let stoppedByHost = false;
  const timer = setTimeout(() => {
    stoppedByHost = true;
    controller.abort();
  }, 0);
  await driveAutoplay({
    signal: controller.signal,
    isEnabled: () => true,
    findAction: () => {
      // A bounded guard makes the old starvation observable without hanging the runner.
      if (++searches === 20) controller.abort();
      return null;
    },
    delayMs: 0,
    postPlayDelayMs: 0,
  });
  clearTimeout(timer);
  expect(stoppedByHost).toBe(true);
  expect(searches).toBeLessThan(20);
});

it("TimerGroup supports a clock that fires during registration without leaking a pending timer", () => {
  const fired = vi.fn();
  const clear = vi.fn();
  const group = new TimerGroup({
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    clearTimeout: clear,
  });
  const cancel = group.setTimeout(fired, 0);
  expect(fired).toHaveBeenCalledTimes(1);
  expect(group.size).toBe(0);
  cancel();
  expect(clear).not.toHaveBeenCalled();
});

it("session shutdown runs a peer cleanup once when another cleanup releases it", () => {
  const lifetime = createSessionLifetime();
  const peer = vi.fn();
  let releasePeer = () => {};
  lifetime.track(() => releasePeer());
  releasePeer = lifetime.track(peer);
  expect(lifetime.close()).toEqual([]);
  expect(peer).toHaveBeenCalledTimes(1);
  releasePeer();
  expect(peer).toHaveBeenCalledTimes(1);
});

it("TimerGroup cancels every timer even when one host cancellation throws", () => {
  let id = 0;
  const clear = vi.fn((timer: number | ReturnType<typeof setTimeout>) => {
    if (timer === 1) throw new Error("host cancellation failed");
  });
  const group = new TimerGroup({ setTimeout: () => ++id, clearTimeout: clear });
  group.setTimeout(() => {}, 100);
  group.setTimeout(() => {}, 100);
  expect(() => group.clearAll()).toThrow("cancel");
  expect(clear.mock.calls.map(([timer]) => timer)).toEqual([1, 2]);
  expect(group.size).toBe(0);
});

it("reentrant disposal shares the outer cleanup completion and its failure", async () => {
  const session = createGameSession();
  let nested: Promise<void> | undefined;
  sessionRuntime(session).track(() => {
    nested = session.dispose();
  });
  sessionRuntime(session).track(() => {
    throw new Error("cleanup failed");
  });
  const outer = session.dispose();
  const [outerResult, nestedResult] = await Promise.allSettled([outer, nested]);
  expect(outerResult.status).toBe("rejected");
  expect(nestedResult.status).toBe("rejected");
  expect(nested).toBe(outer);
});
