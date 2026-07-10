import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "../../api/apiClient";
import { getMySession } from "./auth.api";

import {
  clearAuthStorage,
  getAuthToken,
  removePendingVerificationEmail,
  saveAuthToken,
} from "./auth.storage";

import type { AuthSession, AuthUser } from "./auth.schemas";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  isAuthenticated: boolean;
  errorMessage: string | null;

  completeAuthentication: (session: AuthSession) => void;
  refreshSession: () => Promise<void>;
  signOut: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

function getSessionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Não foi possível restaurar sua sessão.";
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
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
      const isInvalidSession =
        error instanceof ApiError &&
        (error.statusCode === 401 ||
          error.statusCode === 403 ||
          error.code === "AUTH_REQUIRED" ||
          error.code === "INVALID_TOKEN" ||
          error.code === "USER_NOT_FOUND");

      if (isInvalidSession) {
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
    void refreshSession();
  }, [refreshSession]);

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
