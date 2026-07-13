import { useCallback, useEffect, useRef, useState } from "react";

import { getAuthErrorMessage } from "../../../auth/auth.errors";
import { listConversations } from "../../conversations.api";
import type { Conversation } from "../../conversations.schemas";
import { getConversationTitle } from "../../conversations.utils";
import { ConversationAvatar } from "../ConversationAvatar";

import styles from "./styles.module.css";

type Props = { onOpen: (conversation: Conversation) => Promise<void> | void };

export function ArchivedConversationsPage({ onOpen }: Props) {
  const requestRef = useRef<AbortController | null>(null);
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await listConversations({ signal: controller.signal, archived: true });
      if (!controller.signal.aborted) setItems(response.data);
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) setError(getAuthErrorMessage(requestError));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); return () => requestRef.current?.abort(); }, [load]);

  async function restore(conversation: Conversation) {
    if (restoringId !== null) return;
    setRestoringId(conversation.id);
    setActionError(null);
    try {
      await onOpen(conversation);
    } catch (requestError: unknown) {
      setActionError(getAuthErrorMessage(requestError));
      setRestoringId(null);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="archived-title">
      <header><div><h1 id="archived-title">Conversas arquivadas</h1><p>Conversas removidas da lista principal.</p></div><button type="button" disabled={loading} onClick={() => void load()}>Atualizar</button></header>
      <div className={styles.content}>
        {loading ? <div className={styles.state} role="status">Carregando arquivadas…</div> : null}
        {error ? <div className={styles.state} role="alert">{error}</div> : null}
        {actionError ? <div className={styles.actionError} role="alert">{actionError}</div> : null}
        {!loading && !error && items.length === 0 ? <div className={styles.state}>Nenhuma conversa arquivada.</div> : null}
        {!loading && !error && items.length > 0 ? (
          <ul className={styles.list}>
            {items.map((conversation) => (
              <li key={conversation.id}>
                <ConversationAvatar name={getConversationTitle(conversation)} src={conversation.avatarUrl} />
                <span><strong>{getConversationTitle(conversation)}</strong><small>{conversation.type === "group" ? "Grupo" : "Conversa privada"}</small></span>
                <button type="button" disabled={restoringId !== null} onClick={() => void restore(conversation)}>{restoringId === conversation.id ? "Restaurando…" : "Desarquivar"}</button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
