import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "../../../api/apiClient";
import { Modal } from "../../../components/Modal";
import { CreateStatusDialog, type StatusComposerMode } from "../components/CreateStatusDialog";
import { StatusViewer } from "../components/StatusViewer";
import { StatusViewersDialog } from "../components/StatusViewersDialog";
import {
  deleteStatus,
  listMyStatuses,
  listStatuses,
  markStatusViewed,
} from "../status.api";
import type { StatusGroup, StatusPost, StatusUser } from "../status.schemas";
import {
  formatStatusDate,
  getInitials,
  getStatusErrorMessage,
  safeStatusBackground,
} from "../status.utils";
import styles from "./styles.module.css";

type ViewerLocation = { groupIndex: number; statusIndex: number };

export type StatusPageProps = {
  currentUser: StatusUser;
  onBack?: () => void;
};

function withCurrentAuthor(status: StatusPost, currentUser: StatusUser): StatusPost {
  return {
    ...status,
    viewedByMe: true,
    author: currentUser,
  };
}

function addCreatedStatus(
  currentGroup: StatusGroup | null,
  status: StatusPost,
  currentUser: StatusUser,
): StatusGroup {
  const completeStatus = withCurrentAuthor(status, currentUser);
  const statuses = currentGroup
    ? [...currentGroup.statuses.filter((item) => item.id !== status.id), completeStatus]
    : [completeStatus];

  return {
    user: currentUser,
    statuses,
    hasUnseen: false,
    lastCreatedAt: status.createdAt,
    isMine: true,
  };
}

function removeStatusFromGroups(groups: StatusGroup[], statusId: number) {
  return groups.flatMap((group) => {
    const statuses = group.statuses.filter((status) => status.id !== statusId);
    if (statuses.length === 0) return [];
    return [{
      ...group,
      statuses,
      hasUnseen: statuses.some((status) => !status.viewedByMe && !group.isMine),
      lastCreatedAt: statuses.at(-1)?.createdAt ?? group.lastCreatedAt,
    }];
  });
}

function StatusAvatar({ user, unseen }: { user: StatusUser; unseen: boolean }) {
  return (
    <div className={`${styles.avatarRing} ${unseen ? styles.unseenRing : styles.seenRing}`}>
      <div className={styles.avatar} aria-hidden="true">
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : getInitials(user.nome)}
      </div>
    </div>
  );
}

function DeleteStatusDialog({
  status,
  deleting,
  errorMessage,
  onCancel,
  onConfirm,
}: {
  status: StatusPost;
  deleting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title="Apagar status?"
      description="Esta ação remove o status para todos e não pode ser desfeita."
      onClose={onCancel}
      busy={deleting}
      size="small"
      footer={
        <>
          <button className={styles.secondaryButton} type="button" disabled={deleting} onClick={onCancel}>
            Cancelar
          </button>
          <button className={styles.dangerButton} type="button" disabled={deleting} onClick={onConfirm}>
            {deleting ? "Apagando…" : "Apagar status"}
          </button>
        </>
      }
    >
      <div className={styles.deletePreview}>
        <span>{status.type === "text" ? "Texto" : status.type === "image" ? "Imagem" : "Vídeo"}</span>
        <strong>{formatStatusDate(status.createdAt)}</strong>
      </div>
      {errorMessage ? <p className={styles.dialogError} role="alert">{errorMessage}</p> : null}
    </Modal>
  );
}

