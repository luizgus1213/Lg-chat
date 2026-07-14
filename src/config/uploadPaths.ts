import fs from "node:fs/promises";
import path from "node:path";

import { AppError } from "../errors/AppError";
import { env } from "./env";

const uploadFolders = ["chat-media", "groups", "status", "users"] as const;

export type UploadFolder = (typeof uploadFolders)[number];

const root = path.resolve(env.UPLOAD_ROOT);

export const uploadPaths = Object.freeze({
  root,
  chatMedia: path.join(root, "chat-media"),
  groups: path.join(root, "groups"),
  status: path.join(root, "status"),
  users: path.join(root, "users"),
});

function isInsideUploadRoot(filePath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const relativePath = path.relative(uploadPaths.root, resolvedPath);

  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

export async function ensureUploadDirectories(): Promise<void> {
  await Promise.all([
    fs.mkdir(uploadPaths.root, { recursive: true }),
    fs.mkdir(uploadPaths.chatMedia, { recursive: true }),
    fs.mkdir(uploadPaths.groups, { recursive: true }),
    fs.mkdir(uploadPaths.status, { recursive: true }),
    fs.mkdir(uploadPaths.users, { recursive: true }),
  ]);
}

export function toUploadUrl(filePath: string): string {
  const resolvedPath = path.resolve(filePath);

  if (!isInsideUploadRoot(resolvedPath)) {
    throw new AppError(
      500,
      "O arquivo processado está fora do diretório permitido.",
      "INVALID_UPLOAD_PATH",
    );
  }

  const relativePath = path
    .relative(uploadPaths.root, resolvedPath)
    .replace(/\\/g, "/");

  return `/uploads/${relativePath}`;
}

export function resolveUploadUrlToPath(
  uploadUrl: string,
  expectedFolder: UploadFolder,
): string | null {
  const expectedPrefix = `/uploads/${expectedFolder}/`;

  if (
    typeof uploadUrl !== "string" ||
    !uploadUrl.startsWith(expectedPrefix) ||
    uploadUrl.includes("?") ||
    uploadUrl.includes("#") ||
    uploadUrl.includes("\0")
  ) {
    return null;
  }

  let decodedRelativePath: string;

  try {
    decodedRelativePath = decodeURIComponent(
      uploadUrl.slice("/uploads/".length),
    );
  } catch {
    return null;
  }

  const normalizedRelativePath = decodedRelativePath.replace(/\\/g, "/");
  const segments = normalizedRelativePath.split("/");

  if (
    segments.length < 2 ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    return null;
  }

  if (segments[0] !== expectedFolder) {
    return null;
  }

  const resolvedPath = path.resolve(uploadPaths.root, ...segments);

  if (!isInsideUploadRoot(resolvedPath)) {
    return null;
  }

  const expectedDirectory =
    expectedFolder === "chat-media"
      ? uploadPaths.chatMedia
      : uploadPaths[expectedFolder];

  const relativeToExpectedDirectory = path.relative(
    expectedDirectory,
    resolvedPath,
  );

  if (
    relativeToExpectedDirectory === "" ||
    relativeToExpectedDirectory === ".." ||
    relativeToExpectedDirectory.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToExpectedDirectory)
  ) {
    return null;
  }

  return resolvedPath;
}
