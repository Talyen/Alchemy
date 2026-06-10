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
      console.log("[Console Error]", message.text());
      errors.push(message.text());
    }
  });
  return errors;
}
