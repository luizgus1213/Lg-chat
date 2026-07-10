import { Link } from "react-router-dom";

export function LoginPage() {
  return (
    <main className="page-container">
      <section className="page-card">
        <span className="brand-badge">LG</span>

        <h1>Entrar</h1>

        <p>A tela de login será implementada na próxima etapa.</p>

        <Link className="button button-secondary" to="/register">
          Criar uma conta
        </Link>
      </section>
    </main>
  );
}
