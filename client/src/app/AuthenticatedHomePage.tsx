import { useAuth } from "../features/auth/useAuth";

export function AuthenticatedHomePage() {
  const { user, signOut } = useAuth();

  return (
    <main className="page-container">
      <section className="page-card">
        <span className="brand-badge">
          {user?.nome.charAt(0).toUpperCase() || "LG"}
        </span>

        <h1>Olá, {user?.nome}</h1>

        <p>
          Sua sessão foi restaurada corretamente. Esta página será substituída
          pelo layout principal do LG Chat.
        </p>

        <div className="button-group">
          <button
            className="button button-secondary"
            type="button"
            onClick={signOut}
          >
            Sair
          </button>
        </div>
      </section>
    </main>
  );
}
