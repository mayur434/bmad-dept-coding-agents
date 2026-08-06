---
title: Adding a New Engine
sidebar_position: 2
description: How to add a new stack engine (e.g. a new Adobe product) under an existing DCA agent — folder scaffold, registry wiring, output emission, rule packs, and tests.
---

# Adding a New Engine

Add a new stack engine (a new `--engine` value) to an existing agent — for example, a new Adobe product surface under Audit, Sonar Scan, Impact Analysis, or Test Coverage.

:::note Scope
This page covers adding a **stack** to an existing agent. For a brand-new agent, see [Authoring a New Skill](./authoring-a-new-skill). For rule content only, see [Writing Rule Packs](./writing-rule-packs).
:::

---

## 1. Prerequisites

Decide which agent(s) the engine plugs into. The DCA fleet has five, and most engines land in Audit first:

| Agent | Per-engine entry point | Notes |
|-------|------------------------|-------|
| Audit | `scripts/engines/<stack>/audit.ts` | Highest coverage — every stack has an audit engine. Start here. |
| Sonar Scan | `resources/rule-packs/<stack>/` (LLM) + `scripts/engines/<stack>/ingest.ts` | LLM-driven; the ingest step is deterministic. |
| Code Generation | `scripts/scaffold/generators/<stack>/` + `GENERATORS` map entry | Add scaffolders. |
| Impact Analysis | `scripts/engines/profiles.ts` (a new stack profile) | Symbol grammar + reverse-dep rules per stack. |
| Test Coverage | `scripts/engines/<stack>/coverage.ts` + `resources/test-generation/<stack>.md` | Gap analysis + LLM test-generation pack. |

Confirm the engine ID you plan to use — lowercase, hyphenated, and stable (once shipped, it becomes part of the report filename and the working-branch name). Match `resources/rule-packs/<stack>/` directory name to the ID.

---

## 2. Add the engine directory

Under the target agent's `scripts/engines/`:

```
scripts/engines/<stack>/
├── detect.ts       ← Detection function (used by registry.ts)
├── audit.ts        ← main() entry point that emitStandardOutputs()
└── scanner.ts      ← Deterministic scanning (AST + rules)
```

For legacy/reference-quality engines, additional files appear:

- `xml-scan.ts` — XML-config scanning (Spring `applicationContext.xml`, Commerce `di.xml`, AEM `.content.xml`).
- `ast-scan.ts` — AST precision pass that supersedes regex duplicates at the same file:line.
- `lib/scanner/scans-*.ts` — grouped rule modules for larger rule sets.

---

## 3. Write `detect.ts`

`detect.ts` exports a single function `(root: string) => boolean` that returns `true` when the given project root looks like your stack. Signal files — `pom.xml`, `composer.json`, `app.config.yaml`, `blocks/`, `fstab.yaml` — are what auto-detection keys on.

Example — the Spring Boot detector:

```typescript
// scripts/engines/spring/detect.ts
import * as fs from "fs";
import * as path from "path";

export function detectSpringBoot(root: string): boolean {
  const pom = readOrEmpty(path.join(root, "pom.xml"));
  const gradle =
    readOrEmpty(path.join(root, "build.gradle")) +
    readOrEmpty(path.join(root, "build.gradle.kts"));
  const build = pom + "\n" + gradle;

  if (/spring-boot-starter|spring-boot-(maven|gradle)-plugin/i.test(build)) {
    return true;
  }
  // Fallback: @SpringBootApplication somewhere in sources.
  return javaHas(root, /@SpringBootApplication\b/);
}
```

Keep detection fast — `run.ts` calls every registered detector on every dispatch. Read only a handful of well-known signal files (pom, composer, package.json, config yamls); do not walk the whole tree.

---

## 4. Write `audit.ts`

`audit.ts` is the engine's main entry point. It builds `Finding[]` and calls the shared emitter. The canonical shape (adapted from the Spring engine):

