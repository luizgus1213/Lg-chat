import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { Modal } from "../../../components/Modal";
import { useCalls } from "../../calls";
import { useAuth } from "../../auth/useAuth";
import { GroupInfoDialog } from "../../groups/GroupInfoDialog";
import { NewGroupDialog } from "../../groups/NewGroupDialog";
import { MessagesPanel } from "../../messages/components/MessagesPanel";
import { StarredMessagesPage } from "../../messages/components/StarredMessagesPage";
import type { ServerChatMessage } from "../../messages/messages.schemas";
import { NotificationSettingsDialog } from "../../notifications/NotificationSettingsDialog";
import { useNotifications } from "../../notifications/useNotifications";
import { ProfileDialog } from "../../profile/ProfileDialog";
import { StatusPage } from "../../status";
import { NewConversationDialog } from "../../users/components/NewConversationDialog";
import { ArchivedConversationsPage } from "../components/ArchivedConversationsPage";
import { ConversationAvatar } from "../components/ConversationAvatar";
import {
  ConversationOptionsDialog,
  type ConversationAction,
} from "../components/ConversationOptionsDialog";
import { ConversationList } from "../components/ConversationList";
import { updateConversationPreferences } from "../conversationActions.api";
import type { Conversation } from "../conversations.schemas";
import { getConversationTitle } from "../conversations.utils";
import { useConversations } from "../useConversations";

import styles from "./ChatHomePage.module.css";

type Section = "conversations" | "status" | "starred" | "archived";

function getSection(pathname: string): Section {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/app/status") return "status";
  if (normalizedPath === "/app/starred") return "starred";
  if (normalizedPath === "/app/archived") return "archived";
  return "conversations";
}

