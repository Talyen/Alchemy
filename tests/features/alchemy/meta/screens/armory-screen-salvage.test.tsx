// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { installArmoryScreenTestHooks, renderArmoryScreen } from "./armory/armory-screen-test-helpers";

describe("ArmoryScreen salvage flow", () => {
  installArmoryScreenTestHooks();

  it("salvages an item and remains ready to salvage another", async () => {
    const user = userEvent.setup();
    const onSalvage = vi.fn(() => true);
    renderArmoryScreen({ onSalvage });

    await user.click(screen.getByLabelText("Salvage"));
    await user.click(screen.getByRole("button", { name: "Salvage Longsword" }));
    await user.click(screen.getByRole("button", { name: "Salvage", exact: true }));

    expect(onSalvage).toHaveBeenCalledWith("gear-sword");
    expect(screen.getByLabelText("Cancel salvage")).toBeTruthy();
  });

  it("exits targeting on Escape", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Salvage"));
    await user.keyboard("{Escape}");

    expect(screen.getByLabelText("Salvage")).toBeTruthy();
  });

  it("keeps an open confirmation when its backdrop is clicked", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Salvage"));
    await user.click(screen.getByRole("button", { name: "Salvage Longsword" }));
    await user.click(document.querySelector(".motion-overlay")!);

    expect(screen.getByText("Salvaging items yields crafting materials")).toBeTruthy();
  });

  it("dismisses the confirmation on Escape without leaving salvage mode", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Salvage"));
    await user.click(screen.getByRole("button", { name: "Salvage Longsword" }));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("Salvaging items yields crafting materials")).toBeNull();
    });
    expect(screen.getByLabelText("Cancel salvage")).toBeTruthy();
  });
});
