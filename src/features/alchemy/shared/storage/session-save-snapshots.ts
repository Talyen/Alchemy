import { logStorageFailure } from "@/lib/storage-logging";
import type { ProgressCompletion } from "./progress-completion";
import type { SaveWriteOutcome } from "./save-operation-queue";

interface SnapshotWriteAdmission {
  readonly validate: () => "skipped" | "superseded" | undefined;
  readonly complete: (outcome: SaveWriteOutcome) => SaveWriteOutcome;
}

/** Session-owned provenance and ordering; never serialized into the save payload. */
export class SessionSaveSnapshots {
  private readonly receipts = new WeakMap<
    object,
    {
      token: ReturnType<ProgressCompletion["token"]>;
      epoch: number;
      restoreVersion: number;
      sequence: number;
      contents: string;
    }
  >();
  private epoch = 0;
  private sequence = 0;
  private submitted = 0;

  constructor(private readonly progress: ProgressCompletion) {}

  capture<T extends object>(snapshot: T, revision: number): T {
    this.receipts.set(snapshot, {
      token: this.progress.token(revision),
      epoch: this.epoch,
      restoreVersion: this.progress.readRestoreVersion(),
      sequence: ++this.sequence,
      contents: JSON.stringify(snapshot),
    });
    return snapshot;
  }

  invalidate() {
    this.epoch++;
  }

  prepare(snapshot: object): SnapshotWriteAdmission | "failed" | "skipped" | "superseded" {
    const receipt = this.receipts.get(snapshot);
    if (!receipt) return this.reject();
    const cancelled = () =>
      receipt.epoch !== this.epoch || receipt.restoreVersion !== this.progress.readRestoreVersion();
    if (cancelled()) return "skipped";
    if (receipt.sequence < this.submitted) return "superseded";
    try {
      if (receipt.contents !== JSON.stringify(snapshot)) return this.reject();
    } catch {
      return this.reject();
    }
    this.submitted = receipt.sequence;
    // Recheck career lifetime inside the lane. Already admitted writes retain
    // queue order across load barriers; only later stale submissions are refused.
    const validate = () => {
      if (cancelled()) return "skipped" as const;
      return undefined;
    };
    return { validate, complete: (outcome) => this.progress.complete(receipt.token, outcome) };
  }

  private reject(): "failed" {
    logStorageFailure("Save write requires an unchanged snapshot from this game session");
    return "failed";
  }
}
