#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PKG_DIR   = path.join(__dirname, '..');
const AGENTS_DIR = path.join(PKG_DIR, '.agents');

// Install targets per LLM tool.
// Skills in .agents/<skill>/SKILL.md are copied as <skill>.md (flat file) for
// tools that use the slash-command convention, or as <skill>/SKILL.md for tools
// that support the full SKILL.md directory format.
const TARGETS = [
  {
    name:   'Claude Code',
    dest:   path.join(os.homedir(), '.claude', 'commands'),
    format: 'flat',    // copies SKILL.md → <dest>/<skill>.md
  },
  {
    name:   'Codex',
    dest:   path.join(os.homedir(), '.codex'),
    format: 'skill-dir', // copies <skill>/SKILL.md as-is
  },
  {
    name:   'Gemini',
    dest:   path.join(os.homedir(), '.gemini'),
    format: 'skill-dir',
  },
];

/** Collect skill directories (each must contain a SKILL.md). */
function getSkills() {
  return fs.readdirSync(AGENTS_DIR)
    .filter(name => {
      const skillMd = path.join(AGENTS_DIR, name, 'SKILL.md');
      return fs.statSync(path.join(AGENTS_DIR, name)).isDirectory() && fs.existsSync(skillMd);
    });
}

/** Copy a file, creating parent dirs as needed. */
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/** Recursively copy a directory. */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : copyFile(s, d);
  }
}

console.log('Installing Lista Lending agent skills…\n');

const skills = getSkills();
if (skills.length === 0) {
  console.error('No skills found in .agents/');
  process.exit(1);
}

// Also install shared scripts directory
const scriptsDir = path.join(AGENTS_DIR, 'scripts');

let installed = 0;

for (const target of TARGETS) {
  try {
    fs.mkdirSync(target.dest, { recursive: true });

    let count = 0;
    for (const skill of skills) {
      const skillDir  = path.join(AGENTS_DIR, skill);
      const skillMd   = path.join(skillDir, 'SKILL.md');

      if (target.format === 'flat') {
        // Claude Code: copy SKILL.md → <dest>/<skill>.md
        copyFile(skillMd, path.join(target.dest, `${skill}.md`));
      } else {
        // SKILL.md dir format: copy entire skill directory
        copyDir(skillDir, path.join(target.dest, skill));
      }
      count++;
    }

    // Copy shared scripts alongside skills
    if (fs.existsSync(scriptsDir)) {
      if (target.format === 'flat') {
        copyDir(scriptsDir, path.join(target.dest, '..', 'scripts'));
      } else {
        copyDir(scriptsDir, path.join(target.dest, 'scripts'));
      }
    }

    console.log(`  ✓ ${target.name.padEnd(12)} → ${target.dest}  (${count} skills)`);
    installed++;
  } catch (err) {
    console.log(`  ✗ ${target.name.padEnd(12)} skipped: ${err.message}`);
  }
}

if (installed > 0) {
  console.log('\nInstalled skills:');
  for (const skill of skills) console.log(`  /${skill}`);
} else {
  console.error('\nInstallation failed — no targets were written.');
  process.exit(1);
}
