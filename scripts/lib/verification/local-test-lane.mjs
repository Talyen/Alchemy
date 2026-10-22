import { acquireExclusivePort } from "../exclusive-port.mjs";

const LOCAL_TEST_PORT = 48157;

// A loopback listener gives all checkouts on this host one expensive-test lane.
// The OS releases it when its owner exits, without stale files or PID cleanup.
export function acquireLocalTestLane(port = LOCAL_TEST_PORT, options = {}) {
  return acquireExclusivePort(port, { ...options, label: "Local test lane" });
}

export function isInteractiveTestCommand(args) {
  return args.some((arg) => /^(?:--(?:watch|ui|debug)|-w)(?:=(?!false$|0$).*)?$/u.test(arg));
}

export function usesLocalTestLane(command, args) {
  if (isInteractiveTestCommand(args)) return false;
  const tool = command
    .split(/[\\/]/u)
    .at(-1)
    .replace(/\.(?:cmd|exe)$/u, "");
  return tool === "vitest" || tool === "playwright" || (tool === "npx" && ["vitest", "playwright"].includes(args[0]));
}
