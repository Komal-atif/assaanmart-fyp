import { useRef, useCallback, useEffect } from "react";

/**
 * Hands-free listening.
 *
 *   open()   ask for the microphone once (call from a click)
 *   listen() start waiting for the user to speak
 *   pause()  stop listening (e.g. while the agent is talking)
 *   close()  release the microphone
 *
 * While listening, a MediaRecorder runs continuously. When the volume rises above the noise floor we mark
 * "speech started"; after SILENCE_MS of quiet we stop the recorder and hand the audio to onUtterance(blob).
 * If nothing is said, the recorder is recycled every PREROLL_MS so the audio we send never starts with a long silence.
 */

const SILENCE_MS = 1300;       // quiet time that ends a sentence (long enough for a breath, short enough to feel quick)
const THINK_SILENCE_MS = 1900; // after only a short phrase ("mujhe...") the customer is probably still thinking: wait a bit longer
const MIN_VOICED_MS = 250;     // shorter than this = a click / noise, ignored
const MAX_UTTERANCE_MS = 20000;
const PREROLL_MS = 600;        // leading silence kept before the first word
const RESUME_DELAY_MS = 120;   // let the speaker tail die out before listening again
const MIN_THRESHOLD = 0.025;   // lowest volume (0..1) that counts as speech
const BARGE_MIN_THRESHOLD = 0.05; // while the agent is talking we need a clearly louder voice (its own sound leaks in)
const BARGE_HOLD_MS = 200;        // ...held for this long, so a cough or an echo doesn't cut the agent off

export function useVoiceLoop({ onUtterance, onBargeIn }) {
  const levelRef = useRef(0); // smoothed microphone volume 0..1, read by the avatar animation
  const cbRef = useRef(onUtterance);
  cbRef.current = onUtterance;
  const bargeCbRef = useRef(onBargeIn);
  bargeCbRef.current = onBargeIn;

  const s = useRef({
    stream: null, ctx: null, analyser: null, data: null, raf: 0, timer: 0,
    rec: null, listening: false, speaking: false, bargeIn: false, bargeMs: 0,
    recStart: 0, speechStart: 0, lastVoice: 0, voicedMs: 0, lastFrame: 0, floor: 0.01,
  });

  const startRecorder = () => {
    const st = s.current;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)
    );
    const rec = new MediaRecorder(st.stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
    rec._chunks = [];
    rec._send = false;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) rec._chunks.push(e.data);
    };
    rec.onstop = () => {
      if (rec._send && rec._chunks.length) {
        cbRef.current?.(new Blob(rec._chunks, { type: rec.mimeType || "audio/webm" }));
      }
    };
    rec.start(100);
    st.rec = rec;
    st.recStart = performance.now();
  };

  const stopRecorder = (send) => {
    const st = s.current;
    const rec = st.rec;
    st.rec = null;
    if (!rec) return;
    rec._send = send;
    if (rec.state !== "inactive") rec.stop();
  };

  const loop = () => {
    const st = s.current;
    st.raf = requestAnimationFrame(loop);
    if (!st.analyser) return;

    st.analyser.getByteTimeDomainData(st.data);
    let sum = 0;
    for (let i = 0; i < st.data.length; i++) {
      const v = (st.data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / st.data.length);
    levelRef.current = levelRef.current * 0.7 + rms * 0.3;

    if (!st.listening) return;

    const now = performance.now();
    const dt = now - (st.lastFrame || now);
    st.lastFrame = now;

    const voiced = st.bargeIn
      ? rms > Math.max(BARGE_MIN_THRESHOLD, st.floor * 5)
      : rms > Math.max(MIN_THRESHOLD, st.floor * 3);

    if (!st.speaking && st.bargeIn) {
      // the agent is talking: only a sustained, loud voice counts as "the user wants to speak"
      if (voiced) {
        st.bargeMs += dt;
        if (st.bargeMs >= BARGE_HOLD_MS) {
          st.bargeIn = false;
          st.speaking = true;
          st.speechStart = now - st.bargeMs;
          st.lastVoice = now;
          st.voicedMs = st.bargeMs;
          bargeCbRef.current?.(); // App stops the agent's audio; recording carries on
        }
      } else {
        st.bargeMs = 0;
        st.floor = st.floor * 0.97 + rms * 0.03;
        if (now - st.recStart > PREROLL_MS) {
          stopRecorder(false);
          startRecorder();
        }
      }
      return;
    }

    if (!st.speaking) {
      if (voiced) {
        st.speaking = true;
        st.speechStart = now;
        st.lastVoice = now;
        st.voicedMs = dt;
      } else {
        st.floor = st.floor * 0.97 + rms * 0.03; // learn the room's background noise
        if (now - st.recStart > PREROLL_MS) {
          stopRecorder(false);
          startRecorder();
        }
      }
      return;
    }

    if (voiced) {
      st.lastVoice = now;
      st.voicedMs += dt;
    }
    const need = st.voicedMs < 1800 ? THINK_SILENCE_MS : SILENCE_MS;
    if (now - st.lastVoice > need || now - st.speechStart > MAX_UTTERANCE_MS) {
      st.listening = false;
      st.speaking = false;
      if (st.voicedMs >= MIN_VOICED_MS) {
        stopRecorder(true); // -> onUtterance(blob)
      } else {
        stopRecorder(false); // only a click: keep listening
        st.listening = true;
        st.lastFrame = 0;
        startRecorder();
      }
    }
  };

  const open = useCallback(async () => {
    const st = s.current;
    if (st.stream) {
      if (st.ctx && st.ctx.state === "suspended") await st.ctx.resume();
      return;
    }
    st.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    st.ctx = new Ctx();
    const src = st.ctx.createMediaStreamSource(st.stream);
    st.analyser = st.ctx.createAnalyser();
    st.analyser.fftSize = 1024;
    st.data = new Uint8Array(st.analyser.fftSize);
    src.connect(st.analyser);
    loop();
  }, []);

  // listen({ bargeIn: true }) = keep an ear open WHILE the agent speaks, so the user can interrupt it
  const listen = useCallback((opts = {}) => {
    const st = s.current;
    clearTimeout(st.timer);
    const begin = () => {
      if (!st.stream) return;
      stopRecorder(false);
      st.speaking = false;
      st.lastFrame = 0;
      st.bargeIn = !!opts.bargeIn;
      st.bargeMs = 0;
      st.listening = true;
      startRecorder();
    };
    if (opts.bargeIn) begin();
    else st.timer = setTimeout(begin, RESUME_DELAY_MS);
  }, []);

  const pause = useCallback(() => {
    const st = s.current;
    clearTimeout(st.timer);
    st.listening = false;
    st.speaking = false;
    st.bargeIn = false;
    stopRecorder(false);
  }, []);

  const close = useCallback(() => {
    const st = s.current;
    pause();
    cancelAnimationFrame(st.raf);
    st.stream?.getTracks().forEach((t) => t.stop());
    st.ctx?.close().catch(() => {});
    st.stream = null;
    st.ctx = null;
    st.analyser = null;
  }, [pause]);

  useEffect(() => () => close(), [close]);

  return { open, listen, pause, close, levelRef };
}