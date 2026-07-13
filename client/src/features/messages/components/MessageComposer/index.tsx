import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type { ChatMessage } from "../../messages.schemas";

import styles from "./styles.module.css";

const MEDIA_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/aac",
  ".pdf",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".rar",
  ".7z",
].join(",");

type MessageComposerProps = {
  disabled: boolean;
  disabledReason?: string | null;
  isSending: boolean;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSendText: (text: string, replyTo: ChatMessage | null) => Promise<void>;
  onSendMedia: (
    file: File,
    caption: string,
    replyTo: ChatMessage | null,
  ) => Promise<void>;
  onTyping?: () => void;
  onStopTyping?: () => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function getReplyLabel(message: ChatMessage) {
  if (message.text?.trim()) return message.text.trim();
  if (message.mediaOriginalName) return message.mediaOriginalName;
  return "Mensagem";
}

export function MessageComposer({
  disabled,
  disabledReason,
  isSending,
  replyTo,
  onCancelReply,
  onSendText,
  onSendMedia,
  onTyping,
  onStopTyping,
}: MessageComposerProps) {
  const textareaId = useId();
  const fileInputId = useId();
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (replyTo && !disabled) textareaRef.current?.focus();
  }, [disabled, replyTo]);

  const previewUrl = useMemo(() => {
    if (!selectedFile || (!selectedFile.type.startsWith("image/") && !selectedFile.type.startsWith("video/"))) return null;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resizeTextarea(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setText(value);
    setErrorMessage(null);
    resizeTextarea(event.target);

    if (value.trim()) onTyping?.();
    else onStopTyping?.();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMessage(null);
    if (file && !disabled) textareaRef.current?.focus();
  }

  function removeSelectedFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit() {
    if (disabled || isSending || submittingRef.current) return;

    const normalizedText = text.trim();
    if (!normalizedText && !selectedFile) return;

    submittingRef.current = true;
    setErrorMessage(null);

    try {
      if (selectedFile) {
        await onSendMedia(selectedFile, normalizedText, replyTo);
      } else {
        await onSendText(normalizedText, replyTo);
      }

      setText("");
      removeSelectedFile();
      onCancelReply();
      onStopTyping?.();

      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao enviar mensagem.",
      );
    } finally {
      submittingRef.current = false;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  const isDisabled = disabled || isSending;
  const canSubmit = !isDisabled && Boolean(text.trim() || selectedFile);

  return (
    <form
      className={styles.wrapper}
      onSubmit={handleSubmit}
      aria-busy={isSending}
    >
      {disabledReason ? (
        <div className={styles.notice} role="status">
          {disabledReason}
        </div>
      ) : null}

      {errorMessage ? (
        <div className={styles.error} role="alert" aria-live="assertive">
          {errorMessage}
        </div>
      ) : null}

      {replyTo ? (
        <div className={styles.replyPreview}>
          <span>
            <strong>Respondendo</strong>
            <span>{getReplyLabel(replyTo)}</span>
          </span>
          <button
            type="button"
            aria-label="Cancelar resposta"
            disabled={isSending}
            onClick={onCancelReply}
          >
            ×
          </button>
        </div>
      ) : null}

      {selectedFile ? (
        <div className={styles.filePreview}>
          {previewUrl && selectedFile.type.startsWith("image/") ? (
            <img className={styles.previewMedia} src={previewUrl} alt="Prévia do arquivo selecionado" />
          ) : null}
          {previewUrl && selectedFile.type.startsWith("video/") ? (
            <video className={styles.previewMedia} src={previewUrl} controls preload="metadata" aria-label="Prévia do vídeo selecionado" />
          ) : null}
          <span aria-hidden="true">📎</span>
          <span className={styles.fileDetails}>
            <strong>{selectedFile.name}</strong>
            <span>
              {selectedFile.type || "Arquivo"} · {formatFileSize(selectedFile.size)}
            </span>
          </span>
          <button
            type="button"
            aria-label="Remover arquivo selecionado"
            disabled={isSending}
            onClick={removeSelectedFile}
          >
            ×
          </button>
        </div>
      ) : null}

      <div className={styles.row}>
        <input
          ref={fileInputRef}
          id={fileInputId}
          className={styles.fileInput}
          type="file"
          accept={MEDIA_ACCEPT}
          disabled={isDisabled}
          onChange={handleFileChange}
        />
        <label
          className={styles.attachButton}
          htmlFor={fileInputId}
          aria-label="Anexar foto, vídeo, áudio ou documento"
          title="Anexar arquivo"
          aria-disabled={isDisabled}
        >
          <span aria-hidden="true">＋</span>
          <span className={styles.visuallyHidden}>Anexar arquivo</span>
        </label>

        <label className={styles.visuallyHidden} htmlFor={textareaId}>
          Mensagem ou legenda
        </label>
        <textarea
          ref={textareaRef}
          id={textareaId}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onStopTyping}
          placeholder={selectedFile ? "Adicione uma legenda" : "Digite uma mensagem"}
          maxLength={1_000}
          rows={1}
          disabled={isDisabled}
        />

        <button type="submit" disabled={!canSubmit}>
          {isSending ? "Enviando…" : "Enviar"}
        </button>
      </div>

      <span className={styles.characterCount}>{text.length}/1000</span>
    </form>
  );
}
