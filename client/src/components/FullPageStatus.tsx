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
    <main className="page-container">
      <section className="page-card" aria-live="polite">
        <span className="brand-badge">LG</span>

        <h1>{title}</h1>

        <p>{message}</p>

        {actionLabel && onAction ? (
          <button
            className="button button-primary"
            type="button"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </section>
    </main>
  );
}
