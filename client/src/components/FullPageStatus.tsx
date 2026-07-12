import styles from "../app/PublicPage.module.css";

type FullPageStatusProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function FullPageStatus({
  title,
  message,
  actionLabel,
  onAction,
}: FullPageStatusProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <span className={styles.badge} aria-hidden="true">
          LG
        </span>

        <h1 className={styles.title}>{title}</h1>

        <p className={styles.description}>{message}</p>

        {actionLabel && onAction ? (
          <div className={styles.actions}>
            <button
              className={`${styles.button} ${styles.primary}`}
              type="button"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
