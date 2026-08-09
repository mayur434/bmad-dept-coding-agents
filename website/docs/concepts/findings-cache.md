---
id: findings-cache
title: Findings Cache
sidebar_position: 7
description: Per-run JSON snapshots under .bmad/cache/ that downstream agents consume for cross-agent chaining.
---

Every successful agent run writes a JSON snapshot of its findings to `<projectRoot>/.bmad/cache/`. Downstream agents read the latest snapshot to enrich their own analysis — the mechanism that makes cross-agent chaining (audit → coverage, audit → impact, audit → sonar) work.

## What it is

A per-run JSON file at:

```text
<projectRoot>/.bmad/cache/<agent>-<sha256-8chars-of-report-path>.json
```

- **`<agent>`** — one of `audit`, `sonar-scan`, `generation`, `impact-analysis`, `test-coverage`.
- **`<sha256-8chars-of-report-path>`** — 8-char SHA-256 prefix of the run's report path, so distinct runs don't collide.

Files are **append-only per run** — one JSON file per completed report. Writes are atomic (`tmp + rename`) so partial files are never observed.

## Why it exists

Cross-agent chaining. Later agents in the SDLC pass want context from earlier ones:

- **Impact Analysis** reads the latest **Audit** cache to boost priority for files that already carry CRITICAL findings.
- **Test Coverage** reads the latest **Audit** cache to enrich coverage gaps with severity/category context (a Security-CRITICAL gap trumps a stylistic gap).
- **Sonar Scan** reads the latest **Audit** cache to include delta context in the Quality Gate rationale — "these 5 files were CRITICAL last audit and still are, this is a regression".

Consumption is silent and non-fatal — if the cache is missing or malformed, the consuming agent logs a stderr WARN and continues without the enrichment.

## File format

The persisted `CachedRun` (see `skills/shared/findings/cache.ts`):

```json
{
  "agent": "audit",
  "stack": "commerce",
  "runAt": "2026-08-06T14:35:12.123Z",
  "branch": "main",
  "timestamp": "20260806_143512",
  "reportPath": "audit-reports/audit-main-20260806_143512-agent-report.xlsx",
  "findings": [
    {
      "id": "SEC-001-3f9a2b",
      "title": "Unsanitized SQL string concatenation",
      "severity": "CRITICAL",
      "confidence": "HIGH",
      "category": "Security",
      "file": "app/code/Acme/Catalog/Model/Product.php",
      "line": 142,
      "ruleId": "PHP:SQL-INJ-01",
      "recommendation": "Use bind parameters; see …",
      "impact": "Attacker can enumerate the catalog_product_entity table.",
      "effort": "S"
    }
  ],
  "meta": {
    "role": "security",
    "roleFlavor": "technical",
    "roleSource": "role-file",
    "engine": "commerce"
  }
}
```

Every field except `meta` is required; malformed files are logged and skipped by the reader.

## Retention

Housekeeping is delegated to `pruneOldRuns(projectRoot, { keepPerAgent })`, which keeps the newest N runs per agent and deletes the rest.

- **Default: 10 runs per agent** (so at most 90 files total across all nine agents).
- Called automatically by the shared output pipeline after each successful write.
- Non-fatal — reports the number of removed files; failures print a stderr WARN.

To keep more history, callers can pass a larger `keepPerAgent` — this is not user-tunable from the CLI today, so if you need long history, back up the directory yourself.

## Manual inspection

The cache is plain JSON — inspect with any tool:

```bash
# List everything the cache has
ls -la .bmad/cache/

# View one file
cat .bmad/cache/audit-*.json | jq

# Count findings by severity across every cached audit
jq '.findings | group_by(.severity) | map({severity: .[0].severity, count: length})' \
  .bmad/cache/audit-*.json

# The most recent run of each agent
for a in audit sonar-scan generation impact-analysis test-coverage; do
  ls -t .bmad/cache/${a}-*.json 2>/dev/null | head -1
done
```

## Programmatic consumption

Agents use the `consumeLatestFindings()` helper (`skills/shared/findings/consume.ts`), which returns a pre-aggregated view:

```typescript
const enriched = consumeLatestFindings({
  projectRoot: process.cwd(),
  fromAgent: "audit",
  maxAgeHours: 24,          // optional — ignore cache older than this
  requireStack: "commerce", // optional — must match exactly
});
// enriched.findings, enriched.bySeverity, enriched.criticalFiles, enriched.fileToFindings
```

Returns `null` when no cache matches — never throws.

## Location and lifecycle

- **Where** — `<projectRoot>/.bmad/cache/` (created on first write; ignored by git if you gitignore `.bmad/`).
- **When written** — at the end of every successful agent run, before the process exits.
- **When read** — silently, on every subsequent agent invocation, by any downstream consumer.
- **When pruned** — automatically after each write, keeping the newest 10 per agent.
- **When deleted** — never automatically beyond the prune limit. To reset, `rm -rf .bmad/cache/`.

## Not the same as CHANGE-LOG.md

Two different things:

- **`CHANGE-LOG.md`** — human-readable, one Markdown entry per run, git-committed. See [Standardized Outputs](standardized-outputs).
- **`.bmad/cache/*.json`** — machine-readable, consumed by downstream agents, typically gitignored.

## Next

- [The Agents](the-agents) — the cross-agent enrichments and their producer/consumer pairs.
- [Standardized Outputs](standardized-outputs) — the human-readable side of every run.
