import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Modal } from "../../../components/Modal";
import { ConversationAvatar } from "../../conversations/components/ConversationAvatar";
import { getAuthErrorMessage } from "../../auth/auth.errors";
import { useAuth } from "../../auth/useAuth";
import { updateProfile, updateProfileAvatar } from "../profile.api";

import styles from "./styles.module.css";

type ProfileDialogProps = { onClose: () => void };

const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function validateAvatar(file: File) {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WEBP.");
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }
}

export function ProfileDialog({ onClose }: ProfileDialogProps) {
  const auth = useAuth();
  const user = auth.user;
  const nameId = useId();
  const aboutId = useId();
  const fileId = useId();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);
  const [nome, setNome] = useState(user?.nome ?? "");
  const [about, setAbout] = useState(user?.about ?? "Disponível");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  const previewUrl = useMemo(() => (avatar ? URL.createObjectURL(avatar) : null), [avatar]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setAvatar(null);
      return;
    }
    try {
      validateAvatar(file);
      setAvatar(file);
    } catch (validationError: unknown) {
      event.target.value = "";
      setAvatar(null);
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Imagem inválida.",
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || submittingRef.current) return;
    const cleanName = nome.trim();
    const cleanAbout = about.trim();
    if (cleanName.length < 2 || cleanName.length > 120) {
      setError("O nome deve ter entre 2 e 120 caracteres.");
      return;
    }
    if (cleanAbout.length > 140) {
      setError("O recado deve ter no máximo 140 caracteres.");
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      let updatedUser = user;
      if (cleanName !== user.nome || cleanAbout !== (user.about ?? "")) {
        updatedUser = (
          await updateProfile(
            { nome: cleanName, about: cleanAbout || null },
            { signal: controller.signal },
          )
        ).data;
        auth.updateUser(updatedUser);
      }
      if (avatar) {
        updatedUser = (
          await updateProfileAvatar(avatar, { signal: controller.signal })
        ).data;
        auth.updateUser(updatedUser);
      }
      if (!controller.signal.aborted) onClose();
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) setError(getAuthErrorMessage(requestError));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      submittingRef.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <Modal
      title="Meu perfil"
      description="Atualize como você aparece no LG Chat."
      onClose={onClose}
      initialFocusRef={nameRef}
      busy={busy}
      footer={
        <>
          <button className={styles.secondary} type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className={styles.primary} type="submit" form="profile-form" disabled={busy}>
            {busy ? "Salvando…" : "Salvar perfil"}
          </button>
        </>
      }
    >
      <form id="profile-form" className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.avatarRow}>
          <ConversationAvatar
            name={nome || user.nome}
            src={previewUrl || user.avatarUrl}
            size="large"
          />
          <div>
            <label className={styles.fileButton} htmlFor={fileId}>Escolher foto</label>
            <input
              id={fileId}
              className={styles.hiddenInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={chooseAvatar}
            />
            <small>JPG, PNG ou WEBP, até 5 MB.</small>
          </div>
        </div>

        <label className={styles.field} htmlFor={nameId}>
          <span>Nome</span>
          <input
            ref={nameRef}
            id={nameId}
            value={nome}
            maxLength={120}
            disabled={busy}
            autoComplete="name"
            onChange={(event) => { setNome(event.target.value); setError(null); }}
          />
        </label>

        <label className={styles.field} htmlFor={aboutId}>
          <span>Recado</span>
          <textarea
            id={aboutId}
            value={about}
            maxLength={140}
            rows={3}
            disabled={busy}
            onChange={(event) => { setAbout(event.target.value); setError(null); }}
          />
          <small>{about.length}/140</small>
        </label>

        {error ? <div className={styles.error} role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}
