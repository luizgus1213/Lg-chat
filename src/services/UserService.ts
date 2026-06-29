import fs from "fs/promises";
import path from "path";
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
  if (!isLocalUserAvatar(avatarUrl)) return;

  const relativePath = avatarUrl!.replace(/^\//, "");
  const filePath = path.resolve("public", relativePath.replace(/^public[\\/]/, ""));

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
