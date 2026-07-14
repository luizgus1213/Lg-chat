import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { registerUser } from "../auth.api";
import { getAuthErrorMessage, isRequestCancellation } from "../auth.errors";
import { savePendingVerificationEmail } from "../auth.storage";

import styles from "./AuthPages.module.css";

type RegisterFormState = {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterFormState>({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
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

  function updateField(field: keyof RegisterFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setErrorMessage(null);

    if (form.senha !== form.confirmarSenha) {
      setErrorMessage("As senhas informadas não são iguais.");
      return;
    }

    const controller = new AbortController();
    submittingRef.current = true;
    requestRef.current = controller;
    setIsSubmitting(true);

    try {
      const response = await registerUser(
        {
          nome: form.nome,
          email: form.email,
          senha: form.senha,
        },
        { signal: controller.signal },
      );

      if (!mountedRef.current || controller.signal.aborted) return;

      const email = response.data.email.trim().toLowerCase();
      savePendingVerificationEmail(email);

      navigate(`/verificar-email?email=${encodeURIComponent(email)}`, {
        replace: true,
        state: { message: response.message, codeSentAt: Date.now() },
      });
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
        <Link
          className={styles.badge}
          to="/"
          aria-label="Página inicial do LG Chat"
        >
          LG
        </Link>

        <header className={styles.header}>
          <h1>Criar conta</h1>
          <p>Crie sua conta e confirme o código enviado para seu e-mail.</p>
        </header>

        <form
          className={styles.form}
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
          noValidate
        >
          <label className={styles.field} htmlFor="register-name">
            <span>Nome</span>
            <input
              id="register-name"
              className={styles.input}
              type="text"
              value={form.nome}
              onChange={(event) => updateField("nome", event.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              disabled={isSubmitting}
              maxLength={80}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "register-error" : undefined}
              required
            />
          </label>

          <label className={styles.field} htmlFor="register-email">
            <span>E-mail</span>
            <input
              id="register-email"
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              inputMode="email"
              disabled={isSubmitting}
              maxLength={150}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "register-error" : undefined}
              required
            />
          </label>

          <label className={styles.field} htmlFor="register-password">
            <span>Senha</span>
            <input
              id="register-password"
              className={styles.input}
              type="password"
              value={form.senha}
              onChange={(event) => updateField("senha", event.target.value)}
              placeholder="Mínimo de 8 caracteres"
              autoComplete="new-password"
              disabled={isSubmitting}
              maxLength={72}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "register-error" : undefined}
              required
            />
            <small>Use pelo menos uma letra e um número.</small>
          </label>

          <label className={styles.field} htmlFor="register-confirm-password">
            <span>Confirmar senha</span>
            <input
              id="register-confirm-password"
              className={styles.input}
              type="password"
              value={form.confirmarSenha}
              onChange={(event) =>
                updateField("confirmarSenha", event.target.value)
              }
              placeholder="Digite a senha novamente"
              autoComplete="new-password"
              disabled={isSubmitting}
              maxLength={72}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "register-error" : undefined}
              required
            />
          </label>

          {errorMessage ? (
            <div
              id="register-error"
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
            {isSubmitting ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <footer className={styles.footer}>
          <span>Já possui uma conta?</span>
          <Link to="/login">Entrar</Link>
        </footer>
      </section>
    </main>
  );
}
