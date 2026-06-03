#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function fingerprint(f) {
  const key = [f.type || '', f.route || f.flow || '', (f.title || '').toLowerCase().trim()].join('|');
  return createHash('sha1').update(key).digest('hex').slice(0, 12);
}

export function load(path) {
  if (!existsSync(path)) return { findings: [], runs: [] };
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function save(path, mem) {
  writeFileSync(path, JSON.stringify(mem, null, 2) + '\n');
}

export function record(mem, runId, findings) {
  const next = { findings: mem.findings.map((x) => ({ ...x, runsSeen: x.runsSeen ? [...x.runsSeen] : [] })), runs: [...mem.runs] };
  const fps = [];
  for (const f of findings) {
    const fp = fingerprint(f);
    fps.push(fp);
    const existing = next.findings.find((x) => x.fingerprint === fp);
    if (existing) {
      existing.lastRun = runId;
      existing.status = existing.status === 'resolved' ? 'regressed' : 'open';
      if (!existing.runsSeen.includes(runId)) existing.runsSeen.push(runId);
    } else {
      next.findings.push({
        fingerprint: fp, title: f.title, type: f.type, severity: f.severity || 'unknown',
        status: 'open', firstRun: runId, lastRun: runId, runsSeen: [runId],
      });
    }
  }
  next.runs.push({ id: runId, findingFingerprints: fps });
  return next;
}

export function plan(mem) {
  return mem.findings.filter((f) => f.status === 'open' || f.status === 'regressed');
}

export function diff(mem, runId, currentFindings) {
  const present = new Set(currentFindings.map(fingerprint));
  const next = { findings: mem.findings.map((x) => ({ ...x })), runs: [...mem.runs] };
  for (const f of next.findings) {
    if (present.has(f.fingerprint)) {
      f.status = f.status === 'resolved' ? 'regressed' : 'open';
      f.lastRun = runId;
    } else if (f.status === 'open' || f.status === 'regressed') {
      f.status = 'resolved';
      f.lastRun = runId;
    }
  }
  return next;
}

function main() {
  const [cmd, memPath, runId, findingsFile] = process.argv.slice(2);
  if (!cmd || !memPath) { process.stderr.write('usage: regression.mjs <record|plan|diff> <memPath> [runId] [findingsFile]\n'); process.exit(2); }
  if ((cmd === 'record' || cmd === 'diff') && !runId) {
    process.stderr.write('usage: regression.mjs ' + cmd + ' <memPath> <runId> <findingsFile>\n');
    process.exit(2);
  }
  const mem = load(memPath);
  if (cmd === 'plan') { process.stdout.write(JSON.stringify(plan(mem), null, 2) + '\n'); return; }
  const findings = findingsFile ? JSON.parse(readFileSync(findingsFile, 'utf8')) : [];
  if (cmd === 'record') save(memPath, record(mem, runId, findings));
  else if (cmd === 'diff') save(memPath, diff(mem, runId, findings));
  else { process.stderr.write(`unknown command: ${cmd}\n`); process.exit(2); }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
