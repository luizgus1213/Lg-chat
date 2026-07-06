import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAX_LINES = 150;
const TARGETS = ["public/css", "public/features"];
const EXTENSIONS = new Set([".css", ".html"]);

const violations = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!EXTENSIONS.has(path.extname(item.name))) continue;

    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/).length;

    if (lines > MAX_LINES) {
      violations.push({
        arquivo: path.relative(ROOT, fullPath),
        linhas: lines,
      });
    }
  }
}

for (const target of TARGETS) {
  walk(path.join(ROOT, target));
}

if (violations.length) {
  console.error("Arquivos acima de 150 linhas:");
  console.table(violations);
  process.exit(1);
}

console.log("OK: CSS e HTML de manutenção estão dentro do limite de 150 linhas.");
