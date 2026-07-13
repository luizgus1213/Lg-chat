import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "../../../api/apiClient";
import { getMySession } from "../auth.api";
import { getAuthErrorMessage, isRequestCancellation } from "../auth.errors";
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    getAuthToken() ? "loading" : "unauthenticated",
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionGenerationRef = useRef(0);
  const sessionRequestRef = useRef<AbortController | null>(null);

  const signOut = useCallback(() => {
    sessionRequestRef.current?.abort();
    sessionRequestRef.current = null;
    sessionGenerationRef.current += 1;
    clearAuthStorage();
    setUser(null);
    setErrorMessage(null);
    setStatus("unauthenticated");
  }, []);

  const completeAuthentication = useCallback((session: AuthSession) => {
    sessionRequestRef.current?.abort();
    sessionRequestRef.current = null;
    sessionGenerationRef.current += 1;

    if (!saveAuthToken(session.token)) {
      clearAuthStorage();
      setUser(null);
      setErrorMessage(null);
      setStatus("unauthenticated");
      return false;
    }

    removePendingVerificationEmail();
    setUser(session.user);
    setErrorMessage(null);
    setStatus("authenticated");
    return true;
  }, []);

  const refreshSession = useCallback(async () => {
    if (sessionRequestRef.current) return;

    const token = getAuthToken();
    const generation = ++sessionGenerationRef.current;

    if (!token) {
      setUser(null);
      setErrorMessage(null);
      setStatus("unauthenticated");
      return;
    }

    const controller = new AbortController();
    sessionRequestRef.current = controller;

    setStatus("loading");
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

      setUser(null);
      setErrorMessage(getAuthErrorMessage(error));
      setStatus("error");
    } finally {
      if (sessionRequestRef.current === controller) {
        sessionRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (getAuthToken()) {
      queueMicrotask(() => {
        if (active) void refreshSession();
      });
    }

    return () => {
      active = false;
      sessionRequestRef.current?.abort();
      sessionRequestRef.current = null;
    };
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
