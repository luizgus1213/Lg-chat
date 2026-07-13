import { useEffect, useState } from "react";

import { Modal } from "../../../../components/Modal";
import { listStatusViewers } from "../../status.api";
import type { StatusPost, StatusViewer } from "../../status.schemas";
import { formatStatusDate, getInitials, getStatusErrorMessage } from "../../status.utils";
import styles from "./styles.module.css";

type StatusViewersDialogProps = {
  status: StatusPost;
  onClose: () => void;
};

export function StatusViewersDialog({ status, onClose }: StatusViewersDialogProps) {
  const [viewers, setViewers] = useState<StatusViewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void listStatusViewers(status.id, { signal: controller.signal })
      .then((response) => setViewers(response.data))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setErrorMessage(getStatusErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [status.id]);

  return (
    <Modal
      title="Visualizações"
      description={`Publicado em ${formatStatusDate(status.createdAt)}`}
      onClose={onClose}
      size="small"
    >
      {loading ? <p className={styles.state} aria-live="polite">Carregando visualizações…</p> : null}
      {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
      {!loading && !errorMessage && viewers.length === 0 ? (
        <div className={styles.empty}>
          <span aria-hidden="true">◎</span>
          <p>Ninguém visualizou este status ainda.</p>
        </div>
      ) : null}
      {viewers.length > 0 ? (
        <ul className={styles.list} aria-label="Pessoas que visualizaram">
          {viewers.map(({ id, viewedAt, viewer }) => (
            <li key={id}>
              <div className={styles.avatar} aria-hidden="true">
                {viewer?.avatarUrl ? <img src={viewer.avatarUrl} alt="" /> : getInitials(viewer?.nome ?? "Usuário")}
              </div>
              <div>
                <strong>{viewer?.nome ?? "Usuário indisponível"}</strong>
                <span>{formatStatusDate(viewedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  );
}
