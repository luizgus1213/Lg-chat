import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { useCalls } from "../../useCalls";

import styles from "./styles.module.css";

type IconName =
  | "answer"
  | "camera"
  | "cameraOff"
  | "close"
  | "end"
  | "microphone"
  | "microphoneOff"
  | "switchCamera";

const ICON_PATHS: Record<IconName, string> = {
  answer:
    "M6.6 10.8c1.9 3.7 4.9 6.7 8.6 8.6l2.9-2.9c.4-.4 1-.5 1.5-.3l3.2 1.3c.7.3 1.2 1 1.2 1.8v3.2c0 .8-.7 1.5-1.5 1.5C10.1 24 0 13.9 0 1.5 0 .7.7 0 1.5 0h3.2c.8 0 1.5.5 1.8 1.2l1.3 3.2c.2.5.1 1.1-.3 1.5L4.6 8.8c.6.7 1.2 1.4 2 2Z",
  camera:
    "M3 5h11a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Zm16 4.3 3.1-2.1A1.2 1.2 0 0 1 24 8.3v7.4a1.2 1.2 0 0 1-1.9 1L19 14.6V9.3Z",
  cameraOff:
    "m2.1.7 21.2 21.2-1.4 1.4-4.5-4.5-2.1 1.4A1.2 1.2 0 0 1 19 16.6v-2l-2-2V16a3 3 0 0 1-3 3H5.4l-4.7 4.7-1.4-1.4L21.9.7l1.4 1.4-5.1 5.1.8.8v1.3l3.1-2.1A1.2 1.2 0 0 1 24 8.3v7.4a1.2 1.2 0 0 1-1.9 1L19 14.6v2l-1.7-1.7L2.1 30.1.7 28.7 3 26.4 0 23.4V8a3 3 0 0 1 3-3h8.4L.7 2.1 2.1.7Z",
  close: "M5.6 4.2 12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4 1.4-1.4Z",
  end: "M2.3 15.2a2 2 0 0 1-.7-2.8C4.2 9.1 7.8 7.5 12 7.5s7.8 1.6 10.4 4.9a2 2 0 0 1-.7 2.8l-2.4 1.4a2 2 0 0 1-2.7-.7l-.8-1.4a10.2 10.2 0 0 0-7.6 0l-.8 1.4a2 2 0 0 1-2.7.7l-2.4-1.4Z",
  microphone:
    "M12 0a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V4a4 4 0 0 1 4-4Zm7 10v1a7 7 0 0 1-6 6.9V22h4v2H7v-2h4v-4.1A7 7 0 0 1 5 11v-1h2v1a5 5 0 0 0 10 0v-1h2Z",
  microphoneOff:
    "m2.1.7 21.2 21.2-1.4 1.4-5.5-5.5A6.9 6.9 0 0 1 13 17.9V22h4v2H7v-2h4v-4.1A7 7 0 0 1 5 11v-1h2v1a5 5 0 0 0 7.9 4.1l-1.5-1.5A4 4 0 0 1 8 11V8.2L.7 2.1 2.1.7ZM12 0a4 4 0 0 1 4 4v7c0 .4-.1.9-.2 1.3L8 4.5V4a4 4 0 0 1 4-4Zm7 10v1c0 1.5-.5 2.9-1.3 4L16.2 13c.5-.6.8-1.3.8-2v-1h2Z",
  switchCamera:
    "M7.3 4 9 1.5h6L16.7 4H20a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h3.3ZM12 7a6 6 0 0 0-5.7 4H4l3 3 3-3H8.4A4 4 0 0 1 15 9.5l1.4-1.4A6 6 0 0 0 12 7Zm5 3-3 3h1.6A4 4 0 0 1 9 14.5l-1.4 1.4A6 6 0 0 0 17.7 14H20l-3-4Z",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} fill="currentColor" />
    </svg>
  );
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":")
    : [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function useMediaElement(
  elementRef: RefObject<HTMLMediaElement | null>,
  stream: MediaStream | null,
) {
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.srcObject = stream;
    setPlaybackBlocked(false);

    if (stream) {
      void element.play().catch(() => setPlaybackBlocked(true));
    }

    return () => {
      element.pause();
      element.srcObject = null;
    };
  }, [elementRef, stream]);

  async function resume() {
    const element = elementRef.current;
    if (!element) return;

    try {
      await element.play();
      setPlaybackBlocked(false);
    } catch {
      setPlaybackBlocked(true);
    }
  }

  return { playbackBlocked, resume };
}

