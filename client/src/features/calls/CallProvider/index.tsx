import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SOCKET_EVENTS } from "@shared/publicContracts";

import { useSocket } from "../../../socket/useSocket";
import {
  acceptCallAckSchema,
  endCallAckSchema,
  startCallAckSchema,
  type CallParticipant,
  type CallSignal,
  type CallType,
} from "../calls.schemas";
import {
  CallContext,
  type CallContextValue,
  type CallSession,
  type StartCallOptions,
} from "../callContext";
import { CallOverlay } from "../components/CallOverlay";
import { loadIceServerConfiguration } from "../calls.api";
import {
  CALL_TIMEOUTS,
  DEFAULT_ICE_SERVERS,
  INITIAL_CALL_STATE,
  callStatusForType,
  isBusyPhase,
  mediaErrorMessage,
  stopStream,
  type ProviderState,
} from "../callRuntime";
import { useCallSocketEvents } from "./useCallSocketEvents";

export type CallProviderProps = {
  children: ReactNode;
  renderOverlay?: boolean;
};

export function CallProvider({
  children,
  renderOverlay = true,
}: CallProviderProps) {
  const { socket } = useSocket();
  const [state, setState] = useState<ProviderState>(INITIAL_CALL_STATE);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user",
  );

  const stateRef = useRef(state);
  const mountedRef = useRef(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const pendingOfferRef = useRef<Extract<CallSignal, { type: "offer" }> | null>(
    null,
  );
  const pendingAnswerRef = useRef<Extract<
    CallSignal,
    { type: "answer" }
  > | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const activeSinceRef = useRef<number | null>(null);
  const cameraFacingRef = useRef<"user" | "environment">("user");
  const mediaDisconnectTimerRef = useRef<number | null>(null);
  const sessionEpochRef = useRef(0);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

  const updateState = useCallback(
    (updater: ProviderState | ((current: ProviderState) => ProviderState)) => {
      const next =
        typeof updater === "function" ? updater(stateRef.current) : updater;

      stateRef.current = next;

      if (mountedRef.current) {
        setState(next);
      }
    },
    [],
  );

  const clearMediaDisconnectTimer = useCallback(() => {
    if (mediaDisconnectTimerRef.current !== null) {
      window.clearTimeout(mediaDisconnectTimerRef.current);
      mediaDisconnectTimerRef.current = null;
    }
  }, []);

  const cleanupResources = useCallback(() => {
    sessionEpochRef.current += 1;
    clearMediaDisconnectTimer();

    const peer = peerRef.current;
    peerRef.current = null;

    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }

    stopStream(localStreamRef.current);
    stopStream(remoteStreamRef.current);
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pendingOfferRef.current = null;
    pendingAnswerRef.current = null;
    pendingCandidatesRef.current = [];
    cameraFacingRef.current = "user";
    activeSinceRef.current = null;

    if (mountedRef.current) {
      setLocalStream(null);
      setRemoteStream(null);
      setIsMicEnabled(true);
      setIsCameraEnabled(true);
      setCanSwitchCamera(false);
      setIsSwitchingCamera(false);
      setCameraFacing("user");
    }
  }, [clearMediaDisconnectTimer]);

  const isCurrentSession = useCallback((epoch: number, callId?: string) => {
    if (sessionEpochRef.current !== epoch) return false;
    if (!callId) return true;

    return (
      stateRef.current.call?.callId === callId &&
      isBusyPhase(stateRef.current.phase)
    );
  }, []);

  const emitWithAck = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      return new Promise<unknown>((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("SOCKET_DISCONNECTED"));
          return;
        }

        let settled = false;
        const timer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("ACK_TIMEOUT"));
        }, CALL_TIMEOUTS.ack);

        socket.emit(event, payload, (response: unknown) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(response);
        });
      });
    },
    [socket],
  );

  const emitTerminal = useCallback(
    (
      event: typeof SOCKET_EVENTS.callReject | typeof SOCKET_EVENTS.callEnd,
      call: CallSession,
    ) => {
      if (!socket?.connected) return;

      socket.emit(event, {
        callId: call.callId,
        chatId: call.chatId,
      });
    },
    [socket],
  );

  const emitSignal = useCallback(
    (signal: CallSignal) => {
      const call = stateRef.current.call;

      if (!socket?.connected || !call) return;

      socket.emit(SOCKET_EVENTS.callSignal, {
        callId: call.callId,
        chatId: call.chatId,
        signal,
      });
    },
    [socket],
  );

  const finalizeCall = useCallback(
    (
      phase: "ended" | "error",
      statusMessage: string,
      errorMessage?: string,
    ) => {
      cleanupResources();
      updateState((current) => ({
        ...current,
        phase,
        statusMessage,
        errorMessage: errorMessage ?? null,
      }));
    },
    [cleanupResources, updateState],
  );

  const failActiveCall = useCallback(
    (message: string) => {
      const call = stateRef.current.call;
      if (call) emitTerminal(SOCKET_EVENTS.callEnd, call);
      finalizeCall("error", "A chamada foi interrompida.", message);
    },
    [emitTerminal, finalizeCall],
  );

  const refreshCameraCapability = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameraCount = devices.filter(
        (device) => device.kind === "videoinput",
      ).length;

      if (mountedRef.current) {
        setCanSwitchCamera(cameraCount > 1);
      }
    } catch {
      if (mountedRef.current) setCanSwitchCamera(false);
    }
  }, []);

  const requestLocalMedia = useCallback(
    async (type: CallType, expectedEpoch: number) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("MEDIA_DEVICES_UNAVAILABLE");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          type === "video"
            ? {
                facingMode: { ideal: cameraFacingRef.current },
                width: { ideal: 640, max: 1280 },
                height: { ideal: 360, max: 720 },
                frameRate: { ideal: 24, max: 30 },
              }
            : false,
      });

      if (!mountedRef.current || !isCurrentSession(expectedEpoch)) {
        stopStream(stream);
        throw new Error("STALE_CALL_OPERATION");
      }

      stopStream(localStreamRef.current);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMicEnabled(stream.getAudioTracks().every((track) => track.enabled));
      setIsCameraEnabled(
        type === "video" &&
          stream.getVideoTracks().every((track) => track.enabled),
      );

      if (type === "video") {
        void refreshCameraCapability();
      }

      return stream;
    },
    [isCurrentSession, refreshCameraCapability],
  );

  const flushPendingCandidates = useCallback(async () => {
    const peer = peerRef.current;

    if (!peer?.remoteDescription) return;

    const candidates = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("[LG Chat] Candidato ICE ignorado:", error);
        }
      }
    }
  }, []);

  const handleOffer = useCallback(
    async (signal: Extract<CallSignal, { type: "offer" }>) => {
      const peer = peerRef.current;
      const callId = stateRef.current.call?.callId;
      const operationEpoch = sessionEpochRef.current;

      if (!peer || !callId) {
        pendingOfferRef.current = signal;
        return;
      }

      await peer.setRemoteDescription(signal.sdp);
      if (
        peerRef.current !== peer ||
        !isCurrentSession(operationEpoch, callId)
      ) {
        return;
      }

      const answer = await peer.createAnswer();
      if (
        peerRef.current !== peer ||
        !isCurrentSession(operationEpoch, callId)
      ) {
        return;
      }

      await peer.setLocalDescription(answer);
      if (
        peerRef.current !== peer ||
        !isCurrentSession(operationEpoch, callId)
      ) {
        return;
      }

      if (!answer.sdp) {
        throw new Error("EMPTY_ANSWER_SDP");
      }

      emitSignal({
        type: "answer",
        sdp: {
          type: "answer",
          sdp: answer.sdp,
        },
      });

      await flushPendingCandidates();
    },
    [emitSignal, flushPendingCandidates, isCurrentSession],
  );

  const handleAnswer = useCallback(
    async (signal: Extract<CallSignal, { type: "answer" }>) => {
      const peer = peerRef.current;
      const callId = stateRef.current.call?.callId;
      const operationEpoch = sessionEpochRef.current;

      if (!peer || !callId) {
        pendingAnswerRef.current = signal;
        return;
      }

      await peer.setRemoteDescription(signal.sdp);
      if (
        peerRef.current !== peer ||
        !isCurrentSession(operationEpoch, callId)
      ) {
        return;
      }

      await flushPendingCandidates();
    },
    [flushPendingCandidates, isCurrentSession],
  );

  const processSignal = useCallback(
    async (signal: CallSignal) => {
      if (signal.type === "offer") {
        await handleOffer(signal);
        return;
      }

      if (signal.type === "answer") {
        await handleAnswer(signal);
        return;
      }

      const peer = peerRef.current;

      if (!peer?.remoteDescription) {
        pendingCandidatesRef.current.push(signal.candidate);
        return;
      }

      try {
        await peer.addIceCandidate(signal.candidate);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("[LG Chat] Candidato ICE inválido ignorado:", error);
        }
      }
    },
    [handleAnswer, handleOffer],
  );

  const markMediaConnected = useCallback(() => {
    if (activeSinceRef.current === null) {
      activeSinceRef.current = Date.now();
      if (mountedRef.current) setDurationSeconds(0);
    }

    clearMediaDisconnectTimer();
    updateState((current) => {
      if (!current.call || !isBusyPhase(current.phase)) return current;

      return {
        ...current,
        phase: "active",
        statusMessage: "Em chamada",
        errorMessage: null,
      };
    });
  }, [clearMediaDisconnectTimer, updateState]);

  const createPeerConnection = useCallback(() => {
    const call = stateRef.current.call;
    const stream = localStreamRef.current;

    if (!call || !stream) {
      throw new Error("CALL_MEDIA_NOT_READY");
    }

    const oldPeer = peerRef.current;
    if (oldPeer) oldPeer.close();

    const peer = new RTCPeerConnection({
      iceServers: iceServersRef.current,
    });
    const remote = new MediaStream();

    peerRef.current = peer;
    remoteStreamRef.current = remote;
    setRemoteStream(remote);

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      const current = stateRef.current.call;
      if (!event.candidate || current?.callId !== call.callId) return;

      emitSignal({
        type: "candidate",
        candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment,
        },
      });
    };

    peer.ontrack = (event) => {
      if (stateRef.current.call?.callId !== call.callId) return;

      const tracks = event.streams[0]?.getTracks() ?? [event.track];
      tracks.forEach((track) => {
        if (!remote.getTracks().some((current) => current.id === track.id)) {
          remote.addTrack(track);
        }
      });

      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    peer.onconnectionstatechange = () => {
      if (stateRef.current.call?.callId !== call.callId) return;

      if (peer.connectionState === "connected") {
        markMediaConnected();
        return;
      }

      if (peer.connectionState === "disconnected") {
        updateState((current) => ({
          ...current,
          statusMessage: "Reconectando a mídia…",
        }));

        clearMediaDisconnectTimer();
        mediaDisconnectTimerRef.current = window.setTimeout(() => {
          if (
            peerRef.current === peer &&
            peer.connectionState === "disconnected"
          ) {
            failActiveCall("A conexão de mídia foi perdida.");
          }
        }, CALL_TIMEOUTS.disconnectedMedia);
        return;
      }

      if (peer.connectionState === "failed") {
        failActiveCall("Não foi possível estabelecer a conexão da chamada.");
      }
    };

    return peer;
  }, [
    clearMediaDisconnectTimer,
    emitSignal,
    failActiveCall,
    markMediaConnected,
    updateState,
  ]);

  const startCall = useCallback(
    async ({ chatId, type, contact }: StartCallOptions) => {
      if (isBusyPhase(stateRef.current.phase)) return;

      cleanupResources();
      const operationEpoch = sessionEpochRef.current;
      setDurationSeconds(0);

      if (!socket?.connected) {
        updateState({
          phase: "error",
          call: null,
          statusMessage: "Chamada indisponível",
          errorMessage: "Aguarde a conexão em tempo real antes de ligar.",
        });
        return;
      }

      updateState({
        phase: "requesting-media",
        call: null,
        statusMessage: "Preparando a chamada…",
        errorMessage: null,
      });

      try {
        const [, iceConfiguration] = await Promise.all([
          requestLocalMedia(type, operationEpoch),
          loadIceServerConfiguration().catch(() => null),
        ]);
        if (iceConfiguration) {
          iceServersRef.current = iceConfiguration.iceServers;
        }
        if (!isCurrentSession(operationEpoch)) return;

        const response = await emitWithAck(SOCKET_EVENTS.callStart, {
          chatId,
          type,
        });
        const ack = startCallAckSchema.safeParse(response);

        if (!ack.success) {
          throw new Error("INVALID_CALL_START_ACK");
        }

        if (!ack.data.success) {
          throw new Error(ack.data.error.message);
        }

        if (!mountedRef.current || !isCurrentSession(operationEpoch)) {
          if (socket.connected) {
            socket.emit(SOCKET_EVENTS.callReject, {
              callId: ack.data.data.callId,
              chatId: ack.data.data.chatId,
            });
          }
          cleanupResources();
          return;
        }

        const { targetUser, ...details } = ack.data.data;
        const participant: CallParticipant = {
          ...targetUser,
          avatarUrl:
            contact?.id === targetUser.id ? (contact.avatarUrl ?? null) : null,
        };

        updateState({
          phase: "outgoing",
          call: {
            ...details,
            direction: "outgoing",
            participant,
          },
          statusMessage: callStatusForType(
            type,
            "Chamando por vídeo…",
            "Chamando…",
          ),
          errorMessage: null,
        });
      } catch (error) {
        if (!isCurrentSession(operationEpoch)) return;

        cleanupResources();
        const isMediaFailure =
          error instanceof DOMException ||
          (error instanceof Error &&
            ["MEDIA_DEVICES_UNAVAILABLE", "STALE_CALL_OPERATION"].includes(
              error.message,
            ));
        const message = isMediaFailure
          ? mediaErrorMessage(error, type)
          : error instanceof Error &&
              ![
                "SOCKET_DISCONNECTED",
                "ACK_TIMEOUT",
                "INVALID_CALL_START_ACK",
              ].includes(error.message)
            ? error.message
            : "Não foi possível iniciar a chamada.";

        updateState({
          phase: "error",
          call: null,
          statusMessage: "Chamada não iniciada",
          errorMessage: message,
        });
      }
    },
    [
      cleanupResources,
      emitWithAck,
      isCurrentSession,
      requestLocalMedia,
      socket,
      updateState,
    ],
  );

  const acceptCall = useCallback(async () => {
    const call = stateRef.current.call;
    if (
      !call ||
      call.direction !== "incoming" ||
      stateRef.current.phase !== "incoming"
    ) {
      return;
    }
    const operationEpoch = sessionEpochRef.current;

    updateState((current) => ({
      ...current,
      phase: "requesting-media",
      statusMessage: "Preparando microfone e câmera…",
      errorMessage: null,
    }));

    try {
      const [, iceConfiguration] = await Promise.all([
        requestLocalMedia(call.type, operationEpoch),
        loadIceServerConfiguration().catch(() => null),
      ]);
      if (iceConfiguration) {
        iceServersRef.current = iceConfiguration.iceServers;
      }
      if (!isCurrentSession(operationEpoch, call.callId)) return;

      createPeerConnection();
      updateState((current) => ({
        ...current,
        phase: "connecting",
        statusMessage: "Conectando…",
      }));

      const response = await emitWithAck(SOCKET_EVENTS.callAccept, {
        callId: call.callId,
        chatId: call.chatId,
      });
      if (!isCurrentSession(operationEpoch, call.callId)) return;

      const ack = acceptCallAckSchema.safeParse(response);

      if (!ack.success) throw new Error("INVALID_CALL_ACCEPT_ACK");
      if (!ack.data.success) throw new Error(ack.data.error.message);
      const acceptedDetails = ack.data.data;

      updateState((current) => {
        if (current.call?.callId !== call.callId) return current;

        return {
          ...current,
          phase: "connecting",
          call: {
            ...current.call,
            ...acceptedDetails,
          },
          statusMessage: "Conectando…",
        };
      });

      const pendingOffer = pendingOfferRef.current;
      pendingOfferRef.current = null;
      if (pendingOffer) await handleOffer(pendingOffer);
    } catch (error) {
      if (!isCurrentSession(operationEpoch, call.callId)) return;

      emitTerminal(SOCKET_EVENTS.callReject, call);
      const isMediaFailure =
        error instanceof DOMException ||
        (error instanceof Error &&
          ["MEDIA_DEVICES_UNAVAILABLE", "STALE_CALL_OPERATION"].includes(
            error.message,
          ));
      const message = isMediaFailure
        ? mediaErrorMessage(error, call.type)
        : error instanceof Error &&
            ![
              "SOCKET_DISCONNECTED",
              "ACK_TIMEOUT",
              "INVALID_CALL_ACCEPT_ACK",
            ].includes(error.message)
          ? error.message
          : "Não foi possível confirmar a chamada com o servidor.";

      finalizeCall("error", "Não foi possível atender", message);
    }
  }, [
    createPeerConnection,
    emitTerminal,
    emitWithAck,
    finalizeCall,
    handleOffer,
    isCurrentSession,
    requestLocalMedia,
    updateState,
  ]);

  const rejectOrCancel = useCallback(
    async (expectedDirection: "incoming" | "outgoing") => {
      const call = stateRef.current.call;
      const expectedPhase =
        expectedDirection === "incoming" ? "incoming" : "outgoing";

      if (
        !call ||
        call.direction !== expectedDirection ||
        stateRef.current.phase !== expectedPhase
      ) {
        return;
      }

      updateState((current) => ({
        ...current,
        phase: "ending",
        statusMessage:
          expectedDirection === "incoming"
            ? "Recusando chamada…"
            : "Cancelando chamada…",
      }));
      cleanupResources();
      const operationEpoch = sessionEpochRef.current;

      try {
        const response = await emitWithAck(SOCKET_EVENTS.callReject, {
          callId: call.callId,
          chatId: call.chatId,
        });
        const ack = endCallAckSchema.safeParse(response);

        if (!ack.success || !ack.data.success) {
          throw new Error("CALL_REJECT_FAILED");
        }
      } catch {
        // A interface encerra localmente mesmo se o ACK se perder.
      }

      if (!isCurrentSession(operationEpoch, call.callId)) return;

      updateState((current) => ({
        ...current,
        phase: "ended",
        statusMessage:
          expectedDirection === "incoming"
            ? "Chamada recusada"
            : "Chamada cancelada",
        errorMessage: null,
      }));
    },
    [cleanupResources, emitWithAck, isCurrentSession, updateState],
  );

  const rejectCall = useCallback(
    () => rejectOrCancel("incoming"),
    [rejectOrCancel],
  );

  const cancelCall = useCallback(
    () => rejectOrCancel("outgoing"),
    [rejectOrCancel],
  );

  const endCall = useCallback(async () => {
    const call = stateRef.current.call;
    if (!call || !isBusyPhase(stateRef.current.phase)) return;

    updateState((current) => ({
      ...current,
      phase: "ending",
      statusMessage: "Encerrando chamada…",
    }));
    cleanupResources();
    const operationEpoch = sessionEpochRef.current;

    try {
      const response = await emitWithAck(SOCKET_EVENTS.callEnd, {
        callId: call.callId,
        chatId: call.chatId,
      });
      const ack = endCallAckSchema.safeParse(response);

      if (!ack.success || !ack.data.success) {
        throw new Error("CALL_END_FAILED");
      }
    } catch {
      // O backend trata call:end como idempotente; o estado local pode terminar.
    }

    if (!isCurrentSession(operationEpoch, call.callId)) return;

    updateState((current) => ({
      ...current,
      phase: "ended",
      statusMessage: "Chamada encerrada",
      errorMessage: null,
    }));
  }, [cleanupResources, emitWithAck, isCurrentSession, updateState]);

  const toggleMicrophone = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;

    const enabled = !tracks.every((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = enabled;
    });
    setIsMicEnabled(enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (!tracks.length) return;

    const enabled = !tracks.every((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = enabled;
    });
    setIsCameraEnabled(enabled);
  }, []);

  const switchCamera = useCallback(async () => {
    const call = stateRef.current.call;
    const currentStream = localStreamRef.current;
    const peer = peerRef.current;

    if (
      !call ||
      call.type !== "video" ||
      !currentStream ||
      !peer ||
      !["connecting", "active"].includes(stateRef.current.phase) ||
      isSwitchingCamera
    ) {
      return;
    }

    const nextFacing =
      cameraFacingRef.current === "user" ? "environment" : "user";
    const operationEpoch = sessionEpochRef.current;
    let replacementStream: MediaStream | null = null;
    setIsSwitchingCamera(true);

    try {
      replacementStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 640, max: 1280 },
          height: { ideal: 360, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      if (
        !isCurrentSession(operationEpoch, call.callId) ||
        peerRef.current !== peer ||
        localStreamRef.current !== currentStream
      ) {
        stopStream(replacementStream);
        replacementStream = null;
        return;
      }

      const replacementTrack = replacementStream.getVideoTracks()[0];

      if (!replacementTrack) {
        stopStream(replacementStream);
        throw new Error("CAMERA_TRACK_MISSING");
      }

      const oldTrack = currentStream.getVideoTracks()[0];
      replacementTrack.enabled = isCameraEnabled;

      const videoSender = peer
        .getSenders()
        .find((sender) => sender.track?.kind === "video");

      if (!videoSender) throw new Error("CAMERA_SENDER_MISSING");
      await videoSender.replaceTrack(replacementTrack);

      if (
        !isCurrentSession(operationEpoch, call.callId) ||
        peerRef.current !== peer ||
        localStreamRef.current !== currentStream
      ) {
        stopStream(replacementStream);
        replacementStream = null;
        return;
      }

      if (oldTrack) {
        currentStream.removeTrack(oldTrack);
        oldTrack.stop();
      }

      currentStream.addTrack(replacementTrack);
      replacementStream = null;
      cameraFacingRef.current = nextFacing;
      setCameraFacing(nextFacing);
      setCameraFacing(nextFacing);
      localStreamRef.current = currentStream;
      setLocalStream(new MediaStream(currentStream.getTracks()));
      void refreshCameraCapability();
    } catch {
      stopStream(replacementStream);
      if (isCurrentSession(operationEpoch, call.callId)) {
        updateState((current) => ({
          ...current,
          statusMessage: "Não foi possível trocar a câmera.",
        }));
      }
    } finally {
      if (mountedRef.current) setIsSwitchingCamera(false);
    }
  }, [
    isCameraEnabled,
    isCurrentSession,
    isSwitchingCamera,
    refreshCameraCapability,
    updateState,
  ]);

  const dismiss = useCallback(() => {
    if (isBusyPhase(stateRef.current.phase)) return;

    cleanupResources();
    setDurationSeconds(0);
    updateState(INITIAL_CALL_STATE);
  }, [cleanupResources, updateState]);

  useEffect(() => {
    if (state.phase !== "active" || activeSinceRef.current === null) return;

    const updateDuration = () => {
      const startedAt = activeSinceRef.current;
      if (startedAt === null) return;
      setDurationSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      );
    };

    updateDuration();
    const timer = window.setInterval(updateDuration, 1_000);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (
      !state.call ||
      (state.phase !== "incoming" && state.phase !== "outgoing")
    ) {
      return;
    }

    const callId = state.call.callId;
    const timer = window.setTimeout(() => {
      if (stateRef.current.call?.callId !== callId) return;

      if (stateRef.current.phase === "incoming") {
        void rejectCall();
      } else if (stateRef.current.phase === "outgoing") {
        void cancelCall();
      }
    }, CALL_TIMEOUTS.ringing);

    return () => window.clearTimeout(timer);
  }, [cancelCall, rejectCall, state.call, state.phase]);

  useEffect(() => {
    if (state.phase !== "connecting" || !state.call) return;

    const callId = state.call.callId;
    const timer = window.setTimeout(() => {
      if (
        stateRef.current.call?.callId === callId &&
        stateRef.current.phase === "connecting"
      ) {
        failActiveCall("A outra pessoa não conseguiu estabelecer a conexão.");
      }
    }, CALL_TIMEOUTS.connecting);

    return () => window.clearTimeout(timer);
  }, [failActiveCall, state.call, state.phase]);

  const resetDuration = useCallback(() => setDurationSeconds(0), []);

  useCallSocketEvents({
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
  });

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cleanupResources();
    };
  }, [cleanupResources]);

  const value = useMemo<CallContextValue>(
    () => ({
      phase: state.phase,
      call: state.call,
      statusMessage: state.statusMessage,
      errorMessage: state.errorMessage,
      localStream,
      remoteStream,
      durationSeconds,
      isBusy: isBusyPhase(state.phase),
      isMicEnabled,
      isCameraEnabled,
      cameraFacing,
      canSwitchCamera,
      isSwitchingCamera,
      startCall,
      acceptCall,
      rejectCall,
      cancelCall,
      endCall,
      toggleMicrophone,
      toggleCamera,
      switchCamera,
      dismiss,
    }),
    [
      acceptCall,
      canSwitchCamera,
      cameraFacing,
      cancelCall,
      dismiss,
      durationSeconds,
      endCall,
      isCameraEnabled,
      isMicEnabled,
      isSwitchingCamera,
      localStream,
      rejectCall,
      remoteStream,
      startCall,
      state,
      switchCamera,
      toggleCamera,
      toggleMicrophone,
    ],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      {renderOverlay ? <CallOverlay /> : null}
    </CallContext.Provider>
  );
}
