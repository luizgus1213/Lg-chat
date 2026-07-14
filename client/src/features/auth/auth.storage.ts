const LEGACY_AUTH_TOKEN_KEYS = ["lgchat.auth.token.v2", "token"];
const PENDING_EMAIL_KEY = "lgchat.auth.pending-email.v2";

function canUseSessionStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage !== "undefined"
  );
}

export function removeLegacyAuthTokens(): void {
  try {
    for (const key of LEGACY_AUTH_TOKEN_KEYS)
      window.localStorage.removeItem(key);
  } catch {
    // Migração defensiva: storage pode estar bloqueado pelo navegador.
  }
}

export function getPendingVerificationEmail(): string | null {
  if (!canUseSessionStorage()) return null;

  try {
    return window.sessionStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function savePendingVerificationEmail(email: string): void {
  if (!canUseSessionStorage()) return;

  const normalizedEmail = email.trim().toLowerCase();

  try {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail);
  } catch {
    // O fluxo poderá continuar sem persistência.
  }
}

export function removePendingVerificationEmail(): void {
  if (!canUseSessionStorage()) return;

  try {
    window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // Não interromper o fluxo.
  }
}

export function clearAuthStorage(): void {
  removeLegacyAuthTokens();
  removePendingVerificationEmail();
}
