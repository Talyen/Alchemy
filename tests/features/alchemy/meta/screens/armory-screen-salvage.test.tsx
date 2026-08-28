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
    await user.click(screen.getByRole("button", { name: /^Salvage$/ }));

    expect(onSalvage).toHaveBeenCalledWith(
      "gear-sword",
      expect.objectContaining({
        materials: expect.objectContaining({ iron: 6 }),
      }),
    );
    expect(screen.getByLabelText("Cancel salvage")).toBeTruthy();
  });

  it("exits targeting on Escape", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Salvage"));
    await waitFor(() => {
      expect(screen.getByLabelText("Cancel salvage")).toBeTruthy();
    });
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.getByLabelText("Salvage")).toBeTruthy();
    });
  });

  it("keeps an open confirmation when its backdrop is clicked", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Salvage"));
    await user.click(screen.getByRole("button", { name: "Salvage Longsword" }));
    await user.click(document.querySelector(".motion-overlay")!);

    expect(screen.getByText("You will receive:")).toBeTruthy();
    expect(screen.getByTestId("armory-salvage-yield")).toBeTruthy();
    expect(screen.getByText("Iron")).toBeTruthy();
  });

  it("dismisses the confirmation on Escape without leaving salvage mode", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Salvage"));
    await user.click(screen.getByRole("button", { name: "Salvage Longsword" }));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("You will receive:")).toBeNull();
    });
    expect(screen.getByLabelText("Cancel salvage")).toBeTruthy();
  });
});
