import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAT_ALLOWED_MIME_TYPES,
  CHAT_UPLOAD_LIMIT_BYTES,
  SESSION_INVALID_ERROR_CODES,
} from "./publicContracts";

test("limites públicos de upload são coerentes", () => {
  assert.ok(CHAT_UPLOAD_LIMIT_BYTES.image < CHAT_UPLOAD_LIMIT_BYTES.video);
  assert.ok(CHAT_UPLOAD_LIMIT_BYTES.audio <= CHAT_UPLOAD_LIMIT_BYTES.document);
  assert.ok(CHAT_ALLOWED_MIME_TYPES.includes("audio/webm"));
});

test("somente erros de sessão confirmados disparam logout global", () => {
  assert.ok(SESSION_INVALID_ERROR_CODES.includes("INVALID_TOKEN"));
  assert.equal(
    SESSION_INVALID_ERROR_CODES.includes(
      "CONTACT_BLOCKED_ME" as "INVALID_TOKEN",
    ),
    false,
  );
});