```typescript
import { emitStandardOutputs, ensureStandardBranch } from "../../../../shared/output";
import { Finding, RecommendationRow } from "../../../../shared/core/types";
import { MyStackScanner } from "./scanner";

export async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const scanner = new MyStackScanner(args.path);
  const findings: Finding[] = await scanner.scan();

  const recommendations = buildRecommendations(findings);

  await emitStandardOutputs({
    agent: "audit",
    stack: "my-stack",       // matches --engine ID
    projectName: args.name ?? path.basename(args.path),
    projectPath: args.path,
    outputDir: args.output,
    findings,
    recommendations,
    // ...standard branch options
  });
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });
```

Build findings from:

- **Shared AST harnesses.** Under `skills/shared/{java,js,php,xml}/`. Each ships a tree-sitter WASM parser plus a small library of generic rules (SQLi, secret leaks, weak hashes, etc.) that any Java / JS / PHP engine can reuse without re-implementing.
- **Stack-specific rules.** Written in TypeScript under your engine's `scanner.ts` (or `lib/scanner/scans-*.ts` for larger rule sets). Rule IDs follow the pack prefix — `SPRING-SEC-004`, `AEM-PERF-012` — and are the same IDs used in the rule-pack markdown (see [Writing Rule Packs](./writing-rule-packs)).

**Rule pack + scanner cross-reference.** Every deterministic (Tier-1) rule in your engine should have a corresponding entry in `resources/rule-packs/<stack>/rules.md` tagged `[scanner: <RULE-ID>]`, and vice versa. This keeps the pack usable as both an LLM knowledge base (Tier-2 review) and a scanner spec.

---

## 5. Register in `engines/registry.ts`

Import the detector and call `register()` in registration order. Auto-detection iterates in this order and, on a multi-match, prefers the more specific engine (e.g. `eds-commerce` before `eds`).

```typescript
// scripts/engines/registry.ts
import { detectMyStack } from "./my-stack/detect";

register(
  "my-stack",                            // engine ID (matches --engine and rule-pack dir)
  "One-line description of the stack",   // shown by --list-engines
  detectMyStack,
  "engines/my-stack/audit"               // module path resolved by run.ts
);
```

The registry is a `Record<string, EngineEntry>` — see [`scripts/engines/registry.ts`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/bmad-dept-code-audit-agent/scripts/engines/registry.ts).

### Optional: engine alias

If you want a caller-facing ID to resolve to a different registered engine (e.g. `commerce-paas` → `commerce`), add an entry to the `ENGINE_ALIASES` map:

```typescript
const ENGINE_ALIASES: Record<string, string> = {
  "commerce-paas": "commerce",   // caller ID → registered engine
  "my-alias":      "my-stack",
};
```

`getEngine(platformId)` consults the alias map before looking up in `ENGINES`. Aliases don't participate in auto-detection — they resolve only when the caller passes `--engine <alias>`.

---

## 6. Emit via `emitStandardOutputs()`

Do NOT hand-roll Excel or Markdown output. Call [`skills/shared/output/emit.ts::emitStandardOutputs`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/skills/shared/output/emit.ts). It:

- Writes `<agent>-<branch>-<timestamp>-agent-report.xlsx` with the fixed 6-sheet order and the 15-column Summary contract.
- Writes the Markdown twin (`.md`) with the reduced 9-column Summary.
- Splices one entry into `<projectRoot>/CHANGE-LOG.md` after the `<!-- dca:entries -->` marker (newest first).
- Cuts the optional working branch `dca/<agent>-<stack>-<timestamp>` when `--create-branch` is set (via `ensureStandardBranch`).

Every DCA agent funnels through this single seam — respecting it is what makes cross-agent workflows (chain-all, CI gates) work.

---

## 7. Add the rule pack

Create `resources/rule-packs/<stack>/rules.md` (with an optional `_category_.json` for Docusaurus if you also want a sidebar entry). Follow the anatomy documented in [Writing Rule Packs](./writing-rule-packs) — rule IDs, severity band, detection method, good/bad code examples, remediation.

