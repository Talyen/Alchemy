#!/usr/bin/env bash
# Detached sibling worktree compatibility helper for verification-only use.
# Canonical parallel work: node scripts/agent-worktree.mjs create --task <slug> [--base <branch>]
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
WORKTREE_PARENT="$(cd "$ROOT/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/agent-worktree.sh create <slug>
  ./scripts/agent-worktree.sh list
  ./scripts/agent-worktree.sh remove <slug>
  node scripts/agent-worktree.mjs create --task <slug> [--base <branch>]  (canonical)

Creates a detached sibling checkout at ../Alchemy-<slug> from the current HEAD
for verification without sharing a dirty working tree. Do not use it for
changes that need an agent branch.

Canonical isolated worktrees live under .worktrees/<slug> on branch agent/<slug>:
  node scripts/agent-worktree.mjs create --task <slug> [--base main]
EOF
}

slug_ok() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]
}

worktree_path_for_slug() {
  printf '%s/Alchemy-%s' "$WORKTREE_PARENT" "$1"
}

cmd="${1:-}"
case "$cmd" in
  create)
    slug="${2:-}"
    if [[ -z "$slug" ]]; then
      usage >&2
      exit 1
    fi
    if ! slug_ok "$slug"; then
      echo "Slug must be alphanumeric (plus ._-), got: $slug" >&2
      exit 1
    fi
    target="$(worktree_path_for_slug "$slug")"
    if [[ -e "$target" ]]; then
      echo "Worktree path already exists: $target" >&2
      exit 1
    fi
    git worktree add --detach "$target" HEAD
    cat <<EOF
Created sibling worktree: $target

Checked out detached at the current HEAD.
Next:
  cd "$target"
  # verification only; use the canonical Node helper for parallel edits

Use a unique run id / --isolate in each worktree so artifacts do not collide.
EOF
    ;;
  list)
    git worktree list
    ;;
  remove)
    slug="${2:-}"
    if [[ -z "$slug" ]]; then
      usage >&2
      exit 1
    fi
    if ! slug_ok "$slug"; then
      echo "Slug must be alphanumeric (plus ._-), got: $slug" >&2
      exit 1
    fi
    target="$(worktree_path_for_slug "$slug")"
    if [[ ! -d "$target" ]]; then
      echo "No worktree at $target" >&2
      exit 1
    fi
    git worktree remove "$target"
    echo "Removed worktree: $target"
    ;;
  -h|--help|help|"")
    usage
    exit 0
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
