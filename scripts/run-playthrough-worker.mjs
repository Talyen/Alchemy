import { defineScript } from "./lib/script-run.mjs";
import { runCareerWorker } from "./lib/playthrough/career-worker.mjs";

defineScript(import.meta.url, runCareerWorker);
