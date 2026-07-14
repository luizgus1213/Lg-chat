import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "../authContext";
import { loginUser, registerUser, verifyEmail } from "../auth.api";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { VerifyEmailPage } from "./VerifyEmailPage";

vi.mock("../auth.api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../auth.api")>();
  return {
    ...original,
    loginUser: vi.fn(),
    registerUser: vi.fn(),
    verifyEmail: vi.fn(),
  };
});

const user = {
  id: 1,
  nome: "Pessoa Teste",
  email: "pessoa@example.com",
  avatarUrl: null,
  about: "Disponível",
  isOnline: false,
  lastSeenAt: null,
  emailVerificado: true,
};

function createAuthValue(): AuthContextValue {
  return {
    status: "unauthenticated",
    user: null,
    isAuthenticated: false,
    errorMessage: null,
    completeAuthentication: vi.fn(() => true),
    updateUser: vi.fn(),
    refreshSession: vi.fn(async () => undefined),
    signOut: vi.fn(),
  };
}

function renderRoute(
  path: string,
  element: ReactNode,
  auth = createAuthValue(),
) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path.split("?")[0]} element={element} />
          <Route path="/app" element={<p>Aplicação autenticada</p>} />
          <Route
            path="/verificar-email"
            element={<p>Confirmação pendente</p>}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return auth;
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("fluxos públicos de autenticação", () => {
  it("faz login, conclui a sessão e navega para a aplicação", async () => {
    vi.mocked(loginUser).mockResolvedValue({
      success: true,
      data: { user },
    });
    const auth = renderRoute("/login", <LoginPage />);
    const actor = userEvent.setup();

    await actor.type(screen.getByLabelText(/e-mail/i), user.email);
    await actor.type(screen.getByLabelText(/^senha$/i), "Senha123");
    await actor.click(screen.getByRole("button", { name: /^entrar$/i }));

    await screen.findByText("Aplicação autenticada");
    expect(loginUser).toHaveBeenCalledWith(
      { email: user.email, senha: "Senha123" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(auth.completeAuthentication).toHaveBeenCalledWith({ user });
  });

  it("cadastra, normaliza o e-mail e encaminha para verificação", async () => {
    vi.mocked(registerUser).mockResolvedValue({
      success: true,
      message: "Código enviado.",
      data: {
        requiresEmailVerification: true,
        email: user.email,
        user,
      },
    });
    renderRoute("/register", <RegisterPage />);
    const actor = userEvent.setup();

    await actor.type(screen.getByLabelText(/^nome$/i), user.nome);
    await actor.type(screen.getByLabelText(/e-mail/i), "PESSOA@example.com");
    await actor.type(
      screen.getByPlaceholderText(/mínimo de 8 caracteres/i),
      "Senha123",
    );
    await actor.type(screen.getByLabelText(/confirmar senha/i), "Senha123");
    await actor.click(screen.getByRole("button", { name: /^criar conta$/i }));

    await screen.findByText("Confirmação pendente");
    expect(registerUser).toHaveBeenCalledWith(
      {
        nome: user.nome,
        email: "PESSOA@example.com",
        senha: "Senha123",
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(window.sessionStorage.getItem("lgchat.auth.pending-email.v2")).toBe(
      user.email,
    );
  });

  it("valida o código, conclui a sessão e abre a aplicação", async () => {
    vi.mocked(verifyEmail).mockResolvedValue({
      success: true,
      data: { user },
    });
    const auth = renderRoute(
      `/verificar-email?email=${encodeURIComponent(user.email)}`,
      <VerifyEmailPage />,
    );
    const actor = userEvent.setup();

    await actor.type(screen.getByLabelText(/código de verificação/i), "123456");
    await actor.click(
      screen.getByRole("button", { name: /^verificar e-mail$/i }),
    );

    await screen.findByText("Aplicação autenticada");
    await waitFor(() =>
      expect(verifyEmail).toHaveBeenCalledWith(
        { email: user.email, codigo: "123456" },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(auth.completeAuthentication).toHaveBeenCalledWith({ user });
  });
});
