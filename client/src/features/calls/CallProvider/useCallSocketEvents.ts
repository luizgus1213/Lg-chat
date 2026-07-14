import { useCallback, useEffect, type MutableRefObject } from "react";
import type { Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@shared/publicContracts";

import {
  acceptedCallSchema,
  callSignalEventSchema,
  endedCallSchema,
  incomingCallSchema,
  rejectedCallSchema,
  type CallSignal,
} from "../calls.schemas";
import type { CallSession } from "../callContext";
import {
  callStatusForType,
  isBusyPhase,
  type ProviderState,
} from "../callRuntime";

type AnswerSignal = Extract<CallSignal, { type: "answer" }>;
type UpdateState = (
  updater: ProviderState | ((current: ProviderState) => ProviderState),
) => void;

type CallSocketEventsOptions = {
  socket: Socket | null;
  stateRef: MutableRefObject<ProviderState>;
  sessionEpochRef: MutableRefObject<number>;
  peerRef: MutableRefObject<RTCPeerConnection | null>;
  pendingAnswerRef: MutableRefObject<AnswerSignal | null>;
  cleanupResources: () => void;
  resetDuration: () => void;
  updateState: UpdateState;
  createPeerConnection: () => RTCPeerConnection;
  emitSignal: (signal: CallSignal) => void;
  emitTerminal: (
    event: typeof SOCKET_EVENTS.callReject | typeof SOCKET_EVENTS.callEnd,
    call: CallSession,
  ) => void;
  failActiveCall: (message: string) => void;
  finalizeCall: (
    phase: "ended" | "error",
    statusMessage: string,
    errorMessage?: string,
  ) => void;
  handleAnswer: (signal: AnswerSignal) => Promise<void>;
  isCurrentSession: (epoch: number, callId?: string) => boolean;
  processSignal: (signal: CallSignal) => Promise<void>;
};

export function useCallSocketEvents({
  socket,
  stateRef,
  sessionEpochRef,
  peerRef,
  pendingAnswerRef,
  cleanupResources,
  resetDuration,
  updateState,
  createPeerConnection,
  emitSignal,
  emitTerminal,
  failActiveCall,
  finalizeCall,
  handleAnswer,
  isCurrentSession,
  processSignal,
}: CallSocketEventsOptions) {
  const getCurrentState = useCallback(() => stateRef.current, [stateRef]);

  useEffect(() => {
    if (!socket) return;
    const boundSocket = socket;

    function invalidEvent(name: string) {
      if (import.meta.env.DEV) {
        console.warn(`[LG Chat] Evento ${name} inválido.`);
      }
    }

    function handleIncoming(payload: unknown) {
      const parsed = incomingCallSchema.safeParse(payload);
      if (!parsed.success) {
        invalidEvent("call:incoming");
        return;
      }

      if (isBusyPhase(stateRef.current.phase)) {
        boundSocket.emit(SOCKET_EVENTS.callReject, {
          callId: parsed.data.callId,
          chatId: parsed.data.chatId,
        });
        return;
      }

      cleanupResources();
      resetDuration();
      const { fromUser, ...details } = parsed.data;

      updateState({
        phase: "incoming",
        call: {
          ...details,
          direction: "incoming",
          participant: {
            ...fromUser,
            avatarUrl: null,
          },
        },
        statusMessage: callStatusForType(
          details.type,
          "Chamada de vídeo recebida",
          "Chamada de voz recebida",
        ),
        errorMessage: null,
      });
    }

    function handleAccepted(payload: unknown) {
      const parsed = acceptedCallSchema.safeParse(payload);
      if (!parsed.success) {
        invalidEvent("call:accepted");
        return;
      }

      const current = stateRef.current;
      if (
        current.call?.callId !== parsed.data.callId ||
        current.call.direction !== "outgoing" ||
        current.phase !== "outgoing"
      ) {
        return;
      }

      updateState({
        ...current,
        phase: "connecting",
        call: {
          ...current.call,
          callId: parsed.data.callId,
          chatId: parsed.data.chatId,
          callerId: parsed.data.callerId,
          receiverId: parsed.data.receiverId,
          type: parsed.data.type,
          startedAt: parsed.data.startedAt,
          acceptedAt: parsed.data.acceptedAt,
        },
        statusMessage: "Conectando…",
        errorMessage: null,
      });
      const operationEpoch = sessionEpochRef.current;
      const callId = parsed.data.callId;

      void (async () => {
        try {
          const peer = createPeerConnection();
          const offer = await peer.createOffer();
          if (
            peerRef.current !== peer ||
            !isCurrentSession(operationEpoch, callId)
          ) {
            return;
          }

          await peer.setLocalDescription(offer);
          if (
            peerRef.current !== peer ||
            !isCurrentSession(operationEpoch, callId)
          ) {
            return;
          }

          if (!offer.sdp) throw new Error("EMPTY_OFFER_SDP");

          emitSignal({
            type: "offer",
            sdp: {
              type: "offer",
              sdp: offer.sdp,
            },
          });

          const pendingAnswer = pendingAnswerRef.current;
          pendingAnswerRef.current = null;
          if (pendingAnswer) await handleAnswer(pendingAnswer);
        } catch {
          if (isCurrentSession(operationEpoch, callId)) {
            failActiveCall("Não foi possível conectar a chamada.");
          }
        }
      })();
    }

    function handleRejected(payload: unknown) {
      const parsed = rejectedCallSchema.safeParse(payload);
      if (!parsed.success) {
        invalidEvent("call:rejected");
        return;
      }

      if (stateRef.current.call?.callId !== parsed.data.callId) return;
      finalizeCall("ended", "Chamada recusada ou cancelada");
    }

    function handleEnded(payload: unknown) {
      const parsed = endedCallSchema.safeParse(payload);
      if (!parsed.success) {
        invalidEvent("call:ended");
        return;
      }

      if (stateRef.current.call?.callId !== parsed.data.callId) return;
      finalizeCall("ended", "Chamada encerrada");
    }

    function handleSignalEvent(payload: unknown) {
      const parsed = callSignalEventSchema.safeParse(payload);
      if (!parsed.success) {
        invalidEvent("call:signal");
        return;
      }

      const call = stateRef.current.call;
      if (
        !call ||
        call.callId !== parsed.data.callId ||
        call.chatId !== parsed.data.chatId
      ) {
        return;
      }
      const operationEpoch = sessionEpochRef.current;
      const callId = call.callId;

      void processSignal(parsed.data.signal).catch(() => {
        if (isCurrentSession(operationEpoch, callId)) {
          failActiveCall("O sinal da chamada não pôde ser processado.");
        }
      });
    }

    function handleDisconnect() {
      if (!isBusyPhase(stateRef.current.phase)) return;
      finalizeCall(
        "ended",
        "Chamada encerrada",
        "A conexão em tempo real foi interrompida.",
      );
    }

    boundSocket.on(SOCKET_EVENTS.callIncoming, handleIncoming);
    boundSocket.on(SOCKET_EVENTS.callAccepted, handleAccepted);
    boundSocket.on(SOCKET_EVENTS.callRejected, handleRejected);
    boundSocket.on(SOCKET_EVENTS.callEnded, handleEnded);
    boundSocket.on(SOCKET_EVENTS.callSignal, handleSignalEvent);
    boundSocket.on("disconnect", handleDisconnect);

    return () => {
      boundSocket.off(SOCKET_EVENTS.callIncoming, handleIncoming);
      boundSocket.off(SOCKET_EVENTS.callAccepted, handleAccepted);
      boundSocket.off(SOCKET_EVENTS.callRejected, handleRejected);
      boundSocket.off(SOCKET_EVENTS.callEnded, handleEnded);
      boundSocket.off(SOCKET_EVENTS.callSignal, handleSignalEvent);
      boundSocket.off("disconnect", handleDisconnect);

      const current = getCurrentState();
      const call = current.call;
      if (call && isBusyPhase(current.phase) && boundSocket.connected) {
        emitTerminal(
          call.acceptedAt ? SOCKET_EVENTS.callEnd : SOCKET_EVENTS.callReject,
          call,
        );
      }

      cleanupResources();
    };
  }, [
    cleanupResources,
    createPeerConnection,
    emitSignal,
    emitTerminal,
    failActiveCall,
    finalizeCall,
    getCurrentState,
    handleAnswer,
    isCurrentSession,
    pendingAnswerRef,
    peerRef,
    processSignal,
    resetDuration,
    sessionEpochRef,
    socket,
    stateRef,
    updateState,
  ]);
}
