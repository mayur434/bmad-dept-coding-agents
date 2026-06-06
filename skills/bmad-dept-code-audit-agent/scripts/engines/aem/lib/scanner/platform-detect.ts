/**
 * AEM Platform Auto-Detection Module
 * ===================================
 * Detects whether the project is:
 *   - AEM as a Cloud Service (AEMaaCS)
 *   - AEM Managed Services (AMS / On-Premise)
 *   - Hybrid/Migrated (AMS project that has been moved or is being migrated to Cloud)
 *
 * Detection is based on multiple signals with confidence scoring.
 * The result determines which rule pack to apply (AMS or Cloud rules).
 */
import * as fs from 'fs';
import * as path from 'path';

export type PlatformType = 'aemcs' | 'aemams' | 'both';

export interface PlatformDetectionResult {
  /** Detected platform */
  platform: PlatformType;
  /** Overall confidence (0-100) */
  confidence: number;
  /** Whether the project appears to have been migrated from AMS to Cloud */
  isMigrated: boolean;
  /** AEM version detected from pom.xml */
  aemVersion: string;
  /** SDK version if Cloud */
  sdkVersion: string;
  /** Uber-jar version if AMS */
  uberJarVersion: string;
  /** Java version detected */
  javaVersion: string;
  /** All detection signals with their individual confidence */
  signals: DetectionSignal[];
  /** Human-readable summary for the report */
  summary: string;
}

export interface DetectionSignal {
  signal: string;
  value: string;
  weight: number;
  indicatesCloud: boolean;
  source: string;
}

/**
 * Auto-detect AEM platform from project structure and dependencies.
 * Scans pom.xml files, dispatcher configs, cloud manager configs, and
 * repository structure to determine platform type.
 */
