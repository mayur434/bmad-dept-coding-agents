# {{TITLE}}

**Business Requirements Document**

| Field | Value |
|---|---|
| Version | {{VERSION}} |
| Status | {{STATUS}} <!-- Draft \| Reviewed \| Approved --> |
| Author | {{AUTHOR}} |
| Last updated | {{LAST_UPDATED}} |
| Product owner | {{PRODUCT_OWNER}} |
| Tech lead | {{TECH_LEAD}} |
| Target release | {{TARGET_RELEASE}} |
| Stack | {{STACK}} |
| Role driving | {{ROLE}} |

---

## 1. Executive summary

### 1.1 Business context

{{BUSINESS_CONTEXT}}

<!-- One-to-two paragraphs. Why does this exist? What business problem does it solve?
     Who is asking for it (which stakeholder / segment)? What happens if we don't do it? -->

### 1.2 Opportunity

{{OPPORTUNITY}}

<!-- The measurable business opportunity. "Reduce cart abandonment by 12%",
     "Cut publisher latency from 800ms to 200ms", "Onboard 3 new brands in Q4". -->

### 1.3 Expected value

{{EXPECTED_VALUE}}

<!-- Concrete outcomes. Revenue, conversion, latency, NPS, dev velocity. -->

### 1.4 Success metrics

{{SUCCESS_METRICS}}

<!-- Bulleted, measurable, time-boxed. See § 9 for the full KPI table. -->

---

## 2. Scope

### 2.1 In-scope

{{IN_SCOPE}}

<!-- Bulleted. Prefer capabilities over technologies. -->

### 2.2 Out-of-scope

{{OUT_OF_SCOPE}}

<!-- Bulleted. Called out to avoid scope creep. -->

### 2.3 Assumptions

{{ASSUMPTIONS}}

<!-- Bulleted. Environment, third-party availability, team composition. -->

### 2.4 Dependencies

{{DEPENDENCIES}}

<!-- Bulleted. Upstream teams, external services, prerequisite releases. -->

---

## 3. Stakeholders and roles

**RACI matrix.** R = Responsible, A = Accountable, C = Consulted, I = Informed.

| Role | R | A | C | I |
|---|---|---|---|---|
| Product owner | | X | | |
| Tech lead | X | | | |
| Delivery engineers | X | | | |
| QA / SDET | X | | | |
| DevOps / SRE | | | X | |
| Security | | | X | |
| Content / editorial | | | | X |
| Business sponsor | | X | | |
| End users | | | | X |

{{ADDITIONAL_STAKEHOLDERS}}

---

## 4. User personas

{{USER_PERSONAS}}

<!-- One sub-section per persona:

### 4.1 <Persona Name>

- **Description**: <who they are, one sentence>
- **Goals**: <bulleted, 3-5>
- **Pain points**: <bulleted, 3-5>
- **Key journeys**: <top-3 flows this persona owns>

Repeat for each persona. Pull persona shapes from the stack-specific guide
in resources/brd-templates/<stack>.md. -->

---

## 5. Business requirements

{{BUSINESS_REQUIREMENTS}}

<!-- Numbered BR-1, BR-2, … Each with:

**BR-<n>** — <one-sentence title>
> <full statement — what the business needs, not how it's built>
- **Source**: <interview / doc / ticket / market analysis>
- **MoSCoW**: MUST \| SHOULD \| COULD \| WONT
- **Rationale**: <why this matters>

-->

---

## 6. Functional requirements

{{FUNCTIONAL_REQUIREMENTS}}

<!-- Numbered FR-1, FR-2, … Each with:

**FR-<n>** — <one-sentence title>
> <what the system must do — behavior, inputs, outputs>
- **Parent BR**: BR-<n>
- **MoSCoW**: MUST \| SHOULD \| COULD \| WONT
- **Effort**: S \| M \| L \| XL

-->

---

## 7. Non-functional requirements

### 7.1 Performance

{{NFR_PERFORMANCE}}

<!-- Latency budgets, throughput floors, resource ceilings. Stack-specific
     numbers pulled from resources/brd-templates/<stack>.md. -->

### 7.2 Security

{{NFR_SECURITY}}

<!-- AuthN/AuthZ, data classification, threat model, secrets handling. -->

### 7.3 Scalability

{{NFR_SCALABILITY}}

<!-- Peak load, horizontal/vertical scaling model, capacity planning. -->

### 7.4 Availability

{{NFR_AVAILABILITY}}

<!-- SLA / SLO / SLI. RPO / RTO. Failover mode. -->

### 7.5 Usability + accessibility

{{NFR_USABILITY}}

<!-- WCAG level, keyboard-navigation, screen-reader support, i18n/l10n. -->

### 7.6 Compliance

{{NFR_COMPLIANCE}}

<!-- PCI / GDPR / HIPAA / SOC2 / WCAG. Data-residency. Audit logging. -->

---

## 8. Integration points

{{INTEGRATION_POINTS}}

<!-- Table one row per external system:

| System | Direction | Protocol | Frequency | Owner | Contract |
|---|---|---|---|---|---|
| <system> | inbound \| outbound \| bi | REST \| GraphQL \| event \| SFTP \| DB | real-time \| batch | <team> | <link to schema / OpenAPI> |

-->

---

## 9. Success criteria and KPIs

| KPI | Baseline | Target | Measurement | Owner | Review cadence |
|---|---|---|---|---|---|
| {{KPI_1}} | | | | | |
| {{KPI_2}} | | | | | |
| {{KPI_3}} | | | | | |

{{ADDITIONAL_KPIS}}

---

## 10. Risks and assumptions

| Risk | Impact | Likelihood | Mitigation | Owner |
|---|---|---|---|---|
| {{RISK_1}} | H\|M\|L | H\|M\|L | | |
| {{RISK_2}} | H\|M\|L | H\|M\|L | | |
| {{RISK_3}} | H\|M\|L | H\|M\|L | | |

{{ADDITIONAL_RISKS}}

---

## 11. Timeline and milestones

| Milestone | Date | Owner | Success criterion |
|---|---|---|---|
| Discovery complete | | | BRD signed off |
| Sprint 0 (architecture) | | | ADR merged, environments ready |
| MVP feature-complete | | | All MUST FRs implemented, AC passing |
| Beta | | | Internal users onboarded, telemetry green |
| GA | | | Rollout plan executed, KPIs at target |

{{ADDITIONAL_MILESTONES}}

---

## 12. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Product owner | | | |
| Tech lead | | | |
| Enterprise architect | | | |
| Security | | | |
| QA lead | | | |
| Business sponsor | | | |

---

_Generated by BMAD DCA Requirements agent — {{GENERATED_AT}}_
