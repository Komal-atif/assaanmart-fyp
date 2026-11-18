import { useRef, useCallback, useEffect } from 'react';

export const IS_MOBILE =
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || ((navigator.maxTouchPoints || 0) > 1 && typeof window !== 'undefined' && window.innerWidth < 900));

export interface UseVoiceLoopOptions {
  onUtterance: (blob: Blob) => void;
  onBargeIn?: () => void;
  onIdle?: () => void;         
  idleMs?: number;            
  silenceThresholdMs?: number; 
  maxUtteranceMs?: number;     
}

export function useVoiceLoop({
  onUtterance,
  onBargeIn,
  onIdle,
  idleMs = 30000,
  silenceThresholdMs = 900,
  maxUtteranceMs = 30000,
}: UseVoiceLoopOptions) {
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sendOnStopRef = useRef<boolean>(false); 
  const levelRef = useRef<number>(0);
  const isListeningRef = useRef<boolean>(false);
  const isBargeInRef = useRef<boolean>(false);
  const hasSpokenRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  // adaptive voice detection
  const noiseFloorRef = useRef<number>(0.03);  
  const userLevelRef = useRef<number>(0);       
  const aboveSinceRef = useRef<number>(0);      
  const watchdogRef = useRef<any>(null);
  const peakRef = useRef<number>(0);           
  const lastVoiceRef = useRef<number>(0);      
  const onUtteranceRef = useRef(onUtterance);  
  onUtteranceRef.current = onUtterance;
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;
  const bargeBaseRef = useRef<number>(0.03);    // level of the agent's own sound in the room while it speaks
  const listenStartRef = useRef<number>(0);     // when this listening round began 
  const speechStartRef = useRef<number>(0);     // when real speech began 

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

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
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
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

      const checkCaps = (now: number) => {
        if (!isListeningRef.current) return;
        if (!hasSpokenRef.current && !isBargeInRef.current && peakRef.current <= 0.12 && now - listenStartRef.current > idleMs) {
          listenStartRef.current = now;
          chunksRef.current = [];
          const cb = onIdleRef.current;
          if (cb) { isListeningRef.current = false; discardRecorder(); cb(); }
          else if (recorderRef.current && recorderRef.current.state === 'recording') startRecorder();
        }

        if (hasSpokenRef.current && now - speechStartRef.current > maxUtteranceMs) finishUtterance();
        else if (!isBargeInRef.current && peakRef.current > 0.12 && now - listenStartRef.current > maxUtteranceMs) finishUtterance(true);
      };

      // Start volume measurement loop
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let lastFrame = 0;
      const updateVolume = () => {
        if (!analyserRef.current) return;
        if (IS_MOBILE) {
          const t0 = performance.now();
          if (t0 - lastFrame < 40) { rafRef.current = requestAnimationFrame(updateVolume); return; }
          lastFrame = t0;
        }
        analyserRef.current.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const norm = Math.min(1, Math.max(0, avg / 128));
        levelRef.current = norm;

        const now = performance.now();
        const floor = noiseFloorRef.current;
        if (isListeningRef.current) {
          const startT = Math.max(0.08, floor * 1.7);   
          const bargeT = IS_MOBILE ? Math.max(0.16, bargeBaseRef.current * 2.4) : Math.max(0.10, bargeBaseRef.current * 1.8);   
          const k = hasSpokenRef.current && now - speechStartRef.current > 8000 ? 0.7 : 0.5;
          const threshold = isBargeInRef.current ? bargeT : hasSpokenRef.current ? Math.max(startT, userLevelRef.current * k) : startT;
          const needMs = isBargeInRef.current ? (IS_MOBILE ? 450 : 300) : 200;

          if (!isBargeInRef.current && norm > peakRef.current) peakRef.current = norm;
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
            if (isBargeInRef.current) bargeBaseRef.current = bargeBaseRef.current * 0.95 + norm * 0.05;   // follow the agent's own sound
            if (hasSpokenRef.current && !silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => finishUtterance(), silenceThresholdMs);
            }
          }

          checkCaps(now);
        } else {
          aboveSinceRef.current = 0;
        }

        if (!hasSpokenRef.current) noiseFloorRef.current = Math.min(0.2, Math.max(0.01, floor * 0.985 + norm * 0.015));

        rafRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      watchdogRef.current = setInterval(() => {
        // iPhone Safari suspends the audio engine whenever sound plays: wake it so the microphone level keeps being measured
        const c = audioCtxRef.current;
        if (c && c.state === 'suspended') c.resume().catch(() => {});
        checkCaps(performance.now());
      }, 500);
    }

    return stream;
  }, [onBargeIn, silenceThresholdMs, maxUtteranceMs, idleMs]);

  const finishUtterance = useCallback((force: boolean = false) => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (!hasSpokenRef.current && !force) {
      discardRecorder();
      return;
    }
    if (lastVoiceRef.current - speechStartRef.current < 500 && !force) {
      discardRecorder();
      isListeningRef.current = true;
      hasSpokenRef.current = false;
      userLevelRef.current = 0;
      listenStartRef.current = performance.now();
      peakRef.current = 0;
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
      peakRef.current = 0;
      bargeBaseRef.current = Math.max(0.03, noiseFloorRef.current);

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
    discardRecorder(); 
    sendOnStopRef.current = false;

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

      const myChunks: Blob[] = [];   
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) myChunks.push(e.data);
      };

      recorder.onstop = () => {
        const send = sendOnStopRef.current;
        sendOnStopRef.current = false;
        if (!send || myChunks.length === 0) return;
        const finalType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(myChunks, { type: finalType });
        if (blob.size < 2500) return;   
        onUtteranceRef.current(blob);
      };

      if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Android/i.test(navigator.userAgent))) recorder.start();   // Safari: one clean file at stop (chunked mp4 pieces can be unreadable)
      else recorder.start(100); 
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
    if (!sendOnStopRef.current) discardRecorder();  
    levelRef.current = 0;
  }, []);

  return {
    open,
    listen,
    pause,
    stopAll,
    finishUtterance,
    isListening: () => isListeningRef.current,
    levelRef,
  };
}