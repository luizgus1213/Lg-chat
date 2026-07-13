import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";

import { Modal } from "../../../../components/Modal";
import { createMediaStatus, createTextStatus } from "../../status.api";
import {
  STATUS_MEDIA_ACCEPT,
  STATUS_TEXT_COLORS,
  createTextStatusInputSchema,
  statusMediaInputSchema,
  type StatusPost,
  type StatusTextColor,
} from "../../status.schemas";
import { getStatusErrorMessage } from "../../status.utils";
import styles from "./styles.module.css";

export type StatusComposerMode = "text" | "media";

type CreateStatusDialogProps = {
  initialMode: StatusComposerMode;
  onClose: () => void;
  onCreated: (status: StatusPost) => void;
};

function firstValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Confira os dados do status.";
}

export function CreateStatusDialog({
  initialMode,
  onClose,
  onCreated,
}: CreateStatusDialogProps) {
  const [mode, setMode] = useState<StatusComposerMode>(initialMode);
  const [text, setText] = useState("");
  const [color, setColor] = useState<StatusTextColor>(STATUS_TEXT_COLORS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const captionId = useId();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function selectMode(nextMode: StatusComposerMode) {
    if (submitting) return;
    setMode(nextMode);
    setErrorMessage(null);
  }

  function handleFileChange(selectedFile: File | null) {
    if (!selectedFile) {
      setFile(null);
      return;
    }

    const result = statusMediaInputSchema.safeParse({ file: selectedFile, text: caption });
    if (!result.success) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setErrorMessage(firstValidationMessage(result.error));
      return;
    }

    setErrorMessage(null);
    setFile(selectedFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setErrorMessage(null);
    setSubmitting(true);

    try {
      const response =
        mode === "text"
          ? await createTextStatus(createTextStatusInputSchema.parse({
              text,
              backgroundColor: color,
            }))
          : await createMediaStatus(statusMediaInputSchema.parse({ file, text: caption }));

      onCreated(response.data);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof z.ZodError
          ? firstValidationMessage(error)
          : getStatusErrorMessage(error),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Publicar status"
      description="O status fica disponível por 24 horas para seus contatos."
      onClose={onClose}
      busy={submitting}
      size="medium"
      initialFocusRef={mode === "text" ? textAreaRef : undefined}
      footer={
        <>
          <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button className={styles.primaryButton} type="submit" form="status-composer-form" disabled={submitting}>
            {submitting ? "Publicando…" : "Publicar"}
          </button>
        </>
      }
    >
      <div className={styles.modeTabs} role="tablist" aria-label="Tipo de status">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "text"}
          className={mode === "text" ? styles.activeTab : styles.tab}
          onClick={() => selectMode("text")}
        >
          Texto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "media"}
          className={mode === "media" ? styles.activeTab : styles.tab}
          onClick={() => selectMode("media")}
        >
          Foto ou vídeo
        </button>
      </div>

      <form id="status-composer-form" className={styles.form} onSubmit={handleSubmit}>
        {mode === "text" ? (
          <>
            <div className={styles.textPreview} style={{ background: color }}>
              <p>{text.trim() || "Seu texto aparecerá aqui"}</p>
            </div>
            <label className={styles.fieldLabel} htmlFor="status-text">Texto</label>
            <textarea
              ref={textAreaRef}
              id="status-text"
              value={text}
              maxLength={700}
              rows={4}
              disabled={submitting}
              onChange={(event) => setText(event.target.value)}
              aria-describedby="status-text-counter"
            />
            <span id="status-text-counter" className={styles.counter}>{text.length}/700</span>

            <fieldset className={styles.palette}>
              <legend>Cor de fundo</legend>
              <div>
                {STATUS_TEXT_COLORS.map((option) => (
                  <button
                    key={option}
                    className={styles.colorButton}
                    style={{ backgroundColor: option }}
                    type="button"
                    aria-label={`Usar cor ${option}`}
                    aria-pressed={color === option}
                    disabled={submitting}
                    onClick={() => setColor(option)}
                  />
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <label className={styles.filePicker} htmlFor="status-media">
              <strong>{file ? "Trocar arquivo" : "Escolher foto ou vídeo"}</strong>
              <span>Imagem até 8 MB ou vídeo até 30 MB</span>
            </label>
            <input
              ref={fileInputRef}
              id="status-media"
              className={styles.hiddenInput}
              type="file"
              accept={STATUS_MEDIA_ACCEPT}
              disabled={submitting}
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />

            {file && previewUrl ? (
              <div className={styles.mediaPreview}>
                {file.type.startsWith("video/") ? (
                  <video src={previewUrl} controls muted playsInline aria-label="Prévia do vídeo selecionado" />
                ) : (
                  <img src={previewUrl} alt="Prévia da imagem selecionada" />
                )}
                <p title={file.name}>{file.name}</p>
              </div>
            ) : null}

            <label className={styles.fieldLabel} htmlFor={captionId}>Legenda opcional</label>
            <textarea
              id={captionId}
              value={caption}
              maxLength={700}
              rows={3}
              disabled={submitting}
              onChange={(event) => setCaption(event.target.value)}
              aria-describedby={`${captionId}-counter`}
            />
            <span id={`${captionId}-counter`} className={styles.counter}>{caption.length}/700</span>
          </>
        )}

        {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
        <span className={styles.liveRegion} aria-live="polite">
          {submitting ? "Publicando status. Aguarde." : ""}
        </span>
      </form>
    </Modal>
  );
}
