import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "../../../api/apiClient";
import { loginUser } from "../auth.api";
import {
  AUTH_STORAGE_ERROR_MESSAGE,
  getAuthErrorMessage,
  isRequestCancellation,
} from "../auth.errors";
import { savePendingVerificationEmail } from "../auth.storage";
import { useAuth } from "../useAuth";

import styles from "./AuthPages.module.css";

type LoginFormState = {
  email: string;
  senha: string;
};

type LoginLocationState = {
  from?: string;
};

function isSafeInternalPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  );
}

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
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
      submittingRef.current = false;
    };
  }, []);

  function updateField(field: keyof LoginFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const controller = new AbortController();
    submittingRef.current = true;
    requestRef.current = controller;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await loginUser({
        email: form.email,
        senha: form.senha,
      }, { signal: controller.signal });

      if (!mountedRef.current || controller.signal.aborted) return;

      if (!auth.completeAuthentication(response.data)) {
        setErrorMessage(AUTH_STORAGE_ERROR_MESSAGE);
        return;
      }

      const state = location.state as LoginLocationState | null;
      const destination = isSafeInternalPath(state?.from) ? state.from : "/app";

      navigate(destination, { replace: true });
    } catch (error: unknown) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        isRequestCancellation(error)
      ) {
        return;
      }

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
      if (requestRef.current === controller) {
        requestRef.current = null;
        submittingRef.current = false;
        if (mountedRef.current) setIsSubmitting(false);
      }
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.badge} to="/" aria-label="Página inicial do LG Chat">
          LG
        </Link>

        <header className={styles.header}>
          <h1>Entrar</h1>
          <p>Acesse sua conta para continuar no LG Chat.</p>
        </header>

        <form
          className={styles.form}
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
          noValidate
        >
          <label className={styles.field} htmlFor="login-email">
            <span>E-mail</span>
            <input
              id="login-email"
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
              disabled={isSubmitting}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "login-error" : undefined}
              required
            />
          </label>

          <label className={styles.field} htmlFor="login-password">
            <span>Senha</span>
            <input
              id="login-password"
              className={styles.input}
              type="password"
              value={form.senha}
              onChange={(event) => updateField("senha", event.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              disabled={isSubmitting}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "login-error" : undefined}
              required
            />
          </label>

          {errorMessage ? (
            <div
              id="login-error"
              className={`${styles.message} ${styles.error}`}
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          <button
            className={`${styles.button} ${styles.primary}`}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <footer className={styles.footer}>
          <span>Ainda não possui conta?</span>
          <Link to="/register">Criar conta</Link>
        </footer>
      </section>
    </main>
  );
}
