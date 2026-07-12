import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { ApiError } from "../../../../api/apiClient";
import { getAuthErrorMessage } from "../../../auth/auth.errors";
import { createPrivateConversation } from "../../../conversations/conversations.api";
import { useUsers } from "../../hooks/useUsers";
import type { ChatUser } from "../../users.schemas";

import styles from "./styles.module.css";

type NewConversationDialogProps = {
  onClose: () => void;
  onConversationCreated: (chatId: number) => Promise<void>;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function isCancellation(error: unknown) {
  return error instanceof ApiError && error.code === "REQUEST_CANCELLED";
}

export function NewConversationDialog({
  onClose,
  onConversationCreated,
}: NewConversationDialogProps) {
  const { users, status, errorMessage, refresh } = useUsers();
  const [search, setSearch] = useState("");
  const [creatingUserId, setCreatingUserId] = useState<number | null>(null);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(
    null,
  );

  const dialogRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const createRequestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedSearch) return users;

    return users.filter(
      (user) =>
        user.nome.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        user.email.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
    );
  }, [search, users]);

  function closeDialog() {
    createRequestRef.current?.abort();
    onClose();
  }

  useEffect(() => {
    mountedRef.current = true;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        createRequestRef.current?.abort();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      mountedRef.current = false;
      createRequestRef.current?.abort();
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  async function selectUser(user: ChatUser) {
    if (creatingUserId !== null) return;

    const controller = new AbortController();
    createRequestRef.current = controller;
    setCreateErrorMessage(null);
    setCreatingUserId(user.id);

    try {
      const response = await createPrivateConversation(user.id, {
        signal: controller.signal,
      });

      if (!mountedRef.current) return;

      await onConversationCreated(response.data.id);
      if (mountedRef.current) onClose();
    } catch (error: unknown) {
      if (!mountedRef.current || isCancellation(error)) return;
      setCreateErrorMessage(getAuthErrorMessage(error));
    } finally {
      if (mountedRef.current) setCreatingUserId(null);
      createRequestRef.current = null;
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") event.stopPropagation();
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
        aria-describedby="new-conversation-description"
        aria-busy={creatingUserId !== null}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <header className={styles.header}>
          <div>
            <h2 id="new-conversation-title">Nova conversa</h2>
            <p id="new-conversation-description">
              Escolha um usuário para iniciar o chat.
            </p>
          </div>

          <button
            className={styles.closeButton}
            type="button"
            aria-label="Fechar nova conversa"
            onClick={closeDialog}
          >
            ×
          </button>
        </header>

        <div className={styles.search}>
          <label htmlFor="new-conversation-search">
            Buscar por nome ou e-mail
          </label>
          <input
            ref={searchInputRef}
            id="new-conversation-search"
            type="search"
            value={search}
            placeholder="Digite um nome ou e-mail"
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {createErrorMessage ? (
          <div className={styles.error} role="alert">
            {createErrorMessage}
          </div>
        ) : null}

        <div className={styles.list}>
          {status === "loading" ? (
            <div className={styles.status}>Carregando usuários...</div>
          ) : null}

          {status === "error" ? (
            <div className={styles.status}>
              <strong>Não foi possível carregar os usuários</strong>
              <span>{errorMessage}</span>
              <button type="button" onClick={() => void refresh()}>
                Tentar novamente
              </button>
            </div>
          ) : null}

          {status === "ready" && filteredUsers.length === 0 ? (
            <div className={styles.status}>
              {search.trim()
                ? "Nenhum usuário corresponde à busca."
                : "Nenhum outro usuário disponível."}
            </div>
          ) : null}

          {status === "ready"
            ? filteredUsers.map((user) => {
                const isCreating = creatingUserId === user.id;

                return (
                  <button
                    className={styles.user}
                    type="button"
                    key={user.id}
                    disabled={creatingUserId !== null}
                    onClick={() => void selectUser(user)}
                  >
                    <span className={styles.avatar} aria-hidden="true">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" loading="lazy" />
                      ) : (
                        user.nome.charAt(0).toUpperCase()
                      )}

                      {user.isOnline ? (
                        <i className={styles.online} title="Online" />
                      ) : null}
                    </span>

                    <span className={styles.userContent}>
                      <strong>{user.nome}</strong>
                      <small>{user.email}</small>
                      <span>{user.about || "Disponível"}</span>
                    </span>

                    <span className={styles.action}>
                      {isCreating ? "Abrindo..." : "Conversar"}
                    </span>
                  </button>
                );
              })
            : null}
        </div>
      </section>
    </div>
  );
}
