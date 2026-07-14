import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reportClientError } from "./clientDiagnostics";
import { AppErrorBoundary } from "./AppErrorBoundary";

vi.mock("./clientDiagnostics", () => ({
  reportClientError: vi.fn(),
}));

function BrokenComponent(): never {
  throw new Error("Falha interna de teste");
}

afterEach(cleanup);

describe("limite global de erro", () => {
  it("mostra fallback seguro e registra o erro de renderização", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenComponent />
      </AppErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: /encontrou um problema/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /recarregar/i })).toBeTruthy();
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "react_render_error" }),
    );
    consoleError.mockRestore();
  });
});
