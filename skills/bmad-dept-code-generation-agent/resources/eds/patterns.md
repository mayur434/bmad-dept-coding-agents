# Adobe Edge Delivery Services (EDS / Helix) — Generation Patterns

> **Stack:** document-authored, JS-first storefront. Blocks are decorated client-side. No build server —
> plain ES modules, CSS, and `scripts/`. Audit rules: `bmad-dept-code-audit-agent/resources/rule-packs/eds/`.
>
> **Deterministic scaffolder:** `run.ts --scaffold --engine eds --type block --name <Name>` →
> `blocks/<name>/<name>.js` + `<name>.css`.

## Project shape
```
blocks/<name>/<name>.js     → default export decorate(block)
blocks/<name>/<name>.css     → block styles (scoped by .<name>)
scripts/scripts.js           → aem.js / lib-franklin loadEager/loadLazy
scripts/aem.js               → framework (do not edit)
styles/styles.css            → global styles
head.html, 404.html, fstab.yaml, helix-query.yaml, paths.json
```

## Block pattern (official)
```js
export default function decorate(block) {
  // `block` is the block root; its children are the authored rows/cells.
  [...block.children].forEach((row) => {
    // read authored content, build semantic markup
  });
  block.classList.add('<name>');
}
```
- **Decorate, don't fetch on the critical path** — heavy work goes in `loadLazy`/`IntersectionObserver`.
- **Sanitize** anything read from the URL/DOM before inserting as HTML (avoid `innerHTML = userInput`).
- **Images** via `createOptimizedPicture` (aem.js) for responsive/optimized rendering.
- **Metadata/config** via `getMetadata()` and block section metadata — never hardcode secrets (EDS is public).

## Instrumentation & performance
- Keep LCP fast: eager-load only above-the-fold blocks; lazy the rest.
- Add a block's CSS via the framework's auto-loading (`blocks/<name>/<name>.css`) — don't inline large styles.
- Use `sampleRUM` hooks already wired in `scripts/` for Real User Monitoring.

## Testing
- Unit-test pure helpers with Jest; block DOM behavior with jsdom/Playwright. Keep decorate() side-effect-light
  and export helpers for testability.
