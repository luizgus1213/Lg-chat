import { createContext } from "react";

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
