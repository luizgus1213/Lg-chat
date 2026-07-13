import { z } from "zod";

const dateTimeSchema = z.string().datetime({ offset: true });
const nullableText = (maximumLength: number) =>
  z.string().max(maximumLength).nullable().optional().default(null);

export const STATUS_TEXT_COLORS = [
  "#00a884",
  "#075e54",
  "#2563eb",
  "#7c3aed",
  "#be185d",
  "#c2410c",
  "#374151",
] as const;

export const statusTextColorSchema = z.enum(STATUS_TEXT_COLORS);

export const statusUserSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  avatarUrl: nullableText(500),
  about: z.string().max(140).optional().default("Disponível"),
  isOnline: z.boolean().optional().default(false),
  lastSeenAt: dateTimeSchema.nullable().optional().default(null),
});

export const statusPostSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  type: z.enum(["text", "image", "video"]),
  text: nullableText(700),
  mediaUrl: nullableText(700),
  mediaMimeType: nullableText(120),
  mediaSize: z.number().int().nonnegative().nullable().optional().default(null),
  mediaOriginalName: nullableText(255),
  backgroundColor: nullableText(40),
  expiresAt: dateTimeSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  viewedByMe: z.boolean(),
  viewCount: z.number().int().nonnegative(),
  author: statusUserSchema.nullable(),
});

export const statusGroupSchema = z.object({
  user: statusUserSchema,
  statuses: z.array(statusPostSchema).min(1),
  hasUnseen: z.boolean(),
  lastCreatedAt: dateTimeSchema,
  isMine: z.boolean(),
});

export const statusGroupsSchema = z.array(statusGroupSchema);
export const myStatusGroupSchema = statusGroupSchema.nullable();

export const createTextStatusInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Digite algo para publicar no status.")
    .max(700, "O status pode ter no máximo 700 caracteres."),
  backgroundColor: statusTextColorSchema,
});

const STATUS_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const STATUS_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const STATUS_MEDIA_ACCEPT = [...STATUS_IMAGE_TYPES, ...STATUS_VIDEO_TYPES].join(",");

export const statusMediaInputSchema = z
  .object({
    file: z.instanceof(File, { error: "Escolha uma imagem ou um vídeo." }),
    text: z
      .string()
      .trim()
      .max(700, "A legenda pode ter no máximo 700 caracteres."),
  })
  .superRefine(({ file }, context) => {
    const isImage = STATUS_IMAGE_TYPES.some((type) => type === file.type);
    const isVideo = STATUS_VIDEO_TYPES.some((type) => type === file.type);

    if (!isImage && !isVideo) {
      context.addIssue({
        code: "custom",
        path: ["file"],
        message: "Use JPG, PNG, WEBP, GIF, MP4, WEBM ou MOV.",
      });
      return;
    }

    const maximumSize = isImage ? 8 * 1024 * 1024 : 30 * 1024 * 1024;
    if (file.size > maximumSize) {
      context.addIssue({
        code: "custom",
        path: ["file"],
        message: isImage
          ? "A imagem deve ter no máximo 8 MB."
          : "O vídeo deve ter no máximo 30 MB.",
      });
    }
  });

export const statusViewedResultSchema = z.discriminatedUnion("viewed", [
  z.object({
    viewed: z.literal(false),
    reason: z.literal("OWN_STATUS"),
  }),
  z.object({
    viewed: z.literal(true),
    viewedAt: dateTimeSchema,
  }),
]);

export const statusViewerSchema = z.object({
  id: z.number().int().positive(),
  viewedAt: dateTimeSchema,
  viewer: statusUserSchema.nullable(),
});

export const statusViewersSchema = z.array(statusViewerSchema);
export const deleteStatusResultSchema = z.object({ deleted: z.literal(true) });

export type StatusUser = z.infer<typeof statusUserSchema>;
export type StatusPost = z.infer<typeof statusPostSchema>;
export type StatusGroup = z.infer<typeof statusGroupSchema>;
export type StatusTextColor = z.infer<typeof statusTextColorSchema>;
export type CreateTextStatusInput = z.infer<typeof createTextStatusInputSchema>;
export type StatusMediaInput = z.infer<typeof statusMediaInputSchema>;
export type StatusViewedResult = z.infer<typeof statusViewedResultSchema>;
export type StatusViewer = z.infer<typeof statusViewerSchema>;
