import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "../../../api/apiClient";
import { getMySession, logoutUser } from "../auth.api";
import { getAuthErrorMessage, isRequestCancellation } from "../auth.errors";
import {
  clearAuthStorage,
  removeLegacyAuthTokens,
  removePendingVerificationEmail,
} from "../auth.storage";
import { SESSION_INVALID_EVENT } from "../../../api/apiEvents";
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionGenerationRef = useRef(0);
  const sessionRequestRef = useRef<AbortController | null>(null);

  const clearLocalSession = useCallback(() => {
    sessionRequestRef.current?.abort();
    sessionRequestRef.current = null;
    sessionGenerationRef.current += 1;
    clearAuthStorage();
    setUser(null);
    setErrorMessage(null);
    setStatus("unauthenticated");
  }, []);

  const signOut = useCallback(() => {
    void logoutUser()
      .catch(() => undefined)
      .finally(clearLocalSession);
  }, [clearLocalSession]);

  const completeAuthentication = useCallback((session: AuthSession) => {
    sessionRequestRef.current?.abort();
    sessionRequestRef.current = null;
    sessionGenerationRef.current += 1;

    removeLegacyAuthTokens();
    removePendingVerificationEmail();
    setUser(session.user);
    setErrorMessage(null);
    setStatus("authenticated");
    return true;
  }, []);

  const updateUser = useCallback((nextUser: AuthUser) => {
    setUser((current) =>
      current?.id === nextUser.id ? { ...current, ...nextUser } : current,
    );
  }, []);

  const refreshSession = useCallback(async () => {
    if (sessionRequestRef.current) return;

    const generation = ++sessionGenerationRef.current;

    const controller = new AbortController();
    sessionRequestRef.current = controller;

    setStatus((current) => (current === "authenticated" ? current : "loading"));
    setErrorMessage(null);

    try {
      const response = await getMySession({ signal: controller.signal });

      if (
        controller.signal.aborted ||
        generation !== sessionGenerationRef.current
      ) {
        return;
      }

      setUser(response.data.user);
      setErrorMessage(null);
      setStatus("authenticated");
    } catch (error: unknown) {
      if (
        controller.signal.aborted ||
        generation !== sessionGenerationRef.current ||
        isRequestCancellation(error)
      ) {
        return;
      }

      if (isInvalidSessionError(error)) {
        clearAuthStorage();
        setUser(null);
        setErrorMessage(null);
        setStatus("unauthenticated");
        return;
      }

      const message = getAuthErrorMessage(error);
      setErrorMessage(message);
      setStatus((current) =>
        current === "authenticated" ? "authenticated" : "error",
      );
    } finally {
      if (sessionRequestRef.current === controller) {
        sessionRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    removeLegacyAuthTokens();
    queueMicrotask(() => {
      if (active) void refreshSession();
    });

    return () => {
      active = false;
      sessionRequestRef.current?.abort();
      sessionRequestRef.current = null;
    };
  }, [refreshSession]);

  useEffect(() => {
    window.addEventListener(SESSION_INVALID_EVENT, clearLocalSession);
    return () =>
      window.removeEventListener(SESSION_INVALID_EVENT, clearLocalSession);
  }, [clearLocalSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === "authenticated",
      errorMessage,
      completeAuthentication,
      updateUser,
      refreshSession,
      signOut,
    }),
    [
      status,
      user,
      errorMessage,
      completeAuthentication,
      updateUser,
      refreshSession,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
