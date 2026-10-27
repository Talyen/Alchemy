import { spawn } from "node:child_process";

// Keep the lock guardian alive until checkout removal has finished. Its stdin
// closes automatically if this process crashes, releasing the OS lock.
export async function holdManagedToolLock(helper, root) {
  const child = spawn("python3", [helper, "--hold-lock", "--root", root], { stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  let errorOutput = "";
  child.stderr.on("data", (data) => (errorOutput += data));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Managed tool ownership check timed out; checkout preserved"));
    }, 5000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(`Managed tool is active or ownership is unknown; checkout preserved. ${errorOutput}`));
    });
    child.stdout.on("data", (data) => {
      output += data;
      if (!output.includes("\n")) return;
      try {
        if (JSON.parse(output.split("\n")[0]).held !== true) throw new Error("Managed tool is active");
        clearTimeout(timer);
        resolve();
      } catch (error) {
        clearTimeout(timer);
        child.stdin.end();
        reject(error);
      }
    });
  });
  return async () => {
    child.stdin.end();
    await new Promise((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once("exit", resolve);
    });
  };
}
