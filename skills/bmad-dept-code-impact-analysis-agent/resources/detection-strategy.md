# Impact Analysis — Detection Strategy

## Dependency Resolution

Platform-specific dependency chain resolution. The impact agent uses a single generic reverse-dependency tracer parameterized by a per-stack **StackProfile** (`scripts/engines/profiles.ts`); the signals below are what each profile resolves:

### Commerce (Magento 2)
- `di.xml` preference/type overrides
- Plugin (interceptor) chains
- Observer event subscriptions
- Layout XML block references
- GraphQL schema dependencies
- Cron schedule interactions

### AEM (AEMaaCS)
- Sling Resource Type inheritance
- OSGi service references (SCR)
- Content model dependencies
- Workflow step chains
- Dispatcher mapping impacts

### EDS
- Block import chains
- Shared script dependencies
- CSS cascade impacts

### Adobe Commerce SaaS
- Storefront event (SDK) publish/subscribe wiring
- Catalog Service / Live Search API contract usage
- Storefront drop-in component dependencies
- GraphQL / API Mesh source dependencies

### Sling / Shaft (sling-12)
- OSGi service references (SCR / Declarative Services `@Reference`)
- Sling resource-type inheritance (`sling:resourceSuperType`)
- Servlet registrations (`sling.servlet.resourceTypes` / `paths`)
- JCR observation / `ResourceChangeListener` hooks
- Felix configuration PIDs (config → service impact)

### Spring Boot
- Bean dependency graph (constructor / `@Autowired` injection)
- `@RestController` → `@Service` → `@Repository` call chains
- `@EventListener` / `ApplicationEvent` publish-subscribe
- Spring Data repository method → entity/table impacts
- `@ConfigurationProperties` / `application.yml` config bindings

### Adobe App Builder
- API Mesh source & handler dependencies (`mesh.json`)
- Runtime action → action invocation chains
- Event provider → consumer registrations (I/O Events)
- `app.config.yaml` action wiring & extension points

### EDS + Commerce
- EDS block import chains (as above), plus
- Commerce storefront drop-in / Catalog Service / GraphQL dependencies (union of EDS and Commerce SaaS signals)

## Blast Radius Scoring

| Factor | Weight |
|--------|--------|
| Direct dependents | 3x |
| Indirect dependents (2+ hops) | 1x |
| Public API surface | 5x |
| Config-only impact | 0.5x |
