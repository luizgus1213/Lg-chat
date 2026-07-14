import { describe, expect, it } from "vitest";

import { sanitizeDiagnosticMetadata } from "./clientDiagnostics";

describe("sanitização de diagnósticos", () => {
  it("remove segredos e conteúdo privado", () => {
    const result = sanitizeDiagnosticMetadata({
      chatId: 10,
      token: "segredo",
      password: "segredo",
      sdp: "offer completo",
      state: "connecting",
    });

    expect(result).toEqual({ chatId: 10, state: "connecting" });
  });

  it("limita metadados textuais", () => {
    const result = sanitizeDiagnosticMetadata({ value: "x".repeat(600) });
    expect(String(result.value)).toHaveLength(300);
  });
});