export function detectPlatform(projectRoot: string): PlatformDetectionResult {
  const signals: DetectionSignal[] = [];
  let aemVersion = '';
  let sdkVersion = '';
  let uberJarVersion = '';
  let javaVersion = '';

  // ─── Signal 1: Cloud Manager configs ────────────────────────────────────
  const cloudManagerDir = path.join(projectRoot, '.cloudmanager');
  if (fs.existsSync(cloudManagerDir)) {
    signals.push({
      signal: '.cloudmanager/ directory exists',
      value: 'present',
      weight: 30,
      indicatesCloud: true,
      source: '.cloudmanager/',
    });
  }

  // Cloud Manager pipeline yaml
  const cmYaml = findFile(projectRoot, '.cloudmanager/pipeline.yaml');
  if (cmYaml) {
    signals.push({
      signal: 'Cloud Manager pipeline.yaml',
      value: 'present',
      weight: 20,
      indicatesCloud: true,
      source: cmYaml,
    });
  }

  // ─── Signal 2: Root pom.xml analysis ────────────────────────────────────
  const rootPom = path.join(projectRoot, 'pom.xml');
  if (fs.existsSync(rootPom)) {
    const pomContent = fs.readFileSync(rootPom, 'utf-8');

    // AEM SDK API (Cloud indicator)
    const sdkMatch = pomContent.match(/<artifactId>aem-sdk-api<\/artifactId>\s*<version>([^<]+)<\/version>/);
    if (sdkMatch) {
      sdkVersion = sdkMatch[1];
      signals.push({
        signal: 'aem-sdk-api dependency found',
        value: sdkVersion,
        weight: 40,
        indicatesCloud: true,
        source: 'pom.xml',
      });
    }

    // Cloud SDK parent
    const cloudParent = pomContent.match(/com\.adobe\.aem.*aem-project-archetype-parent|aem-guides-wknd.*cloud/i);
    if (cloudParent) {
      signals.push({
        signal: 'Cloud-specific parent POM',
        value: cloudParent[0].substring(0, 60),
        weight: 25,
        indicatesCloud: true,
        source: 'pom.xml',
      });
    }

    // Uber-jar (AMS indicator)
    const uberMatch = pomContent.match(/<artifactId>uber-jar<\/artifactId>\s*(?:<version>([^<]+)<\/version>)?/);
    if (!uberMatch) {
      // Try alternative uber-jar patterns
      const uberAlt = pomContent.match(/uber-jar.*?<version>([^<]+)/s);
      if (uberAlt) {
        uberJarVersion = uberAlt[1];
      }
    } else {
      uberJarVersion = uberMatch[1] || '';
    }

    // Also check properties for uber-jar version
    if (!uberJarVersion) {
      const propMatch = pomContent.match(/<aem\.version>([^<]+)<\/aem\.version>/);
      if (propMatch) uberJarVersion = propMatch[1];
    }

    if (uberJarVersion) {
      signals.push({
        signal: 'uber-jar dependency (AEM 6.5.x)',
        value: uberJarVersion,
        weight: 35,
        indicatesCloud: false,
        source: 'pom.xml',
      });
    }

    // Java version detection
    const javaMatch = pomContent.match(/<(?:maven\.compiler\.(?:source|target|release)|java\.version)>(\d+)<\//);
    if (javaMatch) {
      javaVersion = javaMatch[1];
      // Java 11+ strongly correlates with Cloud
      if (parseInt(javaVersion) >= 11) {
        signals.push({
          signal: 'Java version >= 11 (Cloud-compatible)',
          value: javaVersion,
          weight: 10,
          indicatesCloud: true,
          source: 'pom.xml',
        });
      } else {
        signals.push({
          signal: 'Java version < 11 (AMS-era)',
          value: javaVersion,
          weight: 10,
          indicatesCloud: false,
          source: 'pom.xml',
        });
      }
    }

    // AEM version in properties
    const aemVerMatch = pomContent.match(/<aem\.version>([^<]+)|<uber\.jar\.version>([^<]+)/);
    if (aemVerMatch) {
      aemVersion = aemVerMatch[1] || aemVerMatch[2] || '';
    }

    // Content-package-maven-plugin (legacy AMS)
    if (pomContent.includes('content-package-maven-plugin') && pomContent.includes('com.day.jcr.vault')) {
      signals.push({
        signal: 'Legacy content-package-maven-plugin (com.day)',
        value: 'present',
        weight: 15,
        indicatesCloud: false,
        source: 'pom.xml',
      });
    }

    // filevault-package-maven-plugin (modern, but also used in Cloud)
    if (pomContent.includes('filevault-package-maven-plugin')) {
      signals.push({
        signal: 'filevault-package-maven-plugin (modern)',
        value: 'present',
        weight: 5,
        indicatesCloud: true,
        source: 'pom.xml',
      });
    }

    // Sling Feature Model (Cloud-specific)
    if (pomContent.includes('slingfeature-maven-plugin') || pomContent.includes('sling-feature')) {
      signals.push({
        signal: 'Sling Feature Model plugin (Cloud-native)',
        value: 'present',
        weight: 25,
        indicatesCloud: true,
        source: 'pom.xml',
      });
    }

    // Repo Init (more common in Cloud but also AMS 6.5)
    if (pomContent.includes('repoinit') || pomContent.includes('org.apache.sling.jcr.repoinit')) {
      signals.push({
        signal: 'Sling RepoInit references',
        value: 'present',
        weight: 8,
        indicatesCloud: true,
        source: 'pom.xml',
      });
    }
  }

  // ─── Signal 3: Dispatcher structure ─────────────────────────────────────
  const dispatcherCloud = path.join(projectRoot, 'dispatcher', 'src');
  const dispatcherAms = path.join(projectRoot, 'dispatcher', 'src', 'conf.d');
  const dispatcherAmsAlt = path.join(projectRoot, 'conf.dispatcher.d');
  const dispatcherClassic = findFile(projectRoot, 'dispatcher/conf/dispatcher.any');

  // Cloud dispatcher has a specific structure: src/conf.d/ and src/conf.dispatcher.d/
  const hasCloudDispatcher = fs.existsSync(path.join(projectRoot, 'dispatcher', 'src', 'conf.dispatcher.d'));
  const hasAmsDispatcher = fs.existsSync(dispatcherAmsAlt) || fs.existsSync(dispatcherClassic || '');

  if (hasCloudDispatcher) {
    signals.push({
      signal: 'Cloud dispatcher structure (dispatcher/src/conf.dispatcher.d/)',
      value: 'present',
      weight: 25,
      indicatesCloud: true,
      source: 'dispatcher/src/',
    });
  }

  if (hasAmsDispatcher) {
    signals.push({
      signal: 'AMS dispatcher structure (conf.dispatcher.d/ or dispatcher.any)',
      value: 'present',
      weight: 20,
      indicatesCloud: false,
      source: 'dispatcher/',
    });
  }

  // ─── Signal 4: OSGi config format ──────────────────────────────────────
  // .cfg.json = Cloud-native, .config/.xml = AMS-era
  const cfgJsonFiles = findFilesByPattern(projectRoot, '**/*.cfg.json');
  const cfgConfigFiles = findFilesByPattern(projectRoot, '**/*.config');

  if (cfgJsonFiles.length > 0) {
    signals.push({
      signal: 'OSGi .cfg.json config files (Cloud format)',
      value: `${cfgJsonFiles.length} files`,
      weight: 20,
      indicatesCloud: true,
      source: 'config files',
    });
  }

  if (cfgConfigFiles.length > 0 && cfgJsonFiles.length === 0) {
    signals.push({
      signal: 'OSGi .config files only (legacy AMS format)',
      value: `${cfgConfigFiles.length} files`,
      weight: 15,
      indicatesCloud: false,
      source: 'config files',
    });
  }

  // ─── Signal 5: Runmode-specific config directories ──────────────────────
  const hasCloudRunmodes = checkDirPattern(projectRoot, /config\.(?:author|publish)\.(dev|stage|prod)\b/);
  const hasAmsRunmodes = checkDirPattern(projectRoot, /config\.(author|publish)$/);

  if (hasCloudRunmodes) {
    signals.push({
      signal: 'Cloud-style runmode configs (config.author.dev, config.publish.prod)',
      value: 'present',
      weight: 15,
      indicatesCloud: true,
      source: 'config directories',
    });
  }

  // ─── Signal 6: Replication agents (AMS only) ────────────────────────────
  const hasReplAgents = findFile(projectRoot, '**/replication/agents*');
  if (hasReplAgents) {
    signals.push({
      signal: 'Replication agents in source (AMS pattern)',
      value: 'present',
      weight: 15,
      indicatesCloud: false,
      source: hasReplAgents,
    });
  }

  // ─── Signal 7: Install hooks (banned in Cloud) ──────────────────────────
  const hasInstallHooks = findFile(projectRoot, '**/META-INF/vault/hooks/');
  if (hasInstallHooks) {
    signals.push({
      signal: 'Install hooks (not allowed in Cloud)',
      value: 'present',
      weight: 12,
      indicatesCloud: false,
      source: 'META-INF/vault/hooks/',
    });
  }

  // ─── Signal 8: Repository structure package ─────────────────────────────
  const hasRepoStructure = findFile(projectRoot, '**/ui.apps.structure/') ||
                           findFile(projectRoot, '**/repository-structure/');
  if (hasRepoStructure) {
    signals.push({
      signal: 'Repository structure package (Cloud requirement)',
      value: 'present',
      weight: 15,
      indicatesCloud: true,
      source: 'ui.apps.structure or repository-structure module',
    });
  }

  // ─── Calculate weighted score ───────────────────────────────────────────
  let cloudScore = 0;
  let amsScore = 0;
  let totalWeight = 0;

  for (const s of signals) {
    totalWeight += s.weight;
    if (s.indicatesCloud) {
      cloudScore += s.weight;
    } else {
      amsScore += s.weight;
    }
  }

  // Determine platform
  let platform: PlatformType;
  let confidence: number;
  let isMigrated = false;

  if (totalWeight === 0) {
    platform = 'both';
    confidence = 0;
  } else {
    const cloudPct = (cloudScore / totalWeight) * 100;
    const amsPct = (amsScore / totalWeight) * 100;

    if (cloudPct >= 70) {
      platform = 'aemcs';
      confidence = Math.round(cloudPct);
    } else if (amsPct >= 70) {
      platform = 'aemams';
      confidence = Math.round(amsPct);
    } else if (cloudPct >= 50) {
      // Mixed signals - likely migrated or in-progress migration
      platform = 'aemcs';
      confidence = Math.round(cloudPct);
      isMigrated = amsScore > 0;
    } else if (amsPct >= 50) {
      platform = 'aemams';
      confidence = Math.round(amsPct);
      // Check if there are any cloud signals suggesting a migration
      isMigrated = cloudScore > 20;
    } else {
      platform = 'both';
      confidence = 50;
      isMigrated = cloudScore > 0 && amsScore > 0;
    }
  }

  // Build summary
  const platformLabel = platform === 'aemcs'
    ? 'AEM as a Cloud Service'
    : platform === 'aemams'
      ? 'AEM Managed Services (On-Premise)'
      : 'AEM (Mixed/Unknown)';

  let summary = `Detected: ${platformLabel} (${confidence}% confidence)`;
  if (isMigrated) {
    summary += '\n⚠️ MIGRATION DETECTED: This project shows signs of being migrated from AMS/On-Prem to Cloud Service.';
    if (uberJarVersion && sdkVersion) {
      summary += `\n   Original AMS version: ${uberJarVersion}, Cloud SDK: ${sdkVersion}`;
    }
  }
  if (aemVersion) summary += `\n   AEM Version: ${aemVersion}`;
  if (javaVersion) summary += `\n   Java Version: ${javaVersion}`;

  return {
    platform,
    confidence,
    isMigrated,
    aemVersion: aemVersion || uberJarVersion || sdkVersion,
    sdkVersion,
    uberJarVersion,
    javaVersion,
    signals,
    summary,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function findFile(root: string, pattern: string): string | null {
  // Simple file finder - checks common locations
  const segments = pattern.replace(/\*\*/g, '').split('/').filter(Boolean);
  const target = segments[segments.length - 1];

  function search(dir: string, depth: number): string | null {
    if (depth > 4) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === target) return fullPath;
        if (entry.isDirectory()) {
          if (entry.name === target) return fullPath;
          const found = search(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch { /* permission denied etc */ }
    return null;
  }

  return search(root, 0);
}

function findFilesByPattern(root: string, pattern: string): string[] {
  const ext = pattern.split('.').pop() || '';
  const results: string[] = [];

  function search(dir: string, depth: number): void {
    if (depth > 5 || results.length > 20) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith('.' + ext)) {
          results.push(fullPath);
        } else if (entry.isDirectory()) {
          search(fullPath, depth + 1);
        }
      }
    } catch { /* ignore */ }
  }

  search(root, 0);
  return results;
}

function checkDirPattern(root: string, pattern: RegExp): boolean {
  function search(dir: string, depth: number): boolean {
    if (depth > 4) return false;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') continue;
        if (pattern.test(entry.name)) return true;
        const found = search(path.join(dir, entry.name), depth + 1);
        if (found) return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  return search(root, 0);
}
