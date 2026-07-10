import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <main className="page-container">
      <section className="page-card">
        <span className="brand-badge">LG</span>

        <h1>LG Chat</h1>

        <p>
          A nova versão do frontend foi iniciada com React, TypeScript e uma
          estrutura organizada.
        </p>

        <div className="button-group">
          <Link className="button button-primary" to="/login">
            Entrar
          </Link>

          <Link className="button button-secondary" to="/register">
            Criar conta
          </Link>
        </div>
      </section>
    </main>
  );
}
