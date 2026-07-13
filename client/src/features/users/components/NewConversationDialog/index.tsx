import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPrivateConversation } from "../../../conversations/conversations.api";
import { useUsers } from "../../hooks/useUsers";
import { getUsersErrorMessage } from "../../users.errors";
import type { ChatUser } from "../../users.schemas";

import styles from "./styles.module.css";

type NewConversationDialogProps = {
  onClose: () => void;
  onConversationCreated: (
    chatId: number,
    signal: AbortSignal,
  ) => Promise<void>;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => !element.hidden && element.getClientRects().length > 0);
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

  const titleId = useId();
  const descriptionId = useId();
  const searchId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const createRequestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onConversationCreatedRef = useRef(onConversationCreated);

  useEffect(() => {
    onCloseRef.current = onClose;
    onConversationCreatedRef.current = onConversationCreated;
  }, [onClose, onConversationCreated]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedSearch) return users;

    return users.filter(
      (user) =>
        user.nome.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        user.email.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
    );
  }, [search, users]);

  const closeDialog = useCallback(() => {
    if (closingRef.current) return;

    closingRef.current = true;
    createRequestRef.current?.abort();
    onCloseRef.current();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    closingRef.current = false;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    function focusFirstElement() {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const firstFocusable = getFocusableElements(dialog)[0];
      (firstFocusable ?? dialog).focus();
    }

    function handleFocusIn(event: FocusEvent) {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(event.target as Node)) return;
      focusFirstElement();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeElement = document.activeElement;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focusIsInside =
        activeElement instanceof Node && dialog.contains(activeElement);

      if (!focusIsInside || (event.shiftKey && activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      mountedRef.current = false;
      createRequestRef.current?.abort();
      createRequestRef.current = null;
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [closeDialog]);

  async function selectUser(user: ChatUser) {
    if (createRequestRef.current || closingRef.current) return;

    const controller = new AbortController();
    createRequestRef.current = controller;
    setCreateErrorMessage(null);
    setCreatingUserId(user.id);

    try {
      const response = await createPrivateConversation(user.id, {
        signal: controller.signal,
      });

      if (
        !mountedRef.current ||
        closingRef.current ||
        controller.signal.aborted ||
        createRequestRef.current !== controller
      ) {
        return;
      }

      await onConversationCreatedRef.current(
        response.data.id,
        controller.signal,
      );

      if (
        !mountedRef.current ||
        closingRef.current ||
        controller.signal.aborted
      ) {
        return;
      }

      closeDialog();
    } catch (error: unknown) {
      if (
        !mountedRef.current ||
        closingRef.current ||
        controller.signal.aborted
      ) {
        return;
      }

      setCreateErrorMessage(getUsersErrorMessage(error));
    } finally {
      if (createRequestRef.current === controller) {
        createRequestRef.current = null;

        if (mountedRef.current && !closingRef.current) {
          setCreatingUserId(null);
        }
      }
    }
  }

  const canShowUsers = status === "ready" || status === "refreshing";
  const isRefreshing = status === "refreshing";

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
          closeDialog();
        }
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={creatingUserId !== null || isRefreshing}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>Nova conversa</h2>
            <p id={descriptionId}>Escolha um usuário para iniciar o chat.</p>
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
          <label htmlFor={searchId}>Buscar por nome ou e-mail</label>
          <input
            ref={searchInputRef}
            id={searchId}
            type="search"
            value={search}
            placeholder="Digite um nome ou e-mail"
            autoComplete="off"
            onChange={(event) => {
              setSearch(event.target.value);
              setCreateErrorMessage(null);
            }}
          />
        </div>

        {createErrorMessage ? (
          <div className={styles.error} role="alert">
            {createErrorMessage}
          </div>
        ) : null}

        {canShowUsers && errorMessage ? (
          <div className={styles.refreshError} role="alert">
            <span>{errorMessage} Os usuários já carregados foram mantidos.</span>
            <button type="button" onClick={() => void refresh()}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        {isRefreshing ? (
          <p className={styles.refreshing} role="status" aria-live="polite">
            Atualizando usuários…
          </p>
        ) : null}

        <div className={styles.list} aria-busy={status === "loading"}>
          {status === "loading" ? (
            <div className={styles.status} role="status" aria-live="polite">
              Carregando usuários…
            </div>
          ) : null}

          {status === "error" ? (
            <div className={styles.status} role="alert">
              <strong>Não foi possível carregar os usuários</strong>
              <span>{errorMessage}</span>
              <button type="button" onClick={() => void refresh()}>
                Tentar novamente
              </button>
            </div>
          ) : null}

          {canShowUsers && filteredUsers.length === 0 ? (
            <div className={styles.status} role="status">
              {search.trim()
                ? "Nenhum usuário corresponde à busca."
                : "Nenhum outro usuário disponível."}
            </div>
          ) : null}

          {canShowUsers
            ? filteredUsers.map((user) => {
                const isCreating = creatingUserId === user.id;

                return (
                  <button
                    className={styles.user}
                    type="button"
                    key={user.id}
                    disabled={creatingUserId !== null}
                    aria-busy={isCreating}
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
                      {isCreating ? "Abrindo…" : "Conversar"}
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
