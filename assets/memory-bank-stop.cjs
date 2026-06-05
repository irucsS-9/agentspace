#!/usr/bin/env node
/**
 * agentspace Stop hook — keeps the memory bank current on cross-repo work.
 * Dep-free (runs with bare node). Reads .claude/agentspace-hook.json for config.
 * Pure helpers are exported when required (for tests); the file runs when executed.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MUTATING_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SEED_PAGES = new Set(['README.md', 'index.md', 'log.md', 'projectOverview.md', 'crossAppContracts.md']);

/** Pure decision: allow | warn | block. */
function decideStop({ mode, warm, crossAppMutation, memoryBankUpdated }) {
  if (!crossAppMutation || memoryBankUpdated) return 'allow';
  if (mode === 'warn') return 'warn';
  if (mode === 'block') return 'block';
  return warm ? 'block' : 'warn'; // auto
}

/** Pure: warm when pages OR sessions cross their thresholds. */
function isWarm({ pages, sessions, warmPages, warmSessions }) {
  return pages > warmPages || sessions >= warmSessions;
}

/** Count real (non-seed) memory-bank .md pages, recursively. */
function countRealPages(mbDir) {
  let count = 0;
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md') && !SEED_PAGES.has(e.name)) count++;
    }
  }
  walk(mbDir);
  return count;
}

function readState(stateFile) {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return { sessions: 0 }; }
}

function writeState(stateFile, state) {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state));
  } catch { /* best effort */ }
}

function main() {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
  if (input.stop_hook_active) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const mbDir = path.join(projectDir, 'memory-bank');
  if (!fs.existsSync(mbDir)) process.exit(0);

  const configFile = path.join(projectDir, '.claude', 'agentspace-hook.json');
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch { process.exit(0); }
  const subRepos = Array.isArray(cfg.subRepos) ? cfg.subRepos : [];

  // Count this session (every Stop on a configured workspace).
  const stateFile = path.join(projectDir, '.agentspace', 'state.json');
  const state = readState(stateFile);
  state.sessions = (state.sessions || 0) + 1;
  writeState(stateFile, state);

  // Inspect the transcript for mutating tool uses.
  let mutationCount = 0;
  const touched = new Set();
  let memoryBankUpdated = false;
  const tp = input.transcript_path;
  if (tp && fs.existsSync(tp)) {
    for (const line of fs.readFileSync(tp, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let evt; try { evt = JSON.parse(line); } catch { continue; }
      const content = evt && evt.message && evt.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block || block.type !== 'tool_use' || !MUTATING_TOOLS.has(block.name)) continue;
        mutationCount++;
        const raw = (block.input && (block.input.file_path || block.input.notebook_path)) || '';
        const rel = raw.startsWith(projectDir) ? raw.slice(projectDir.length + 1) : raw;
        if (rel.startsWith('memory-bank/')) memoryBankUpdated = true;
        for (const sub of subRepos) { if (rel.startsWith(sub + '/')) { touched.add(sub); break; } }
      }
    }
  }

  const crossAppMutation = mutationCount > 0 && touched.size >= 2;
  const warm = isWarm({
    pages: countRealPages(mbDir),
    sessions: state.sessions,
    warmPages: cfg.warmPages,
    warmSessions: cfg.warmSessions,
  });
  const decision = decideStop({ mode: cfg.mode, warm, crossAppMutation, memoryBankUpdated });

  if (decision === 'allow') process.exit(0);

  const list = [...touched].sort().join(', ');
  const reason = [
    `Cross-repo activity detected (${list}) — update the memory bank before ending.`,
    '1. Refresh memory-bank/01-active/currentWork.md (date + status).',
    '2. Append one line to memory-bank/log.md: `## [YYYY-MM-DD] <action> | <slug>`.',
    '3. If a cross-repo contract was touched, record it in memory-bank/00-core/crossAppContracts.md (cite `file:line`).',
  ].join('\n');

  if (decision === 'block') {
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  } else {
    // warn: surface a note but allow the stop.
    process.stdout.write(JSON.stringify({ systemMessage: reason }));
  }
  process.exit(0);
}

if (require.main === module) {
  main();
} else {
  module.exports = { decideStop, isWarm, countRealPages, readState, writeState };
}
