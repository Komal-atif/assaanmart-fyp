import React, { useState, useRef, useEffect, useCallback } from "react";
import AgentPanel from "./components/AgentPanel";
import BasketPanel from "./components/BasketPanel";
import ProductModal from "./components/ProductModal";
import { useVoiceLoop } from "./hooks/useVoiceLoop";
import { BACKEND, EMPTY_CART, get, post } from "./api";
import "./App.css";

/**
 * Conversation flow (hands-free):
 *   tap mic once -> /greet -> agent speaks -> listening (voice-activity detection)
 *   user stops talking -> /converse -> agent speaks -> listening again ... until the user pauses.
 * phase: off | listening | thinking | speaking
 */
export default function App() {
  const [phase, setPhase] = useState("off");
  const [started, setStarted] = useState(false);
  const [reply, setReply] = useState("");
  const [heard, setHeard] = useState("");
  const [lang, setLang] = useState(null);
  const [options, setOptions] = useState(null);
  const [cart, setCart] = useState(EMPTY_CART);
  const [notice, setNotice] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [interrupt, setInterrupt] = useState(true); // may the user cut the agent off by speaking?

  const playerRef = useRef(null);
  const resolverRef = useRef(null);
  const tokenRef = useRef(0);
  const activeRef = useRef(false); // true while the conversation is running (not paused)
  const historyRef = useRef([]);
  const cartRef = useRef(EMPTY_CART);
  const bargedRef = useRef(false);
  const interruptRef = useRef(true);
  interruptRef.current = interrupt;

  // ---------------------------------------------------------------- audio
  const playOnce = (url) =>
    new Promise((resolve) => {
      const a = playerRef.current || (playerRef.current = new Audio());
      a.preload = "auto";
      if (resolverRef.current) resolverRef.current(); // a newer reply replaces the old one
      resolverRef.current = resolve;
      const done = () => {
        if (resolverRef.current === resolve) resolverRef.current = null;
        resolve();
      };
      a.onended = done;
      a.onerror = done;
      a.src = url;
      a.play().catch(done);
    });

  const stopSpeech = () => {
    playerRef.current?.pause();
    if (resolverRef.current) {
      const r = resolverRef.current;
      resolverRef.current = null;
      r();
    }
  };

  // ---------------------------------------------------------------- turn handling
  const voice = useVoiceLoop({
    onUtterance: (blob) => handleUtterance(blob),
    onBargeIn: () => {
      bargedRef.current = true; // the user started talking over the agent
      stopSpeech();
    },
  });
  const { open, listen, pause, levelRef } = voice;

  // speak the reply, then go back to listening (unless the user paused or something newer started)
  const speak = useCallback(
    async (path) => {
      const my = ++tokenRef.current;
      bargedRef.current = false;
      if (path) {
        setPhase("speaking");
        // keep the microphone open while the agent talks, so the user can interrupt
        if (interruptRef.current && activeRef.current) listen({ bargeIn: true });
        else pause();
        await playOnce(BACKEND + path);
      }
      if (my !== tokenRef.current) return;
      if (bargedRef.current) {
        // the user is already speaking: the recorder is running, just show that we're listening
        bargedRef.current = false;
        setPhase("listening");
        return;
      }
      if (activeRef.current) {
        setPhase("listening");
        listen();
      } else {
        setPhase("off");
      }
    },
    [listen, pause]
  );

  function applyTurn(d, { silentIfEmpty = false } = {}) {
    if (d.cart) {
      // basket just became empty without a cancel -> the order was placed (by voice or by button)
      if (d.cart.count === 0 && cartRef.current.count > 0 && !/cancel|منسوخ/i.test(d.reply_text || "")) {
        setOrderMessage(`Order placed — ${Math.round(cartRef.current.total)} rupees, cash on delivery.`);
      }
      cartRef.current = d.cart;
      setCart(d.cart);
    }
    if ("options" in d) setOptions(d.options ?? null);
    if (silentIfEmpty && !d.user_text) return;
    if (d.reply_text !== undefined) setReply(d.reply_text);
    if (d.detected_language) setLang(d.detected_language);
    if (d.user_text !== undefined) setHeard(d.user_text);
  }

  async function handleUtterance(blob) {
    setPhase("thinking");
    setNotice("");
    try {
      const fd = new FormData();
      fd.append("audio", blob, `speech.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
      fd.append("history_json", JSON.stringify(historyRef.current.slice(-6)));
      const res = await fetch(`${BACKEND}/converse`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();

      applyTurn(d, { silentIfEmpty: true });
      if (!d.user_text) {
        // nothing recognised (noise) — stay quiet and keep listening
        if (activeRef.current) {
          setPhase("listening");
          listen();
        } else setPhase("off");
        return;
      }
      historyRef.current = d.history || historyRef.current;
      await speak(activeRef.current ? d.audio_url : null);
    } catch (err) {
      console.error("converse failed:", err);
      setNotice("Couldn't reach the server. Check that the backend is running.");
      if (activeRef.current) {
        setPhase("listening");
        listen();
      } else setPhase("off");
    }
  }

  // ---------------------------------------------------------------- start / pause / skip
  async function startSession() {
    try {
      await open(); // microphone permission (needs this click)
    } catch (err) {
      console.error(err);
      setNotice("Microphone is blocked. Allow it in the browser address bar and try again.");
      return;
    }
    activeRef.current = true;
    setNotice("");
    setStarted(true);
    setPhase("thinking");
    try {
      const g = await post("/greet");
      historyRef.current = g.history || [];
      setReply(g.reply_text);
      setHeard("");
      setLang(null);
      setOptions(null);
      cartRef.current = g.cart || EMPTY_CART;
      setCart(cartRef.current);
      setOrderMessage("");
      await speak(g.audio_url);
    } catch (err) {
      console.error(err);
      activeRef.current = false;
      setPhase("off");
      setStarted(false);
      setNotice("Couldn't reach the server. Check that the backend is running.");
    }
  }

  async function onToggle() {
    if (phase === "off") {
      if (!started) return startSession();
      await open();
      activeRef.current = true;
      setPhase("listening");
      listen();
    } else if (phase === "speaking") {
      stopSpeech(); // skip: the speak() chain then returns to listening
    } else {
      activeRef.current = false; // pause
      tokenRef.current += 1;
      stopSpeech();
      pause();
      setPhase("off");
    }
  }

  async function startOver() {
    activeRef.current = false;
    tokenRef.current += 1;
    stopSpeech();
    pause();
    setStarted(false);
    await startSession();
  }

  // ---------------------------------------------------------------- taps (pop-up, basket)
  async function runRequest(path, body) {
    stopSpeech();
    pause();
    tokenRef.current += 1;
    setPhase("thinking");
    try {
      const d = await post(path, body);
      applyTurn(d);
      return d;
    } catch (err) {
      console.error(err);
      setNotice("Something went wrong. Please try again.");
      setPhase(activeRef.current ? "listening" : "off");
      if (activeRef.current) listen();
      return null;
    }
  }

  async function pick(value, qty) {
    const d = await runRequest("/select", { value, qty });
    if (d) await speak(d.audio_url);
  }

  async function confirmOrder() {
    setBusy(true);
    const d = await runRequest("/action", { action: "confirm" });
    setBusy(false);
    if (d) await speak(d.audio_url);
  }

  async function declineOrder() {
    const d = await runRequest("/action", { action: "decline" });
    if (d) await speak(d.audio_url);
  }

  async function changeQty(id, qty) {
    try {
      const c = await post("/cart/update", { id, qty });
      cartRef.current = c;
      setCart(c);
    } catch (err) {
      console.error(err);
    }
  }

  // show whatever the server already holds (e.g. after a page refresh)
  useEffect(() => {
    get("/cart")
      .then((c) => {
        cartRef.current = { ...EMPTY_CART, ...c };
        setCart(cartRef.current);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="shell">
      <AgentPanel
        phase={phase}
        started={started}
        reply={reply}
        heard={heard}
        lang={lang}
        notice={notice}
        levelRef={levelRef}
        onToggle={onToggle}
        onStartOver={startOver}
        interrupt={interrupt}
        onInterruptChange={setInterrupt}
      />
      <BasketPanel
        cart={cart}
        busy={busy}
        message={orderMessage}
        onDismissMessage={() => setOrderMessage("")}
        onQty={changeQty}
        onConfirm={confirmOrder}
        onDecline={declineOrder}
      />
      <ProductModal options={options} phase={phase} onSelect={pick} />
    </div>
  );
}