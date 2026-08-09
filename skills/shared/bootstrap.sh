#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# skills/shared/bootstrap.sh
#
# Purpose:
#   First-run dependency installer for the BMad Dept Coding Agents (DCA) skills.
#   Ensures BOTH the `shared/` foundation and a given agent's `scripts/` have
#   their npm dependencies installed, in the correct order, with a single-line
#   confirmation prompt so the user knows what's about to happen.
#
# Usage:
#   bash skills/shared/bootstrap.sh <agent-name> [--yes|--no]
#
#   <agent-name>  one of: audit | sonar-scan | generation | impact-analysis | test-coverage |
#                 requirements | architecture | release | operations | code-review | compliance
#   --yes         headless: skip prompt and install if anything is missing
#   --no          headless: do NOT install; exit 2 if any deps are missing
#   (no flag)     interactive: prompt (default Y) before installing
#
# Exit codes:
#   0  success (already installed OR install completed)
#   2  missing dependencies AND running in --no mode
#   3  user declined the confirmation prompt
#   4  npm install failed
# ---------------------------------------------------------------------------

set -u

AGENT="${1:-}"
MODE="${2:-}"

if [ -z "$AGENT" ]; then
  echo "[dca-bootstrap] error: agent name required. Usage: bash bootstrap.sh <agent-name> [--yes|--no]" 1>&2
  exit 4
fi

case "$AGENT" in
  audit|sonar-scan|generation|impact-analysis|test-coverage|requirements|architecture|release|operations|code-review|compliance) ;;
  *)
    echo "[dca-bootstrap] error: unknown agent '$AGENT'. Expected: audit | sonar-scan | generation | impact-analysis | test-coverage | requirements | architecture | release | operations | code-review | compliance" 1>&2
    exit 4
    ;;
esac

case "$MODE" in
  ""|--yes|--no) ;;
  *)
    echo "[dca-bootstrap] error: unknown flag '$MODE'. Expected: --yes or --no" 1>&2
    exit 4
    ;;
esac

# Resolve absolute paths regardless of caller cwd.
# bootstrap.sh lives in <repo>/.claude/skills/shared/ (or equivalent), so
# SHARED_DIR is the directory holding this script.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$SCRIPT_DIR"
SKILLS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Directory naming follows bmad-dept-code-<agent>-agent for every agent EXCEPT
# code-review, whose folder is bmad-dept-code-review-agent (the "code-" prefix
# already supplies the first half of "code review" — doubling it would give
# bmad-dept-code-code-review-agent, which does not exist).
if [ "$AGENT" = "code-review" ]; then
  AGENT_DIR_NAME="bmad-dept-code-review-agent"
else
  AGENT_DIR_NAME="bmad-dept-code-${AGENT}-agent"
fi
AGENT_SCRIPTS_DIR="$SKILLS_ROOT/$AGENT_DIR_NAME/scripts"

SHARED_MISSING=0
AGENT_MISSING=0

if [ ! -d "$SHARED_DIR/node_modules" ]; then
  SHARED_MISSING=1
fi

if [ ! -d "$AGENT_SCRIPTS_DIR" ]; then
  echo "[dca-bootstrap] error: agent scripts dir not found: $AGENT_SCRIPTS_DIR" 1>&2
  exit 4
fi

if [ ! -d "$AGENT_SCRIPTS_DIR/node_modules" ]; then
  AGENT_MISSING=1
fi

# Both present -> silent no-op
if [ "$SHARED_MISSING" -eq 0 ] && [ "$AGENT_MISSING" -eq 0 ]; then
  exit 0
fi

# Something is missing.
if [ "$MODE" = "--no" ]; then
  exit 2
fi

if [ "$MODE" != "--yes" ]; then
  # Interactive prompt.
  printf '[dca-bootstrap] First-run dependency install needed — ~80MB across shared/ and %s/ (~30–60s). Proceed? (Y/n) ' "$AGENT" 1>&2
  # Read one line from stdin; if stdin is not a TTY and empty, we accept default.
  if ! IFS= read -r REPLY; then
    REPLY=""
  fi
  case "$REPLY" in
    ""|Y|y|Yes|yes|YES) ;;
    N|n|No|no|NO)
      echo "[dca-bootstrap] declined by user." 1>&2
      exit 3
      ;;
    *)
      echo "[dca-bootstrap] unrecognized response '$REPLY' — treating as decline." 1>&2
      exit 3
      ;;
  esac
fi

install_at() {
  DIR="$1"
  LABEL="$2"
  echo "[dca-bootstrap] installing $LABEL deps ($DIR) ..." 1>&2
  if ! ( cd "$DIR" && npm install --silent --no-fund --no-audit --loglevel=error ) 1>&2; then
    echo "[dca-bootstrap] error: npm install failed in $DIR" 1>&2
    exit 4
  fi
}

# Install order: shared/ first, then agent/scripts/.
if [ "$SHARED_MISSING" -eq 1 ]; then
  install_at "$SHARED_DIR" "shared"
fi
if [ "$AGENT_MISSING" -eq 1 ]; then
  install_at "$AGENT_SCRIPTS_DIR" "$AGENT"
fi

echo "[dca-bootstrap] done." 1>&2
exit 0
