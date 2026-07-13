import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Modal } from "../../../components/Modal";
import { getAuthErrorMessage } from "../../auth/auth.errors";
import type { ChatMessage } from "../../messages/messages.schemas";
import { searchMessages } from "../search.api";
import type { MessageSearchType } from "../search.schemas";

import styles from "./styles.module.css";

type Props = {
  chatId: number;
  currentUserId: number;
  otherUserName?: string | null;
  onClose: () => void;
  onSelect: (message: ChatMessage) => void;
};

const FILTERS: Array<{ value: MessageSearchType; label: string }> = [
  { value: "all", label: "Tudo" },
  { value: "text", label: "Texto" },
  { value: "image", label: "Imagens" },
  { value: "video", label: "Vídeos" },
  { value: "audio", label: "Áudios" },
  { value: "file", label: "Arquivos" },
  { value: "media", label: "Todas as mídias" },
];

function typeLabel(message: ChatMessage) {
  const labels: Record<ChatMessage["type"], string> = {
    text: "Texto", system: "Sistema", image: "Imagem", video: "Vídeo", audio: "Áudio", file: "Arquivo",
  };
  return labels[message.type];
}

function resultPreview(message: ChatMessage) {
  return message.text?.trim() || message.mediaOriginalName || typeLabel(message);
}

export function MessageSearchDialog({ chatId, currentUserId, otherUserName, onClose, onSelect }: Props) {
  const queryId = useId();
  const queryRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MessageSearchType>("all");
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery && filter === "all") {
      setError("Digite um texto ou escolha um tipo de mensagem.");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await searchMessages(chatId, { q: cleanQuery, type: filter }, controller.signal);
      if (controller.signal.aborted) return;
      setResults(response.data.results);
      setHasSearched(true);
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) setError(getAuthErrorMessage(requestError));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function clear() {
    requestRef.current?.abort();
    setQuery("");
    setFilter("all");
    setResults([]);
    setHasSearched(false);
    setError(null);
    queryRef.current?.focus();
  }

  return (
    <Modal title="Buscar mensagens" description="A busca é limitada à conversa aberta." onClose={onClose} initialFocusRef={queryRef} busy={loading} size="large">
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field} htmlFor={queryId}>
          <span>Texto, legenda ou nome do arquivo</span>
          <input ref={queryRef} id={queryId} type="search" value={query} maxLength={100} disabled={loading} placeholder="Digite o que deseja encontrar" onChange={(event) => { setQuery(event.target.value); setError(null); }} />
        </label>
        <fieldset className={styles.filters} disabled={loading}>
          <legend>Tipo de mensagem</legend>
          {FILTERS.map((item) => (
            <label key={item.value}>
              <input type="radio" name="search-type" value={item.value} checked={filter === item.value} onChange={() => setFilter(item.value)} />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>
        <div className={styles.actions}>
          <button type="button" disabled={loading} onClick={clear}>Limpar</button>
          <button className={styles.primary} type="submit" disabled={loading || (!query.trim() && filter === "all")}>{loading ? "Buscando…" : "Buscar"}</button>
        </div>
      </form>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      <section className={styles.results} aria-label="Resultados da busca" aria-busy={loading}>
        {loading ? <p role="status">Buscando mensagens…</p> : null}
        {!loading && hasSearched && results.length === 0 ? <p role="status">Nenhuma mensagem encontrada.</p> : null}
        {results.map((message) => (
          <button key={message.id} type="button" onClick={() => { onSelect(message); onClose(); }}>
            <span className={styles.resultTop}>
              <strong>{message.fromUserId === currentUserId ? "Você" : otherUserName || `Participante ${message.fromUserId}`}</strong>
              <time dateTime={message.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.createdAt))}</time>
            </span>
            <span className={styles.preview}>{resultPreview(message)}</span>
            <small>{typeLabel(message)}</small>
          </button>
        ))}
      </section>
    </Modal>
  );
}
