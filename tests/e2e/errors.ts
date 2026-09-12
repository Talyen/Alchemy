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
      console.log("[Console Error]", text);
      errors.push(text);
    }
  });
  return errors;
}
