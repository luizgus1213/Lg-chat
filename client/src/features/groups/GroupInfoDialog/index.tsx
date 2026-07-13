import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";

import { Modal } from "../../../components/Modal";
import { ApiError } from "../../../api/apiClient";
import { ConversationAvatar } from "../../conversations/components/ConversationAvatar";
import { useUsers } from "../../users/hooks/useUsers";
import {
  addGroupMember,
  deleteGroup,
  getGroup,
  leaveGroup,
  listGroupMembers,
  removeGroupMember,
  updateGroup,
  uploadGroupAvatar,
} from "../groups.api";
import { getGroupErrorMessage } from "../groups.errors";
import type { GroupChat, GroupMember } from "../groups.schemas";

import styles from "./styles.module.css";

type Props = {
  chatId: number;
  currentUserId: number;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onRemoved: () => Promise<void> | void;
};

type Confirmation = "leave" | "delete" | { remove: GroupMember } | null;

export function GroupInfoDialog({ chatId, currentUserId, onClose, onChanged, onRemoved }: Props) {
  const { users } = useUsers();
  const nameId = useId();
  const descriptionId = useId();
  const addId = useId();
  const avatarId = useId();
  const requestRef = useRef<AbortController | null>(null);
  const confirmationFocusRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onRemovedRef = useRef(onRemoved);
  const busyRef = useRef(false);
  const [group, setGroup] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    onRemovedRef.current = onRemoved;
  }, [onClose, onRemoved]);

  useEffect(() => {
    if (!confirmation) return;
    const frame = window.requestAnimationFrame(() => confirmationFocusRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [confirmation]);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [groupResponse, membersResponse] = await Promise.all([
        getGroup(chatId, { signal }),
        listGroupMembers(chatId, { signal }),
      ]);
      if (signal?.aborted) return;
      setGroup(groupResponse.data);
      setMembers(membersResponse.data);
      setName(groupResponse.data.name ?? "");
      setDescription(groupResponse.data.description ?? "");
      setStatus("ready");
      setError(null);
    } catch (requestError: unknown) {
      if (!signal?.aborted) {
        if (
          requestError instanceof ApiError &&
          ["CHAT_ACCESS_DENIED", "GROUP_NOT_FOUND", "CHAT_NOT_FOUND"].includes(requestError.code)
        ) {
          await onRemovedRef.current();
          onCloseRef.current();
          return;
        }
        setStatus("error");
        setError(getGroupErrorMessage(requestError));
      }
    }
  }, [chatId]);

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    queueMicrotask(() => void load(controller.signal));
    return () => controller.abort();
  }, [load]);

  const availableUsers = useMemo(() => {
    const ids = new Set(members.map((member) => member.userId));
    return users.filter((user) => !ids.has(user.id));
  }, [members, users]);

  async function run(
    action: string,
    request: (signal: AbortSignal) => Promise<unknown>,
    after: "reload" | "remove" = "reload",
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
      setConfirmation(null);
      if (after === "remove") {
        await onRemoved();
        if (!controller.signal.aborted) onClose();
        return;
      }
      await load(controller.signal);
      await onChanged();
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) setError(getGroupErrorMessage(requestError));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      busyRef.current = false;
      if (!controller.signal.aborted) setBusyAction(null);
    }
  }

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group) return;
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    if (cleanName.length < 2 || cleanName.length > 120) { setError("O nome deve ter entre 2 e 120 caracteres."); return; }
    if (cleanDescription.length > 500) { setError("A descrição deve ter no máximo 500 caracteres."); return; }
    void run("details", (signal) => updateGroup(chatId, { name: cleanName, description: cleanDescription || null }, { signal }));
  }

  function changeAvatar(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) { setError("Use uma imagem JPG, PNG ou WEBP."); return; }
    if (file.size <= 0 || file.size > 2 * 1024 * 1024) { setError("A foto do grupo deve ter no máximo 2 MB."); return; }
    void run("avatar", (signal) => uploadGroupAvatar(chatId, file, { signal }));
  }

  const isBusy = busyAction !== null;
  const canManage = Boolean(group?.canManageGroup);

  return (
    <Modal
      title="Informações do grupo"
      description={group ? `${members.length} membro(s)` : "Carregando detalhes do grupo."}
      onClose={() => {
        if (confirmation) setConfirmation(null);
        else onClose();
      }}
      busy={isBusy}
      size="large"
    >
      {status === "loading" ? <div className={styles.state} role="status">Carregando grupo…</div> : null}
      {status === "error" ? (
        <div className={styles.state} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => { setStatus("loading"); void load(); }}>Tentar novamente</button>
        </div>
      ) : null}

      {status === "ready" && group ? confirmation ? (
        <div className={styles.confirm} role="alertdialog" aria-label="Confirmar ação do grupo">
          <strong>
            {confirmation === "leave" ? "Sair deste grupo?" : confirmation === "delete" ? "Excluir este grupo para todos?" : `Remover ${confirmation.remove.user.nome}?`}
          </strong>
          <span>{confirmation === "delete" ? "O histórico e o grupo serão removidos permanentemente." : "Confirme para continuar."}</span>
          <div>
            <button ref={confirmationFocusRef} type="button" disabled={isBusy} onClick={() => setConfirmation(null)}>Cancelar</button>
            <button className={styles.dangerButton} type="button" disabled={isBusy} onClick={() => {
              if (confirmation === "leave") void run("leave", (signal) => leaveGroup(chatId, { signal }), "remove");
              else if (confirmation === "delete") void run("delete", (signal) => deleteGroup(chatId, { signal }), "remove");
              else void run("remove", (signal) => removeGroupMember(chatId, confirmation.remove.userId, { signal }));
            }}>{isBusy ? "Processando…" : "Confirmar"}</button>
          </div>
        </div>
      ) : (
        <div className={styles.layout}>
          <section className={styles.summary} aria-label="Dados do grupo">
            <ConversationAvatar name={group.name ?? "Grupo"} src={group.avatarUrl} size="large" />
            <div><strong>{group.name}</strong><span>{group.description || "Sem descrição"}</span></div>
            {canManage ? (
              <>
                <label className={styles.fileButton} htmlFor={avatarId}>{busyAction === "avatar" ? "Enviando…" : "Alterar foto"}</label>
                <input id={avatarId} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={isBusy} onChange={(event) => changeAvatar(event.target.files?.[0] ?? null)} />
              </>
            ) : null}
          </section>

          {canManage ? (
            <form className={styles.detailsForm} onSubmit={saveDetails}>
              <label className={styles.field} htmlFor={nameId}>
                <span>Nome</span>
                <input id={nameId} value={name} maxLength={120} disabled={isBusy} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className={styles.field} htmlFor={descriptionId}>
                <span>Descrição</span>
                <textarea id={descriptionId} value={description} maxLength={500} rows={3} disabled={isBusy} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <button className={styles.primary} type="submit" disabled={isBusy || name.trim().length < 2}>{busyAction === "details" ? "Salvando…" : "Salvar informações"}</button>
            </form>
          ) : null}

          <section className={styles.members} aria-labelledby="members-title">
            <div className={styles.sectionTitle}><strong id="members-title">Membros</strong><span>{members.length}</span></div>
            {canManage && availableUsers.length > 0 ? (
              <div className={styles.addMember}>
                <label className={styles.field} htmlFor={addId}>
                  <span>Adicionar pessoa</span>
                  <select id={addId} value={selectedUserId} disabled={isBusy} onChange={(event) => setSelectedUserId(event.target.value)}>
                    <option value="">Selecione um usuário</option>
                    {availableUsers.map((user) => <option key={user.id} value={user.id}>{user.nome} — {user.email}</option>)}
                  </select>
                </label>
                <button className={styles.secondary} type="button" disabled={isBusy || !selectedUserId} onClick={() => void run("add", async (signal) => {
                  await addGroupMember(chatId, Number(selectedUserId), { signal });
                  setSelectedUserId("");
                })}>{busyAction === "add" ? "Adicionando…" : "Adicionar"}</button>
              </div>
            ) : null}
            <ul className={styles.memberList}>
              {members.map((member) => (
                <li key={member.id}>
                  <ConversationAvatar name={member.user.nome} src={member.user.avatarUrl} size="small" />
                  <span><strong>{member.user.nome}{member.userId === currentUserId ? " (você)" : ""}</strong><small>{member.user.email}</small></span>
                  <em>{member.role === "owner" ? "Dono" : member.role === "admin" ? "Admin" : "Membro"}</em>
                  {canManage && member.userId !== currentUserId ? <button type="button" disabled={isBusy} onClick={() => setConfirmation({ remove: member })}>Remover</button> : null}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.dangerZone} aria-label="Ações do grupo">
            <button type="button" disabled={isBusy} onClick={() => setConfirmation("leave")}>Sair do grupo</button>
            {canManage ? <button type="button" disabled={isBusy} onClick={() => setConfirmation("delete")}>Excluir grupo</button> : null}
          </section>

          {error ? <div className={styles.error} role="alert">{error}</div> : null}
        </div>
      ) : null}
    </Modal>
  );
}
