import fs from "fs/promises";
import { resolveUploadUrlToPath } from "../config/uploadPaths";
import { logger } from "../utils/logger";
import { Op } from "sequelize";
import { AppError } from "../errors/AppError";
import { User } from "../models/User";

export function publicUser(user: User) {
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

function isLocalUserAvatar(avatarUrl?: string | null) {
  return Boolean(avatarUrl && avatarUrl.startsWith("/uploads/users/"));
}
async function removeOldUserAvatar(avatarUrl?: string | null) {
  if (!isLocalUserAvatar(avatarUrl)) {
    return;
  }

  const filePath = resolveUploadUrlToPath(avatarUrl!, "users");

  if (!filePath) {
    logger.warn(
      {
        avatarUrl,
      },
      "Caminho inválido ao tentar remover avatar antigo do usuário",
    );

    return;
  }

  await fs.unlink(filePath).catch(() => undefined);
}
export async function listUsers(currentUserId: number) {
  const users = await User.findAll({
    where: {
      id: {
        [Op.ne]: currentUserId,
      },
    },
    attributes: [
      "id",
      "nome",
      "email",
      "avatarUrl",
      "about",
      "isOnline",
      "lastSeenAt",
    ],
    order: [["nome", "ASC"]],
  });

  return users.map(publicUser);
}

export async function listUserDirectory(params: {
  currentUserId: number;
  query: string;
  page: number;
  limit: number;
}) {
  const search = params.query.trim();
  const where = {
    id: { [Op.ne]: params.currentUserId },
    ...(search
      ? {
          [Op.or]: [
            { nome: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {}),
  };
  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: [
      "id",
      "nome",
      "email",
      "avatarUrl",
      "about",
      "isOnline",
      "lastSeenAt",
    ],
    order: [
      ["nome", "ASC"],
      ["id", "ASC"],
    ],
    offset: (params.page - 1) * params.limit,
    limit: params.limit,
  });

  return {
    items: rows.map(publicUser),
    page: params.page,
    limit: params.limit,
    total: count,
    hasMore: params.page * params.limit < count,
  };
}

export async function getUserProfile(userId: number) {
  const user = await User.findByPk(userId, {
    attributes: [
      "id",
      "nome",
      "email",
      "avatarUrl",
      "about",
      "isOnline",
      "lastSeenAt",
    ],
  });

  if (!user) {
    throw new AppError(404, "Usuário não encontrado.", "USER_NOT_FOUND");
  }

  return publicUser(user);
}

export async function updateMyProfile(params: {
  currentUserId: number;
  nome?: string;
  about?: string | null;
}) {
  const user = await User.findByPk(params.currentUserId);

  if (!user) {
    throw new AppError(404, "Usuário não encontrado.", "USER_NOT_FOUND");
  }

  if (params.nome !== undefined) {
    user.nome = params.nome;
  }

  if (params.about !== undefined) {
    user.about = params.about?.trim() || "Disponível";
  }

  await user.save();

  return publicUser(user);
}

export async function updateMyAvatar(params: {
  currentUserId: number;
  avatarUrl: string;
}) {
  const user = await User.findByPk(params.currentUserId);

  if (!user) {
    throw new AppError(404, "Usuário não encontrado.", "USER_NOT_FOUND");
  }

  const oldAvatarUrl = user.avatarUrl;

  user.avatarUrl = params.avatarUrl;
  await user.save();

  await removeOldUserAvatar(oldAvatarUrl);

  return publicUser(user);
}

export async function setUserOnlineStatus(params: {
  userId: number;
  isOnline: boolean;
}) {
  const updates: {
    isOnline: boolean;
    lastSeenAt?: Date;
  } = {
    isOnline: params.isOnline,
  };

  if (!params.isOnline) {
    updates.lastSeenAt = new Date();
  }

  await User.update(updates, {
    where: {
      id: params.userId,
    },
  });

  return getUserProfile(params.userId);
}
