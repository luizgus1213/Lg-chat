import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { AppError, toClientError } from "./AppError";

test("AppError preserva somente a mensagem pública", () => {
  const result = toClientError(
    new AppError(403, "Ação não permitida.", "ACTION_DENIED"),
  );

  assert.deepEqual(result, {
    code: "ACTION_DENIED",
    message: "Ação não permitida.",
    statusCode: 403,
  });
});

test("erros inesperados usam uma resposta genérica", () => {
  const result = toClientError(new Error("detalhe interno"));

  assert.equal(result.code, "INTERNAL_ERROR");
  assert.equal(result.statusCode, 500);
  assert.equal(result.message, "Erro interno no servidor. Tente novamente.");
});

test("falhas Zod expõem campos sem stack trace", () => {
  const schema = z.object({ id: z.number().positive() });
  const parsed = schema.safeParse({ id: -1 });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const result = toClientError(parsed.error);
  assert.equal(result.code, "VALIDATION_ERROR");
  assert.equal(result.fields?.[0]?.path, "id");
});
