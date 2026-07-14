import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { SESSION_INVALID_EVENT } from "./apiEvents";
import { ApiError, apiRequest } from "./apiClient";

const origin = "http://localhost";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  server.resetHandlers();
  document.cookie = "lgchat_csrf=csrf-test; path=/";

  const interceptedFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const resolvedInput =
        typeof input === "string" ? new URL(input, origin) : input;
      return interceptedFetch(resolvedInput, init);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("cliente HTTP central", () => {
  it("envia cookie e cabeçalho CSRF em mutações autenticadas", async () => {
    server.use(
      http.post(`${origin}/api/test`, ({ request }) => {
        expect(request.headers.get("x-csrf-token")).toBe("csrf-test");
        return HttpResponse.json({
          success: true,
          data: { saved: true },
        });
      }),
    );

    const response = await apiRequest<{ saved: boolean }>("/api/test", {
      method: "POST",
      body: JSON.stringify({ value: 1 }),
    });

    expect(response.data.saved).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("emite sessão inválida somente para um 401 confirmado pelo backend", async () => {
    server.use(
      http.get(`${origin}/api/private`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_TOKEN",
              message: "Sessão expirada.",
              statusCode: 401,
            },
          },
          { status: 401 },
        ),
      ),
    );
    const onInvalid = vi.fn();
    window.addEventListener(SESSION_INVALID_EVENT, onInvalid);

    await expect(apiRequest("/api/private")).rejects.toBeInstanceOf(ApiError);

    expect(onInvalid).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_INVALID_EVENT, onInvalid);
  });
});
