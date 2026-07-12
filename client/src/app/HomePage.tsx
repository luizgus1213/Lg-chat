import { Link } from "react-router-dom";

import styles from "./PublicPage.module.css";

export function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.badge} aria-hidden="true">
          LG
        </span>

        <h1 className={styles.title}>Converse de forma simples e segura.</h1>

        <p className={styles.description}>
          Entre na sua conta ou crie um cadastro para acessar suas conversas em
          tempo real no LG Chat.
        </p>

        <div className={styles.actions}>
          <Link
            className={`${styles.button} ${styles.primary}`}
            to="/login"
          >
            Entrar
          </Link>

          <Link
            className={`${styles.button} ${styles.secondary}`}
            to="/register"
          >
            Criar conta
          </Link>
        </div>
      </section>
    </main>
  );
}
