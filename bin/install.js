#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PKG_DIR = path.join(__dirname, '..');
const AGENTS_DIR = path.join(PKG_DIR, '.agents');

// Target paths per LLM tool (global user-level install)
const TARGETS = [
  { name: 'Claude Code',  dest: path.join(os.homedir(), '.claude', 'commands') },
  { name: 'Codex',        dest: path.join(os.homedir(), '.codex') },
  { name: 'Gemini',       dest: path.join(os.homedir(), '.gemini') },
];

function copySkills(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const file of fs.readdirSync(src)) {
    if (!file.endsWith('.md')) continue;
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
    count++;
  }
  return count;
}

console.log('Installing Lista Lending agent skills...\n');

let installed = 0;
for (const target of TARGETS) {
  try {
    const count = copySkills(AGENTS_DIR, target.dest);
    console.log(`  ✓ ${target.name.padEnd(12)} → ${target.dest}  (${count} skills)`);
    installed++;
  } catch (err) {
    console.log(`  ✗ ${target.name.padEnd(12)} skipped: ${err.message}`);
  }
}

if (installed > 0) {
  console.log('\nDone. Available commands:');
  for (const file of fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'))) {
    console.log(`  /${path.basename(file, '.md')}`);
  }
} else {
  console.error('\nInstallation failed. No targets were written.');
  process.exit(1);
}
