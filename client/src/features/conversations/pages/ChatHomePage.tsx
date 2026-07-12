import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import { MessagesPanel } from "../../messages/components/MessagesPanel";
import { NewConversationDialog } from "../../users/components/NewConversationDialog";
import { ConversationAvatar } from "../components/ConversationAvatar";
import { ConversationList } from "../components/ConversationList/index";
import type { Conversation } from "../conversations.schemas";
import { getConversationTitle } from "../conversations.utils";
import { useConversations } from "../useConversations";

import styles from "./ChatHomePage.module.css";
export function ChatHomePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const currentUserId = auth.user?.id ?? null;

  const selectedChatId = useMemo(() => {
    if (!params.chatId) return null;

    const parsedId = Number(params.chatId);
    return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  }, [params.chatId]);

  const {
    conversations,
    status,
    errorMessage,
    refresh,
    confirmConversationRead,
  } = useConversations({ selectedChatId, currentUserId });

  const [search, setSearch] = useState("");
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);

  const selectedConversation = useMemo(() => {
    if (!selectedChatId) return null;
    return (
      conversations.find(
        (conversation) => conversation.id === selectedChatId,
      ) ?? null
    );
  }, [conversations, selectedChatId]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedSearch) return conversations;

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

  const handleReadConfirmed = useCallback(
    (chatId: number) => {
      confirmConversationRead(chatId);
    },
    [confirmConversationRead],
  );

  async function handleConversationCreated(chatId: number) {
    await refresh();
    navigate(`/app/chat/${chatId}`);
  }

  function selectConversation(conversation: Conversation) {
    navigate(`/app/chat/${conversation.id}`);
  }

  const userName = auth.user?.nome ?? "Usuário";
  const hasConversations = conversations.length > 0;
  const isInitialLoading = status === "loading" && !hasConversations;
  const isInitialError = status === "error" && !hasConversations;
  const isSearching = Boolean(search.trim());

  return (
    <main
      className={`${styles.shell} ${
        selectedConversation ? styles.selected : ""
      }`}
    >
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <ConversationAvatar name={userName} src={auth.user?.avatarUrl} />

          <div className={styles.currentUser}>
            <strong>{userName}</strong>
            <span>{auth.user?.about ?? "Disponível"}</span>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.iconButton}
              type="button"
              title="Nova conversa"
              aria-label="Nova conversa"
              onClick={() => setIsNewConversationOpen(true)}
            >
              ＋
            </button>

            <button
              className={styles.iconButton}
              type="button"
              title="Atualizar conversas"
              aria-label="Atualizar conversas"
              disabled={status === "loading" || status === "refreshing"}
              onClick={() => void refresh()}
            >
              ↻
            </button>

            <button
              className={styles.iconButton}
              type="button"
              title="Sair"
              aria-label="Sair"
              onClick={auth.signOut}
            >
              ⎋
            </button>
          </div>
        </header>

        <div className={styles.search}>
          <label htmlFor="conversation-search">Buscar conversa</label>
          <input
            id="conversation-search"
            type="search"
            value={search}
            placeholder="Pesquisar conversas"
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <section className={styles.sidebarContent} aria-label="Conversas">
          {isInitialLoading ? (
            <div className={styles.state}>
              <strong>Carregando conversas</strong>
              <span>Aguarde um momento.</span>
            </div>
          ) : null}

          {isInitialError ? (
            <div className={styles.state}>
              <strong>Não foi possível carregar</strong>
              <span>
                {errorMessage ?? "Ocorreu um erro ao buscar as conversas."}
              </span>
              <button
                className={styles.retryButton}
                type="button"
                onClick={() => void refresh()}
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {!isInitialLoading && !isInitialError ? (
            <>
              {errorMessage ? (
                <div className={styles.refreshNotice} role="status">
                  {errorMessage} As conversas já carregadas foram mantidas.
                </div>
              ) : null}

              <ConversationList
                conversations={filteredConversations}
                selectedChatId={selectedChatId}
                onSelect={selectConversation}
                emptyTitle={
                  isSearching ? "Nenhum resultado" : "Nenhuma conversa"
                }
                emptyMessage={
                  isSearching
                    ? "Tente pesquisar outro nome ou trecho de mensagem."
                    : "Clique em “Nova conversa” para escolher com quem falar."
                }
              />
            </>
          ) : null}
        </section>
      </aside>

      <section className={styles.main}>
        {selectedConversation && currentUserId ? (
          <>
            <header className={styles.mainHeader}>
              <button
                className={styles.backButton}
                type="button"
                aria-label="Voltar para conversas"
                onClick={() => navigate("/app")}
              >
                ←
              </button>

              <ConversationAvatar
                name={getConversationTitle(selectedConversation)}
                src={selectedConversation.avatarUrl}
              />

              <div className={styles.contact}>
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
              onReadConfirmed={handleReadConfirmed}
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
          <div className={styles.placeholder}>
            <span className={styles.badge} aria-hidden="true">
              LG
            </span>
            <h1>LG Chat</h1>
            <p>
              {selectedChatId && status === "ready"
                ? "Essa conversa não foi encontrada ou você não possui mais acesso."
                : "Selecione uma conversa para visualizar e enviar mensagens."}
            </p>
          </div>
        )}
      </section>

      {isNewConversationOpen ? (
        <NewConversationDialog
          onClose={() => setIsNewConversationOpen(false)}
          onConversationCreated={handleConversationCreated}
        />
      ) : null}
    </main>
  );
}
