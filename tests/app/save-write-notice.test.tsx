import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveWriteNotice } from "@/app/save-write-notice";
import {
  configureSaveBackend,
  saveAlchemySaveData,
  resetStorageIoForTests,
} from "@/features/alchemy/shared/storage/io";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { defaultGameSession } from "@/app/application-session";

afterEach(async () => {
  cleanup();
  await resetStorageIoForTests(defaultGameSession);
  vi.restoreAllMocks();
});
describe("visible save acknowledgement", () => {
  it("warns only after local writes and recovery both fail, then clears after an acknowledged retry", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = true;
    configureSaveBackend(
      {
        readCandidates: async () => ({ ok: true, candidates: [] }),
        write: async () => (fail ? { ok: false, error: new Error("disk full") } : { ok: true }),
        writeSync: () => null,
        clear: async () => ({ ok: true }),
      },
      defaultGameSession,
    );
    render(<SaveWriteNotice />);
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => {
      expect(await saveAlchemySaveData(createDefaultSaveData(), defaultGameSession)).toBe("failed");
    });
    expect(screen.getByRole("alert").textContent).toContain("Progress could not be saved");
    expect(errors).toHaveBeenCalled();
    fail = false;
    await act(async () => {
      expect(await saveAlchemySaveData(createDefaultSaveData(), defaultGameSession)).toBe("saved");
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("does not warn if the recovery slot acknowledges the save", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    configureSaveBackend(
      {
        readCandidates: async () => ({ ok: true, candidates: [] }),
        write: async (key) =>
          key.includes("recovery") ? { ok: true } : { ok: false, error: new Error("primary unavailable") },
        writeSync: () => null,
        clear: async () => ({ ok: true }),
      },
      defaultGameSession,
    );
    render(<SaveWriteNotice />);
    await act(async () => {
      expect(await saveAlchemySaveData(createDefaultSaveData(), defaultGameSession)).toBe("saved");
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
