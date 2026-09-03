import { expect, type Page } from "@playwright/test";

export async function expectRunPhase(page: Page, phase: string) {
  await expect(page.getByTestId("vr-stage")).toHaveAttribute("data-run-phase", phase);
}
