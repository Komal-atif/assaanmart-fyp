import React, { useEffect, useRef } from "react";
import mascot from "../assets/mascot.png";

/**
 * The AssanMart mascot. `state` = off | listening | thinking | speaking
 * While listening, the rings grow with the user's voice volume (levelRef is written by useVoiceLoop).
 */
export default function AgentAvatar({ state, levelRef }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (state !== "listening") {
      el.style.setProperty("--lvl", "0");
      return undefined;
    }
    let raf;
    const tick = () => {
      const v = Math.min(1, (levelRef?.current || 0) * 4);
      el.style.setProperty("--lvl", v.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [state, levelRef]);

  return (
    <div ref={ref} className="avatar" data-state={state}>
      <span className="avatar-halo" />
      <span className="avatar-ring ring-1" />
      <span className="avatar-ring ring-2" />
      <img className="avatar-img" src={mascot} alt="AssanMart assistant" draggable="false" />
      {state === "thinking" && (
        <span className="avatar-dots" aria-hidden="true">
          <i /><i /><i />
        </span>
      )}
    </div>
  );
}