import { useEffect, useState } from "react";

import {
  RECOVERABLE_ERROR_EVENT,
  type RecoverableErrorDetail,
} from "../api/apiEvents";
import { useSocket } from "../socket/useSocket";
import { reportClientError } from "./clientDiagnostics";

import styles from "./errors.module.css";

export function GlobalErrorPresenter() {
  const { errorMessage: socketError } = useSocket();
  const [message, setMessage] = useState<string | null>(null);
  const [dismissedSocketError, setDismissedSocketError] = useState<
    string | null
  >(null);

  useEffect(() => {
    const handleRecoverable = (event: Event) => {
      const customEvent = event as CustomEvent<RecoverableErrorDetail>;
      setMessage(customEvent.detail.message);
    };

    window.addEventListener(RECOVERABLE_ERROR_EVENT, handleRecoverable);
    return () =>
      window.removeEventListener(RECOVERABLE_ERROR_EVENT, handleRecoverable);
  }, []);

  useEffect(() => {
    if (!socketError) return;
    reportClientError({
      type: "socket_error",
      message: socketError,
      level: "warn",
    });
  }, [socketError]);

  const displayedMessage =
    message ?? (socketError !== dismissedSocketError ? socketError : null);

  if (!displayedMessage) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span>{displayedMessage}</span>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => {
          if (message) setMessage(null);
          else setDismissedSocketError(socketError);
        }}
      >
        ×
      </button>
    </div>
  );
}
