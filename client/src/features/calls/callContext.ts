import { createContext } from "react";

import type {
  CallDetails,
  CallParticipant,
  CallType,
} from "./calls.schemas";

export type CallPhase =
  | "idle"
  | "requesting-media"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "active"
  | "ending"
  | "ended"
  | "error";

export type CallDirection = "incoming" | "outgoing";

export type CallSession = CallDetails & {
  direction: CallDirection;
  participant: CallParticipant;
};

export type StartCallOptions = {
  chatId: number;
  type: CallType;
  contact?: CallParticipant | null;
};

export type CallContextValue = {
  phase: CallPhase;
  call: CallSession | null;
  statusMessage: string;
  errorMessage: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  durationSeconds: number;
  isBusy: boolean;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  cameraFacing: "user" | "environment";
  canSwitchCamera: boolean;
  isSwitchingCamera: boolean;
  startCall: (options: StartCallOptions) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  cancelCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMicrophone: () => void;
  toggleCamera: () => void;
  switchCamera: () => Promise<void>;
  dismiss: () => void;
};

export const CallContext = createContext<CallContextValue | null>(null);
