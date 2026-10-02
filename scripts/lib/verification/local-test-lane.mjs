import net from "node:net";

const LOCAL_TEST_PORT = 48157;

// A loopback listener gives all checkouts on this host one expensive-test lane.
// The OS releases it when its owner exits, without stale files or PID cleanup.
export async function acquireLocalTestLane(port = LOCAL_TEST_PORT) {
  const server = net.createServer((socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once("error", (error) => {
      reject(
        error.code === "EADDRINUSE"
          ? new Error(
              `Local test lane is occupied (127.0.0.1:${port}); no tests were started. ` +
                "Finish the active unit/browser verification before retrying. " +
                "If no verification is running, inspect the port owner; do not terminate another session.",
            )
          : error,
      );
    });
    server.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
  });
  return {
    port: server.address().port,
    release: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
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
