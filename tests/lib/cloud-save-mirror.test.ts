import { expect, it } from "vitest";
import { CloudSaveMirror } from "@/lib/cloud-save-mirror";
import { deferred } from "../helpers/deferred";

it("coalesces queued snapshots and finishes an in-flight upload before deleting", async () => {
  const mirror = new CloudSaveMirror();
  const started = deferred<void>();
  const finish = deferred<boolean>();
  const order: string[] = [];
  mirror.enqueue("primary", async () => {
    order.push("old");
    started.resolve();
    return finish.promise;
  });
  await started.promise;
  mirror.enqueue("primary", async () => {
    order.push("discarded");
    return true;
  });
  mirror.enqueue("primary", async () => {
    order.push("new");
    return true;
  });
  const removed = mirror.clear(async () => {
    order.push("delete");
    return true;
  });
  mirror.enqueue("recovery", async () => {
    order.push("resurrection");
    return true;
  });
  expect(order).toEqual(["old"]);
  finish.resolve(true);
  expect(await removed).toBe(true);
  expect(order).toEqual(["old", "delete"]);
});

it("uploads only the newest queued revision after the current revision", async () => {
  const mirror = new CloudSaveMirror();
  const finish = deferred<boolean>();
  const latest = deferred<void>();
  const order: string[] = [];
  mirror.enqueue("primary", async () => {
    order.push("first");
    return finish.promise;
  });
  mirror.enqueue("primary", async () => {
    order.push("obsolete");
    return true;
  });
  mirror.enqueue("primary", async () => {
    order.push("latest");
    latest.resolve();
    return true;
  });
  finish.resolve(true);
  await latest.promise;
  await mirror.clear(async () => true);
  expect(order).toEqual(["first", "latest"]);
});
