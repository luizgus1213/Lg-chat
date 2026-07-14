import { useCallback, useEffect, useRef, useState } from "react";

type RecorderState = "idle" | "recording" | "paused" | "ready";

function preferredMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const elapsedBeforeStartRef = useRef(0);
  const discardRef = useRef(false);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const reset = useCallback(() => {
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
    releaseStream();
    clearPreview();
    chunksRef.current = [];
    startedAtRef.current = null;
    elapsedBeforeStartRef.current = 0;
    setDurationSeconds(0);
    setFile(null);
    setErrorMessage(null);
    setState("idle");
  }, [clearPreview, releaseStream]);

  const start = useCallback(async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setErrorMessage("A gravação de áudio não é suportada neste navegador.");
      return;
    }

    reset();
    discardRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setErrorMessage("A gravação foi interrompida pelo navegador.");
        releaseStream();
      };
      recorder.onstop = () => {
        releaseStream();
        recorderRef.current = null;
        if (discardRef.current) return;

        const type = (recorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size === 0) {
          setErrorMessage("Nenhum áudio foi capturado. Tente novamente.");
          setState("idle");
          return;
        }

        const extension = type.includes("ogg") ? "ogg" : "webm";
        const nextFile = new File([blob], `audio-${Date.now()}.${extension}`, {
          type,
        });
        clearPreview();
        setFile(nextFile);
        const objectUrl = URL.createObjectURL(blob);
        previewUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
        setState("ready");
      };

      startedAtRef.current = Date.now();
      recorder.start(250);
      setState("recording");
    } catch (error: unknown) {
      releaseStream();
      setState("idle");
      setErrorMessage(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Permita o uso do microfone para gravar um áudio."
          : "Não foi possível acessar o microfone.",
      );
    }
  }, [clearPreview, releaseStream, reset]);

  const pauseOrResume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || typeof recorder.pause !== "function") return;

    if (recorder.state === "recording") {
      if (startedAtRef.current !== null) {
        elapsedBeforeStartRef.current += Date.now() - startedAtRef.current;
      }
      startedAtRef.current = null;
      recorder.pause();
      setState("paused");
    } else if (recorder.state === "paused") {
      startedAtRef.current = Date.now();
      recorder.resume();
      setState("recording");
    }
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (startedAtRef.current !== null) {
      elapsedBeforeStartRef.current += Date.now() - startedAtRef.current;
    }
    startedAtRef.current = null;
    recorder.stop();
  }, []);

  useEffect(() => {
    if (state !== "recording") return;

    const update = () => {
      const active = startedAtRef.current
        ? Date.now() - startedAtRef.current
        : 0;
      setDurationSeconds(
        Math.floor((elapsedBeforeStartRef.current + active) / 1000),
      );
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(
    () => () => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      recorderRef.current = null;
      releaseStream();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      chunksRef.current = [];
    },
    [releaseStream],
  );

  return {
    state,
    durationSeconds,
    file,
    previewUrl,
    errorMessage,
    canPause:
      typeof MediaRecorder !== "undefined" &&
      typeof MediaRecorder.prototype.pause === "function",
    start,
    pauseOrResume,
    stop,
    cancel: reset,
    reset,
  };
}
