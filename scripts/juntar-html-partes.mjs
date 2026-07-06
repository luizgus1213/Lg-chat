import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const groups = [
  {
    folder: "public/features/sidebar/partes-html",
    output: "public/features/sidebar/sidebar.html",
  },
  {
    folder: "public/features/chat-main/partes-html",
    output: "public/features/chat-main/chat-main.html",
  },
  {
    folder: "public/features/info-panel/partes-html",
    output: "public/features/info-panel/info-panel.html",
  },
];

for (const group of groups) {
  const folderPath = path.join(ROOT, group.folder);

  if (!fs.existsSync(folderPath)) {
    console.warn(`Pasta não encontrada: ${group.folder}`);
    continue;
  }

  const files = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".html"))
    .sort();

  const html = files
    .map((file) => fs.readFileSync(path.join(folderPath, file), "utf8").trim())
    .join("\n\n");

  fs.writeFileSync(path.join(ROOT, group.output), `${html}\n`, "utf8");
  console.log(`Gerado: ${group.output}`);
}
