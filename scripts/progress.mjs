#!/usr/bin/env node
// Usage:
//   node scripts/progress.mjs                 print dashboard
//   node scripts/progress.mjs --write         also update the dashboard block in docs/PROGRESS.md
//   node scripts/progress.mjs --log "note"    append a timestamped line to the Log in docs/PROGRESS.md
//
// Reads docs/MILESTONES.md. Each "## Mxx ..." section may contain a line "Estimate: N h"
// and checkbox lines "- [ ]" / "- [x]". Progress is weighted by estimated hours.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MILESTONES = 'docs/MILESTONES.md';
const PROGRESS = 'docs/PROGRESS.md';
const args = process.argv.slice(2);
const write = args.includes('--write');
const logIdx = args.indexOf('--log');
const logNote = logIdx >= 0 ? args[logIdx + 1] : null;

if (!existsSync(MILESTONES)) {
  console.error(`Missing ${MILESTONES}`);
  process.exit(1);
}

const md = readFileSync(MILESTONES, 'utf8');
const sections = md.split(/^## /m).slice(1);

const rows = [];
for (const s of sections) {
  const title = s.split('\n')[0].trim();
  if (!/^(M|S)\d+/.test(title)) continue;
  const done = (s.match(/^\s*- \[x\]/gim) || []).length;
  const open = (s.match(/^\s*- \[ \]/gim) || []).length;
  const total = done + open;
  const est = parseFloat((s.match(/Estimate:\s*([\d.]+)\s*h/i) || [])[1] || '0');
  const isStretch = /^S\d+/.test(title);
  rows.push({ title, done, total, est, isStretch, pct: total ? done / total : 0 });
}

const core = rows.filter((r) => !r.isStretch);
const weightSum = core.reduce((a, r) => a + r.est, 0) || 1;
const overall = core.reduce((a, r) => a + r.est * r.pct, 0) / weightSum;

const current = core.find((r) => r.pct < 1) || core[core.length - 1];

// Dates
let start = null;
let deadline = null;
if (existsSync(PROGRESS)) {
  const p = readFileSync(PROGRESS, 'utf8');
  const s = p.match(/^START_DATE:\s*(\d{4}-\d{2}-\d{2})/m);
  const d = p.match(/^DEADLINE:\s*(\d{4}-\d{2}-\d{2})/m);
  if (s) start = new Date(s[1] + 'T00:00:00');
  if (d) deadline = new Date(d[1] + 'T23:59:59');
}

const now = new Date();
const DAY = 86400000;
let dayLine = 'Dates not set (fill START_DATE and DEADLINE in docs/PROGRESS.md)';
let rag = 'UNKNOWN';
if (start && deadline && deadline > start) {
  const totalDays = Math.max(1, Math.ceil((deadline - start) / DAY));
  const dayN = Math.min(totalDays, Math.max(1, Math.ceil((now - start) / DAY)));
  const daysLeft = Math.max(0, Math.ceil((deadline - now) / DAY));
  const elapsed = Math.min(1, Math.max(0, (now - start) / (deadline - start)));
  dayLine = `Day ${dayN}/${totalDays}, ${daysLeft} day(s) left`;
  const gap = elapsed - overall; // positive means behind
  rag = gap <= 0.05 ? 'GREEN' : gap <= 0.15 ? 'AMBER' : 'RED';
}

const bar = (p) => {
  const n = Math.round(p * 20);
  return '[' + '#'.repeat(n) + '.'.repeat(20 - n) + '] ' + String(Math.round(p * 100)).padStart(3) + '%';
};

const lines = [];
lines.push(`Generated: ${now.toISOString()}`);
lines.push('');
lines.push(`Overall (hours-weighted): ${bar(overall)}   ${dayLine}   Schedule: ${rag}`);
lines.push(`Current milestone: ${current ? current.title : 'n/a'}`);
lines.push('');
lines.push('| Milestone | Est (h) | Tasks | Progress |');
lines.push('|---|---:|---:|---|');
for (const r of rows) {
  lines.push(`| ${r.title} | ${r.est || '-'} | ${r.done}/${r.total} | ${bar(r.pct)} |`);
}
const dashboard = lines.join('\n');
console.log(dashboard);

if (write && existsSync(PROGRESS)) {
  let p = readFileSync(PROGRESS, 'utf8');
  const block = `<!-- DASHBOARD:START -->\n${dashboard}\n<!-- DASHBOARD:END -->`;
  if (/<!-- DASHBOARD:START -->[\s\S]*<!-- DASHBOARD:END -->/.test(p)) {
    p = p.replace(/<!-- DASHBOARD:START -->[\s\S]*<!-- DASHBOARD:END -->/, block);
  } else {
    p += `\n${block}\n`;
  }
  writeFileSync(PROGRESS, p);
}

if (logNote && existsSync(PROGRESS)) {
  const stamp = now.toISOString().replace('T', ' ').slice(0, 16);
  const pct = Math.round(overall * 100);
  const entry = `- ${stamp} | ${current ? current.title.split(' ')[0] : '-'} | overall ${pct}% | ${rag} | ${logNote}\n`;
  const p = readFileSync(PROGRESS, 'utf8');
  writeFileSync(PROGRESS, p.endsWith('\n') ? p + entry : p + '\n' + entry);
}