If your engine is scanner-heavy, split rules into groups: `resources/rule-packs/<stack>/security.md`, `.../performance.md`, etc.

---

## 8. Update `module.yaml` + `module-help.csv`

Two files at the top of `skills/`:

- **`skills/module.yaml`** — extend the `audit_engine` variable's allowed values to include your new engine ID:
  ```yaml
  audit_engine:
    default: auto
    values: [auto, aem, commerce, commerce-saas, sling, spring, app-builder, eds, eds-commerce, my-stack]
  ```
- **`skills/module-help.csv`** — if you want a first-class menu entry, add row(s) for the stack. Menu codes are 2-character uppercase, unique across the CSV. Example row shape:
  ```
  BMAD DEPT Code Agent,bmad-dept-code-audit-agent,My-Stack Scan,MS,Run Tier 1 scanner on My-Stack project.,scan,--engine my-stack --path {project_path},anytime,,,false,{audit_output},excel report,,
  ```

---

## 9. Tests + smoke

Two levels:

- **Unit / integration.** Under `scripts/engines/<stack>/__tests__/` (matching the pattern in existing engines). At minimum: one test per detector, one test per scanner that asserts the expected `Finding[]`.
- **Smoke.** From a fixture project of your stack, run:
  ```bash
  cd skills/bmad-dept-code-audit-agent/scripts
  npx ts-node run.ts --engine my-stack --path /path/to/fixture --no-preflight
  ```
  Verify the report appears at the expected path, the CHANGE-LOG entry is spliced, and (if you passed `--create-branch`) the working branch is cut. Auditor smoke commands live in [`DCA-Test-Commands.xlsx`](https://github.com/mayur434/bmad-dept-code-agent/blob/main/DCA-Test-Commands.xlsx).

---

## 10. Docusaurus updates

Extend the docs so consumers can discover the new engine:

- `website/docs/concepts/the-8-stacks.md` — add a row for the new stack (and update the page title if the count changed).
- `website/docs/reference/rule-packs/` — add `<stack>.md` (with `_category_.json` if needed) mirroring the existing entries.
- `website/docs/reference/prompts/*.md` — add copy-paste prompts for the new engine under each agent that supports it.
- `website/docs/agents/<agent>.md` — extend the engine table.
- `website/docs/reference/cli-flags.md` — extend the `--engine <id>` enum list.

---

## 11. Publishing checklist

- [ ] `detect.ts` returns `false` for every non-matching stack in the fixture corpus (no false auto-detects).
- [ ] `audit.ts` produces the standardized report and appends to `CHANGE-LOG.md`.
- [ ] Registered in `engines/registry.ts` in the correct order (more-specific engines listed after less-specific if they share signal files).
- [ ] Alias added to `ENGINE_ALIASES` if you introduced a caller-facing synonym.
- [ ] Rule pack in `resources/rule-packs/<stack>/rules.md` — every deterministic rule tagged `[scanner: <RULE-ID>]`.
- [ ] `module.yaml` `audit_engine.values` list extended.
- [ ] `module-help.csv` rows added for menu-driven access.
- [ ] Smoke test passes on a fixture project.
- [ ] TypeScript compiles clean (`npx tsc --noEmit`).
- [ ] Docusaurus pages updated (`the-8-stacks`, `rule-packs/<stack>`, per-agent prompt catalogs).
- [ ] `CHANGE-LOG.md` entry noting the new engine.

---

## 12. Related pages

- [Authoring a New Skill](./authoring-a-new-skill) — add a wholly new agent.
- [Writing Rule Packs](./writing-rule-packs) — anatomy of the rule pack you add in step 7.
- [The 8 Stacks](../concepts/the-8-stacks) — reference for engine IDs already taken.
- [Standardized Outputs Contract](../concepts/standardized-outputs) — the contract your engine must satisfy.
- [Scoring Model](../reference/scoring-model) — severity / confidence / rating vocabulary your rules must use.
