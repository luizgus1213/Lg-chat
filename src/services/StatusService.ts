import fs from "fs/promises";
import path from "path";
import { Op } from "sequelize";
import { AppError } from "../errors/AppError";
import { ChatMember } from "../models/ChatMember";
import { StatusPost, type StatusPostType } from "../models/StatusPost";
import { StatusView } from "../models/StatusView";
import { User } from "../models/User";
import { UserBlock } from "../models/UserBlock";
import { logger } from "../utils/logger";

const STATUS_TTL_HOURS = 24;

function publicUserDTO(user: User) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    about: user.about ?? "Disponível",
    isOnline: Boolean(user.isOnline),
    lastSeenAt: user.lastSeenAt ?? null,
  };
}

function getExpiresAt() {
  const expiresAt = new Date();

  expiresAt.setHours(expiresAt.getHours() + STATUS_TTL_HOURS);

  return expiresAt;
}

function getStatusPostType(mimeType: string): Exclude<StatusPostType, "text"> {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";

  throw new AppError(
    400,
    "Formato inválido. Publique imagem ou vídeo em formato permitido.",
    "INVALID_STATUS_MEDIA_FORMAT",
  );
}

function isLocalStatusMedia(mediaUrl?: string | null) {
  return Boolean(mediaUrl && mediaUrl.startsWith("/uploads/status/"));
}

async function removeStatusMedia(mediaUrl?: string | null) {
  if (!isLocalStatusMedia(mediaUrl)) return;

  const relativePath = mediaUrl!.replace(/^\//, "");
  const filePath = path.resolve("public", relativePath.replace(/^public[\\/]/, ""));

  await fs.unlink(filePath).catch(() => undefined);
}

async function getAllowedStatusUserIds(currentUserId: number) {
  const memberships = await ChatMember.findAll({
    where: {
      userId: currentUserId,
      leftAt: null,
    },
    attributes: ["chatId"],
  });

  const chatIds = Array.from(
    new Set(
      memberships
        .map((membership) => membership.chatId)
        .filter((chatId) => Number.isInteger(chatId) && chatId > 0),
    ),
  );

  const candidateIds = new Set<number>([currentUserId]);

  if (chatIds.length) {
    const members = await ChatMember.findAll({
      where: {
        chatId: {
          [Op.in]: chatIds,
        },
        leftAt: null,
      },
      attributes: ["userId"],
    });

    for (const member of members) {
      if (Number.isInteger(member.userId) && member.userId > 0) {
        candidateIds.add(member.userId);
      }
    }
  }

  const ids = Array.from(candidateIds);

  if (ids.length <= 1) {
    return ids;
  }

  const blocks = await UserBlock.findAll({
    where: {
      [Op.or]: [
        {
          blockerId: currentUserId,
          blockedId: {
            [Op.in]: ids,
          },
        },
        {
          blockerId: {
            [Op.in]: ids,
          },
          blockedId: currentUserId,
        },
      ],
    },
    attributes: ["blockerId", "blockedId"],
  });

  for (const block of blocks) {
    const otherUserId =
      block.blockerId === currentUserId ? block.blockedId : block.blockerId;

    if (otherUserId !== currentUserId) {
      candidateIds.delete(otherUserId);
    }
  }

  return Array.from(candidateIds);
}

function statusDTO(params: {
  status: StatusPost;
  currentUserId: number;
  viewedStatusIds: Set<number>;
  viewCountMap: Map<number, number>;
}) {
  const author = params.status.get("author") as User | undefined;

  return {
    id: params.status.id,
    userId: params.status.userId,
    type: params.status.type,
    text: params.status.text,
    mediaUrl: params.status.mediaUrl ?? null,
    mediaMimeType: params.status.mediaMimeType ?? null,
    mediaSize: params.status.mediaSize ?? null,
    mediaOriginalName: params.status.mediaOriginalName ?? null,
    backgroundColor: params.status.backgroundColor ?? null,
    expiresAt: params.status.expiresAt,
    createdAt: params.status.createdAt,
    updatedAt: params.status.updatedAt,
    viewedByMe:
      params.status.userId === params.currentUserId ||
      params.viewedStatusIds.has(params.status.id),
    viewCount: params.viewCountMap.get(params.status.id) ?? 0,
    author: author ? publicUserDTO(author) : null,
  };
}

function groupStatusDTOs(statuses: ReturnType<typeof statusDTO>[], currentUserId: number) {
  const map = new Map<
    number,
    {
      user: NonNullable<ReturnType<typeof statusDTO>["author"]>;
      statuses: ReturnType<typeof statusDTO>[];
      hasUnseen: boolean;
      lastCreatedAt: Date;
      isMine: boolean;
    }
  >();

  for (const status of statuses) {
    if (!status.author) continue;

    const current = map.get(status.userId) ?? {
      user: status.author,
      statuses: [],
      hasUnseen: false,
      lastCreatedAt: status.createdAt,
      isMine: status.userId === currentUserId,
    };

    current.statuses.push(status);

    if (!status.viewedByMe && status.userId !== currentUserId) {
      current.hasUnseen = true;
    }

    if (new Date(status.createdAt).getTime() > new Date(current.lastCreatedAt).getTime()) {
      current.lastCreatedAt = status.createdAt;
    }

    map.set(status.userId, current);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isMine && !b.isMine) return -1;
    if (!a.isMine && b.isMine) return 1;
    if (a.hasUnseen && !b.hasUnseen) return -1;
    if (!a.hasUnseen && b.hasUnseen) return 1;

    return new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime();
  });
}

