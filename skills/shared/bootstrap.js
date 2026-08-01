#!/usr/bin/env node
/* ---------------------------------------------------------------------------
 * skills/shared/bootstrap.js
 *
 * Windows-friendly Node wrapper for bootstrap.sh. Same contract:
 *   node bootstrap.js <agent-name> [--yes|--no]
 *
 * Exit codes: 0 ok/silent · 2 missing (--no) · 3 declined · 4 install error
 * -------------------------------------------------------------------------*/
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const VALID_AGENTS = ['audit', 'sonar-scan', 'generation', 'impact-analysis', 'test-coverage'];

function die(code, msg) {
  if (msg) process.stderr.write(`[dca-bootstrap] ${msg}\n`);
  process.exit(code);
}

const agent = process.argv[2];
const mode = process.argv[3] || '';

if (!agent) die(4, 'error: agent name required. Usage: node bootstrap.js <agent-name> [--yes|--no]');
if (!VALID_AGENTS.includes(agent)) die(4, `error: unknown agent '${agent}'. Expected: ${VALID_AGENTS.join(' | ')}`);
if (mode && mode !== '--yes' && mode !== '--no') die(4, `error: unknown flag '${mode}'. Expected: --yes or --no`);

const sharedDir = __dirname;
const skillsRoot = path.resolve(sharedDir, '..');
const agentScriptsDir = path.join(skillsRoot, `bmad-dept-code-${agent}-agent`, 'scripts');

if (!fs.existsSync(agentScriptsDir)) die(4, `error: agent scripts dir not found: ${agentScriptsDir}`);

const sharedMissing = !fs.existsSync(path.join(sharedDir, 'node_modules'));
const agentMissing = !fs.existsSync(path.join(agentScriptsDir, 'node_modules'));

if (!sharedMissing && !agentMissing) process.exit(0);
if (mode === '--no') process.exit(2);

function install(dir, label) {
  process.stderr.write(`[dca-bootstrap] installing ${label} deps (${dir}) ...\n`);
  try {
    execSync('npm install --silent --no-fund --no-audit --loglevel=error', { cwd: dir, stdio: 'inherit' });
  } catch (e) {
    die(4, `error: npm install failed in ${dir}`);
  }
}

function proceed() {
  if (sharedMissing) install(sharedDir, 'shared');
  if (agentMissing) install(agentScriptsDir, agent);
  process.stderr.write('[dca-bootstrap] done.\n');
  process.exit(0);
}

if (mode === '--yes') {
  proceed();
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: false });
  process.stderr.write(`[dca-bootstrap] First-run dependency install needed — ~80MB across shared/ and ${agent}/ (~30–60s). Proceed? (Y/n) `);
  rl.question('', (answer) => {
    rl.close();
    const a = (answer || '').trim();
    if (a === '' || /^(y|yes)$/i.test(a)) return proceed();
    if (/^(n|no)$/i.test(a)) die(3, 'declined by user.');
    die(3, `unrecognized response '${a}' — treating as decline.`);
  });
}
