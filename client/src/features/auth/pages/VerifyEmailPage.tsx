import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { ApiError } from "../../../api/apiClient";
import { resendVerificationEmail, verifyEmail } from "../auth.api";
import {
  AUTH_STORAGE_ERROR_MESSAGE,
  getAuthErrorMessage,
  isRequestCancellation,
} from "../auth.errors";
import {
  resendEmailInputSchema,
  verifyEmailInputSchema,
} from "../auth.schemas";
import {
  getPendingVerificationEmail,
  savePendingVerificationEmail,
} from "../auth.storage";
import { useAuth } from "../useAuth";

import styles from "./AuthPages.module.css";

type VerificationLocationState = {
  message?: string;
  codeSentAt?: number;
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
  const [successMessage, setSuccessMessage] = useState<string | null>(() =>
    typeof locationState?.message === "string" ? locationState.message : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(() => {
    const codeSentAt = locationState?.codeSentAt;
    if (typeof codeSentAt !== "number" || !Number.isFinite(codeSentAt)) {
      return 0;
    }

    const remainingMs = codeSentAt + RESEND_COOLDOWN_SECONDS * 1_000 - Date.now();
    return Math.min(
      RESEND_COOLDOWN_SECONDS,
      Math.max(0, Math.ceil(remainingMs / 1_000)),
    );
  });

  const mountedRef = useRef(true);
  const verifyRequestRef = useRef<AbortController | null>(null);
  const resendRequestRef = useRef<AbortController | null>(null);
  const verifyInFlightRef = useRef(false);
  const resendInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      verifyRequestRef.current?.abort();
      resendRequestRef.current?.abort();
      verifyRequestRef.current = null;
      resendRequestRef.current = null;
      verifyInFlightRef.current = false;
      resendInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  function handleCodeChange(value: string) {
    setCodigo(value.replace(/\D/g, "").slice(0, 6));
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifyInFlightRef.current || resendInFlightRef.current) return;

    const controller = new AbortController();
    verifyInFlightRef.current = true;
    verifyRequestRef.current = controller;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const input = verifyEmailInputSchema.parse({ email, codigo });
      savePendingVerificationEmail(input.email);

      const response = await verifyEmail(input, { signal: controller.signal });

      if (!mountedRef.current || controller.signal.aborted) return;

      if (!auth.completeAuthentication(response.data)) {
        setErrorMessage(AUTH_STORAGE_ERROR_MESSAGE);
        return;
      }

      navigate("/app", { replace: true });
    } catch (error: unknown) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        isRequestCancellation(error)
      ) {
        return;
      }

      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      if (verifyRequestRef.current === controller) {
        verifyRequestRef.current = null;
        verifyInFlightRef.current = false;
        if (mountedRef.current) setIsSubmitting(false);
      }
    }
  }

  async function handleResend() {
    if (
      verifyInFlightRef.current ||
      resendInFlightRef.current ||
      resendCooldown > 0
    ) {
      return;
    }

    const controller = new AbortController();
    resendInFlightRef.current = true;
    resendRequestRef.current = controller;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResending(true);

    try {
      const input = resendEmailInputSchema.parse({ email });
      savePendingVerificationEmail(input.email);

      const response = await resendVerificationEmail(input, {
        signal: controller.signal,
      });

      if (!mountedRef.current || controller.signal.aborted) return;

      if (response.data.email) {
        setEmail(response.data.email);
        savePendingVerificationEmail(response.data.email);
      }

      setSuccessMessage(
        response.message || "Um novo código foi enviado para seu e-mail.",
      );
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: unknown) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        isRequestCancellation(error)
      ) {
        return;
      }

      if (error instanceof ApiError && error.code === "EMAIL_CODE_COOLDOWN") {
        const seconds = Number(error.message.match(/(\d+)\s+segundos?/i)?.[1]);
        if (Number.isFinite(seconds) && seconds > 0) {
          setResendCooldown(seconds);
        }
      }

      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      if (resendRequestRef.current === controller) {
        resendRequestRef.current = null;
        resendInFlightRef.current = false;
        if (mountedRef.current) setIsResending(false);
      }
    }
  }

  const isBusy = isSubmitting || isResending;

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

        <form
          className={styles.form}
          onSubmit={handleSubmit}
          aria-busy={isBusy}
          noValidate
        >
          <label className={styles.field} htmlFor="verification-email">
            <span>E-mail</span>
            <input
              id="verification-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorMessage(null);
              }}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
              disabled={isBusy}
              maxLength={150}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "verification-error" : undefined}
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
              disabled={isBusy}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "verification-error" : undefined}
              autoFocus
              required
            />
          </label>

          {errorMessage ? (
            <div
              id="verification-error"
              className={`${styles.message} ${styles.error}`}
              role="alert"
            >
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
            disabled={isBusy || codigo.length !== 6}
          >
            {isSubmitting ? "Verificando..." : "Verificar e-mail"}
          </button>

          <button
            className={`${styles.button} ${styles.secondary}`}
            type="button"
            onClick={() => void handleResend()}
            disabled={isBusy || resendCooldown > 0 || !email.trim()}
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
