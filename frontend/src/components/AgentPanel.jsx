import React from "react";
import AgentAvatar from "./AgentAvatar";

const LABELS = {
  off: { fresh: "Tap the mic once to start", paused: "Paused — tap to continue" },
  listening: "Listening… just speak",
  thinking: "Thinking…",
  speaking: "Speaking — tap to skip",
};

function Icon({ name }) {
  const common = { width: 34, height: 34, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (name === "pause")
    return (<svg {...common}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>);
  if (name === "skip")
    return (<svg {...common}><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>);
  return (
    <svg {...common}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

export default function AgentPanel({ phase, started, reply, heard, lang, notice, levelRef, onToggle, onStartOver, interrupt, onInterruptChange }) {
  const urdu = lang === "urdu"; // Urdu is spoken only — its script is never shown on screen
  const label =
    phase === "off" ? (started ? LABELS.off.paused : LABELS.off.fresh) : LABELS[phase];
  const icon = phase === "off" ? "mic" : phase === "speaking" ? "skip" : "pause";
  const hint =
    phase === "off" ? "Start" : phase === "speaking" ? "Skip" : "Pause";

  return (
    <section className="agent-card" aria-label="Voice assistant">
      <header className="agent-top">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">AssanMart</span>
        </div>
        {lang && <span className="lang-chip">{urdu ? "Urdu" : "English"}</span>}
      </header>

      <div className="avatar-stage">
        <AgentAvatar state={phase} levelRef={levelRef} />
      </div>

      <div className={`status-chip is-${phase}`} role="status" aria-live="polite">
        <span className="status-dot" />
        {label}
      </div>

      <div className="caption">
        {urdu
          ? "Talking in Urdu — I reply by voice. Say “can we speak English?” to switch back."
          : reply || "Say what groceries you need. To talk in Urdu, just ask me."}
      </div>
      {heard && !urdu && !/[\u0600-\u06FF]/.test(heard) && (
        <div className="heard">
          <span>You said</span> {heard}
        </div>
      )}
      {notice && <div className="notice" role="alert">{notice}</div>}

      <div className="mic-dock">
        <button
          type="button"
          className={`mic-btn is-${phase}`}
          onClick={onToggle}
          aria-label={`${hint} voice assistant`}
        >
          <span className="mic-pulse" />
          <Icon name={icon} />
        </button>
        <div className="mic-hint">{hint}</div>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={!!interrupt} onChange={(e) => onInterruptChange?.(e.target.checked)} />
        <span>Let me interrupt the agent by speaking <small>(best with headphones)</small></span>
      </label>

      {phase === "off" && !started && (
        <ul className="try-list" aria-label="Examples">
          <li>“Mujhe atta chahiye”</li>
          <li>“I need a toothbrush”</li>
          <li>“Honey and sugar”</li>
        </ul>
      )}

      {started && (
        <button type="button" className="link-btn" onClick={onStartOver}>
          Start a new order
        </button>
      )}
    </section>
  );
}