import { useContext } from "react";
import { SocketContext } from "./socketContext";

export function useSocket() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket precisa ser usado dentro de SocketProvider.");
  }

  return context;
}
