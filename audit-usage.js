// audit-usage.js
// Run: node audit-usage.js
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const EXTS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(p, files);
    } else {
      if (EXTS.has(path.extname(entry.name))) files.push(p);
    }
  }
  return files;
}

const files = walk(ROOT);

const tableRegex = /\.from\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const rpcRegex = /\.rpc\(\s*['"`]([^'"`]+)['"`]\s*/g;
const envRegex = /(process\.env\.[A-Z0-9_]+|import\.meta\.env\.[A-Z0-9_]+)/g;

const tables = new Map();   // table -> Set(files)
const rpcs = new Map();     // rpc -> Set(files)
const envs = new Map();     // env -> Set(files)

for (const f of files) {
  const txt = fs.readFileSync(f, "utf8");

  let m;
  while ((m = tableRegex.exec(txt))) {
    const t = m[1];
    if (!tables.has(t)) tables.set(t, new Set());
    tables.get(t).add(path.relative(ROOT, f));
  }
  while ((m = rpcRegex.exec(txt))) {
    const r = m[1];
    if (!rpcs.has(r)) rpcs.set(r, new Set());
    rpcs.get(r).add(path.relative(ROOT, f));
  }
  while ((m = envRegex.exec(txt))) {
    const e = m[1];
    if (!envs.has(e)) envs.set(e, new Set());
    envs.get(e).add(path.relative(ROOT, f));
  }
}

function printMap(title, map) {
  console.log("\n=== " + title + " ===");
  const keys = Array.from(map.keys()).sort();
  for (const k of keys) {
    const list = Array.from(map.get(k)).sort();
    console.log("\n- " + k);
    for (const f of list) console.log("  • " + f);
  }
}

printMap("Supabase Tables Used", tables);
printMap("Supabase RPC Used", rpcs);
printMap("ENV Vars Referenced", envs);

// API endpoints
const apiDir = path.join(ROOT, "api");
console.log("\n=== API Endpoints (/api) ===");
if (fs.existsSync(apiDir)) {
  const apiFiles = fs.readdirSync(apiDir).filter(x => x.endsWith(".js")).sort();
  for (const f of apiFiles) console.log("• /api/" + f);
} else {
  console.log("Kein /api Ordner gefunden.");
}
