/**
 * BMAD Test Coverage Agent — Base Engine
 * ========================================
 * Abstract base class for platform-specific coverage engines.
 */

// ---------------------------------------------------------------------------
// Testing frameworks supported per platform
// ---------------------------------------------------------------------------

export type TestFramework =
  | "unit"             // PHPUnit Unit / JUnit / Jest
  | "integration"     // PHPUnit Integration (bootstrapped)
  | "mftf"           // Magento Functional Testing Framework
  | "api-functional"  // REST/GraphQL endpoint tests
  | "js"             // Frontend JS tests (Jasmine/Jest/Mocha)
  | "static"         // PHPCS / PHPStan / PHPMD
  | "performance";   // JMeter / Gatling / k6

export type DetectionStrategy =
  | "filename"       // FooClass.php → FooClassTest.php
  | "namespace"      // Mirror src namespace → test namespace
  | "annotation"     // @covers / @coversDefaultClass
  | "all";           // All strategies combined

// ---------------------------------------------------------------------------
// Options & Report structures
// ---------------------------------------------------------------------------

export interface CoverageOptions {
  name: string | null;
  module: string | null;
  output: string | null;
  frameworks: TestFramework[] | null;
  strategy: DetectionStrategy | null;
}

export interface CoverageGap {
  file: string;
  className: string | null;
  method: string | null;
  complexity: number;
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
  framework: TestFramework;
}

export interface FrameworkSummary {
  framework: TestFramework;
  totalFiles: number;
  testedFiles: number;
  untestedFiles: number;
  coveragePercent: number;
}

export interface CoverageReport {
  projectName: string;
  engine: string;
  totalSourceFiles: number;
  testedFiles: number;
  untestedFiles: number;
  coveragePercent: number;
  gaps: CoverageGap[];
  frameworkBreakdown: FrameworkSummary[];
}

export abstract class BaseEngine {
  abstract readonly name: string;
  abstract readonly id: string;

  /**
   * Analyze existing test coverage and identify gaps.
   */
  abstract analyzeCoverage(projectPath: string, options: CoverageOptions): Promise<CoverageReport>;

  /**
   * Generate test files for identified gaps.
   * Returns paths of generated test files.
   */
  abstract generateTests(projectPath: string, options: CoverageOptions): Promise<string[]>;
}
