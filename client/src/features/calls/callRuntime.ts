import type { CallPhase, CallSession } from "./callContext";
import type { CallType } from "./calls.schemas";

export type ProviderState = {
  phase: CallPhase;
  call: CallSession | null;
  statusMessage: string;
  errorMessage: string | null;
};

export const CALL_TIMEOUTS = {
  ack: 15_000,
  ringing: 60_000,
  connecting: 30_000,
  disconnectedMedia: 12_000,
} as const;

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export const INITIAL_CALL_STATE: ProviderState = {
  phase: "idle",
  call: null,
  statusMessage: "",
  errorMessage: null,
};

export function isBusyPhase(phase: CallPhase): boolean {
  return !["idle", "ended", "error"].includes(phase);
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function mediaErrorMessage(error: unknown, type: CallType): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return type === "video"
        ? "Permita o uso do microfone e da câmera para continuar."
        : "Permita o uso do microfone para continuar.";
    }

    if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      return type === "video"
        ? "Não encontramos microfone e câmera disponíveis neste aparelho."
        : "Não encontramos um microfone disponível neste aparelho.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "O microfone ou a câmera já está em uso por outro aplicativo.";
    }
  }

  return "Não foi possível acessar o microfone ou a câmera.";
}

export function callStatusForType(
  type: CallType,
  videoText: string,
  voiceText: string,
): string {
  return type === "video" ? videoText : voiceText;
}
