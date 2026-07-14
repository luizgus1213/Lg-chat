import { useEffect, useRef, useState } from "react";

import { Modal } from "../../../../components/Modal";
import { getAuthErrorMessage } from "../../../auth/auth.errors";
import type { Conversation } from "../../conversations.schemas";
import {
  clearConversationForMe,
  deleteConversationForMe,
  updateConversationBlock,
  updateConversationPreferences,
} from "../../conversationActions.api";

import styles from "./styles.module.css";

export type ConversationAction =
  "pin" | "mute" | "archive" | "block" | "clear" | "delete";

type Props = {
  conversation: Conversation;
  onClose: () => void;
  onChanged: (action: ConversationAction) => Promise<void> | void;
};

type Confirmation = "clear" | "delete" | null;

export function ConversationOptionsDialog({
  conversation,
  onClose,
  onChanged,
}: Props) {
  const requestRef = useRef<AbortController | null>(null);
  const confirmationFocusRef = useRef<HTMLButtonElement | null>(null);
  const busyRef = useRef(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (!confirmation) return;
    const frame = window.requestAnimationFrame(() =>
      confirmationFocusRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [confirmation]);

  async function run(
    action: ConversationAction,
    request: (signal: AbortSignal) => Promise<unknown>,
  ) {
    if (busyRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    busyRef.current = true;
    setBusyAction(action);
    setError(null);
    try {
      await request(controller.signal);
      if (controller.signal.aborted) return;
      await onChanged(action);
      if (!controller.signal.aborted) onClose();
    } catch (requestError: unknown) {
      if (!controller.signal.aborted)
        setError(getAuthErrorMessage(requestError));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      busyRef.current = false;
      if (!controller.signal.aborted) setBusyAction(null);
    }
  }

  function changePreference(
    action: "pin" | "mute" | "archive",
    changes: Partial<Pick<Conversation, "isPinned" | "isArchived" | "isMuted">>,
  ) {
    return run(action, (signal) =>
      updateConversationPreferences(
        conversation.id,
        {
          isPinned: changes.isPinned ?? conversation.isPinned,
          isArchived: changes.isArchived ?? conversation.isArchived,
          isMuted: changes.isMuted ?? conversation.isMuted,
          mutedUntil:
            changes.isMuted === false ? null : conversation.mutedUntil,
        },
        { signal },
      ),
    );
  }

  const isBusy = busyAction !== null;

  return (
    <Modal
      title="Opções da conversa"
      description="Preferências aplicadas somente à sua conta."
      onClose={() => {
        if (confirmation) setConfirmation(null);
        else onClose();
      }}
      busy={isBusy}
      size="small"
    >
      {confirmation ? (
        <div
          className={styles.confirm}
          role="alertdialog"
          aria-label="Confirmar ação"
        >
          <strong>
            {confirmation === "clear"
              ? "Limpar esta conversa?"
              : "Excluir esta conversa da sua lista?"}
          </strong>
          <span>
            Essa ação afeta somente a sua conta e não pode ser desfeita pela
            interface.
          </span>
          <div>
            <button
              ref={confirmationFocusRef}
              type="button"
              disabled={isBusy}
              onClick={() => setConfirmation(null)}
            >
              Cancelar
            </button>
            <button
              className={styles.confirmDanger}
              type="button"
              disabled={isBusy}
              onClick={() =>
                void run(
                  confirmation === "clear" ? "clear" : "delete",
                  (signal) =>
                    confirmation === "clear"
                      ? clearConversationForMe(conversation.id, { signal })
                      : deleteConversationForMe(conversation.id, { signal }),
                )
              }
            >
              {busyAction ? "Processando…" : "Confirmar"}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.options}>
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              void changePreference("pin", { isPinned: !conversation.isPinned })
            }
          >
            <span>
              {conversation.isPinned ? "Desafixar conversa" : "Fixar conversa"}
            </span>
            <small>
              {conversation.isPinned
                ? "Remover do topo da lista"
                : "Manter no topo da lista"}
            </small>
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              void changePreference("mute", { isMuted: !conversation.isMuted })
            }
          >
            <span>
              {conversation.isMuted
                ? "Ativar notificações"
                : "Silenciar conversa"}
            </span>
            <small>
              {conversation.isMuted
                ? "Voltar a receber alertas"
                : "Não tocar som para novas mensagens"}
            </small>
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              void changePreference("archive", {
                isArchived: !conversation.isArchived,
              })
            }
          >
            <span>
              {conversation.isArchived
                ? "Desarquivar conversa"
                : "Arquivar conversa"}
            </span>
            <small>Organize sua lista sem apagar mensagens</small>
          </button>

          {conversation.type === "private" ? (
            <button
              className={conversation.block?.blockedByMe ? "" : styles.danger}
              type="button"
              disabled={isBusy}
              onClick={() =>
                void run("block", (signal) =>
                  updateConversationBlock(
                    conversation.id,
                    !conversation.block?.blockedByMe,
                    { signal },
                  ),
                )
              }
            >
              <span>
                {conversation.block?.blockedByMe
                  ? "Desbloquear contato"
                  : "Bloquear contato"}
              </span>
              <small>O backend continuará validando todas as permissões</small>
            </button>
          ) : null}

          <button
            className={styles.danger}
            type="button"
            disabled={isBusy}
            onClick={() => setConfirmation("clear")}
          >
            <span>Limpar conversa para mim</span>
            <small>Oculta o histórico anterior somente para você</small>
          </button>
          <button
            className={styles.danger}
            type="button"
            disabled={isBusy}
            onClick={() => setConfirmation("delete")}
          >
            <span>Excluir conversa para mim</span>
            <small>Remove a conversa da sua lista</small>
          </button>
        </div>
      )}

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
    </Modal>
  );
}