export function CallOverlay() {
  const calls = useCalls();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wasVisibleRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isVisible = calls.phase !== "idle";
  const isVideoCall = calls.call?.type === "video";
  const remoteVideoPlayback = useMediaElement(
    remoteVideoRef,
    isVideoCall ? calls.remoteStream : null,
  );
  const remoteAudioPlayback = useMediaElement(
    remoteAudioRef,
    !isVideoCall ? calls.remoteStream : null,
  );
  useMediaElement(localVideoRef, isVideoCall ? calls.localStream : null);

  useEffect(() => {
    if (isVisible && !wasVisibleRef.current) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      window.setTimeout(() => {
        (primaryActionRef.current ?? dialogRef.current)?.focus();
      }, 0);
    }

    if (!isVisible && wasVisibleRef.current) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }

    wasVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const appRoot = document.getElementById("root");
    if (!appRoot) return;

    const previousAriaHidden = appRoot.getAttribute("aria-hidden");
    const wasInert = appRoot.inert;
    appRoot.inert = true;
    appRoot.setAttribute("aria-hidden", "true");

    return () => {
      appRoot.inert = wasInert;
      if (previousAriaHidden === null) {
        appRoot.removeAttribute("aria-hidden");
      } else {
        appRoot.setAttribute("aria-hidden", previousAriaHidden);
      }
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const timer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(document.activeElement)) return;
      (primaryActionRef.current ?? dialog)?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [calls.phase, isVisible]);

  useEffect(() => {
    const localVideo = localVideoRef.current;
    if (!localVideo) return;
    localVideo.muted = true;
  }, [calls.localStream]);

  if (!isVisible) return null;

  const participantName = calls.call?.participant.nome ?? "LG Chat";
  const participantInitial = participantName.trim().charAt(0).toUpperCase() || "?";
  const playbackBlocked = isVideoCall
    ? remoteVideoPlayback.playbackBlocked
    : remoteAudioPlayback.playbackBlocked;

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && ["ended", "error"].includes(calls.phase)) {
      event.preventDefault();
      calls.dismiss();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
      ),
    );

    if (!focusable.length) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${isVideoCall ? styles.videoDialog : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lg-call-title"
        aria-describedby="lg-call-status"
        onKeyDown={handleDialogKeyDown}
        tabIndex={-1}
      >
        <div className={styles.mediaStage}>
          {isVideoCall ? (
            <>
              <video
                ref={remoteVideoRef}
                className={styles.remoteVideo}
                autoPlay
                playsInline
                aria-label={`Vídeo de ${participantName}`}
              />
              <video
                ref={localVideoRef}
                className={`${styles.localVideo} ${
                  calls.isCameraEnabled ? "" : styles.localVideoHidden
                } ${
                  calls.cameraFacing === "user" ? styles.localVideoMirrored : ""
                }`}
                autoPlay
                muted
                playsInline
                aria-label="Prévia da sua câmera"
              />
            </>
          ) : (
            <audio ref={remoteAudioRef} autoPlay />
          )}

          <div className={`${styles.identity} ${isVideoCall ? styles.identityOnVideo : ""}`}>
            {calls.call?.participant.avatarUrl ? (
              <img
                className={styles.avatar}
                src={calls.call.participant.avatarUrl}
                alt=""
              />
            ) : (
              <div className={styles.avatarFallback} aria-hidden="true">
                {participantInitial}
              </div>
            )}

            <div className={styles.identityText}>
              <h2 id="lg-call-title">{participantName}</h2>
              <p id="lg-call-status" aria-live="polite">
                {calls.statusMessage}
              </p>
              {calls.phase === "active" ? (
                <time className={styles.duration}>
                  {formatDuration(calls.durationSeconds)}
                </time>
              ) : null}
            </div>
          </div>

          {calls.errorMessage ? (
            <div className={styles.error} role="alert">
              {calls.errorMessage}
            </div>
          ) : null}

          {playbackBlocked && calls.remoteStream ? (
            <button
              type="button"
              className={styles.playbackButton}
              onClick={() =>
                void (isVideoCall
                  ? remoteVideoPlayback.resume()
                  : remoteAudioPlayback.resume())
              }
            >
              Ativar áudio da chamada
            </button>
          ) : null}
        </div>

        <div className={styles.controls} aria-label="Controles da chamada">
          {calls.phase === "incoming" ? (
            <>
              <button
                type="button"
                className={`${styles.controlButton} ${styles.rejectButton}`}
                onClick={() => void calls.rejectCall()}
                aria-label="Recusar chamada"
              >
                <Icon name="end" />
                <span>Recusar</span>
              </button>
              <button
                ref={primaryActionRef}
                type="button"
                className={`${styles.controlButton} ${styles.answerButton}`}
                onClick={() => void calls.acceptCall()}
                aria-label="Atender chamada"
              >
                <Icon name="answer" />
                <span>Atender</span>
              </button>
            </>
          ) : null}

          {calls.phase === "outgoing" ? (
            <button
              ref={primaryActionRef}
              type="button"
              className={`${styles.controlButton} ${styles.rejectButton}`}
              onClick={() => void calls.cancelCall()}
              aria-label="Cancelar chamada"
            >
              <Icon name="end" />
              <span>Cancelar</span>
            </button>
          ) : null}

          {calls.phase === "connecting" || calls.phase === "active" ? (
            <>
              <button
                type="button"
                className={`${styles.controlButton} ${
                  calls.isMicEnabled ? "" : styles.inactiveButton
                }`}
                onClick={calls.toggleMicrophone}
                aria-label={
                  calls.isMicEnabled ? "Desativar microfone" : "Ativar microfone"
                }
                aria-pressed={!calls.isMicEnabled}
              >
                <Icon
                  name={calls.isMicEnabled ? "microphone" : "microphoneOff"}
                />
                <span>{calls.isMicEnabled ? "Silenciar" : "Ativar"}</span>
              </button>

              {isVideoCall ? (
                <button
                  type="button"
                  className={`${styles.controlButton} ${
                    calls.isCameraEnabled ? "" : styles.inactiveButton
                  }`}
                  onClick={calls.toggleCamera}
                  aria-label={
                    calls.isCameraEnabled ? "Desativar câmera" : "Ativar câmera"
                  }
                  aria-pressed={!calls.isCameraEnabled}
                >
                  <Icon name={calls.isCameraEnabled ? "camera" : "cameraOff"} />
                  <span>{calls.isCameraEnabled ? "Câmera" : "Ativar"}</span>
                </button>
              ) : null}

              {isVideoCall && calls.canSwitchCamera ? (
                <button
                  type="button"
                  className={styles.controlButton}
                  onClick={() => void calls.switchCamera()}
                  disabled={calls.isSwitchingCamera}
                  aria-label="Trocar entre câmera frontal e traseira"
                >
                  <Icon name="switchCamera" />
                  <span>{calls.isSwitchingCamera ? "Trocando" : "Trocar"}</span>
                </button>
              ) : null}

              <button
                ref={primaryActionRef}
                type="button"
                className={`${styles.controlButton} ${styles.rejectButton}`}
                onClick={() => void calls.endCall()}
                aria-label="Encerrar chamada"
              >
                <Icon name="end" />
                <span>Encerrar</span>
              </button>
            </>
          ) : null}

          {calls.phase === "requesting-media" || calls.phase === "ending" ? (
            <div className={styles.progress} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              Aguarde…
            </div>
          ) : null}

          {calls.phase === "ended" || calls.phase === "error" ? (
            <button
              ref={primaryActionRef}
              type="button"
              className={`${styles.controlButton} ${styles.closeButton}`}
              onClick={calls.dismiss}
              aria-label="Fechar chamada"
            >
              <Icon name="close" />
              <span>Fechar</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
