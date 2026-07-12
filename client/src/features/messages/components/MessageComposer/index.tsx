import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import styles from "./styles.module.css";

type MessageComposerProps = {
  disabled: boolean;
  disabledReason?: string | null;
  isSending: boolean;

  onSend: (text: string) => Promise<void>;

  onTyping?: () => void;
  onStopTyping?: () => void;
};

export function MessageComposer({
  disabled,
  disabledReason,
  isSending,
  onSend,
  onTyping,
  onStopTyping,
}: MessageComposerProps) {
  const [text, setText] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;

    setText(value);
    setErrorMessage(null);

    if (value.trim()) {
      onTyping?.();
      return;
    }

    onStopTyping?.();
  }

  async function submit() {
    if (disabled || isSending) {
      return;
    }

    const normalizedText = text.trim();

    if (!normalizedText) {
      return;
    }

    setErrorMessage(null);

    try {
      await onSend(normalizedText);

      setText("");
      onStopTyping?.();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao enviar mensagem.",
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form className={styles.wrapper} onSubmit={handleSubmit}>
      {disabledReason ? (
        <div className={styles.notice}>{disabledReason}</div>
      ) : null}

      {errorMessage ? (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className={styles.row}>
        <textarea
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onStopTyping}
          placeholder="Digite uma mensagem"
          maxLength={1_000}
          rows={1}
          disabled={disabled || isSending}
          aria-label="Mensagem"
        />

        <button type="submit" disabled={disabled || isSending || !text.trim()}>
          {isSending ? "..." : "Enviar"}
        </button>
      </div>

      <span className={styles.characterCount}>{text.length}/1000</span>
    </form>
  );
}
