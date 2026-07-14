import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../api/apiClient";
import { SESSION_INVALID_EVENT } from "../../../api/apiEvents";
import { getMySession } from "../auth.api";
import type { AuthUser } from "../auth.schemas";
import { useAuth } from "../useAuth";
import { AuthProvider } from ".";

vi.mock("../auth.api", () => ({
  getMySession: vi.fn(),
  logoutUser: vi.fn(async () => undefined),
}));

const firstUser: AuthUser = {
  id: 1,
  nome: "Primeira Pessoa",
  email: "primeira@example.com",
  avatarUrl: null,
  about: "Disponível",
  isOnline: true,
  lastSeenAt: null,
  emailVerificado: true,
};

let latestAuth: ReturnType<typeof useAuth> | null = null;

function SessionProbe({
  onChange,
}: {
  onChange: (value: ReturnType<typeof useAuth>) => void;
}) {
  const auth = useAuth();
  useEffect(() => onChange(auth), [auth, onChange]);
  return (
    <p>
      {auth.status}:{auth.user?.id ?? "sem-usuario"}:
      {auth.errorMessage ?? "sem-erro"}
    </p>
  );
}

function renderProvider() {
  const captureAuth = (value: ReturnType<typeof useAuth>) => {
    latestAuth = value;
  };
  return render(
    <AuthProvider>
      <SessionProbe onChange={captureAuth} />
    </AuthProvider>,
  );
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  latestAuth = null;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("sessão global", () => {
  it("remove tokens legados e carrega a sessão por cookie", async () => {
    window.localStorage.setItem("token", "token-legado");
    vi.mocked(getMySession).mockResolvedValue({
      success: true,
      data: { user: firstUser },
    });

    renderProvider();

    await screen.findByText("authenticated:1:sem-erro");
    expect(window.localStorage.getItem("token")).toBeNull();
  });

  it("encerra localmente somente quando a sessão é confirmada como inválida", async () => {
    vi.mocked(getMySession).mockResolvedValue({
      success: true,
      data: { user: firstUser },
    });
    renderProvider();
    await screen.findByText("authenticated:1:sem-erro");

    act(() => window.dispatchEvent(new Event(SESSION_INVALID_EVENT)));

    expect(
      screen.getByText("unauthenticated:sem-usuario:sem-erro"),
    ).toBeTruthy();
  });

  it("preserva usuário e estado autenticado em erro temporário", async () => {
    vi.mocked(getMySession).mockResolvedValueOnce({
      success: true,
      data: { user: firstUser },
    });
    renderProvider();
    await screen.findByText("authenticated:1:sem-erro");

    vi.mocked(getMySession).mockRejectedValueOnce(
      new ApiError({
        statusCode: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Serviço temporariamente indisponível.",
      }),
    );
    await act(async () => {
      await latestAuth?.refreshSession();
    });

    await waitFor(() =>
      expect(screen.getByText(/authenticated:1:/)).toBeTruthy(),
    );
  });

  it("não vaza o usuário anterior ao trocar a sessão", async () => {
    vi.mocked(getMySession).mockResolvedValue({
      success: true,
      data: { user: firstUser },
    });
    renderProvider();
    await screen.findByText("authenticated:1:sem-erro");

    act(() => {
      latestAuth?.completeAuthentication({
        user: {
          ...firstUser,
          id: 2,
          nome: "Segunda Pessoa",
          email: "segunda@example.com",
        },
      });
    });

    expect(screen.getByText("authenticated:2:sem-erro")).toBeTruthy();
  });
});
