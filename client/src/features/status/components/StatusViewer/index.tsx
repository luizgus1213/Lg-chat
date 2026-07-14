import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { ApiError } from "../../../../api/apiClient";
import type { StatusGroup, StatusPost } from "../../status.schemas";
import {
  formatStatusDate,
  getInitials,
  getStatusErrorMessage,
} from "../../status.utils";
import { StatusPlayback } from "./StatusPlayback";
import styles from "./styles.module.css";

type StatusLocation = { groupIndex: number; statusIndex: number };

type StatusViewerProps = {
  groups: StatusGroup[];
  initialLocation: StatusLocation;
  currentUserId: number;
  onClose: () => void;
  onViewed: (status: StatusPost) => Promise<void>;
  onExpired: () => void;
  onRequestDelete: (status: StatusPost) => void;
  onShowViewers: (status: StatusPost) => void;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "video[controls]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function nextLocation(
  groups: StatusGroup[],
  current: StatusLocation,
  direction: 1 | -1,
) {
  const currentGroup = groups[current.groupIndex];
  if (!currentGroup) return null;

  if (direction === 1) {
    if (current.statusIndex + 1 < currentGroup.statuses.length) {
      return { ...current, statusIndex: current.statusIndex + 1 };
    }
    if (current.groupIndex + 1 < groups.length) {
      return { groupIndex: current.groupIndex + 1, statusIndex: 0 };
    }
    return null;
  }

  if (current.statusIndex > 0)
    return { ...current, statusIndex: current.statusIndex - 1 };
  if (current.groupIndex > 0) {
    const previousGroupIndex = current.groupIndex - 1;
    return {
      groupIndex: previousGroupIndex,
      statusIndex: groups[previousGroupIndex].statuses.length - 1,
    };
  }
  return null;
}

export function StatusViewer({
  groups,
  initialLocation,
  currentUserId,
  onClose,
  onViewed,
  onExpired,
  onRequestDelete,
  onShowViewers,
}: StatusViewerProps) {
  const [location, setLocation] = useState(initialLocation);
  const [progress, setProgress] = useState(0);
  const [manualPaused, setManualPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(document.hidden);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const viewedIdsRef = useRef(new Set<number>());
  const closeRef = useRef(onClose);

  const group = groups[location.groupIndex];
  const status = group?.statuses[location.statusIndex];

  const navigate = useCallback(
    (direction: 1 | -1) => {
      const destination = nextLocation(groups, location, direction);
      if (!destination) {
        if (direction === 1) onClose();
        return;
      }

      setProgress(0);
      setManualPaused(false);
      setInteractionPaused(false);
      setErrorMessage(null);
      setLocation(destination);
    },
    [groups, location, onClose],
  );
  const navigateRef = useRef(navigate);

  useEffect(() => {
    closeRef.current = onClose;
    navigateRef.current = navigate;
  }, [navigate, onClose]);

  const handleDisplayed = useCallback(
    (displayedStatus: StatusPost) => {
      if (
        displayedStatus.userId === currentUserId ||
        displayedStatus.viewedByMe ||
        viewedIdsRef.current.has(displayedStatus.id)
      )
        return;

      viewedIdsRef.current.add(displayedStatus.id);
      void onViewed(displayedStatus).catch((error: unknown) => {
        viewedIdsRef.current.delete(displayedStatus.id);
        if (
          error instanceof ApiError &&
          ["STATUS_EXPIRED", "STATUS_NOT_FOUND"].includes(error.code)
        ) {
          onExpired();
          onClose();
          return;
        }
        setErrorMessage(getStatusErrorMessage(error));
      });
    },
    [currentUserId, onClose, onExpired, onViewed],
  );

  useEffect(() => {
    const handleVisibility = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog) (focusableElements(dialog)[0] ?? dialog).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateRef.current(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateRef.current(-1);
        return;
      }
      if (
        event.key === " " &&
        !(event.target instanceof HTMLButtonElement) &&
        !(event.target instanceof HTMLVideoElement)
      ) {
        event.preventDefault();
        setManualPaused((current) => !current);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(event.target as Node)) return;
      (focusableElements(dialog)[0] ?? dialog).focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  if (!group || !status) return null;

  const paused = manualPaused || interactionPaused || pageHidden;
  const canGoBack = nextLocation(groups, location, -1) !== null;
  const isMine = status.userId === currentUserId;

  const pauseInteraction = (event: ReactPointerEvent) => {
    if (event.button === 0) setInteractionPaused(true);
  };

  return (
    <div className={styles.overlay} role="presentation">
      <section
        ref={dialogRef}
        className={styles.viewer}
        role="dialog"
        aria-modal="true"
        aria-label={`Status de ${group.user.nome}`}
        tabIndex={-1}
      >
        <div
          className={styles.progressRow}
          aria-label={`Status ${location.statusIndex + 1} de ${group.statuses.length}`}
        >
          {group.statuses.map((item, index) => (
            <span className={styles.progressTrack} key={item.id}>
              <span
                className={styles.progressValue}
                style={{
                  transform: `scaleX(${index < location.statusIndex ? 1 : index === location.statusIndex ? progress : 0})`,
                }}
              />
            </span>
          ))}
        </div>

        <header className={styles.header}>
          <div className={styles.authorAvatar} aria-hidden="true">
            {group.user.avatarUrl ? (
              <img src={group.user.avatarUrl} alt="" />
            ) : (
              getInitials(group.user.nome)
            )}
          </div>
          <div className={styles.authorInfo}>
            <strong>{isMine ? "Meu status" : group.user.nome}</strong>
            <span>{formatStatusDate(status.createdAt)}</span>
          </div>
          <button
            className={styles.iconButton}
            type="button"
            aria-label={manualPaused ? "Continuar status" : "Pausar status"}
            aria-pressed={manualPaused}
            onClick={() => setManualPaused((current) => !current)}
          >
            {manualPaused ? "▶" : "Ⅱ"}
          </button>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Fechar status"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div
          className={styles.stage}
          onPointerDown={pauseInteraction}
          onPointerUp={() => setInteractionPaused(false)}
          onPointerCancel={() => setInteractionPaused(false)}
          onPointerLeave={() => setInteractionPaused(false)}
        >
          <StatusPlayback
            key={status.id}
            status={status}
            authorName={group.user.nome}
            paused={paused}
            onProgress={setProgress}
            onComplete={() => navigate(1)}
            onDisplayed={handleDisplayed}
          />

          <button
            className={`${styles.navigationButton} ${styles.previousButton}`}
            type="button"
            aria-label="Status anterior"
            disabled={!canGoBack}
            onClick={() => navigate(-1)}
          >
            ‹
          </button>
          <button
            className={`${styles.navigationButton} ${styles.nextButton}`}
            type="button"
            aria-label="Próximo status"
            onClick={() => navigate(1)}
          >
            ›
          </button>
        </div>

        {isMine ? (
          <footer className={styles.footer}>
            <button type="button" onClick={() => onShowViewers(status)}>
              Visualizações ({status.viewCount})
            </button>
            <button
              className={styles.deleteButton}
              type="button"
              onClick={() => onRequestDelete(status)}
            >
              Apagar
            </button>
          </footer>
        ) : null}

        {paused && !pageHidden ? (
          <span className={styles.pausedBadge} role="status">
            Pausado
          </span>
        ) : null}
        {errorMessage ? (
          <p className={styles.viewerError} role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>
    </div>
  );
}
