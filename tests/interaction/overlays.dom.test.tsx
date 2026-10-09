import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ModalOverlayShell } from "@/features/alchemy/shared/ui/modal-overlay-shell";
import { setModalRoot } from "@/features/alchemy/shared/ui/modal-root";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { defineSequenceFamily, requireProgress, type Scenario } from "./sequence";
import { advance, installFrames } from "./timing";

defineSequenceFamily("overlays", () => {
  installFrames();
  resetEscapeStackForTests();
  const root = document.createElement("div");
  document.body.append(root);
  setModalRoot(root);
  let opened = false;
  let activations = 0;
  let exits = 0;
  function Controls() {
    const [open, setOpen] = useState(false);
    const close = () => {
      opened = false;
      exits++;
      setOpen(false);
    };
    return (
      <>
        <button
          onClick={() => {
            opened = true;
            setOpen(true);
          }}
        >
          Inspect
        </button>
        <ModalOverlayShell open={open} escapeId="sequence" onClose={close} dismissOnBackdrop testId="sequence-overlay">
          <button
            onClick={() => {
              activations++;
            }}
          >
            Choose
          </button>
          <button onClick={close}>Close</button>
        </ModalOverlayShell>
      </>
    );
  }
  const mounted = render(<Controls />);
  const observe = () => ({
    opened,
    activations,
    exits,
    overlay: !!screen.queryByTestId("sequence-overlay"),
    inert: root.querySelector("[data-modal-content]")?.hasAttribute("inert"),
  });
  return {
    fixture: { open: false },
    actions: () => ["open", "escape", "settle", ...(opened ? ["close", "choose", "backdrop"] : [])],
    async run(action) {
      const before = activations;
      const wasInteractive = opened && root.querySelector("[data-modal-content]")?.hasAttribute("inert") === false;
      act(() => {
        if (action === "open") fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
        if (action === "escape") fireEvent.keyDown(window, { key: "Escape" });
        if (action === "close") fireEvent.click(screen.getByText("Close"));
        if (action === "choose") fireEvent.click(screen.getByText("Choose"));
        if (action === "backdrop") fireEvent.click(screen.getByTestId("sequence-overlay"));
      });
      if (action === "choose")
        requireProgress(
          activations === before + (wasInteractive ? 1 : 0),
          "overlay-supported-action-or-blocked",
          observe(),
        );
      if (action === "settle") {
        await advance(1000);
        requireProgress(
          opened
            ? root.querySelector("[data-modal-content]")?.hasAttribute("inert") === false
            : root.children.length === 0,
          "overlay-releases-input",
          observe(),
        );
      } else await advance(1);
    },
    check() {
      if (!opened && root.querySelector("[data-modal-content]"))
        requireProgress(
          root.querySelector("[data-modal-content]")!.hasAttribute("inert"),
          "exiting-overlay-inert",
          observe(),
        );
    },
    observe,
    async settle(this: Scenario) {
      await this.run("settle");
    },
    dispose() {
      mounted.unmount();
      cleanup();
      setModalRoot(null);
      root.remove();
      resetEscapeStackForTests();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    },
  };
});
