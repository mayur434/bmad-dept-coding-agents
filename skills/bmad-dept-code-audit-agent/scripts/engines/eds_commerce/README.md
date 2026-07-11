# EDS + Commerce Hybrid Audit Engine

## Status: Implemented

Provides static analysis for EDS storefronts with Commerce dropins (regex scanner + the EDS JS tree-sitter AST precision pass, reusing `../eds/ast-scan`), emitting the platform report plus the shared standardized report.

## Capabilities

- All EDS checks (block structure, JS quality, performance)
- Commerce dropin integration validation
- Cart/checkout flow correctness
- Product data layer consistency
- Commerce event tracking compliance
- API mesh / catalog service integration patterns
- Dropin customization anti-patterns

## Usage

Run via the unified dispatcher (auto-detects EDS+Commerce, or force with `--engine eds-commerce`):

```bash
npx ts-node scripts/run.ts --path /path/to/eds-commerce-project --engine eds-commerce
```

`audit.ts` implements the engine (`main()`) and accepts:
- `--path` — project root
- `--name` — project name
- `--output` — output directory
- `--config` — config JSON path (optional)
