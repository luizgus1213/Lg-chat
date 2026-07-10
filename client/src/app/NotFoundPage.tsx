import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="page-container">
      <section className="page-card">
        <h1>Página não encontrada</h1>

        <p>O endereço acessado não existe.</p>

        <Link className="button button-primary" to="/">
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
