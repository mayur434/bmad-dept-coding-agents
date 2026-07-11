# Edge Delivery Services Audit Engine

## Status: Implemented

Provides static analysis for Edge Delivery Services (EDS) projects (regex scanner + JS tree-sitter AST precision pass in `ast-scan.ts`), emitting the platform report plus the shared standardized report.

## Capabilities

- Block architecture validation (proper structure, lazy loading)
- JavaScript quality (ES module patterns, no global pollution)
- CSS analysis (CLS prevention, critical CSS extraction)
- Lighthouse/CWV anti-patterns (render-blocking resources, layout shifts)
- Content model validation (metadata, sections, block variants)
- Sidekick plugin compatibility
- Performance patterns (image optimization, font loading, script deferral)

## Usage

Run via the unified dispatcher (auto-detects EDS, or force with `--engine eds`):

```bash
npx ts-node scripts/run.ts --path /path/to/eds-project --engine eds
```

`audit.ts` implements the engine (`main()`) and accepts:
- `--path` — project root
- `--name` — project name
- `--output` — output directory
- `--config` — config JSON path (optional)
