import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Modal } from "../../../components/Modal";
import { useUsers } from "../../users/hooks/useUsers";
import { createGroup, uploadGroupAvatar } from "../groups.api";
import { getGroupErrorMessage } from "../groups.errors";

import styles from "./styles.module.css";

type Props = {
  onClose: () => void;
  onCreated: (chatId: number) => Promise<void> | void;
};

const AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function NewGroupDialog({ onClose, onCreated }: Props) {
  const { users, status, errorMessage, refresh } = useUsers();
  const nameId = useId();
  const descriptionId = useId();
  const searchId = useId();
  const avatarId = useId();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const createdChatIdRef = useRef<number | null>(null);
  const [createdChatId, setCreatedChatId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [memberIds, setMemberIds] = useState<Set<number>>(() => new Set());
  const [avatar, setAvatar] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => requestRef.current?.abort(), []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return users;
    return users.filter((user) =>
      `${user.nome} ${user.email}`.toLocaleLowerCase("pt-BR").includes(query),
    );
  }, [search, users]);

  function toggleMember(userId: number) {
    setMemberIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else if (next.size < 100) next.add(userId);
      return next;
    });
  }

  function closeDialog() {
    const createdChatId = createdChatIdRef.current;
    if (createdChatId) {
      createdChatIdRef.current = null;
      setCreatedChatId(null);
      void Promise.resolve(onCreated(createdChatId)).then(onClose, onClose);
      return;
    }
    onClose();
  }

  function chooseAvatar(file: File | null) {
    setError(null);
    if (!file) {
      setAvatar(null);
      return;
    }
    if (!AVATAR_TYPES.has(file.type)) {
      setError("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size <= 0 || file.size > 2 * 1024 * 1024) {
      setError("A imagem do grupo deve ter no máximo 2 MB.");
      return;
    }
    setAvatar(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    if (cleanName.length < 2 || cleanName.length > 120) {
      setError("O nome do grupo deve ter entre 2 e 120 caracteres.");
      return;
    }
    if (cleanDescription.length > 500) {
      setError("A descrição deve ter no máximo 500 caracteres.");
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      let chatId = createdChatIdRef.current;
      if (!chatId) {
        const created = await createGroup(
          {
            name: cleanName,
            description: cleanDescription || null,
            memberIds: Array.from(memberIds),
          },
          { signal: controller.signal },
        );
        chatId = created.data.id;
        createdChatIdRef.current = chatId;
        setCreatedChatId(chatId);
      }
      if (avatar)
        await uploadGroupAvatar(chatId, avatar, { signal: controller.signal });
      if (controller.signal.aborted) return;
      await onCreated(chatId);
      createdChatIdRef.current = null;
      setCreatedChatId(null);
      if (!controller.signal.aborted) onClose();
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) {
        const message = getGroupErrorMessage(requestError);
        setError(
          createdChatIdRef.current
            ? `O grupo foi criado, mas não foi possível concluir a foto ou a abertura. Tente novamente ou conclua sem a foto. ${message}`
            : message,
        );
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      busyRef.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <Modal
      title="Novo grupo"
      description="Escolha participantes e defina as informações do grupo."
      onClose={closeDialog}
      initialFocusRef={nameRef}
      busy={busy}
      size="large"
      footer={
        <>
          <button
            className={styles.secondary}
            type="button"
            disabled={busy}
            onClick={closeDialog}
          >
            {createdChatId ? "Concluir sem foto" : "Cancelar"}
          </button>
          <button
            className={styles.primary}
            type="submit"
            form="new-group-form"
            disabled={busy || name.trim().length < 2}
          >
            {busy ? "Criando grupo…" : "Criar grupo"}
          </button>
        </>
      }
    >
      <form
        id="new-group-form"
        className={styles.form}
        onSubmit={submit}
        noValidate
      >
        <div className={styles.grid}>
          <label className={styles.field} htmlFor={nameId}>
            <span>Nome do grupo</span>
            <input
              ref={nameRef}
              id={nameId}
              value={name}
              maxLength={120}
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
          </label>
          <label className={styles.field} htmlFor={avatarId}>
            <span>Foto do grupo (opcional)</span>
            <input
              id={avatarId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) =>
                chooseAvatar(event.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>
        <label className={styles.field} htmlFor={descriptionId}>
          <span>Descrição (opcional)</span>
          <textarea
            id={descriptionId}
            value={description}
            rows={2}
            maxLength={500}
            disabled={busy}
            onChange={(event) => {
              setDescription(event.target.value);
              setError(null);
            }}
          />
        </label>

        <section
          className={styles.people}
          aria-labelledby="group-members-heading"
        >
          <div className={styles.peopleHeader}>
            <div>
              <strong id="group-members-heading">Participantes</strong>
              <span>{memberIds.size} selecionado(s)</span>
            </div>
            <button
              type="button"
              disabled={busy || status === "refreshing"}
              onClick={() => void refresh()}
            >
              Atualizar
            </button>
          </div>
          <label className={styles.field} htmlFor={searchId}>
            <span>Buscar por nome ou e-mail</span>
            <input
              id={searchId}
              type="search"
              value={search}
              disabled={busy}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {errorMessage ? (
            <div className={styles.error} role="alert">
              {errorMessage}
            </div>
          ) : null}
          <div
            className={styles.userList}
            aria-busy={status === "loading" || status === "refreshing"}
          >
            {status === "loading" ? (
              <p role="status">Carregando usuários…</p>
            ) : null}
            {status === "error" ? (
              <p role="alert">Não foi possível carregar usuários.</p>
            ) : null}
            {(status === "ready" || status === "refreshing") &&
            filteredUsers.length === 0 ? (
              <p>Nenhum usuário encontrado.</p>
            ) : null}
            {filteredUsers.map((user) => (
              <label className={styles.user} key={user.id}>
                <input
                  type="checkbox"
                  checked={memberIds.has(user.id)}
                  disabled={
                    busy || (!memberIds.has(user.id) && memberIds.size >= 100)
                  }
                  onChange={() => toggleMember(user.id)}
                />
                <span aria-hidden="true">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" />
                  ) : (
                    user.nome.charAt(0).toUpperCase()
                  )}
                </span>
                <span>
                  <strong>{user.nome}</strong>
                  <small>{user.email}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
