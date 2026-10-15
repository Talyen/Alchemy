import { expect, it } from "vitest";
import { ProgressCompletion } from "@/features/alchemy/shared/storage/progress-completion";

it("delivers saved feedback in registration order through idle observers and nested completion", () => {
  const progress = new ProgressCompletion();
  const order: string[] = [];
  progress.mark(1);
  progress.afterSaved(() => {
    order.push("first");
    progress.mark(2);
    progress.afterSaved(() => order.push("nested save"));
    progress.complete(progress.token(2), "saved");
  });
  progress.afterSaved(() => order.push("second"));
  let observed = false;
  progress.subscribe(() => {
    if (progress.read().kind !== "idle" || observed) return;
    observed = true;
    progress.afterSaved(() => order.push("idle observer"));
  });
  progress.complete(progress.token(1), "saved");
  expect(order).toEqual(["first", "second", "idle observer", "nested save"]);
});

it("cancellation from reentrant feedback revokes all remaining saved feedback", () => {
  const progress = new ProgressCompletion();
  const order: string[] = [];
  progress.mark(1);
  progress.afterSaved(() => {
    order.push("first");
    progress.afterSaved(() => order.push("revoked nested"));
    progress.replace();
    progress.afterSaved(() => order.push("replacement"));
  });
  progress.afterSaved(() => order.push("revoked sibling"));
  progress.complete(progress.token(1), "saved");
  expect(order).toEqual(["first", "replacement"]);
});
