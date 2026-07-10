import { Link } from "react-router-dom";

export function VerifyEmailPage() {
  return (
    <main className="page-container">
      <section className="page-card">
        <span className="brand-badge">LG</span>

        <h1>Verificar e-mail</h1>

        <p>A tela para inserir o código será implementada na próxima etapa.</p>

        <Link className="button button-secondary" to="/login">
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
