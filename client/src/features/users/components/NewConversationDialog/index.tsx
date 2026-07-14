import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Modal } from "../../../../components/Modal";
import { createPrivateConversation } from "../../../conversations/conversations.api";
import { useUsers } from "../../hooks/useUsers";
import { getUsersErrorMessage } from "../../users.errors";
import type { ChatUser } from "../../users.schemas";

import styles from "./styles.module.css";

type NewConversationDialogProps = {
  onClose: () => void;
  onConversationCreated: (chatId: number, signal: AbortSignal) => Promise<void>;
};

export function NewConversationDialog({
  onClose,
  onConversationCreated,
}: NewConversationDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { users, status, errorMessage, refresh } = useUsers(debouncedSearch);
  const [creatingUserId, setCreatingUserId] = useState<number | null>(null);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(
    null,
  );
  const searchId = useId();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const createRequestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      createRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const close = useCallback(() => {
    createRequestRef.current?.abort();
    onClose();
  }, [onClose]);

  async function selectUser(user: ChatUser) {
    if (createRequestRef.current) return;

    const controller = new AbortController();
    createRequestRef.current = controller;
    setCreateErrorMessage(null);
    setCreatingUserId(user.id);

    try {
      const response = await createPrivateConversation(user.id, {
        signal: controller.signal,
      });
      if (!mountedRef.current || controller.signal.aborted) return;

      await onConversationCreated(response.data.id, controller.signal);
      if (!controller.signal.aborted) close();
    } catch (error: unknown) {
      if (mountedRef.current && !controller.signal.aborted) {
        setCreateErrorMessage(getUsersErrorMessage(error));
      }
    } finally {
      if (createRequestRef.current === controller) {
        createRequestRef.current = null;
        if (mountedRef.current) setCreatingUserId(null);
      }
    }
  }

  const canShowUsers = status === "ready" || status === "refreshing";

  return (
    <Modal
      title="Nova conversa"
      description="Escolha um usuário para iniciar o chat."
      onClose={close}
      initialFocusRef={searchInputRef}
      busy={creatingUserId !== null}
      size="large"
    >
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
      {status === "refreshing" ? (
        <p className={styles.refreshing} role="status">
          Atualizando usuários…
        </p>
      ) : null}

      <div className={styles.list} aria-busy={status === "loading"}>
        {status === "loading" ? (
          <div className={styles.status} role="status">
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
        {canShowUsers && users.length === 0 ? (
          <div className={styles.status} role="status">
            {search.trim()
              ? "Nenhum usuário corresponde à busca."
              : "Nenhum outro usuário disponível."}
          </div>
        ) : null}

        {canShowUsers
          ? users.map((user) => {
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
    </Modal>
  );
}
