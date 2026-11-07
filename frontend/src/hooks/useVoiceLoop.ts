import { useRef, useCallback, useEffect } from 'react';

export interface UseVoiceLoopOptions {
  onUtterance: (blob: Blob) => void;
  onBargeIn?: () => void;
  silenceThresholdMs?: number; // how long the customer may stay silent (thinking) before the sentence is sent
}

const SPEECH_THRESHOLD = 0.12;      // normal listening
const BARGE_IN_MIN = 0.17;          // lowest level that can interrupt the agent while it talks
const MIN_SPEECH_FRAMES = 14;       // ~0.25 s of real speech before a sentence counts (ignores clicks, fans, echo tails)
const MIN_BLOB_BYTES = 2000;        // anything smaller is noise, never sent to the server

interface Rec {
  recorder: MediaRecorder;
  chunks: Blob[];
  send: boolean; // only true when the customer really finished a sentence
}

export function useVoiceLoop({ onUtterance, onBargeIn, silenceThresholdMs = 1800 }: UseVoiceLoopOptions) {
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recRef = useRef<Rec | null>(null);
  const levelRef = useRef<number>(0);
  const isListeningRef = useRef(false);
  const isBargeInRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);
  const speechFramesRef = useRef(0);
  const noiseRef = useRef(0.02); // room noise level, learned while nobody is talking
  // How loud THIS customer usually is (they sit closest to the microphone). Voices in the background (TV, other people)
  // are quieter than that, so they are not treated as the customer talking.
  const userLevelRef = useRef(0);
  const echoRef = useRef(0.05); // how loud the agent's own voice comes back into the microphone while it talks
  const sumRef = useRef(0);
  const cntRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // always call the latest callbacks
  const onUtteranceRef = useRef(onUtterance);
  const onBargeInRef = useRef(onBargeIn);
  onUtteranceRef.current = onUtterance;
  onBargeInRef.current = onBargeIn;

  const clearSilence = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // Stop the current recorder. send=false throws the audio away.
  const endRecorder = (send: boolean) => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    rec.send = send;
    if (rec.recorder.state !== 'inactive') {
      try {
        rec.recorder.stop();
      } catch {}
    }
  };

  const finishUtterance = useCallback(() => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    clearSilence();
    if (hasSpokenRef.current && cntRef.current > 0) {
      const avg = sumRef.current / cntRef.current;
      userLevelRef.current = userLevelRef.current ? userLevelRef.current * 0.7 + avg * 0.3 : avg;
    }
    endRecorder(hasSpokenRef.current);
  }, []);

  const startRecorder = () => {
    const stream = streamRef.current;
    if (!stream) return;
    endRecorder(false); // an unfinished recording is dropped, never sent

    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    }
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const rec: Rec = { recorder, chunks: [], send: false };
      recRef.current = rec;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) rec.chunks.push(e.data);
      };
      recorder.onstop = () => {
        if (!rec.send) return;
        const blob = new Blob(rec.chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        if (blob.size >= MIN_BLOB_BYTES) onUtteranceRef.current(blob);
      };
      recorder.start(100);
    } catch (err) {
      console.warn('Could not create MediaRecorder:', err);
    }
  };

  const stopAll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    clearSilence();
    endRecorder(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        audioCtxRef.current.close();
      } catch {}
    }
    audioCtxRef.current = null;
    isListeningRef.current = false;
    levelRef.current = 0;
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const open = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current && streamRef.current.active) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone not supported.');

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    streamRef.current = stream;

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const norm = Math.min(1, Math.max(0, sum / buffer.length / 128));
        levelRef.current = norm;

        if (!isListeningRef.current || !hasSpokenRef.current) {
          // learn the room noise from quiet moments
          if (norm < 0.15) noiseRef.current = noiseRef.current * 0.98 + norm * 0.02;
        }
        if (isListeningRef.current) {
          // after the first sentences: only sound that is close to the customer's own loudness counts as speech
          const fg = userLevelRef.current ? Math.min(0.32, userLevelRef.current * 0.5) : 0;
          const base = Math.max(SPEECH_THRESHOLD, noiseRef.current * 2.5 + 0.05, fg);
          // while the agent talks: the customer must be clearly louder than the agent's own echo (learned live),
          // so a normal speaking voice interrupts it, but its own voice does not
          const bargeThr = Math.max(BARGE_IN_MIN, echoRef.current * 1.8 + 0.05);
          const threshold = isBargeInRef.current ? bargeThr : base;
          if (isBargeInRef.current && norm <= bargeThr) echoRef.current = echoRef.current * 0.95 + norm * 0.05;
          // once the customer is talking, soft words and trailing sounds still count as speech (lower bar)
          const keepTalking = hasSpokenRef.current && norm > base * 0.6;
          if (norm > threshold || keepTalking) {
            speechFramesRef.current += 1;
            if (!isBargeInRef.current && norm > base) {
              sumRef.current += norm;
              cntRef.current += 1;
            }
            if (speechFramesRef.current >= (isBargeInRef.current ? 9 : MIN_SPEECH_FRAMES)) {
              if (isBargeInRef.current) {
                isBargeInRef.current = false;
                onBargeInRef.current?.();
              }
              hasSpokenRef.current = true;
              clearSilence();
            }
          } else {
            if (!hasSpokenRef.current) speechFramesRef.current = Math.max(0, speechFramesRef.current - 1);
            if (hasSpokenRef.current && !silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(finishUtterance, silenceThresholdMs);
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    }
    return stream;
  }, [silenceThresholdMs, finishUtterance]);

  const listen = useCallback(
    ({ bargeIn = false }: { bargeIn?: boolean } = {}) => {
      isBargeInRef.current = bargeIn;
      if (bargeIn) echoRef.current = 0.05;
      isListeningRef.current = true;
      hasSpokenRef.current = false;
      speechFramesRef.current = 0;
      sumRef.current = 0;
      cntRef.current = 0;
      userLevelRef.current *= 0.97; // slowly forgets, in case the customer moves away from the microphone
      clearSilence();
      if (!streamRef.current || !streamRef.current.active) {
        open().then(startRecorder).catch((err) => console.warn('Could not open microphone:', err));
        return;
      }
      startRecorder();
    },
    [open]
  );

  // Stop listening and throw away whatever was recorded.
  const pause = useCallback(() => {
    isListeningRef.current = false;
    isBargeInRef.current = false;
    clearSilence();
    endRecorder(false);
    levelRef.current = 0;
  }, []);

  return { open, listen, pause, stopAll, finishUtterance, levelRef };
}