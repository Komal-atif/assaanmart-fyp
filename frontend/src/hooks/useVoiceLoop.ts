import { useRef, useCallback, useEffect } from 'react';

export interface UseVoiceLoopOptions {
  onUtterance: (blob: Blob) => void;
  onBargeIn?: () => void;
  silenceThresholdMs?: number; // quiet time (relative to the user's own voice) before the audio is sent (default 900ms)
  maxUtteranceMs?: number;     // safety stop: send whatever was recorded after this long (default 30000ms): background voices can never keep the mic open forever
}

export function useVoiceLoop({
  onUtterance,
  onBargeIn,
  silenceThresholdMs = 900,
  maxUtteranceMs = 30000,
}: UseVoiceLoopOptions) {
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sendOnStopRef = useRef<boolean>(false); // only a recording that really contained speech is sent
  const levelRef = useRef<number>(0);
  const isListeningRef = useRef<boolean>(false);
  const isBargeInRef = useRef<boolean>(false);
  const hasSpokenRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  // adaptive voice detection
  const noiseFloorRef = useRef<number>(0.03);   // slow average of the room's background level
  const userLevelRef = useRef<number>(0);       // average level of THIS customer's speech in the current utterance
  const aboveSinceRef = useRef<number>(0);      // when the level first rose above the start / barge-in threshold
  const lastVoiceRef = useRef<number>(0);       // last moment the level was above the speech threshold
  const onUtteranceRef = useRef(onUtterance);  // always the newest callback (no stale closures)
  onUtteranceRef.current = onUtterance;
  const listenStartRef = useRef<number>(0);     // when this listening round began (no-speech fallback)
  const speechStartRef = useRef<number>(0);     // when real speech began (for the safety stop)

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  // stop a recorder WITHOUT sending what it captured (nothing was said / it is being replaced)
  const discardRecorder = () => {
    const r = recorderRef.current;
    if (!r) return;
    r.ondataavailable = null;
    r.onstop = null;
    if (r.state !== 'inactive') {
      try { r.stop(); } catch {}
    }
    recorderRef.current = null;
  };

  const stopAll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    discardRecorder();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    isListeningRef.current = false;
    levelRef.current = 0;
  };

  // Open microphone and initialize audio analyzer
  const open = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current && streamRef.current.active) {
      return streamRef.current;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone not supported on this browser/environment.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    streamRef.current = stream;

    // Set up Web Audio Analyser
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      // Start volume measurement loop
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        // Normalize 0.0 to 1.0 with soft non-linear curve
        const norm = Math.min(1, Math.max(0, avg / 128));
        levelRef.current = norm;

        // VAD (Voice Activity Detection), relative to the room and to the customer's own voice:
        //  - slight sounds never interrupt the agent: barge-in needs a clearly loud voice kept up for ~0.5 s
        //  - background voices / TV do not keep the mic "open": after the customer stops, anything much quieter
        //    than their own speech counts as silence, so the audio is sent a moment later
        const now = performance.now();
        const floor = noiseFloorRef.current;
        if (isListeningRef.current) {
          const startT = Math.max(0.08, floor * 1.7);   // sensitive enough for quiet voices / phone mics
          const bargeT = Math.max(0.22, floor * 3);
          // the longer someone keeps talking, the stricter 'silence' becomes (0.5 -> 0.7 of the customer's own level after 8 s),
          // so a TV / people in the background cannot hold the microphone open
          const k = hasSpokenRef.current && now - speechStartRef.current > 8000 ? 0.7 : 0.5;
          const threshold = isBargeInRef.current ? bargeT : hasSpokenRef.current ? Math.max(startT, userLevelRef.current * k) : startT;
          const needMs = isBargeInRef.current ? 500 : 200;

          if (norm > threshold) {
            if (!aboveSinceRef.current) aboveSinceRef.current = now;
            const sustained = now - aboveSinceRef.current >= needMs;
            if (sustained || hasSpokenRef.current) {
              if (isBargeInRef.current) {
                isBargeInRef.current = false;
                onBargeIn?.();
              }
              if (!hasSpokenRef.current) speechStartRef.current = aboveSinceRef.current;
              hasSpokenRef.current = true;
              lastVoiceRef.current = now;
              userLevelRef.current = userLevelRef.current ? userLevelRef.current * 0.9 + norm * 0.1 : norm;
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
            }
          } else {
            aboveSinceRef.current = 0;
            if (hasSpokenRef.current && !silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => finishUtterance(), silenceThresholdMs);
            }
          }

          // nobody spoke for 12 s: quietly start a fresh round (the recording is thrown away, never sent, so room noise
          // can not be 'heard' as an order). Not while the agent is talking.
          if (!hasSpokenRef.current && !isBargeInRef.current && now - listenStartRef.current > 12000) {
            listenStartRef.current = now;
            chunksRef.current = [];
            if (recorderRef.current && recorderRef.current.state === 'recording') startRecorder();
          }

          // safety: never wait forever when something keeps the level up
          if (hasSpokenRef.current && now - speechStartRef.current > maxUtteranceMs) finishUtterance();
        } else {
          aboveSinceRef.current = 0;
        }

        // learn the room's background level (slowly, only when nobody is speaking)
        if (!hasSpokenRef.current) noiseFloorRef.current = Math.min(0.2, Math.max(0.01, floor * 0.985 + norm * 0.015));

        rafRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    }

    return stream;
  }, [onBargeIn, silenceThresholdMs, maxUtteranceMs]);

  const finishUtterance = useCallback((force: boolean = false) => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // send only if the customer really spoke (otherwise room noise would be sent again and again)
    if (!hasSpokenRef.current && !force) {
      discardRecorder();
      return;
    }
    // a blip shorter than ~0.5 s is a noise, not an order
    if (lastVoiceRef.current - speechStartRef.current < 500 && !force) {
      discardRecorder();
      isListeningRef.current = true;
      hasSpokenRef.current = false;
      userLevelRef.current = 0;
      listenStartRef.current = performance.now();
      startRecorder();
      return;
    }
    sendOnStopRef.current = true;
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping recorder:', err);
      }
    }
  }, []);

  const listen = useCallback(
    ({ bargeIn = false }: { bargeIn?: boolean } = {}) => {
      isBargeInRef.current = bargeIn;
      isListeningRef.current = true;
      hasSpokenRef.current = false;
      userLevelRef.current = 0;
      aboveSinceRef.current = 0;
      chunksRef.current = [];
      listenStartRef.current = performance.now();

      if (!streamRef.current || !streamRef.current.active) {
        open()
          .then(() => startRecorder())
          .catch((err) => console.warn('Could not open stream for listen:', err));
        return;
      }

      startRecorder();
    },
    [open]
  );

  const startRecorder = () => {
    if (!streamRef.current) return;
    discardRecorder(); // the old recorder must never send its leftovers
    sendOnStopRef.current = false;

    // Determine supported mimeType
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else {
        mimeType = '';
      }
    }

    try {
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(streamRef.current, options);
      recorderRef.current = recorder;

      const myChunks: Blob[] = [];   // belongs to THIS recorder only
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) myChunks.push(e.data);
      };

      recorder.onstop = () => {
        const send = sendOnStopRef.current;
        sendOnStopRef.current = false;
        if (!send || myChunks.length === 0) return;
        const finalType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(myChunks, { type: finalType });
        if (blob.size < 2500) return;   // too short to be speech (also avoids 'corrupt audio' errors)
        onUtteranceRef.current(blob);
      };

      recorder.start(100); // chunk every 100ms
    } catch (err) {
      console.warn('Could not create MediaRecorder:', err);
    }
  };

  const pause = useCallback(() => {
    isListeningRef.current = false;
    isBargeInRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (!sendOnStopRef.current) discardRecorder();   // paused while nothing was said: drop the recording, do not send it
    levelRef.current = 0;
  }, []);

  return {
    open,
    listen,
    pause,
    stopAll,
    finishUtterance,
    levelRef,
  };
}