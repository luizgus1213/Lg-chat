import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "../../../api/apiClient";

import { getMySession } from "../auth.api";

import {
  clearAuthStorage,
  getAuthToken,
  removePendingVerificationEmail,
  saveAuthToken,
} from "../auth.storage";

import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "../authContext";

import type { AuthSession, AuthUser } from "../auth.schemas";

type AuthProviderProps = {
  children: ReactNode;
};

function isInvalidSessionError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.statusCode === 401 ||
      error.statusCode === 403 ||
      error.code === "AUTH_REQUIRED" ||
      error.code === "INVALID_TOKEN" ||
      error.code === "USER_NOT_FOUND")
  );
}

function getSessionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível restaurar sua sessão.";
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>(() => {
    return getAuthToken() ? "loading" : "unauthenticated";
  });

  const [user, setUser] = useState<AuthUser | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signOut = useCallback(() => {
    clearAuthStorage();

    setUser(null);
    setErrorMessage(null);
    setStatus("unauthenticated");
  }, []);

  const completeAuthentication = useCallback((session: AuthSession) => {
    saveAuthToken(session.token);
    removePendingVerificationEmail();

    setUser(session.user);
    setErrorMessage(null);
    setStatus("authenticated");
  }, []);

  const refreshSession = useCallback(async () => {
    const token = getAuthToken();

    if (!token) {
      setUser(null);
      setErrorMessage(null);
      setStatus("unauthenticated");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await getMySession();

      setUser(response.data.user);
      setStatus("authenticated");
    } catch (error: unknown) {
      if (isInvalidSessionError(error)) {
        clearAuthStorage();

        setUser(null);
        setErrorMessage(null);
        setStatus("unauthenticated");
        return;
      }

      setUser(null);
      setErrorMessage(getSessionErrorMessage(error));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      return;
    }

    let cancelled = false;

    /*
      O efeito apenas sincroniza a sessão com o servidor.

      Não existe setState síncrono no corpo do efeito.
    */
    void getMySession()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setUser(response.data.user);
        setErrorMessage(null);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (isInvalidSessionError(error)) {
          clearAuthStorage();

          setUser(null);
          setErrorMessage(null);
          setStatus("unauthenticated");
          return;
        }

        setUser(null);
        setErrorMessage(getSessionErrorMessage(error));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === "authenticated",
      errorMessage,
      completeAuthentication,
      refreshSession,
      signOut,
    }),
    [
      status,
      user,
      errorMessage,
      completeAuthentication,
      refreshSession,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
