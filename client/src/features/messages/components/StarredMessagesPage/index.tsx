import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAuthErrorMessage } from "../../../auth/auth.errors";
import type { Conversation } from "../../../conversations/conversations.schemas";
import { listConversations } from "../../../conversations/conversations.api";
import { getConversationTitle } from "../../../conversations/conversations.utils";
import { listStarredMessages } from "../../api/messages.api";
import type { ChatMessage } from "../../messages.schemas";

import styles from "./styles.module.css";

type StarredEntry = { conversation: Conversation; message: ChatMessage };

type Props = {
  conversations: Conversation[];
  currentUserId: number;
  onOpen: (entry: StarredEntry) => void;
};

function preview(message: ChatMessage) {
  return message.text?.trim() || message.mediaOriginalName || ({ image: "Imagem", video: "Vídeo", audio: "Áudio", file: "Arquivo", text: "Mensagem", system: "Sistema" } as const)[message.type];
}

export function StarredMessagesPage({ conversations, currentUserId, onOpen }: Props) {
  const controllerRef = useRef<AbortController | null>(null);
  const conversationsRef = useRef(conversations);
  const [entries, setEntries] = useState<StarredEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const conversationIdsKey = conversations.map((conversation) => conversation.id).join(",");

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const archived = await listConversations({ signal: controller.signal, archived: true });
      const expectedIds = new Set(
        conversationIdsKey
          .split(",")
          .filter(Boolean)
          .map(Number),
      );
      const uniqueConversations = Array.from(
        new Map(
          [
            ...conversationsRef.current.filter((conversation) => expectedIds.has(conversation.id)),
            ...archived.data,
          ].map((conversation) => [conversation.id, conversation]),
        ).values(),
      );
      const groups = await Promise.all(
        uniqueConversations.map(async (conversation) => {
          const response = await listStarredMessages(conversation.id, 100, { signal: controller.signal });
          return response.data.map((message) => ({ conversation, message }));
        }),
      );
      if (controller.signal.aborted) return;
      setEntries(groups.flat().sort((first, second) => new Date(second.message.createdAt).getTime() - new Date(first.message.createdAt).getTime()));
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) setError(getAuthErrorMessage(requestError));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [conversationIdsKey]);

  useEffect(() => {
    queueMicrotask(() => void load());
    return () => controllerRef.current?.abort();
  }, [load]);

  const content = useMemo(() => {
    if (loading) return <div className={styles.state} role="status">Carregando favoritas…</div>;
    if (error) return <div className={styles.state} role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>;
    if (entries.length === 0) return <div className={styles.state} role="status">Nenhuma mensagem favorita nas conversas atuais.</div>;
    return (
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={`${entry.conversation.id}:${entry.message.id}`}>
            <button type="button" onClick={() => onOpen(entry)}>
              <span className={styles.top}>
                <strong>{getConversationTitle(entry.conversation)}</strong>
                <time dateTime={entry.message.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.message.createdAt))}</time>
              </span>
              <span className={styles.preview}>{preview(entry.message)}</span>
              <small>{entry.message.fromUserId === currentUserId ? "Enviada por você" : "Recebida"}</small>
            </button>
          </li>
        ))}
      </ul>
    );
  }, [currentUserId, entries, error, load, loading, onOpen]);

  return (
    <section className={styles.page} aria-labelledby="starred-title">
      <header><div><h1 id="starred-title">Mensagens favoritas</h1><p>Mensagens que você marcou nas suas conversas.</p></div><button type="button" disabled={loading} onClick={() => void load()}>Atualizar</button></header>
      {content}
    </section>
  );
}