async function getStatusExtras(statusIds: number[], currentUserId: number) {
  if (!statusIds.length) {
    return {
      viewedStatusIds: new Set<number>(),
      viewCountMap: new Map<number, number>(),
    };
  }

  const [myViews, allViews] = await Promise.all([
    StatusView.findAll({
      where: {
        viewerId: currentUserId,
        statusPostId: {
          [Op.in]: statusIds,
        },
      },
      attributes: ["statusPostId"],
    }),

    StatusView.findAll({
      where: {
        statusPostId: {
          [Op.in]: statusIds,
        },
      },
      attributes: ["statusPostId"],
    }),
  ]);

  const viewedStatusIds = new Set(myViews.map((view) => view.statusPostId));
  const viewCountMap = new Map<number, number>();

  for (const view of allViews) {
    viewCountMap.set(view.statusPostId, (viewCountMap.get(view.statusPostId) ?? 0) + 1);
  }

  return {
    viewedStatusIds,
    viewCountMap,
  };
}

export async function listVisibleStatuses(currentUserId: number) {
  const allowedUserIds = await getAllowedStatusUserIds(currentUserId);

  const statuses = await StatusPost.findAll({
    where: {
      userId: {
        [Op.in]: allowedUserIds,
      },
      expiresAt: {
        [Op.gt]: new Date(),
      },
    },
    include: [
      {
        model: User,
        as: "author",
        attributes: [
          "id",
          "nome",
          "email",
          "avatarUrl",
          "about",
          "isOnline",
          "lastSeenAt",
        ],
      },
    ],
    order: [["createdAt", "ASC"]],
  });

  const statusIds = statuses.map((status) => status.id);
  const extras = await getStatusExtras(statusIds, currentUserId);

  const dtos = statuses.map((status) =>
    statusDTO({
      status,
      currentUserId,
      viewedStatusIds: extras.viewedStatusIds,
      viewCountMap: extras.viewCountMap,
    }),
  );

  return groupStatusDTOs(dtos, currentUserId);
}

export async function listMyStatuses(currentUserId: number) {
  const statuses = await StatusPost.findAll({
    where: {
      userId: currentUserId,
      expiresAt: {
        [Op.gt]: new Date(),
      },
    },
    include: [
      {
        model: User,
        as: "author",
        attributes: [
          "id",
          "nome",
          "email",
          "avatarUrl",
          "about",
          "isOnline",
          "lastSeenAt",
        ],
      },
    ],
    order: [["createdAt", "ASC"]],
  });

  const statusIds = statuses.map((status) => status.id);
  const extras = await getStatusExtras(statusIds, currentUserId);

  const dtos = statuses.map((status) =>
    statusDTO({
      status,
      currentUserId,
      viewedStatusIds: extras.viewedStatusIds,
      viewCountMap: extras.viewCountMap,
    }),
  );

  return groupStatusDTOs(dtos, currentUserId)[0] ?? null;
}

export async function createTextStatus(params: {
  currentUserId: number;
  text: string;
  backgroundColor?: string | null;
}) {
  const status = await StatusPost.create({
    userId: params.currentUserId,
    type: "text",
    text: params.text.trim(),
    backgroundColor: params.backgroundColor || "#00a884",
    expiresAt: getExpiresAt(),
  });

  logger.info(
    {
      statusId: status.id,
      userId: params.currentUserId,
      type: status.type,
    },
    "Status de texto criado",
  );

  return statusDTO({
    status,
    currentUserId: params.currentUserId,
    viewedStatusIds: new Set<number>(),
    viewCountMap: new Map<number, number>(),
  });
}

