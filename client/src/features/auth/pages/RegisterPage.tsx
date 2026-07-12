import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { registerUser } from "../auth.api";
import { getAuthErrorMessage } from "../auth.errors";
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

  function updateField(field: keyof RegisterFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);

    if (form.senha !== form.confirmarSenha) {
      setErrorMessage("As senhas informadas não são iguais.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await registerUser({
        nome: form.nome,
        email: form.email,
        senha: form.senha,
      });

      const email = response.data.email.trim().toLowerCase();
      savePendingVerificationEmail(email);

      navigate(`/verificar-email?email=${encodeURIComponent(email)}`, {
        replace: true,
        state: { message: response.message },
      });
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.badge} to="/" aria-label="Página inicial do LG Chat">
          LG
        </Link>

        <header className={styles.header}>
          <h1>Criar conta</h1>
          <p>Crie sua conta e confirme o código enviado para seu e-mail.</p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
              required
            />
          </label>

          {errorMessage ? (
            <div className={`${styles.message} ${styles.error}`} role="alert">
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
