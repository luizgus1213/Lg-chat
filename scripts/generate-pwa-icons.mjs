import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const projectRoot = process.cwd();
const publicDirectory = path.join(projectRoot, "client", "public");
const sourceIcon = path.join(publicDirectory, "favicon.svg");

async function createSquareIcon({
  filename,
  size,
  iconScale = 0.72,
  background = "#080c14",
}) {
  const outputPath = path.join(publicDirectory, filename);
  const internalSize = Math.max(1, Math.round(size * iconScale));

  const resizedIcon = await sharp(sourceIcon)
    .resize(internalSize, internalSize, {
      fit: "contain",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: resizedIcon,
        gravity: "center",
      },
    ])
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toFile(outputPath);

  console.log(`Ícone criado: ${filename} (${size}x${size})`);
}

async function main() {
  await fs.access(sourceIcon);
  await fs.mkdir(publicDirectory, { recursive: true });

  await Promise.all([
    createSquareIcon({
      filename: "icon-192.png",
      size: 192,
      iconScale: 0.72,
    }),

    createSquareIcon({
      filename: "icon-512.png",
      size: 512,
      iconScale: 0.72,
    }),

    createSquareIcon({
      filename: "maskable-512.png",
      size: 512,
      iconScale: 0.6,
    }),

    createSquareIcon({
      filename: "apple-touch-icon.png",
      size: 180,
      iconScale: 0.72,
    }),

    createSquareIcon({
      filename: "badge-96.png",
      size: 96,
      iconScale: 0.7,
      background: "#00000000",
    }),
  ]);

  console.log("Todos os ícones PWA foram gerados com sucesso.");
}

main().catch((error) => {
  console.error("Erro ao gerar os ícones PWA:", error);
  process.exitCode = 1;
});
