import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { NewConversationDialog } from "../../users/components/NewConversationDialog";

import { useAuth } from "../../auth/useAuth";
import { MessagesPanel } from "../../messages/components/MessagesPanel";

import { ConversationAvatar } from "../components/ConversationAvatar";
import { ConversationList } from "../components/ConversationList";

import { getConversationTitle } from "../conversations.utils";
import { useConversations } from "../useConversations";

import type { Conversation } from "../conversations.schemas";

export function ChatHomePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  const currentUserId = auth.user?.id ?? null;

  const selectedChatId = useMemo(() => {
    if (!params.chatId) {
      return null;
    }

    const parsedId = Number(params.chatId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return null;
    }

    return parsedId;
  }, [params.chatId]);

  const {
    conversations,
    status,
    errorMessage,
    refresh,
    markConversationAsReadLocally,
  } = useConversations({
    selectedChatId,
    currentUserId,
  });

  const [search, setSearch] = useState("");
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);

  const selectedConversation = useMemo(() => {
    if (!selectedChatId) {
      return null;
    }

    return (
      conversations.find(
        (conversation) => conversation.id === selectedChatId,
      ) ?? null
    );
  }, [conversations, selectedChatId]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedSearch) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const title =
        getConversationTitle(conversation).toLocaleLowerCase("pt-BR");

      const lastMessage =
        conversation.lastMessage?.text?.toLocaleLowerCase("pt-BR") ?? "";

      return (
        title.includes(normalizedSearch) ||
        lastMessage.includes(normalizedSearch)
      );
    });
  }, [conversations, search]);
  async function handleConversationCreated(chatId: number) {
    await refresh();

    navigate(`/app/chat/${chatId}`);
  }
  function selectConversation(conversation: Conversation) {
    markConversationAsReadLocally(conversation.id);

    navigate(`/app/chat/${conversation.id}`);
  }
  const userName = auth.user?.nome ?? "Usuário";

  return (
    <main
      className={[
        "chat-shell",
        selectedConversation ? "chat-shell-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <aside className="chat-sidebar">
        <header className="chat-sidebar-header">
          <ConversationAvatar name={userName} src={auth.user?.avatarUrl} />

          <div className="chat-current-user">
            <strong>{userName}</strong>

            <span>{auth.user?.about ?? "Disponível"}</span>
          </div>

          <div className="chat-sidebar-actions">
            <button
              type="button"
              title="Nova conversa"
              aria-label="Nova conversa"
              onClick={() => {
                setIsNewConversationOpen(true);
              }}
            >
              ＋
            </button>
            <button
              type="button"
              title="Atualizar conversas"
              aria-label="Atualizar conversas"
              disabled={status === "loading"}
              onClick={() => {
                void refresh();
              }}
            >
              ↻
            </button>

            <button
              type="button"
              title="Sair"
              aria-label="Sair"
              onClick={auth.signOut}
            >
              ⎋
            </button>
          </div>
        </header>

        <div className="chat-search">
          <label htmlFor="conversation-search">Buscar conversa</label>

          <input
            id="conversation-search"
            type="search"
            value={search}
            placeholder="Pesquisar..."
            autoComplete="off"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
        </div>

        <section
          className="chat-sidebar-content"
          aria-label="Lista de conversas"
        >
          {status === "loading" && conversations.length === 0 ? (
            <div className="conversation-list-status">
              <strong>Carregando conversas</strong>

              <span>Aguarde um momento.</span>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="conversation-list-status">
              <strong>Não foi possível carregar</strong>

              <span>
                {errorMessage ?? "Ocorreu um erro ao buscar as conversas."}
              </span>

              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  void refresh();
                }}
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {status !== "error" ? (
            <ConversationList
              conversations={filteredConversations}
              selectedChatId={selectedChatId}
              onSelect={selectConversation}
            />
          ) : null}
        </section>
      </aside>

      <section className="chat-main">
        {selectedConversation && currentUserId ? (
          <>
            <header className="chat-main-header">
              <button
                className="chat-back-button"
                type="button"
                aria-label="Voltar para conversas"
                onClick={() => {
                  navigate("/app");
                }}
              >
                ←
              </button>

              <ConversationAvatar
                name={getConversationTitle(selectedConversation)}
                src={selectedConversation.avatarUrl}
              />

              <div className="chat-main-contact">
                <strong>{getConversationTitle(selectedConversation)}</strong>

                <span>
                  {selectedConversation.type === "group"
                    ? "Grupo"
                    : selectedConversation.privateUser?.isOnline
                      ? "Online"
                      : (selectedConversation.privateUser?.about ?? "Offline")}
                </span>
              </div>
            </header>

            <MessagesPanel
              key={selectedConversation.id}
              chatId={selectedConversation.id}
              currentUserId={currentUserId}
              disabledReason={
                selectedConversation.block?.blockedByMe
                  ? "Você bloqueou este contato."
                  : selectedConversation.block?.blockedMe
                    ? "Este contato não pode receber suas mensagens."
                    : null
              }
            />
          </>
        ) : (
          <div className="chat-main-placeholder">
            <span className="brand-badge">LG</span>

            <h1>LG Chat</h1>

            <p>Selecione uma conversa para visualizar e enviar mensagens.</p>
          </div>
        )}
      </section>
      {isNewConversationOpen ? (
        <NewConversationDialog
          onClose={() => {
            setIsNewConversationOpen(false);
          }}
          onConversationCreated={handleConversationCreated}
        />
      ) : null}
    </main>
  );
}
