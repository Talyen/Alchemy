import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function recordAgentEvent(rootDir, event, env = process.env) {
  const session = env.ALCHEMY_AGENT_SESSION;
  if (!session) return;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/u.test(session))
    throw new Error("Invalid ALCHEMY_AGENT_SESSION; use 1-80 letters, digits, underscores or hyphens");
  const directory = path.join(rootDir, "reports/agent-evals", session);
  fs.mkdirSync(directory, { recursive: true });
  fs.appendFileSync(
    path.join(directory, "events.jsonl"),
    `${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n`,
  );
}

export function readExposure(section) {
  return {
    kind: "read",
    path: section.path,
    start: section.start,
    end: section.end,
    contentHash: crypto.createHash("sha256").update(section.text).digest("hex"),
    bytes: Buffer.byteLength(section.text, "utf8"),
    lines: section.text
      .split(/\r?\n/u)
      .map((text, index) => ({
        line: section.start + index,
        hash: crypto.createHash("sha256").update(text).digest("hex"),
        bytes: Buffer.byteLength(text, "utf8"),
      }))
      .filter((line) => line.line <= section.end),
  };
}
