#!/usr/bin/env node
// Lightweight secret scanner over git-tracked (and untracked, non-ignored) files.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const PATTERNS = [
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['Azure storage key', /AccountKey=[A-Za-z0-9+/=]{40,}/],
  ['Connection string with password', /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/'"<>$]+:(?!\$|<|\{|PLACEHOLDER|password|changeme|postgres)[^\s@/'"<>$]{6,}@/i],
  ['Hard-coded JWT secret', /JWT_SECRET\s*[:=]\s*['"]?(?!<|\$|\{|PLACEHOLDER|test|insecure|e2e|dev|\s|['"]|$)[A-Za-z0-9+/=_-]{32,}/],
  ['JWT bearer token', /Bearer\s+eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/]
];
const SKIP = /(^|\/)(package-lock\.json|docs\/openapi\.json|docs\/design\/.*|.*\.(jpg|png|svg|ico|woff2?))$|tests\/security\/scan-secrets\.mjs$/;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => !SKIP.test(file));

const findings = [];
for (const file of files) {
  let text;
  try {
    if (!statSync(file).isFile()) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, index) => {
    for (const [name, pattern] of PATTERNS) {
      if (pattern.test(line)) findings.push(`${file}:${index + 1}: ${name}`);
    }
  });
}

if (findings.length > 0) {
  console.error('Potential secrets found:\n' + findings.join('\n'));
  process.exit(1);
}
console.log(`Secret scan clean (${files.length} files checked)`);