export function ChatHomePage() {
  const auth = useAuth();
  const calls = useCalls();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const currentUserId = auth.user?.id ?? null;
  const section = getSection(location.pathname);
  const navigationState = location.state as { focusedMessage?: ServerChatMessage } | null;

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
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [messageSearchChatId, setMessageSearchChatId] = useState<number | null>(null);
  const [optionsChatId, setOptionsChatId] = useState<number | null>(null);
  const [groupInfoChatId, setGroupInfoChatId] = useState<number | null>(null);
  const [messagePanelVersion, setMessagePanelVersion] = useState(0);
  const [activeChatAtBottom, setActiveChatAtBottom] = useState(false);

  const selectedConversation = useMemo(() => {
    if (!selectedChatId) return null;
    return conversations.find((conversation) => conversation.id === selectedChatId) ?? null;
  }, [conversations, selectedChatId]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedSearch) return conversations;
    return conversations.filter((conversation) => {
      const title = getConversationTitle(conversation).toLocaleLowerCase("pt-BR");
      const lastMessage = conversation.lastMessage?.text?.toLocaleLowerCase("pt-BR") ?? "";
      return title.includes(normalizedSearch) || lastMessage.includes(normalizedSearch);
    });
  }, [conversations, search]);

  const notifications = useNotifications({
    currentUserId: currentUserId ?? 0,
    activeChatId: selectedChatId,
    activeChatAtBottom,
    conversations,
  });

  const handleReadConfirmed = useCallback(
    (chatId: number, messageId: number) => confirmConversationRead(chatId, messageId),
    [confirmConversationRead],
  );

  async function handleConversationCreated(chatId: number) {
    await refresh();
    setActiveChatAtBottom(false);
    setMessageSearchChatId(null);
    setOptionsChatId(null);
    setGroupInfoChatId(null);
    navigate(`/app/chat/${chatId}`);
  }

  function selectConversation(conversation: Conversation) {
    setActiveChatAtBottom(false);
    setMessageSearchChatId(null);
    setOptionsChatId(null);
    setGroupInfoChatId(null);
    navigate(`/app/chat/${conversation.id}`);
  }

  function closeConversationPanels() {
    setMessageSearchChatId(null);
    setOptionsChatId(null);
    setGroupInfoChatId(null);
  }

  async function handleConversationAction(action: ConversationAction) {
    if (action === "clear") setMessagePanelVersion((current) => current + 1);
    await refresh();
    if (action === "archive" || action === "delete") navigate("/app");
  }

  async function restoreArchivedConversation(conversation: Conversation) {
    await updateConversationPreferences(conversation.id, {
      isPinned: conversation.isPinned,
      isArchived: false,
      isMuted: conversation.isMuted,
      mutedUntil: conversation.mutedUntil,
    });
    await refresh();
    navigate(`/app/chat/${conversation.id}`);
  }

  const userName = auth.user?.nome ?? "Usuário";
  const hasConversations = conversations.length > 0;
  const isInitialLoading = status === "loading" && !hasConversations;
  const isInitialError = status === "error" && !hasConversations;
  const isSearching = Boolean(search.trim());
  const showMainOnMobile = Boolean(selectedConversation) || section !== "conversations";

  function closeMoreAnd(action: () => void) {
    setIsMoreOpen(false);
    action();
  }

  return (
    <main className={`${styles.shell} ${showMainOnMobile ? styles.selected : ""}`}>
      <nav className={styles.navigation} aria-label="Navegação principal">
        <Link className={section === "conversations" ? styles.navActive : ""} to="/app" aria-label="Conversas" title="Conversas" onClick={closeConversationPanels}>
          <span aria-hidden="true">◫</span><small>Conversas</small>
        </Link>
        <Link className={section === "status" ? styles.navActive : ""} to="/app/status" aria-label="Status" title="Status" onClick={closeConversationPanels}>
          <span aria-hidden="true">◉</span><small>Status</small>
        </Link>
        <button type="button" aria-label="Nova conversa" title="Nova conversa" onClick={() => setIsNewConversationOpen(true)}>
          <span aria-hidden="true">＋</span><small>Conversa</small>
        </button>
        <button type="button" aria-label="Novo grupo" title="Novo grupo" onClick={() => setIsNewGroupOpen(true)}>
          <span aria-hidden="true">♟</span><small>Grupo</small>
        </button>
        <Link className={`${styles.desktopOnly} ${section === "starred" ? styles.navActive : ""}`} to="/app/starred" aria-label="Mensagens favoritas" title="Mensagens favoritas" onClick={closeConversationPanels}>
          <span aria-hidden="true">★</span><small>Favoritas</small>
        </Link>
        <Link className={`${styles.desktopOnly} ${section === "archived" ? styles.navActive : ""}`} to="/app/archived" aria-label="Conversas arquivadas" title="Conversas arquivadas" onClick={closeConversationPanels}>
          <span aria-hidden="true">▣</span><small>Arquivadas</small>
        </Link>
        <button className={styles.desktopOnly} type="button" aria-label="Meu perfil" title="Meu perfil" onClick={() => setIsProfileOpen(true)}>
          <span aria-hidden="true">●</span><small>Perfil</small>
        </button>
        <button className={styles.desktopOnly} type="button" aria-label="Notificações" title="Notificações" onClick={() => setIsNotificationsOpen(true)}>
          <span aria-hidden="true">♬</span><small>Alertas</small>
        </button>
        <button className={styles.desktopOnly} type="button" aria-label="Sair" title="Sair" onClick={auth.signOut}>
          <span aria-hidden="true">↪</span><small>Sair</small>
        </button>
        <button className={styles.mobileMore} type="button" aria-label="Mais opções" title="Mais opções" onClick={() => setIsMoreOpen(true)}>
          <span aria-hidden="true">•••</span><small>Mais</small>
        </button>
      </nav>

      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <button className={styles.avatarButton} type="button" aria-label="Abrir meu perfil" onClick={() => setIsProfileOpen(true)}>
            <ConversationAvatar name={userName} src={auth.user?.avatarUrl} />
          </button>
          <div className={styles.currentUser}>
            <strong>{userName}</strong>
            <span>{auth.user?.about ?? "Disponível"}</span>
          </div>
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
        </header>

        <div className={styles.search}>
          <label htmlFor="conversation-search">Buscar conversa</label>
          <input id="conversation-search" type="search" value={search} placeholder="Pesquisar conversas" autoComplete="off" onChange={(event) => setSearch(event.target.value)} />
        </div>

        <section className={styles.sidebarContent} aria-label="Conversas">
          {isInitialLoading ? <div className={styles.state}><strong>Carregando conversas</strong><span>Aguarde um momento.</span></div> : null}
          {isInitialError ? (
            <div className={styles.state}>
              <strong>Não foi possível carregar</strong>
              <span>{errorMessage ?? "Ocorreu um erro ao buscar as conversas."}</span>
              <button className={styles.retryButton} type="button" onClick={() => void refresh()}>Tentar novamente</button>
            </div>
          ) : null}
          {!isInitialLoading && !isInitialError ? (
            <>
              {errorMessage ? <div className={styles.refreshNotice} role="status">{errorMessage} As conversas já carregadas foram mantidas.</div> : null}
              <ConversationList
                conversations={filteredConversations}
                selectedChatId={selectedChatId}
                onSelect={selectConversation}
                emptyTitle={isSearching ? "Nenhum resultado" : "Nenhuma conversa"}
                emptyMessage={isSearching ? "Tente pesquisar outro nome ou trecho de mensagem." : "Use Nova conversa ou Novo grupo para começar."}
              />
            </>
          ) : null}
        </section>
      </aside>

      <section className={styles.main}>
        {section === "status" && auth.user ? <StatusPage currentUser={auth.user} onBack={() => { closeConversationPanels(); navigate("/app"); }} /> : null}

        {section === "starred" && currentUserId ? (
          <StarredMessagesPage
            conversations={conversations}
            currentUserId={currentUserId}
            onOpen={({ conversation, message }) =>
              navigate(`/app/chat/${conversation.id}`, {
                state: { focusedMessage: message },
              })
            }
          />
        ) : null}

        {section === "archived" ? <ArchivedConversationsPage onOpen={(conversation) => void restoreArchivedConversation(conversation)} /> : null}

        {section === "conversations" && selectedConversation && currentUserId ? (
          <>
            <header className={styles.mainHeader}>
              <button className={styles.backButton} type="button" aria-label="Voltar para conversas" onClick={() => { closeConversationPanels(); navigate("/app"); }}>←</button>
              <button
                className={styles.contactButton}
                type="button"
                disabled={selectedConversation.type !== "group"}
                aria-label={selectedConversation.type === "group" ? "Abrir informações do grupo" : undefined}
                onClick={() => selectedConversation.type === "group" && setGroupInfoChatId(selectedConversation.id)}
              >
                <ConversationAvatar name={getConversationTitle(selectedConversation)} src={selectedConversation.avatarUrl} />
                <span className={styles.contact}>
                  <strong>{getConversationTitle(selectedConversation)}</strong>
                  <span>{selectedConversation.type === "group" ? "Grupo" : selectedConversation.privateUser?.isOnline ? "Online" : (selectedConversation.privateUser?.about ?? "Offline")}</span>
                </span>
              </button>
              <div className={styles.headerActions}>
                {selectedConversation.type === "private" ? (
                  <>
                    <button type="button" aria-label="Iniciar chamada de voz" title="Chamada de voz" disabled={calls.isBusy || Boolean(selectedConversation.block?.isBlocked)} onClick={() => void calls.startCall({ chatId: selectedConversation.id, type: "voice", contact: selectedConversation.privateUser })}>☎</button>
                    <button type="button" aria-label="Iniciar chamada de vídeo" title="Chamada de vídeo" disabled={calls.isBusy || Boolean(selectedConversation.block?.isBlocked)} onClick={() => void calls.startCall({ chatId: selectedConversation.id, type: "video", contact: selectedConversation.privateUser })}>▣</button>
                  </>
                ) : null}
                <button type="button" aria-label="Buscar mensagens" title="Buscar mensagens" onClick={() => setMessageSearchChatId(selectedConversation.id)}>⌕</button>
                <button type="button" aria-label="Opções da conversa" title="Opções da conversa" onClick={() => setOptionsChatId(selectedConversation.id)}>⋮</button>
              </div>
            </header>

            <MessagesPanel
              key={`${selectedConversation.id}:${messagePanelVersion}`}
              chatId={selectedConversation.id}
              currentUserId={currentUserId}
              conversation={selectedConversation}
              conversations={conversations}
              searchOpen={messageSearchChatId === selectedConversation.id}
              onSearchClose={() => setMessageSearchChatId(null)}
              onViewportAtBottom={setActiveChatAtBottom}
              onAccessLost={() => {
                void refresh();
                navigate("/app");
              }}
              initialLocatedMessage={
                navigationState?.focusedMessage?.chatId === selectedConversation.id
                  ? navigationState.focusedMessage
                  : null
              }
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
        ) : null}

        {section === "conversations" && !selectedConversation ? (
          <div className={styles.placeholder}>
            <span className={styles.badge} aria-hidden="true">LG</span>
            <h1>LG Chat</h1>
            <p>{selectedChatId && status === "ready" ? "Essa conversa não foi encontrada ou você não possui mais acesso." : "Selecione uma conversa para visualizar e enviar mensagens."}</p>
          </div>
        ) : null}
      </section>

      {isNewConversationOpen ? <NewConversationDialog onClose={() => setIsNewConversationOpen(false)} onConversationCreated={handleConversationCreated} /> : null}
      {isNewGroupOpen ? <NewGroupDialog onClose={() => setIsNewGroupOpen(false)} onCreated={handleConversationCreated} /> : null}
      {isProfileOpen ? <ProfileDialog onClose={() => setIsProfileOpen(false)} /> : null}
      {isNotificationsOpen ? (
        <NotificationSettingsDialog
          soundEnabled={notifications.soundEnabled}
          systemEnabled={notifications.systemEnabled}
          errorMessage={notifications.errorMessage}
          onSoundChange={notifications.enableSound}
          onEnableSystem={notifications.requestSystemNotifications}
          onDisableSystem={notifications.disableSystemNotifications}
          onClose={() => setIsNotificationsOpen(false)}
        />
      ) : null}
      {optionsChatId === selectedConversation?.id && selectedConversation ? <ConversationOptionsDialog conversation={selectedConversation} onClose={() => setOptionsChatId(null)} onChanged={handleConversationAction} /> : null}
      {groupInfoChatId === selectedConversation?.id && selectedConversation?.type === "group" && currentUserId ? (
        <GroupInfoDialog
          chatId={selectedConversation.id}
          currentUserId={currentUserId}
          onClose={() => setGroupInfoChatId(null)}
          onChanged={refresh}
          onRemoved={async () => { await refresh(); navigate("/app"); }}
        />
      ) : null}

      {isMoreOpen ? (
        <Modal title="Mais opções" onClose={() => setIsMoreOpen(false)} size="small">
          <div className={styles.moreMenu}>
            <Link to="/app/starred" onClick={() => { closeConversationPanels(); setIsMoreOpen(false); }}>★ Mensagens favoritas</Link>
            <Link to="/app/archived" onClick={() => { closeConversationPanels(); setIsMoreOpen(false); }}>▣ Conversas arquivadas</Link>
            <button type="button" onClick={() => closeMoreAnd(() => setIsProfileOpen(true))}>● Meu perfil</button>
            <button type="button" onClick={() => closeMoreAnd(() => setIsNotificationsOpen(true))}>♬ Notificações</button>
            <button className={styles.moreDanger} type="button" onClick={() => closeMoreAnd(auth.signOut)}>↪ Sair</button>
          </div>
        </Modal>
      ) : null}

      {notifications.toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          <span>{notifications.toast}</span>
          <button type="button" aria-label="Fechar aviso" onClick={notifications.dismissToast}>×</button>
        </div>
      ) : null}
    </main>
  );
}
