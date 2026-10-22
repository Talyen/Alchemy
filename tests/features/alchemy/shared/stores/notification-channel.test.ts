import { expect, it, vi } from "vitest";
import { createNotificationChannel } from "@/features/alchemy/shared/stores/notification-channel";

it("drains observer notifications even when reporting a listener failure throws", () => {
  const onError = vi.fn(() => {
    throw new Error("Reporter failed");
  });
  const channel = createNotificationChannel<[number]>(onError);
  const received: number[] = [];
  channel.subscribe((value) => {
    if (value === 1) channel.publish(2);
    throw new Error("Listener failed");
  });
  channel.subscribe((value) => received.push(value));
  expect(() => channel.publish(1)).not.toThrow();
  expect(received).toEqual([1, 2]);
  expect(onError).toHaveBeenCalledTimes(2);
  channel.publish(3);
  expect(received).toEqual([1, 2, 3]);
});
