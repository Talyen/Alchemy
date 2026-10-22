import { defineScript } from "./lib/script-run.mjs";
import { runPlaythrough } from "./lib/playthrough/playthrough-runner.mjs";

defineScript(import.meta.url, runPlaythrough, { artifacts: true });
