import { useCallback, useEffect, useRef, useState } from "react";

import type { StatusPost } from "../../status.schemas";
import { safeStatusBackground } from "../../status.utils";
import styles from "./styles.module.css";

type StatusPlaybackProps = {
  status: StatusPost;
  authorName: string;
  paused: boolean;
  onProgress: (progress: number) => void;
  onComplete: () => void;
  onDisplayed: (status: StatusPost) => void;
};

export function StatusPlayback({
  status,
  authorName,
  paused,
  onProgress,
  onComplete,
  onDisplayed,
}: StatusPlaybackProps) {
  const missingMedia = status.type !== "text" && !status.mediaUrl;
  const [ready, setReady] = useState(status.type === "text");
  const [mediaError, setMediaError] = useState(missingMedia);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playbackMessage, setPlaybackMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const elapsedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const displayedRef = useRef(false);
  const playGenerationRef = useRef(0);

  const attemptVideoPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const generation = ++playGenerationRef.current;
    try {
      await video.play();
      if (generation !== playGenerationRef.current) return;
      setAutoplayBlocked(false);
      setPlaybackMessage(null);
    } catch (error) {
      if (generation !== playGenerationRef.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;

      setAutoplayBlocked(true);
      setPlaybackMessage(
        "A reprodução automática foi bloqueada. Toque para iniciar o vídeo.",
      );
    }
  }, []);

  useEffect(() => {
    if (!ready || mediaError || displayedRef.current) return;

    const displayedTimer = window.setTimeout(() => {
      displayedRef.current = true;
      onDisplayed(status);
    }, 250);

    return () => window.clearTimeout(displayedTimer);
  }, [mediaError, onDisplayed, ready, status]);

  useEffect(() => {
    const usesTimer = status.type !== "video" || mediaError;
    if (!ready || paused || !usesTimer || completedRef.current) return;

    const tick = (timestamp: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = timestamp;
      const delta = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;
      elapsedRef.current += delta;

      const nextProgress = Math.min(1, elapsedRef.current / 7_000);
      onProgress(nextProgress);

      if (nextProgress >= 1) {
        completedRef.current = true;
        onComplete();
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastFrameRef.current = null;
    };
  }, [mediaError, onComplete, onProgress, paused, ready, status.type]);

  useEffect(() => {
    if (status.type !== "video" || !ready || mediaError) return;

    const video = videoRef.current;
    if (!video) return;

    if (paused) {
      playGenerationRef.current += 1;
      video.pause();
      return;
    }

    if (!autoplayBlocked) {
      const generation = ++playGenerationRef.current;
      void video
        .play()
        .then(() => {
          if (generation !== playGenerationRef.current) return;
          setAutoplayBlocked(false);
          setPlaybackMessage(null);
        })
        .catch((error: unknown) => {
          if (generation !== playGenerationRef.current) return;
          if (error instanceof DOMException && error.name === "AbortError")
            return;
          setAutoplayBlocked(true);
          setPlaybackMessage(
            "A reprodução automática foi bloqueada. Toque para iniciar o vídeo.",
          );
        });
    }
  }, [autoplayBlocked, mediaError, paused, ready, status.type]);

  useEffect(
    () => () => {
      playGenerationRef.current += 1;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    },
    [],
  );

  const mediaFailure = (
    <div
      className={styles.mediaFailure}
      role="img"
      aria-label="Mídia indisponível"
    >
      <span aria-hidden="true">!</span>
      <p>Não foi possível exibir esta mídia.</p>
    </div>
  );

  return (
    <div className={styles.playback}>
      {status.type === "text" ? (
        <div
          className={styles.textStatus}
          style={{ background: safeStatusBackground(status.backgroundColor) }}
        >
          <p>{status.text}</p>
        </div>
      ) : null}

      {status.type === "image" ? (
        mediaError ? (
          mediaFailure
        ) : (
          <img
            className={styles.statusImage}
            src={status.mediaUrl ?? undefined}
            alt={`Status publicado por ${authorName}`}
            onLoad={() => setReady(true)}
            onError={() => {
              setMediaError(true);
              setReady(true);
            }}
          />
        )
      ) : null}

      {status.type === "video" ? (
        mediaError ? (
          mediaFailure
        ) : (
          <video
            ref={videoRef}
            className={styles.statusVideo}
            src={status.mediaUrl ?? undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label={`Vídeo de status publicado por ${authorName}`}
            onLoadedData={() => setReady(true)}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              if (Number.isFinite(video.duration) && video.duration > 0) {
                onProgress(Math.min(1, video.currentTime / video.duration));
              }
            }}
            onEnded={onComplete}
            onError={() => {
              setMediaError(true);
              setReady(true);
              setPlaybackMessage("O vídeo não pôde ser carregado.");
            }}
          />
        )
      ) : null}

      {status.type !== "text" && status.text ? (
        <p className={styles.caption}>{status.text}</p>
      ) : null}

      {autoplayBlocked ? (
        <button
          className={styles.playButton}
          type="button"
          onClick={() => void attemptVideoPlay()}
        >
          Reproduzir vídeo
        </button>
      ) : null}
      {playbackMessage ? (
        <p className={styles.playbackMessage} role="status">
          {playbackMessage}
        </p>
      ) : null}
      {!ready && !mediaError ? (
        <p className={styles.loadingMedia} aria-live="polite">
          Carregando mídia…
        </p>
      ) : null}
    </div>
  );
}
