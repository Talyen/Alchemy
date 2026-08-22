import { afterEach, describe, expect, it } from "vitest";
import { setupMockWindowDesktop } from "../../../../helpers/desktop-save-mock-helper";
import { bootstrapAlchemySaveState } from "@/features/alchemy/shared/storage/bootstrap-save-state";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { saveAlchemySaveData } from "@/features/alchemy/shared/storage/io";

const globalWithWindow = globalThis as unknown as { window?: object };

describe("bootstrapAlchemySaveState", () => {
  afterEach(() => {
    delete globalWithWindow.window;
  });

  it("initializes Steam before loading on desktop", async () => {
    const desktop = setupMockWindowDesktop();

    await bootstrapAlchemySaveState();

    expect(desktop.steamGetName).toHaveBeenCalled();
    expect(desktop.listSaveCandidates).toHaveBeenCalled();
  });

  it("enables cloud mirroring only from successful Steam initialization", async () => {
    const order: string[] = [];
    const desktop = setupMockWindowDesktop();
    desktop.writeSave.mockImplementation(async () => {
      order.push("local");
      return true;
    });
    desktop.steamCloudWrite.mockImplementation(async () => {
      order.push("cloud");
      return true;
    });

    await bootstrapAlchemySaveState();
    await saveAlchemySaveData(defaultSaveData);

    expect(order).toEqual(["local", "cloud"]);
  });
});
