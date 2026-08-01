/**
 * Priority module smoke test.
 * Usage: npx ts-node skills/shared/priority/smoke.ts
 */

import {
  STACK_PROFILES,
  getStackProfile,
  scoreFile,
  scoreFiles,
  bandForScore,
  normalizeBoolean,
  normalizeCount,
  type FileFactors,
} from "./index";

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    process.exit(1);
  }
}

function main(): void {
  // --- 1. All 8 profiles present + aliases resolve
  const expectedStacks = [
    "commerce",
    "commerce-saas",
    "aem",
    "sling",
    "spring",
    "app-builder",
    "eds",
    "eds-commerce",
  ];
  assert(STACK_PROFILES.length === expectedStacks.length, "STACK_PROFILES count");
  for (const s of expectedStacks) {
    const p = getStackProfile(s);
    assert(p.stack === s, `profile ${s} resolves`);
    assert(Object.keys(p.weights).length > 0, `profile ${s} has weights`);
  }
  assert(getStackProfile("commerce-paas").stack === "commerce", "alias commerce-paas → commerce");
  assert(getStackProfile("aemcs").stack === "aem", "alias aemcs → aem");
  assert(getStackProfile("unknown-stack-xyz").stack === "unknown-stack-xyz", "unknown → fallback");

  // --- 2. Normalisers
  assert(normalizeBoolean(true) === 1, "normalizeBoolean true");
  assert(normalizeBoolean(false) === 0, "normalizeBoolean false");
  assert(normalizeCount(0) === 0, "normalizeCount 0");
  assert(normalizeCount(5, 10) === 0.5, "normalizeCount 5/10");
  assert(normalizeCount(999, 10) === 1, "normalizeCount saturates");

  // --- 3. bandForScore
  assert(bandForScore(0) === "low", "band 0");
  assert(bandForScore(30) === "medium", "band 30");
  assert(bandForScore(60) === "high", "band 60");
  assert(bandForScore(90) === "critical", "band 90");

  // --- 4. scoreFile — high-signal input maxes out
  const commerceProfile = getStackProfile("commerce");
  const heavy: FileFactors = {
    filePath: "app/code/Vendor/Checkout/Plugin/Payment.php",
    factors: {
      complexity: 30,
      revenue_path: true,
      plugin: true,
      observer: false,
      api_annotated: true,
      churn: 12,
      fan_in: 25,
      security_touch: true,
      test_gap: true,
    },
  };
  const light: FileFactors = {
    filePath: "app/code/Vendor/Util/Helper.php",
    factors: {
      complexity: 1,
      revenue_path: false,
      plugin: false,
      observer: false,
      api_annotated: false,
      churn: 0,
      fan_in: 0,
      security_touch: false,
      test_gap: false,
    },
  };
  const heavyScored = scoreFile(heavy, commerceProfile);
  const lightScored = scoreFile(light, commerceProfile);
  assert(heavyScored.score >= 0 && heavyScored.score <= 100, "heavy in 0-100");
  assert(lightScored.score >= 0 && lightScored.score <= 100, "light in 0-100");
  assert(heavyScored.score > lightScored.score, "heavy > light");
  assert(heavyScored.band === "critical" || heavyScored.band === "high", "heavy is high/critical");
  assert(lightScored.band === "low", "light is low");
  assert(Object.keys(heavyScored.breakdown).length > 0, "heavy breakdown populated");

  // --- 5. scoreFiles is sorted highest-first for ALL 8 profiles
  const rand = [
    { filePath: "a.php", factors: { complexity: 20, churn: 8 } },
    { filePath: "b.php", factors: { complexity: 2, churn: 0 } },
    { filePath: "c.php", factors: { complexity: 10, churn: 4 } },
  ];
  for (const profile of STACK_PROFILES) {
    const sorted = scoreFiles(rand, profile);
    assert(sorted.length === rand.length, `sorted len for ${profile.stack}`);
    for (let i = 1; i < sorted.length; i++) {
      assert(
        sorted[i - 1].score >= sorted[i].score,
        `sorted desc for ${profile.stack} at ${i}`,
      );
      assert(sorted[i].score >= 0 && sorted[i].score <= 100, `bounds for ${profile.stack}`);
    }
  }

  // --- 6. Non-fatal: garbage input doesn't crash
  const bad = scoreFile(
    { filePath: "x", factors: { complexity: NaN as unknown as number } },
    commerceProfile,
  );
  assert(bad.score >= 0 && bad.score <= 100, "NaN input safe");
  const empty = scoreFiles([], commerceProfile);
  assert(Array.isArray(empty) && empty.length === 0, "empty input safe");

  process.stdout.write("OK\n");
}

main();
