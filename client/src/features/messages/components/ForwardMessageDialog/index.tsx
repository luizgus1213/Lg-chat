import { useMemo, useState } from "react";

import { Modal } from "../../../../components/Modal";
import type { Conversation } from "../../../conversations/conversations.schemas";
import { getConversationTitle } from "../../../conversations/conversations.utils";
import type { ChatMessage } from "../../messages.schemas";

import styles from "./styles.module.css";

type Props = {
  message: ChatMessage;
  conversations: Conversation[];
  busy: boolean;
  onClose: () => void;
  onForward: (targetChatIds: number[]) => Promise<boolean>;
};

export function ForwardMessageDialog({
  message,
  conversations,
  busy,
  onClose,
  onForward,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const filtered = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase("pt-BR");
    return clean
      ? conversations.filter((item) =>
          getConversationTitle(item).toLocaleLowerCase("pt-BR").includes(clean),
        )
      : conversations;
  }, [conversations, query]);

  function toggle(chatId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(chatId)) next.delete(chatId);
      else if (next.size < 20) next.add(chatId);
      return next;
    });
  }

  return (
    <Modal
      title="Encaminhar mensagem"
      description="Escolha até 20 conversas de destino."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button
            className={styles.secondary}
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className={styles.primary}
            type="button"
            disabled={busy || uncertain || selected.size === 0}
            onClick={() =>
              void (async () => {
                setError(null);
                const success = await onForward(Array.from(selected));
                if (success) onClose();
                else {
                  setUncertain(true);
                  setError(
                    "O envio pode ter sido concluído em parte. Feche este painel e verifique os destinos antes de tentar novamente.",
                  );
                }
              })()
            }
          >
            {busy
              ? "Encaminhando…"
              : uncertain
                ? "Verifique os destinos"
                : `Encaminhar (${selected.size})`}
          </button>
        </>
      }
    >
      <p className={styles.preview}>
        {message.text?.trim() ||
          message.mediaOriginalName ||
          "Mensagem de mídia"}
      </p>
      <label className={styles.search}>
        <span>Buscar conversa</span>
        <input
          type="search"
          value={query}
          disabled={busy}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={styles.list}>
        {filtered.length === 0 ? <p>Nenhuma conversa encontrada.</p> : null}
        {filtered.map((conversation) => (
          <label key={conversation.id}>
            <input
              type="checkbox"
              checked={selected.has(conversation.id)}
              disabled={
                busy || (!selected.has(conversation.id) && selected.size >= 20)
              }
              onChange={() => toggle(conversation.id)}
            />
            <span>{getConversationTitle(conversation)}</span>
            <small>
              {conversation.type === "group" ? "Grupo" : "Conversa privada"}
            </small>
          </label>
        ))}
      </div>
      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
    </Modal>
  );
}
