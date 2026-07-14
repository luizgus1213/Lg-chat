import { Link } from "react-router-dom";

import styles from "./PublicPage.module.css";

export function NotFoundPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.badge} aria-hidden="true">
          404
        </span>

        <h1 className={styles.title}>Página não encontrada</h1>

        <p className={styles.description}>
          O endereço acessado não existe ou foi removido.
        </p>

        <div className={styles.actions}>
          <Link className={`${styles.button} ${styles.primary}`} to="/">
            Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}
