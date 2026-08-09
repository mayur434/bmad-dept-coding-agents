# Pipeline authoring guide — Spring Boot

This guide tells the LLM authoring pass **what stack-specific content to
embed** when generating a CI/CD pipeline for a Spring Boot project.
Combine with the appropriate master template under `templates/`.

## Purpose

A pipeline for Spring Boot should establish: Gradle/Maven build,
comprehensive unit + integration + slice tests (`@WebMvcTest`,
`@DataJpaTest`, `@SpringBootTest`), image build with Buildpacks or a
distroless base, Kubernetes rolling deploy driven by Helm / Kustomize,
DB migration ordering (Flyway or Liquibase) that runs before the deploy
finishes health-checking, and Actuator-driven readiness/liveness gates.

## Preferred pipeline target

**GitHub Actions or GitLab CI** for the build; **ArgoCD or Flux**
frequently owns the K8s deploy (GitOps). CircleCI and Jenkins are
common in older orgs.

Rationale — Spring Boot deploys to Kubernetes in most modern orgs.
The pipeline builds the image, pushes to a registry, and updates a
Helm chart or Kustomize overlay; ArgoCD reconciles the target cluster.
For orgs without GitOps, the pipeline runs `helm upgrade --wait` or
`kubectl apply -f` directly.

## Typical pipeline stages for Spring

1. **Setup** — Java 17 (or 21), Gradle/Maven cache.
2. **Build** — `./gradlew clean build -x test` or `mvn -B clean package -DskipTests`.
3. **Unit tests** — `./gradlew test` — fast slice tests (`@WebMvcTest`,
   `@DataJpaTest`, `@JsonTest`).
4. **Integration tests** — `./gradlew integrationTest` (or
   `@SpringBootTest` with Testcontainers).
5. **Coverage** — JaCoCo report; floor gate (line + branch).
6. **DCA sonar-scan gate** — `--engine spring` — surfaces bean
   topology issues, Spring Security misuse, missing observability.
7. **DCA audit gate** — pre-release audit.
8. **DB migration dry-run** — `./gradlew flywayMigrate -Pflyway.url=<stage-db>`
   or `liquibase update-sql` (verify against a stage snapshot).
9. **Image build** — `./gradlew bootBuildImage` (Buildpacks) or a
   `Dockerfile` build; push to registry with the release tag.
10. **Deploy stage** — `helm upgrade --install <chart> ./chart -f
    values-stage.yaml --set image.tag={{VERSION}} --wait`.
11. **Actuator health gate** — poll `/actuator/health/readiness` for
    all replicas.
12. **Manual approval** — CI holds before prod.
13. **Deploy prod** — same as stage; rolling deploy
    (`RollingUpdate` with `maxSurge: 25% maxUnavailable: 25%`).
14. **Post-deploy** — Actuator health + a synthetic check.

## Stack-specific secrets / env-vars

- `REGISTRY_TOKEN` — for image push.
- `KUBE_CONTEXT_STAGE` / `KUBE_CONTEXT_PROD` — kubeconfig contexts.
- `DB_URL_STAGE` / `DB_URL_PROD` — for migration dry-run + prod
  migration.
- Externalized config lives in ConfigMaps / Secrets (never in the image).
- Spring profile per env — `SPRING_PROFILES_ACTIVE=stage` /
  `SPRING_PROFILES_ACTIVE=prod`.

## Stack-specific quality gates

- **JaCoCo coverage** — line + branch floors (typical: 80% line, 60%
  branch); DCA test-coverage agent enforces per-file floors.
- **Spring Boot dependency-management** — verify `spring-boot-dependencies`
  BOM is aligned across modules.
- **OWASP dependency-check** — `./gradlew dependencyCheckAnalyze` — fail
  on new CVEs at HIGH+.
