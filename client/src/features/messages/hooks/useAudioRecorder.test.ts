import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAudioRecorder } from "./useAudioRecorder";

class FakeMediaRecorder {
  static latest: FakeMediaRecorder | null = null;

  static isTypeSupported(type: string) {
    return type.startsWith("audio/webm");
  }

  state = "inactive";
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: unknown, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? "audio/webm";
    FakeMediaRecorder.latest = this;
  }

  start() {
    this.state = "recording";
  }

  pause() {
    this.state = "paused";
  }

  resume() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }),
    });
    this.onstop?.();
  }
}

const stopTrack = vi.fn();
const getUserMedia = vi.fn(async () => ({
  getTracks: () => [{ stop: stopTrack }],
}));
const createObjectURL = vi.fn(() => "blob:audio-preview");
const revokeObjectURL = vi.fn();

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  FakeMediaRecorder.latest = null;
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
});

describe("gravador de áudio", () => {
  it("grava, pausa, cria prévia e libera o microfone", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());
    expect(result.current.state).toBe("recording");

    act(() => result.current.pauseOrResume());
    expect(result.current.state).toBe("paused");

    act(() => result.current.pauseOrResume());
    expect(result.current.state).toBe("recording");

    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state).toBe("ready"));

    expect(result.current.file).toMatchObject({ type: "audio/webm" });
    expect(result.current.previewUrl).toBe("blob:audio-preview");
    expect(stopTrack).toHaveBeenCalled();
  });

  it("revoga a prévia ao cancelar", async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state).toBe("ready"));

    act(() => result.current.cancel());

    expect(result.current.state).toBe("idle");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:audio-preview");
  });
});
