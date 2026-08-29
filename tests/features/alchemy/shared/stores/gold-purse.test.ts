import { beforeEach, describe, expect, it } from "vitest";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { addRunGold, setRunGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress } from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunDomainStore();
});

describe("shared gold purse", () => {
  it("writes spend and earn through profile gold", () => {
    dispatchRunSessionCommand((draft) => setRunGold(draft, 40));
    dispatchRunSessionCommand((draft) => addRunGold(draft, 5));
    expect(readRunProfile().gold).toBe(45);
  });

  it("adds earned gold onto the purse", () => {
    setRunProgress({ gold: 10 });
    dispatchRunSessionCommand((draft) => addRunGold(draft, 5));
    expect(readRunProfile().gold).toBe(15);
  });
});
