import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { resendVerificationEmail, verifyEmail } from "../auth.api";
import { getAuthErrorMessage } from "../auth.errors";
import {
  getPendingVerificationEmail,
  savePendingVerificationEmail,
} from "../auth.storage";
import { useAuth } from "../useAuth";

import styles from "./AuthPages.module.css";

type VerificationLocationState = {
  message?: string;
};

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialEmail = useMemo(() => {
    return (searchParams.get("email") || getPendingVerificationEmail() || "")
      .trim()
      .toLowerCase();
  }, [searchParams]);

  const locationState = location.state as VerificationLocationState | null;

  const [email, setEmail] = useState(initialEmail);
  const [codigo, setCodigo] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    locationState?.message || null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function handleCodeChange(value: string) {
    setCodigo(value.replace(/\D/g, "").slice(0, 6));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      savePendingVerificationEmail(normalizedEmail);

      const response = await verifyEmail({
        email: normalizedEmail,
        codigo,
      });

      auth.completeAuthentication(response.data);
      navigate("/app", { replace: true });
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (isResending || resendCooldown > 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResending(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      savePendingVerificationEmail(normalizedEmail);

      const response = await resendVerificationEmail({
        email: normalizedEmail,
      });

      setSuccessMessage(
        response.message || "Um novo código foi enviado para seu e-mail.",
      );
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.badge} to="/" aria-label="Página inicial do LG Chat">
          LG
        </Link>

        <header className={styles.header}>
          <h1>Verificar e-mail</h1>
          <p>Digite o código de seis números enviado para seu e-mail.</p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field} htmlFor="verification-email">
            <span>E-mail</span>
            <input
              id="verification-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
              disabled={isSubmitting || isResending}
              required
            />
          </label>

          <label className={styles.field} htmlFor="verification-code">
            <span>Código de verificação</span>
            <input
              id="verification-code"
              className={`${styles.input} ${styles.codeInput}`}
              type="text"
              value={codigo}
              onChange={(event) => handleCodeChange(event.target.value)}
              placeholder="000000"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </label>

          {errorMessage ? (
            <div className={`${styles.message} ${styles.error}`} role="alert">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className={`${styles.message} ${styles.success}`} role="status">
              {successMessage}
            </div>
          ) : null}

          <button
            className={`${styles.button} ${styles.primary}`}
            type="submit"
            disabled={isSubmitting || codigo.length !== 6}
          >
            {isSubmitting ? "Verificando..." : "Verificar e-mail"}
          </button>

          <button
            className={`${styles.button} ${styles.secondary}`}
            type="button"
            onClick={() => void handleResend()}
            disabled={isResending || resendCooldown > 0 || !email.trim()}
          >
            {isResending
              ? "Reenviando..."
              : resendCooldown > 0
                ? `Reenviar em ${resendCooldown}s`
                : "Reenviar código"}
          </button>
        </form>

        <footer className={styles.footer}>
          <span>Usou o e-mail errado?</span>
          <Link to="/register">Voltar ao cadastro</Link>
        </footer>
      </section>
    </main>
  );
}
