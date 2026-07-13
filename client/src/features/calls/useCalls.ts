import { useContext } from "react";

import { CallContext } from "./callContext";

export function useCalls() {
  const context = useContext(CallContext);

  if (!context) {
    throw new Error("useCalls precisa ser usado dentro de CallProvider.");
  }

  return context;
}
