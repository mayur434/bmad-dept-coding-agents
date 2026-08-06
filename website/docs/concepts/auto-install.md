---
id: auto-install
title: Auto-install
sidebar_position: 6
description: First-run dependency bootstrap — one prompt, ~80MB, headless overrides for CI.
---

# Auto-install

Every agent depends on the top-level **`shared/`** foundation (`@bmad/dca-shared`) plus its own `scripts/` folder. **You do not need to install these by hand.** The first time you invoke any agent, a bootstrap step detects missing `node_modules` and — with your confirmation — installs them.

## The bootstrap scripts

The dispatcher shells out to one of two scripts under `skills/shared/`:

- **`bootstrap.sh`** — POSIX shell (macOS, Linux, WSL). Default.
- **`bootstrap.js`** — Node twin, used on Windows and anywhere `sh` isn't available.

Both accept identical arguments:

```bash
bash .claude/skills/shared/bootstrap.sh <agent-name> [--yes|--no]
# or on Windows:
node .claude/skills/shared/bootstrap.js <agent-name> [--yes|--no]
```

Valid `<agent-name>` values: `audit`, `sonar-scan`, `generation`, `impact-analysis`, `test-coverage`.

## The first-run prompt

When either `shared/node_modules` or the agent's `scripts/node_modules` is missing (and no `--yes` / `--no` flag was passed), the bootstrap prints exactly one line on stderr and waits for a keypress:

```text
[dca-bootstrap] First-run dependency install needed — ~80MB across shared/ and <agent>/ (~30–60s). Proceed? (Y/n)
```

- **Y** (or Enter) — the bootstrap runs `npm install` in `shared/` first, then in the agent's `scripts/`. Both installs are silent.
- **n** — the bootstrap exits with code `3` and the agent stops.

Subsequent runs are silent no-ops (both `node_modules` present ⇒ exit `0` without printing).

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — either an install completed, or a silent no-op because deps were already present. |
| `2` | Deps missing and `--no` was passed. Nothing was installed. |
| `3` | User declined the interactive prompt. |
| `4` | `npm install` errored (or bad usage) — inspect the printed npm output. |

## Headless overrides

Every agent's `run.ts` accepts two mutually exclusive flags that get forwarded to the bootstrap:

- **`--yes-install`** — skip the prompt and install any missing deps. Use in CI or non-interactive scripts.
- **`--no-install`** — never install; exit with code `2` if anything is missing. Use in air-gapped environments where you pre-populate `node_modules`.

Both flags work on every `run.ts` (Audit, Sonar Scan, Code Generation, Impact Analysis, Test Coverage). Example — a CI-safe Audit:

```bash
npx ts-node .claude/skills/bmad-dept-code-audit-agent/scripts/run.ts \
  --path . --yes-install
```

## Manual fallback

If you'd rather run the installs yourself — e.g. in CI without a TTY, in an air-gapped environment where you pre-populate `node_modules`, or when the interactive prompt confuses your automation — install `shared/` **first**, then each agent's `scripts/` folder you plan to use:

```bash
# 1. shared foundation (required by every agent) FIRST
cd .claude/skills/shared && npm install

# 2. each agent you plan to use (repeat for the others)
cd ../bmad-dept-code-audit-agent/scripts        && npm install
cd ../../bmad-dept-code-sonar-scan-agent/scripts   && npm install
cd ../../bmad-dept-code-generation-agent/scripts   && npm install
cd ../../bmad-dept-code-impact-analysis-agent/scripts && npm install
cd ../../bmad-dept-code-test-coverage-agent/scripts   && npm install
```

After the manual install, verify with `bootstrap.sh <agent> --no` — it should exit `0` silently (nothing installed, nothing missing).

## Cross-platform notes

- **macOS / Linux / WSL** — `bootstrap.sh` runs under `sh` (POSIX-compliant, not bash-specific).
- **Windows PowerShell / cmd** — the dispatcher uses `bootstrap.js` (pure Node, no shell required). Behavior and exit codes are identical.
- **Corporate proxies** — the bootstrap uses `npm install` under the hood. Set `npm config set proxy http://your-proxy` / `https-proxy`, or export `HTTP_PROXY` / `HTTPS_PROXY`, before the first agent invocation.
- **Node version** — the bootstrap does not itself check the Node version; the WASM load in `shared/` will fail at first use if you're below v20.12. See [Prerequisites](../getting-started/prerequisites).

## Where the files live

Every `run.ts` resolves paths from `dirname "$0"`, so the bootstrap works regardless of which directory BMAD chose (`.claude/skills/`, `.agents/skills/`, `.cline/skills/`, etc.). The layout it expects:

```
<skills-root>/
├── shared/
│   ├── bootstrap.sh
│   ├── bootstrap.js
│   ├── package.json
│   └── node_modules/           ← installed by bootstrap
└── bmad-dept-code-<agent>-agent/
    └── scripts/
        ├── run.ts
        ├── package.json
        └── node_modules/       ← installed by bootstrap
```

## What's actually installed

Roughly ~80MB total. Most of it is:

- `tree-sitter-wasms` bundle + `web-tree-sitter` under `shared/` (the AST harness — one bundle covers Java, JS/TS, and PHP).
- ExcelJS (for the standardized XLSX report).
- `mammoth` (for BRD `.docx` parsing in Audit and Impact Analysis).
- Per-agent extras — `fast-glob`, `js-yaml`, coverage parsers, etc.

Typical wall-clock time: 30–60 seconds on a normal network.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Exit `3` — you accidentally declined. | Re-run with `--yes-install`, or run the manual fallback, then retry. |
| Exit `2` — you passed `--no-install` but deps are missing. | Run the manual fallback, or re-run with `--yes-install` if the environment can reach npm. |
| Exit `4` — `npm install` errored. | Inspect the printed npm output. Common cause: corporate proxy not configured. |
| `Error: Cannot find module 'web-tree-sitter'` on first Tier-1 scan. | Deps weren't installed. Run the manual fallback and confirm Node ≥ v20.12. |

## Next

- [First Run](../getting-started/first-run) — where the install prompt fires in the first-invocation sequence.
- [Prerequisites](../getting-started/prerequisites) — Node 20.12+ is the load-bearing requirement.
