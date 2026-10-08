import { expect, type Page } from "@playwright/test";
import type { RunPhase } from "@/lib/routing";

export async function expectRunPhase(page: Page, phase: RunPhase) {
  await expect(page.getByTestId("vr-stage")).toHaveAttribute("data-run-phase", phase);
}
