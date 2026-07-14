import { useCallback, useEffect, useRef, useState } from "react";

import { getAuthErrorMessage } from "../../../auth/auth.errors";
import { listAllStarredMessages } from "../../api/messages.api";
import type { StarredMessageEntry } from "../../messages.schemas";

import styles from "./styles.module.css";

type Props = {
  currentUserId: number;
  onOpen: (entry: StarredMessageEntry) => void;
};

function preview(entry: StarredMessageEntry) {
  const { message } = entry;
  return (
    message.text?.trim() ||
    message.mediaOriginalName ||
    {
      image: "Imagem",
      video: "Vídeo",
      audio: "Áudio",
      file: "Arquivo",
      text: "Mensagem",
      system: "Sistema",
    }[message.type]
  );
}

export function StarredMessagesPage({ currentUserId, onOpen }: Props) {
  const controllerRef = useRef<AbortController | null>(null);
  const [entries, setEntries] = useState<StarredMessageEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (append: boolean, beforeId?: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const response = await listAllStarredMessages(
        { limit: 30, beforeId: append ? beforeId : undefined },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;

      setEntries((current) =>
        append ? [...current, ...response.data.items] : response.data.items,
      );
      setNextCursor(response.data.nextCursor);
    } catch (requestError: unknown) {
      if (!controller.signal.aborted)
        setError(getAuthErrorMessage(requestError));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (!controller.signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load(false));
    return () => controllerRef.current?.abort();
  }, [load]);

  return (
    <section className={styles.page} aria-labelledby="starred-title">
      <header>
        <div>
          <h1 id="starred-title">Mensagens favoritas</h1>
          <p>Uma lista paginada de todas as mensagens que você marcou.</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(false)}
        >
          Atualizar
        </button>
      </header>

      {loading ? (
        <div className={styles.state} role="status">
          Carregando favoritas…
        </div>
      ) : null}
      {!loading && error ? (
        <div className={styles.state} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load(false)}>
            Tentar novamente
          </button>
        </div>
      ) : null}
      {!loading && !error && entries.length === 0 ? (
        <div className={styles.state} role="status">
          Nenhuma mensagem favorita.
        </div>
      ) : null}

      {entries.length > 0 ? (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={`${entry.conversation.id}:${entry.message.id}`}>
              <button type="button" onClick={() => onOpen(entry)}>
                <span className={styles.top}>
                  <strong>{entry.conversation.name || "Conversa"}</strong>
                  <time dateTime={entry.message.createdAt}>
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(entry.message.createdAt))}
                  </time>
                </span>
                <span className={styles.preview}>{preview(entry)}</span>
                <small>
                  {entry.message.fromUserId === currentUserId
                    ? "Enviada por você"
                    : "Recebida"}
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {nextCursor ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void load(true, nextCursor)}
        >
          {loadingMore ? "Carregando…" : "Carregar mais"}
        </button>
      ) : null}
    </section>
  );
}
