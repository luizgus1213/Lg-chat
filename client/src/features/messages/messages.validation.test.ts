import { describe, expect, it } from "vitest";

import { CHAT_UPLOAD_LIMIT_BYTES } from "@shared/publicContracts";
import { validateMediaFile } from "./messages.validation";

describe("validação rápida de upload", () => {
  it("aceita áudio gravado em WebM", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "audio.webm", {
      type: "audio/webm",
    });

    expect(() => validateMediaFile(file)).not.toThrow();
  });

  it("rejeita MIME não permitido", () => {
    const file = new File(["script"], "script.js", {
      type: "application/javascript",
    });

    expect(() => validateMediaFile(file)).toThrow(/formato não permitido/i);
  });

  it("usa o mesmo limite público de áudio do backend", () => {
    const oversized = new File(
      [new Uint8Array(CHAT_UPLOAD_LIMIT_BYTES.audio + 1)],
      "grande.webm",
      { type: "audio/webm" },
    );

    expect(() => validateMediaFile(oversized)).toThrow(/no máximo 15 MB/i);
  });
});
