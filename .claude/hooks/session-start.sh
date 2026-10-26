#!/bin/bash
# Cloud sessions commit as "Claude <noreply@anthropic.com>" (the container's
# global git config). Commit as the repository owner instead; see the
# attribution rule in CLAUDE.md.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
git config user.name "Fanis"
git config user.email "git@hatzidakis.org"
