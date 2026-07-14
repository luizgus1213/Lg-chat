import { describe, expect, it } from "vitest";

import { CALL_TIMEOUTS, isBusyPhase } from "./callRuntime";

describe("máquina de estado da chamada", () => {
  it("distingue estados terminais de fases ocupadas", () => {
    expect(isBusyPhase("idle")).toBe(false);
    expect(isBusyPhase("ended")).toBe(false);
    expect(isBusyPhase("error")).toBe(false);
    expect(isBusyPhase("connecting")).toBe(true);
    expect(isBusyPhase("active")).toBe(true);
  });

  it("mantém timeouts defensivos positivos", () => {
    expect(CALL_TIMEOUTS.ack).toBeGreaterThan(0);
    expect(CALL_TIMEOUTS.disconnectedMedia).toBeLessThan(CALL_TIMEOUTS.ringing);
  });
});
