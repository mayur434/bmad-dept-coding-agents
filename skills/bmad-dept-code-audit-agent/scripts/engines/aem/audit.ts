/**
 * AEM Code Audit Engine v2.0
 * Enterprise-grade static code analysis for AEM (AMS & Cloud Service) projects.
 * Features:
 *   - Auto-detects platform (AMS/On-Prem vs Cloud Service vs Migrated)
 *   - Applies platform-appropriate rules (AMS rules for AMS, Cloud rules for AEMaaCS)
 *   - Commerce-style Excel report with Executive Summary, Category Sheets,
 *     Recommendations, Module Rollout, Execution Plan, Action Plan
 *   - CEO-friendly risk scorecard + Technical detail in same report
 *   - SonarQube-style code quality patterns (god classes, dead code, complexity)
 *   - Accessibility scanning (WCAG 2.1 AA compliance)
 *   - SCA-informed vulnerability detection patterns
 *
 * Categories audited:
 *   Performance, Code Quality, Security, SEO, Accessibility,
 *   Architecture, Sling & OSGi, Cloud Readiness, Dispatcher,
 *   HTL & Frontend, Test Coverage, Maintainability,
 *   AMS Specific, Dependencies & Versions
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { AemAuditScanner, FindingsMap, StatsMap } from './lib/scanner';
import { AemReportGenerator } from './lib/report';
import { generateMarkdownReport } from './lib/report-md';
import { generatePdfReport } from './lib/report-pdf';
import { detectPlatform, PlatformDetectionResult } from './lib/scanner/platform-detect';

interface Config {
  project?: { path?: string; name?: string };
  output?: { directory?: string };
  scanner?: { platform?: 'aemcs' | 'aemams' | 'both'; categories?: string[]; modules?: string[] };
  thresholds?: Record<string, number>;
}

function loadConfig(configPath: string): Config {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e: any) {
    console.log(`⚠️  Warning: Could not parse ${configPath}: ${e.message}`);
    return {};
  }
}

function parseArgs(argv: string[]): Record<string, any> {
  const args: Record<string, any> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--config') args.config = argv[++i];
    else if (arg === '--path') args.path = argv[++i];
    else if (arg === '--name') args.name = argv[++i];
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--platform') args.platform = argv[++i];
    else if (arg === '--module') args.module = argv[++i];
    else if (arg === '--format') args.format = argv[++i];
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`AEM Code Audit Engine v1.0

Usage:
  npx ts-node audit.ts --path /aem-project
  npx ts-node audit.ts --path /aem-project --platform aemcs
  npx ts-node audit.ts --path /aem-project --format md
  npx ts-node audit.ts --config config.json

Options:
  --config <path>      Config JSON (default: config.json)
  --path <path>        AEM project root
  --name <name>        Project name (default: folder name)
  --output <dir>       Output directory (default: output)
  --platform <type>    Platform type: aemcs, aemams, or both (default: both)
  --module <mods>      Module filter (comma-separated: core,ui.apps)
  --format <type>      Report format: excel, md, pdf, all (default: excel)
  --json               Also output findings as JSON
  --help               Show this help

Categories audited:
  - Performance: queries, caching, threading, response times
  - Code Quality: patterns, standards, deprecated APIs, dead code
  - Security: XSS, SSRF, credentials, CSRF, injections
  - SEO: meta tags, structure, canonicals, Open Graph
  - Accessibility: WCAG 2.1, ARIA, keyboard, screen readers
  - Architecture: project structure, overlays, design patterns
  - Sling & OSGi: resolver leaks, service config, lifecycle
  - Cloud Readiness: AEMaaCS compatibility checks
  - Dispatcher: cache rules, filters, security
  - HTL & Frontend: template quality, clientlibs, JS/CSS
  - Test Coverage: unit tests, integration tests, coverage ratio
  - Maintainability: complexity, duplication, naming
`);
      process.exit(0);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const configPath = args.config || 'config.json';
  const cfg = loadConfig(configPath);

  const projectCfg = cfg.project || {};
  const outputCfg = cfg.output || {};
  const scannerCfg = cfg.scanner || {};
  const thresholds = cfg.thresholds || {};

  // Resolve values: CLI > config > defaults
  let projectPath = args.path || projectCfg.path || '';
  let platform = (args.platform || scannerCfg.platform || '') as 'aemcs' | 'aemams' | 'both' | '';

  // Validate project path
  if (!projectPath) {
    console.error('❌ Error: No project path provided. Use --path or set in config.json.');
    process.exit(1);
  }

  projectPath = path.resolve(projectPath);
  if (!fs.existsSync(projectPath)) {
    console.error(`❌ Error: Project path does not exist: ${projectPath}`);
    process.exit(1);
  }

  scan(): FindingsMap {
    const scanner = new AemAuditScanner({ root: this.projectRoot });
    return scanner.scan();
  }

  // ─── PLATFORM AUTO-DETECTION ────────────────────────────────────────────
  let platformDetection: PlatformDetectionResult | null = null;
  if (!platform) {
    console.log('🔍 Auto-detecting AEM platform...');
    platformDetection = detectPlatform(projectPath);
    platform = platformDetection.platform;
    console.log(`   ${platformDetection.summary}`);
    if (platformDetection.isMigrated) {
      console.log('   📋 Migration signals detected — will flag AMS patterns that need Cloud remediation');
    }
    console.log(`   Applying ${platform === 'aemcs' ? 'AEMaaCS' : platform === 'aemams' ? 'AEM AMS' : 'AMS + Cloud'} rule set`);
    console.log('');
  } else {
    console.log(`   Platform: ${platform.toUpperCase()} (manually specified)`);
  }

  const projectName = args.name || projectCfg.name || path.basename(projectPath);
  const outputDir = path.resolve(args.output || outputCfg.directory || 'output');
  let modules: string[] = [];
  const moduleFilter = args.module || scannerCfg.modules;
  if (typeof moduleFilter === 'string') {
    modules = moduleFilter.split(',').map((m: string) => m.trim()).filter(Boolean);
  } else if (Array.isArray(moduleFilter)) {
    modules = moduleFilter;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  // Detect git branch
  let branch = '';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath, timeout: 5000 })
      .toString().trim().replace(/\//g, '-');
  } catch { /* ignore */ }

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15).replace(/(\d{8})(\d{6})/, '$1_$2');
  const branchPart = branch ? `-${branch}` : '';

  // Print summary
  console.log('═'.repeat(60));
  console.log(' AEM Code Audit Engine v2.0');
  console.log('═'.repeat(60));
  console.log(`📄 Config: ${fs.existsSync(configPath) ? configPath : 'defaults'}`);
  console.log(`   Project: ${projectName}`);
  console.log(`   Platform: ${platform.toUpperCase()}${platformDetection?.isMigrated ? ' (Migrated from AMS)' : ''}`);
  console.log(`   Path: ${projectPath}`);
  console.log(`   Output: ${outputDir}`);
  if (modules.length > 0) console.log(`   Modules: ${modules.join(', ')}`);
  console.log('');

    // Generate Excel report
    const excelReport = new AuditExcelReport(findings, stats, projectName, this.projectRoot, aemReportConfig);
    const xlsxPath = await excelReport.generate(outputPath);
    console.log(`[${this.PLATFORM_ID}] Excel report: ${xlsxPath}`);

    // Generate Markdown report
    const mdReport = new AuditMarkdownReport(findings, stats, projectName, this.projectRoot, aemReportConfig);
    const mdPath = mdReport.generate(outputPath);
    console.log(`[${this.PLATFORM_ID}] Markdown report: ${mdPath}`);
  }

  const platformLabel = platform === 'aemcs' ? 'AEM as a Cloud Service' : platform === 'aemams' ? 'AEM Managed Services' : 'AEM (AMS + Cloud Service)';
  const migrationNote = platformDetection?.isMigrated ? ' [Migrated to Cloud]' : '';
  const baseFileName = `${projectName}-aem-audit-${timestamp}${branchPart}`;

  const formats = format === 'all' ? ['excel', 'md', 'pdf'] : [format];

  for (const fmt of formats) {
    switch (fmt) {
      case 'excel': {
        const outputFile = path.join(outputDir, `${baseFileName}.xlsx`);
        const report = new AemReportGenerator(findings, stats, projectName, projectPath, platformLabel + migrationNote, platformDetection);
        await report.generate(outputFile);
        break;
      }
      case 'md': {
        const outputFile = path.join(outputDir, `${baseFileName}.md`);
        await generateMarkdownReport(findings, stats, projectName, projectPath, platformLabel + migrationNote, outputFile);
        break;
      }
      case 'pdf': {
        const outputFile = path.join(outputDir, `${baseFileName}.pdf`);
        await generatePdfReport(findings, stats, projectName, projectPath, platformLabel + migrationNote, outputFile);
        break;
      }
    }
    return {
      totalFiles: 0,
      totalFindings,
      categories: Object.keys(findings).length,
      severityCounts,
      scanDuration: 0,
    };
  }

  // Optionally output JSON
  if (args.json) {
    const jsonFile = path.join(outputDir, `${baseFileName}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify({ findings, stats }, null, 2));
    console.log(`📋 JSON: ${jsonFile}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(' ✅ AEM Code Audit Complete (v2.0)');
  console.log('═'.repeat(60));
}