- **DCA sonar-scan for spring** — surfaces `@Autowired` on fields (not
  constructor), missing Spring Security config, missing Micrometer
  metrics, blocking calls in reactive code, `@Transactional` on private
  methods.

## Stack-specific rollout options

- **Rolling (K8s default)** — `RollingUpdate` with `maxSurge` /
  `maxUnavailable`; the pipeline waits for all replicas to be `Ready`
  before marking success.
- **Canary** — K8s + Istio/Linkerd traffic-split; 5% → 25% → 50% →
  100%; separate `VirtualService` / `TrafficSplit` per phase.
- **Blue-green** — two Deployments + Service selector cutover; needs
  double the fleet size for the swap window.
- **Feature-flag** — LaunchDarkly / Unleash / Split; deploy dark, flip
  flag to release.

## Stack-specific deploy commands

- **Helm** — `helm upgrade --install <chart> ./chart -f values-<env>.yaml
  --set image.tag={{VERSION}} --wait --atomic --timeout 10m`.
- **Kustomize** — `kustomize edit set image myapp={{IMAGE}}:{{VERSION}}
  && kubectl apply -k overlays/<env>`.
- **ArgoCD** — commit the tag bump to the GitOps repo; ArgoCD
  reconciles.
- **Direct kubectl** — `kubectl set image deployment/myapp
  myapp={{IMAGE}}:{{VERSION}} -n <env> && kubectl rollout status
  deployment/myapp -n <env> --timeout 10m`.

## Stack-specific verify steps

- **Readiness** — `curl -sf http://myapp.<env>/actuator/health/readiness`
  expects `UP`.
- **Liveness** — `curl -sf http://myapp.<env>/actuator/health/liveness`
  expects `UP`.
- **Info** — `curl -sf http://myapp.<env>/actuator/info` should
  report the deployed version + build timestamp.
- **Metrics scrape** — Prometheus should be scraping the pod fresh
  metrics within 60s of deploy.
- **Synthetic check** — a smoke request against the app's headline
  endpoint (e.g. `/api/v1/health`).

## Worked pipeline outlines

### 1. Spring Boot microservice — GH Actions + Helm

- **Target:** `github-actions`
- **Stages:** setup → build → unit + integration tests → coverage →
  DCA sonar-scan → DCA audit gate → migration dry-run → build image
  → push to registry → helm upgrade stage → readiness poll → smoke
  → manual approval → helm upgrade prod → readiness poll → smoke.

### 2. Spring Boot with ArgoCD (GitOps) — GitLab CI + ArgoCD

- **Target:** `gitlab-ci`
- **Stages:** build → test → DCA gates → build image → push → commit
  tag bump to the GitOps repo (triggers ArgoCD sync) → wait for
  ArgoCD Health = Healthy → smoke.

### 3. Spring Boot with canary via Istio — Azure DevOps

- **Target:** `azure-devops`
- **Stages:** build → test → DCA gates → image build/push → helm
  upgrade prod-canary (5% traffic) → observe 15min → shift to 25% →
  observe → shift to 50% → observe → shift to 100% → remove old
  Deployment.

## Anti-patterns to avoid

1. **Long-running Flyway migrations during deploy.** Pod readiness
   times out; K8s marks the deploy failed. Run heavy migrations
   out-of-band (job); run only the small forward-compatible migration
   during deploy.
2. **Missing Actuator readiness/liveness distinction.** K8s restarts
   pods on transient load; use liveness only for hung processes,
   readiness for load-shed.
3. **Deploying without observability.** No metrics scrape = no
   post-deploy signal; rollback decision blind.
4. **Baking secrets into the image.** Registry leak = secret leak;
   always inject from Secret volume or env var at runtime.
5. **Skipping `--wait --atomic` on Helm.** Pipeline reports success
   before rollout is complete; failures visible only via user reports.

---

Generate the full pipeline using the appropriate `templates/pipeline-<target>.yml`
as the master, populating placeholders with Spring-appropriate content
from the guide above.
