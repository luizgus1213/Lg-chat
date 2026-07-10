import { Link } from "react-router-dom";

export function RegisterPage() {
  return (
    <main className="page-container">
      <section className="page-card">
        <span className="brand-badge">LG</span>

        <h1>Criar conta</h1>

        <p>A tela de cadastro será implementada na próxima etapa.</p>

        <Link className="button button-secondary" to="/login">
          Já tenho uma conta
        </Link>
      </section>
    </main>
  );
}
