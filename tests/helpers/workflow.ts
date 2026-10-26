import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

interface Step {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}
interface Job {
  uses?: string;
  needs?: string | string[];
  if?: string;
  steps: Step[];
  outputs?: Record<string, string>;
  concurrency?: Record<string, unknown>;
  env?: Record<string, unknown>;
  with?: Record<string, unknown>;
}
interface Workflow {
  on: {
    workflow_call?: { inputs?: Record<string, { default?: unknown }>; outputs?: Record<string, { value: string }> };
  };
  jobs: Record<string, Job>;
}
const root = resolve(import.meta.dirname, "../..");

export function readWorkflow(name: string): Workflow {
  return parse(readFileSync(resolve(root, `.github/workflows/${name}.yml`), "utf8")) as Workflow;
}

/** Follow local job reuse so contracts protect the executed job, not its file layout. */
export function workflowJob(name: string, id: string): Job {
  const caller = readWorkflow(name).jobs[id];
  if (!caller.uses) return caller;
  const target = readWorkflow(caller.uses.replace("./.github/workflows/", "").replace(/\.yml$/u, ""));
  const jobs = Object.values(target.jobs);
  if (jobs.length !== 1) throw new Error(`Expected one execution job in ${caller.uses}`);
  const [job] = jobs;
  return { ...caller, ...job };
}
