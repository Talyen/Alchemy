// Collects page errors and console.error for post-test assertions in E2E specs.
import type { Page } from "@playwright/test";

export function failOnRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    console.log("[Runtime Error]", error.message);
    errors.push(error.stack ?? error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (text.includes("Failed to load or decode sound")) return;
      if (text.includes("was passed to the") && text.includes("attribute")) return;
      console.log("[Console Error]", text);
      errors.push(text);
    }
  });
  return errors;
}
