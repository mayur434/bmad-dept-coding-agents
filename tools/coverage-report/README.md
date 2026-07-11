# DCA Agent Coverage report

Regenerates the coverage deliverables at the repo root.

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"   # Node is keg-only
SHARED=../../skills/shared/node_modules
AUDIT=../../skills/bmad-dept-code-audit-agent/scripts/node_modules

NODE_PATH="$SHARED" node build-xlsx.js          ../../DCA-Agent-Coverage.xlsx   # needs exceljs (in skills/shared)
NODE_PATH="$AUDIT"  node build-pdf.js           ../../DCA-Agent-Coverage.pdf    # needs pdfkit (in audit agent)
NODE_PATH="$SHARED" node build-test-commands.js ../../DCA-Test-Commands.xlsx     # agent × stack test/command matrix
```

Edit the `MATRIX` / `DETAIL` / `AGENT_INFO` data at the top of each script when coverage changes.