export async function createMediaStatus(params: {
  currentUserId: number;
  text?: string | null;
  file: Express.Multer.File;
}) {
  const mediaUrl = `/uploads/status/${params.file.filename}`;
  const type = getStatusPostType(params.file.mimetype);

  const status = await StatusPost.create({
    userId: params.currentUserId,
    type,
    text: params.text?.trim() || null,
    mediaUrl,
    mediaMimeType: params.file.mimetype,
    mediaSize: params.file.size,
    mediaOriginalName: params.file.originalname,
    expiresAt: getExpiresAt(),
  });

  logger.info(
    {
      statusId: status.id,
      userId: params.currentUserId,
      type: status.type,
      mediaMimeType: params.file.mimetype,
    },
    "Status de mídia criado",
  );

  return statusDTO({
    status,
    currentUserId: params.currentUserId,
    viewedStatusIds: new Set<number>(),
    viewCountMap: new Map<number, number>(),
  });
}

async function assertCanAccessStatus(status: StatusPost, currentUserId: number) {
  if (status.expiresAt.getTime() <= Date.now()) {
    throw new AppError(404, "Status expirado ou não encontrado.", "STATUS_EXPIRED");
  }

  if (status.userId === currentUserId) {
    return;
  }

  const allowedUserIds = await getAllowedStatusUserIds(currentUserId);

  if (!allowedUserIds.includes(status.userId)) {
    throw new AppError(
      403,
      "Você não tem permissão para ver esse status.",
      "STATUS_ACCESS_DENIED",
    );
  }
}

export async function markStatusAsViewed(params: {
  currentUserId: number;
  statusId: number;
}) {
  const status = await StatusPost.findByPk(params.statusId);

  if (!status) {
    throw new AppError(404, "Status não encontrado.", "STATUS_NOT_FOUND");
  }

  await assertCanAccessStatus(status, params.currentUserId);

  if (status.userId === params.currentUserId) {
    return {
      viewed: false,
      reason: "OWN_STATUS",
    };
  }

  const [view] = await StatusView.findOrCreate({
    where: {
      statusPostId: status.id,
      viewerId: params.currentUserId,
    },
    defaults: {
      statusPostId: status.id,
      viewerId: params.currentUserId,
      viewedAt: new Date(),
    },
  });

  return {
    viewed: true,
    viewedAt: view.viewedAt,
  };
}

export async function listStatusViews(params: {
  currentUserId: number;
  statusId: number;
}) {
  const status = await StatusPost.findByPk(params.statusId);

  if (!status) {
    throw new AppError(404, "Status não encontrado.", "STATUS_NOT_FOUND");
  }

  if (status.userId !== params.currentUserId) {
    throw new AppError(
      403,
      "Você só pode ver as visualizações do seu próprio status.",
      "STATUS_VIEWERS_DENIED",
    );
  }

  const views = await StatusView.findAll({
    where: {
      statusPostId: status.id,
    },
    include: [
      {
        model: User,
        as: "viewer",
        attributes: [
          "id",
          "nome",
          "email",
          "avatarUrl",
          "about",
          "isOnline",
          "lastSeenAt",
        ],
      },
    ],
    order: [["viewedAt", "DESC"]],
  });

  return views.map((view) => {
    const viewer = view.get("viewer") as User | undefined;

    return {
      id: view.id,
      viewedAt: view.viewedAt,
      viewer: viewer ? publicUserDTO(viewer) : null,
    };
  });
}

export async function deleteStatus(params: {
  currentUserId: number;
  statusId: number;
}) {
  const status = await StatusPost.findByPk(params.statusId);

  if (!status) {
    throw new AppError(404, "Status não encontrado.", "STATUS_NOT_FOUND");
  }

  if (status.userId !== params.currentUserId) {
    throw new AppError(
      403,
      "Você só pode apagar seu próprio status.",
      "STATUS_DELETE_DENIED",
    );
  }

  const mediaUrl = status.mediaUrl;

  await status.destroy();
  await removeStatusMedia(mediaUrl);

  logger.info(
    {
      statusId: params.statusId,
      userId: params.currentUserId,
    },
    "Status apagado",
  );

  return {
    deleted: true,
  };
}
