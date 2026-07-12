import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "../../../api/apiClient";
import { loginUser } from "../auth.api";
import { getAuthErrorMessage } from "../auth.errors";
import { savePendingVerificationEmail } from "../auth.storage";
import { useAuth } from "../useAuth";

type LoginFormState = {
  email: string;
  senha: string;
};

type LoginLocationState = {
  from?: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const [form, setForm] = useState<LoginFormState>({
    email: "",
    senha: "",
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof LoginFormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await loginUser({
        email: form.email,
        senha: form.senha,
      });

      auth.completeAuthentication(response.data);

      const state = location.state as LoginLocationState | null;
      const destination = state?.from || "/app";

      navigate(destination, {
        replace: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "EMAIL_NOT_VERIFIED") {
        const email = form.email.trim().toLowerCase();

        savePendingVerificationEmail(email);

        navigate(`/verificar-email?email=${encodeURIComponent(email)}`, {
          replace: true,
        });

        return;
      }

      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand-badge" to="/" aria-label="LG Chat">
          LG
        </Link>

        <header className="auth-header">
          <h1>Entrar</h1>
          <p>Acesse sua conta para continuar no LG Chat.</p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="form-field" htmlFor="login-email">
            <span>E-mail</span>

            <input
              id="login-email"
              className="form-input"
              type="email"
              value={form.email}
              onChange={(event) => {
                updateField("email", event.target.value);
              }}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
              disabled={isSubmitting}
              required
            />
          </label>

          <label className="form-field" htmlFor="login-password">
            <span>Senha</span>

            <input
              id="login-password"
              className="form-input"
              type="password"
              value={form.senha}
              onChange={(event) => {
                updateField("senha", event.target.value);
              }}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              disabled={isSubmitting}
              required
            />
          </label>

          {errorMessage ? (
            <div className="form-message form-message-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <button
            className="button button-primary button-full"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <footer className="auth-footer">
          <span>Ainda não possui conta?</span>

          <Link to="/register">Criar conta</Link>
        </footer>
      </section>
    </main>
  );
}
