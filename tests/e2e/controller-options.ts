import { expect, type Page } from "@playwright/test";
import { controllerInput } from "./controller-input";

/** Same mapped-input smoke for Chromium and the isolated Electron renderer. */
export async function exerciseControllerOptions(page: Page) {
  const input = controllerInput(page);
  await input.activate(page.getByRole("button", { name: "Options", exact: true }));
  const aspect = page.getByRole("combobox", { name: "Aspect Ratio" });
  await input.activate(aspect);
  await expect(page.getByRole("listbox")).toBeVisible();
  await input.press("down");
  await input.press("confirm");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(aspect).toBeFocused();
  await input.press("confirm");
  await expect(page.getByRole("listbox")).toBeVisible();
  await input.press("back");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Options", exact: true })).toBeVisible();
  await input.activate(page.getByRole("button", { name: "Sound", exact: true }));
  const volume = page.getByRole("slider", { name: "Music Volume", exact: true });
  await input.reach(volume);
  const before = Number(await volume.inputValue());
  await input.press("left");
  await expect(volume).toHaveValue(String(before - 1));
  await input.activate(page.getByRole("button", { name: "Other", exact: true }));
  const clear = page.getByRole("button", { name: "Clear Save Data", exact: true });
  await input.activate(clear);
  const dialog = page.getByRole("dialog");
  const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
  await expect(cancel).toBeFocused();
  await input.press("previous");
  await expect(dialog.getByRole("button", { name: "Clear Save Data" })).toBeFocused();
  await input.press("next");
  await expect(cancel).toBeFocused();
  await input.press("back");
  await expect(dialog).toHaveCount(0);
  await expect(clear).toBeFocused();
  await input.press("back");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
}
