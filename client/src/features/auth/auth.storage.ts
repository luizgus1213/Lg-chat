const AUTH_TOKEN_KEY = "lgchat.auth.token.v2";
const PENDING_EMAIL_KEY = "lgchat.auth.pending-email.v2";

function canUseLocalStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function getAuthToken(): string | null {
  if (!canUseLocalStorage()) return null;

  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAuthToken(token: string): boolean {
  if (!canUseLocalStorage() || !token.trim()) return false;

  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    return window.localStorage.getItem(AUTH_TOKEN_KEY) === token;
  } catch {
    return false;
  }
}

export function removeAuthToken(): void {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Não interromper o logout.
  }
}

export function getPendingVerificationEmail(): string | null {
  if (!canUseLocalStorage()) return null;

  try {
    return window.localStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function savePendingVerificationEmail(email: string): void {
  if (!canUseLocalStorage()) return;

  const normalizedEmail = email.trim().toLowerCase();

  try {
    window.localStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail);
  } catch {
    // O fluxo poderá continuar sem persistência.
  }
}

export function removePendingVerificationEmail(): void {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // Não interromper o fluxo.
  }
}

export function clearAuthStorage(): void {
  removeAuthToken();
  removePendingVerificationEmail();
}
