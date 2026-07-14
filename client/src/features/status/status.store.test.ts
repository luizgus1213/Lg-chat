import { describe, expect, it } from "vitest";

import type { StatusGroup, StatusPost, StatusUser } from "./status.schemas";
import { addCreatedStatus, removeStatusFromGroups } from "./status.store";

const user: StatusUser = {
  id: 1,
  nome: "Pessoa",
  avatarUrl: null,
  about: "Disponível",
  isOnline: true,
  lastSeenAt: null,
};

function status(id: number, viewedByMe = false): StatusPost {
  return {
    id,
    userId: user.id,
    type: "text",
    text: `Status ${id}`,
    mediaUrl: null,
    mediaMimeType: null,
    mediaSize: null,
    mediaOriginalName: null,
    backgroundColor: "#00a884",
    expiresAt: "2026-07-14T12:00:00.000Z",
    createdAt: `2026-07-13T12:0${id}:00.000Z`,
    updatedAt: `2026-07-13T12:0${id}:00.000Z`,
    viewedByMe,
    viewCount: 0,
    author: user,
  };
}

function group(statuses: StatusPost[]): StatusGroup {
  return {
    user,
    statuses,
    hasUnseen: statuses.some((item) => !item.viewedByMe),
    lastCreatedAt: statuses.at(-1)?.createdAt ?? "2026-07-13T12:00:00.000Z",
    isMine: false,
  };
}

describe("store de status", () => {
  it("adiciona status próprio sem duplicar o id", () => {
    const result = addCreatedStatus(group([status(1)]), status(1), user);

    expect(result.statuses).toHaveLength(1);
    expect(result.statuses[0].viewedByMe).toBe(true);
    expect(result.isMine).toBe(true);
  });

  it("remove o grupo quando o último status é apagado", () => {
    expect(removeStatusFromGroups([group([status(1)])], 1)).toEqual([]);
  });

  it("recalcula indicador de não vistos após uma exclusão", () => {
    const result = removeStatusFromGroups(
      [group([status(1, false), status(2, true)])],
      1,
    );

    expect(result[0].hasUnseen).toBe(false);
    expect(result[0].lastCreatedAt).toBe(status(2, true).createdAt);
  });
});
