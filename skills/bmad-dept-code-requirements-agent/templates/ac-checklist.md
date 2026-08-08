## {{STORY_ID}} — Acceptance criteria

_Story:_ {{STORY_TITLE}}
_Priority:_ {{PRIORITY}} · _Effort:_ {{EFFORT}}

### Happy path (Given / When / Then)

{{AC_HAPPY}}

<!-- One block per happy-path AC:

**AC-<n>** — <one-sentence title>
- **Given** <precondition>
- **When** <action / event>
- **Then** <observable outcome>
- **Test type**: unit | integration | e2e | manual

-->

### Edge cases

{{AC_EDGE}}

<!-- Boundary values, empty inputs, max sizes, unicode, concurrency, race
     windows. Same G/W/T block shape as the happy path. -->

### Negative paths

{{AC_NEGATIVE}}

<!-- Invalid inputs, unauthorized actors, missing prerequisites,
     downstream-service outages. Same G/W/T block shape. -->

### Performance

{{AC_PERFORMANCE}}

<!-- One AC per NFR target that applies to this story. Pull budget numbers
     from parent BRD § 7.1 and the stack-specific guide. -->

### Security

{{AC_SECURITY}}

<!-- One AC per threat / control that applies. AuthZ boundary, input
     validation, injection defense, secrets handling, audit-log emission. -->

### Testability

{{AC_TESTABILITY}}

<!-- What test fixtures / seed data / mocks are needed?
     What observability (logs / metrics / traces) confirms the AC in prod? -->

---

_Rendered from `templates/ac-checklist.md` — one file per story, or one
section per story in the aggregated `acceptance-criteria.md` roll-up._
