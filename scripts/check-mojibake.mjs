import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src', 'api', 'public', 'supabase', 'scripts'];
const FILE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.html',
  '.css',
  '.json',
  '.md',
  '.sql',
]);

const SUSPICIOUS_PATTERNS = [
  /\u00C3[\u0080-\u00BF]/u,
  /\u00C2[\u0080-\u00BF]/u,
  /\u00E2\u20AC[\u0098-\u009D\u00A6\u0093\u0094\u00A0-\u00A2\u00B9\u00BA]/u,
];

const ALLOWLIST = [
  /\bÂge\b/u,
];

const findings = [];

function shouldScan(filePath) {
  return FILE_EXTENSIONS.has(path.extname(filePath));
}

function isAllowed(line) {
  return ALLOWLIST.some((pattern) => pattern.test(line));
}

function hasSuspiciousText(line) {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(line));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (!hasSuspiciousText(line) || isAllowed(line)) {
      return;
    }

    findings.push({
      filePath,
      lineNumber: index + 1,
      line: line.trim(),
    });
  });
}

function walk(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (shouldScan(fullPath)) {
      scanFile(fullPath);
    }
  }
}

for (const dir of SCAN_DIRS) {
  walk(path.join(ROOT, dir));
}

if (findings.length > 0) {
  console.error('Potential mojibake detected:');

  for (const finding of findings) {
    const relativePath = path.relative(ROOT, finding.filePath);
    console.error(`${relativePath}:${finding.lineNumber}: ${finding.line}`);
  }

  process.exit(1);
}

console.log('No mojibake patterns detected.');
