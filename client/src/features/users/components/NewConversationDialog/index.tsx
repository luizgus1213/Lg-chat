import { useMemo, useState } from "react";

import { getAuthErrorMessage } from "../../../auth/auth.errors";

import { createPrivateConversation } from "../../../conversations/conversations.api";

import { useUsers } from "../../hooks/useUsers";

import type { ChatUser } from "../../users.schemas";

import styles from "./styles.module.css";

type NewConversationDialogProps = {
  onClose: () => void;

  onConversationCreated: (chatId: number) => Promise<void>;
};

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

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.nome.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        user.email.toLocaleLowerCase("pt-BR").includes(normalizedSearch)
      );
    });
  }, [search, users]);

  async function selectUser(user: ChatUser) {
    if (creatingUserId !== null) {
      return;
    }

    setCreateErrorMessage(null);
    setCreatingUserId(user.id);

    try {
      const response = await createPrivateConversation(user.id);

      await onConversationCreated(response.data.id);

      onClose();
    } catch (error: unknown) {
      setCreateErrorMessage(getAuthErrorMessage(error));
    } finally {
      setCreatingUserId(null);
    }
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="new-conversation-title">Nova conversa</h2>

            <p>Escolha um usuário para iniciar o chat.</p>
          </div>

          <button
            className={styles.closeButton}
            type="button"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.search}>
          <input
            type="search"
            value={search}
            placeholder="Buscar por nome ou e-mail"
            autoComplete="off"
            autoFocus
            onChange={(event) => {
              setSearch(event.target.value);
            }}
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

              <button
                type="button"
                onClick={() => {
                  void refresh();
                }}
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {status === "ready" && filteredUsers.length === 0 ? (
            <div className={styles.status}>Nenhum usuário encontrado.</div>
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
                    onClick={() => {
                      void selectUser(user);
                    }}
                  >
                    <span className={styles.avatar}>
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" />
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
