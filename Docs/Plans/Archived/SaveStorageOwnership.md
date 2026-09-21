---
status: complete
updated: 2026-09-21
---

# Save storage ownership

The save transport and write queue currently live in separate module globals.
Queued callbacks consult a mutable backend, and callers can manipulate a globally
exported queue independently of I/O. This makes lifetime and reconfiguration
rules implicit and prevents isolated storage instances.

## Plan

1. Introduce one storage owner for transport, queue, protection, load, save, exit
   flush, and clear. Keep candidate parsing and platform transport in their existing owners.
2. Keep the app's function API as a thin adapter over one instance. Explicit
   instances accept a backend and work in headless environments. Preserve the
   unconfigured browser/SSR behavior in the adapter.
3. Allow backend configuration only when operations are idle, making bootstrap
   configuration a checked boundary instead of silently redirecting queued work.
4. Preserve save formats, timestamping, coalescing, cancellation, and exit ordering.
   Exercise independent instances and pending-operation configuration boundaries;
   retain existing save and autosave regression coverage.
5. Update the canonical persistence reference, review the diff, and run the
   complete changed-path handoff gate.

## Completed

- `SaveStorage` owns the transport, queue, write policy, and operation lifetime.
- The existing app API delegates to one private instance; backend replacement is
  rejected while a load, write, or clear is pending.
- New tests cover independent storage protection/cancellation/transport and all
  four asynchronous operation entry points during backend reconfiguration.
- Save schemas and existing queue/exit semantics are unchanged. No tests were retired.
- Focused tests passed (36 checks). The full changed-path handoff gate passed,
  including related tests, the complete persistence suite, CI static checks,
  web build, bundle budget, and preview smoke.
