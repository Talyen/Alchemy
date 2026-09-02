#!/usr/bin/env bash
# Deprecated: use node scripts/agent-worktree.mjs create --task <slug> --detached
set -euo pipefail
echo "Deprecated: ./scripts/agent-worktree.sh is consolidated into agent-worktree.mjs" >&2
echo "Use: node scripts/agent-worktree.mjs create --task <slug> --detached  (detached verification)" >&2
echo "     node scripts/agent-worktree.mjs create --task <slug> [--base <branch>]" >&2
exec node "$(dirname "$0")/agent-worktree.mjs" "$@"