export function StatusPage({ currentUser, onBack }: StatusPageProps) {
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [myStatuses, setMyStatuses] = useState<StatusGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<StatusComposerMode | null>(null);
  const [viewerLocation, setViewerLocation] = useState<ViewerLocation | null>(null);
  const [viewersStatus, setViewersStatus] = useState<StatusPost | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<StatusPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const activeLoadRef = useRef<AbortController | null>(null);

  const load = useCallback(async (background = false) => {
    activeLoadRef.current?.abort();
    const controller = new AbortController();
    activeLoadRef.current = controller;

    if (background) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [visibleResponse, mineResponse] = await Promise.all([
        listStatuses({ signal: controller.signal }),
        listMyStatuses({ signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;
      const visible = visibleResponse.data;
      const mine = mineResponse.data;
      setMyStatuses(mine);
      setGroups(
        mine && !visible.some((group) => group.user.id === currentUser.id)
          ? [mine, ...visible]
          : visible,
      );
    } catch (error) {
      if (!controller.signal.aborted) setErrorMessage(getStatusErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentUser.id]);

  useEffect(() => {
    const initialLoadFrame = window.requestAnimationFrame(() => void load());
    return () => {
      window.cancelAnimationFrame(initialLoadFrame);
      activeLoadRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    const activeStatuses = groups.flatMap((group) => group.statuses);
    if (activeStatuses.length === 0) return;
    const nextExpiration = Math.min(
      ...activeStatuses.map((status) => new Date(status.expiresAt).getTime()),
    );
    const delay = Math.min(
      Math.max(0, nextExpiration - Date.now()) + 50,
      2_147_000_000,
    );
    const timer = window.setTimeout(() => {
      const now = Date.now();
      const isActive = (status: StatusPost) =>
        new Date(status.expiresAt).getTime() > now;
      setGroups((current) =>
        current.flatMap((group) => {
          const statuses = group.statuses.filter(isActive);
          return statuses.length
            ? [{
                ...group,
                statuses,
                hasUnseen: statuses.some((status) => !status.viewedByMe && !group.isMine),
                lastCreatedAt: statuses.at(-1)?.createdAt ?? group.lastCreatedAt,
              }]
            : [];
        }),
      );
      setMyStatuses((current) => {
        if (!current) return null;
        const statuses = current.statuses.filter(isActive);
        return statuses.length
          ? { ...current, statuses, lastCreatedAt: statuses.at(-1)?.createdAt ?? current.lastCreatedAt }
          : null;
      });
      setViewerLocation(null);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [groups]);

  const contactGroups = useMemo(
    () => groups.filter((group) => group.user.id !== currentUser.id),
    [currentUser.id, groups],
  );

  function handleCreated(status: StatusPost) {
    const nextMine = addCreatedStatus(myStatuses, status, currentUser);
    setMyStatuses(nextMine);
    setGroups((current) => [
      nextMine,
      ...current.filter((group) => group.user.id !== currentUser.id),
    ]);
  }

  function openGroup(userId: number) {
    const groupIndex = groups.findIndex((group) => group.user.id === userId);
    if (groupIndex < 0) return;
    const group = groups[groupIndex];
    const firstUnseen = group.statuses.findIndex((status) => !status.viewedByMe);
    setViewerLocation({ groupIndex, statusIndex: firstUnseen >= 0 ? firstUnseen : 0 });
  }

  const handleViewed = useCallback(async (status: StatusPost) => {
    const response = await markStatusViewed(status.id);
    if (!response.data.viewed) return;

    setGroups((current) => current.map((group) => {
      if (group.user.id !== status.userId) return group;
      const statuses = group.statuses.map((item) =>
        item.id === status.id ? { ...item, viewedByMe: true } : item,
      );
      return {
        ...group,
        statuses,
        hasUnseen: statuses.some((item) => !item.viewedByMe),
      };
    }));
  }, []);

  const removeStatusLocally = useCallback((statusId: number) => {
    setGroups((current) => removeStatusFromGroups(current, statusId));
    setMyStatuses((current) => {
      if (!current) return null;
      const statuses = current.statuses.filter((status) => status.id !== statusId);
      if (statuses.length === 0) return null;
      return {
        ...current,
        statuses,
        lastCreatedAt: statuses.at(-1)?.createdAt ?? current.lastCreatedAt,
      };
    });
    setViewerLocation(null);
    setViewersStatus((current) => current?.id === statusId ? null : current);
  }, []);

  async function confirmDelete() {
    if (!deleteCandidate || deleting) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteStatus(deleteCandidate.id);
      removeStatusLocally(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (error) {
      if (error instanceof ApiError && error.code === "STATUS_NOT_FOUND") {
        removeStatusLocally(deleteCandidate.id);
        setDeleteCandidate(null);
      } else {
        setDeleteError(getStatusErrorMessage(error));
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleRow}>
          {onBack ? (
            <button className={styles.backButton} type="button" aria-label="Voltar para conversas" onClick={onBack}>‹</button>
          ) : null}
          <div>
            <span className={styles.eyebrow}>Atualizações</span>
            <h1>Status</h1>
            <p>Veja e compartilhe momentos que desaparecem em 24 horas.</p>
          </div>
        </div>
        <button
          className={styles.refreshButton}
          type="button"
          disabled={loading || refreshing}
          onClick={() => void load(true)}
        >
          {refreshing ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      <section className={styles.myStatusSection} aria-labelledby="my-status-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="my-status-heading">Meu status</h2>
            <p>{myStatuses ? `${myStatuses.statuses.length} ${myStatuses.statuses.length === 1 ? "publicação" : "publicações"}` : "Nenhuma publicação ativa"}</p>
          </div>
          <div className={styles.createActions}>
            <button type="button" onClick={() => setComposerMode("text")}>+ Texto</button>
            <button type="button" onClick={() => setComposerMode("media")}>+ Foto ou vídeo</button>
          </div>
        </div>

        <div className={styles.mineCard}>
          <button
            className={styles.mineIdentity}
            type="button"
            disabled={!myStatuses}
            onClick={() => openGroup(currentUser.id)}
          >
            <StatusAvatar user={currentUser} unseen={false} />
            <span>
              <strong>{currentUser.nome}</strong>
              <small>{myStatuses ? `Última publicação ${formatStatusDate(myStatuses.lastCreatedAt)}` : "Crie um status para começar"}</small>
            </span>
          </button>

          {myStatuses ? (
            <ul className={styles.mineList} aria-label="Meus status ativos">
              {[...myStatuses.statuses].reverse().map((status) => (
                <li key={status.id}>
                  <button className={styles.statusSummary} type="button" onClick={() => {
                    const groupIndex = groups.findIndex((group) => group.user.id === currentUser.id);
                    const statusIndex = groups[groupIndex]?.statuses.findIndex((item) => item.id === status.id) ?? -1;
                    if (groupIndex >= 0 && statusIndex >= 0) setViewerLocation({ groupIndex, statusIndex });
                  }}>
                    <span
                      className={styles.statusThumbnail}
                      style={status.type === "text" ? { background: safeStatusBackground(status.backgroundColor) } : undefined}
                    >
                      {status.type === "image" && status.mediaUrl ? <img src={status.mediaUrl} alt="" /> : null}
                      {status.type === "video" ? "▶" : null}
                      {status.type === "text" ? "Aa" : null}
                    </span>
                    <span>
                      <strong>{status.type === "text" ? "Status de texto" : status.type === "image" ? "Foto" : "Vídeo"}</strong>
                      <small>{formatStatusDate(status.createdAt)} · {status.viewCount} visualizações</small>
                    </span>
                  </button>
                  <button className={styles.inlineButton} type="button" onClick={() => setViewersStatus(status)}>Ver pessoas</button>
                  <button className={styles.inlineDeleteButton} type="button" onClick={() => {
                    setDeleteError(null);
                    setDeleteCandidate(status);
                  }}>Apagar</button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className={styles.contactsSection} aria-labelledby="recent-status-heading" aria-busy={loading || refreshing}>
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="recent-status-heading">Atualizações recentes</h2>
            <p>O aro verde indica publicações ainda não vistas.</p>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState} aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <p>Carregando status…</p>
          </div>
        ) : null}

        {!loading && errorMessage ? (
          <div className={styles.errorState} role="alert">
            <strong>Não foi possível carregar os status.</strong>
            <p>{errorMessage}</p>
            <button type="button" onClick={() => void load()}>Tentar novamente</button>
          </div>
        ) : null}

        {!loading && !errorMessage && contactGroups.length === 0 ? (
          <div className={styles.emptyState}>
            <span aria-hidden="true">◌</span>
            <strong>Nenhuma atualização recente</strong>
            <p>Quando seus contatos publicarem, os status aparecerão aqui.</p>
          </div>
        ) : null}

        {contactGroups.length > 0 ? (
          <ul className={styles.groupList} aria-label="Status dos contatos">
            {contactGroups.map((group) => (
              <li key={group.user.id}>
                <button type="button" onClick={() => openGroup(group.user.id)}>
                  <StatusAvatar user={group.user} unseen={group.hasUnseen} />
                  <span className={styles.groupInfo}>
                    <strong>{group.user.nome}</strong>
                    <small>{formatStatusDate(group.lastCreatedAt)}</small>
                  </span>
                  <span className={group.hasUnseen ? styles.unseenBadge : styles.seenBadge}>
                    {group.hasUnseen ? "Novo" : "Visto"}
                  </span>
                  <span className={styles.statusCount}>{group.statuses.length}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <span className={styles.liveRegion} aria-live="polite">
        {refreshing ? "Atualizando lista de status." : ""}
      </span>

      {composerMode ? (
        <CreateStatusDialog
          initialMode={composerMode}
          onClose={() => setComposerMode(null)}
          onCreated={handleCreated}
        />
      ) : null}

      {viewerLocation && groups.length > 0 ? (
        <StatusViewer
          groups={groups}
          initialLocation={viewerLocation}
          currentUserId={currentUser.id}
          onClose={() => setViewerLocation(null)}
          onViewed={handleViewed}
          onExpired={() => void load(true)}
          onRequestDelete={(status) => {
            setViewerLocation(null);
            setDeleteError(null);
            setDeleteCandidate(status);
          }}
          onShowViewers={(status) => {
            setViewerLocation(null);
            setViewersStatus(status);
          }}
        />
      ) : null}

      {viewersStatus ? <StatusViewersDialog status={viewersStatus} onClose={() => setViewersStatus(null)} /> : null}

      {deleteCandidate ? (
        <DeleteStatusDialog
          status={deleteCandidate}
          deleting={deleting}
          errorMessage={deleteError}
          onCancel={() => {
            if (!deleting) {
              setDeleteCandidate(null);
              setDeleteError(null);
            }
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </section>
  );
}
