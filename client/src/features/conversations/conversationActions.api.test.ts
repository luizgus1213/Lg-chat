import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../../api/apiClient";
import {
  clearConversationForMe,
  deleteConversationForMe,
  updateConversationBlock,
  updateConversationPreferences,
} from "./conversationActions.api";

vi.mock("../../api/apiClient", () => ({
  apiRequest: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("contratos das ações de conversa", () => {
  it("arquiva e fixa usando uma atualização única de preferências", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      success: true,
      data: {
        chatId: 7,
        isPinned: false,
        isArchived: true,
        isMuted: false,
        pinnedAt: null,
        archivedAt: "2026-07-13T12:00:00.000Z",
        mutedUntil: null,
      },
    });

    await updateConversationPreferences(7, {
      isPinned: false,
      isArchived: true,
      isMuted: false,
      mutedUntil: null,
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/api/chats/7/preferences",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          isPinned: false,
          isArchived: true,
          isMuted: false,
          mutedUntil: null,
        }),
      }),
    );
  });

  it("bloqueia, limpa e exclui somente para o usuário autenticado", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        success: true,
        data: {
          chatId: 7,
          otherUserId: 9,
          block: { blockedByMe: true, blockedMe: false, isBlocked: true },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          cleared: true,
          chatId: 7,
          chatClearedAt: "2026-07-13T12:00:00.000Z",
          lastReadMessageId: 20,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          deletedForMe: true,
          chatId: 7,
          chatDeletedAt: "2026-07-13T12:01:00.000Z",
        },
      });

    await updateConversationBlock(7, true);
    await clearConversationForMe(7);
    await deleteConversationForMe(7);

    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      "/api/chats/7/block",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      "/api/chats/7/clear",
      expect.objectContaining({ method: "POST" }),
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      "/api/chats/7/delete-for-me",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
