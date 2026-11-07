import React, { useEffect, useRef } from 'react';

export type VoicePhase = 'off' | 'listening' | 'thinking' | 'speaking';

interface VoiceAvatarProps {
  state: VoicePhase;
  levelRef?: React.MutableRefObject<number>;
}

export const VoiceAvatar: React.FC<VoiceAvatarProps> = ({ state, levelRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    if (state !== 'listening') {
      el.style.setProperty('--lvl', '0');
      return undefined;
    }

    let rafId: number;
    const tick = () => {
      const v = Math.min(1, (levelRef?.current || 0) * 3.5);
      el.style.setProperty('--lvl', v.toFixed(3));
      rafId = requestAnimationFrame(tick);
    };
    tick();

    return () => cancelAnimationFrame(rafId);
  }, [state, levelRef]);

  return (
    <div
      ref={containerRef}
      className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center select-none"
      style={{ ['--lvl' as any]: 0 }}
    >
      {/* Outer Glow Halo */}
      <div className="absolute inset-2 rounded-full bg-radial from-emerald-100/90 via-emerald-50/50 to-transparent transition-all duration-300" />

      {/* Reactive Audio Rings for Listening */}
      <div
        className={`absolute inset-4 rounded-full border-2 border-emerald-500/40 pointer-events-none transition-opacity duration-200 ${
          state === 'listening' ? 'opacity-80' : 'opacity-0'
        }`}
        style={{
          transform: `scale(calc(1.02 + var(--lvl) * 0.28))`,
          transition: 'transform 0.08s linear',
        }}
      />
      <div
        className={`absolute inset-0 rounded-full border border-emerald-400/30 pointer-events-none transition-opacity duration-200 ${
          state === 'listening' ? 'opacity-50' : 'opacity-0'
        }`}
        style={{
          transform: `scale(calc(1.08 + var(--lvl) * 0.45))`,
          transition: 'transform 0.1s linear',
        }}
      />

      {/* Speaking Ripple Rings */}
      {state === 'speaking' && (
        <>
          <div className="absolute inset-2 rounded-full border-2 border-amber-400/50 animate-ping opacity-60 pointer-events-none" />
          <div className="absolute inset-5 rounded-full border border-emerald-500/40 animate-pulse pointer-events-none" />
        </>
      )}

      {/* Inner Circular Pedestal */}
      <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-linear-to-b from-white to-[#f5fbf7] p-2 shadow-lg shadow-emerald-950/10 border-2 border-emerald-100 flex items-center justify-center overflow-hidden">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute inset-0 bg-radial from-emerald-200/30 via-transparent to-emerald-900/5" />

        {/* 3D Mascot Bag Artwork */}
        <img
          src="/assets/aistudio/image_59b342ad.png"
          alt="AssanMart Voice Assistant"
          className={`relative z-10 w-full h-full object-contain filter drop-shadow-md transition-transform duration-300 ${
            state === 'speaking'
              ? 'animate-bounce'
              : state === 'thinking'
              ? 'animate-pulse'
              : state === 'listening'
              ? 'scale-105'
              : 'hover:scale-105'
          }`}
          style={{ animationDuration: state === 'speaking' ? '1.2s' : '2.5s' }}
          draggable={false}
        />

        {/* Thinking State Bouncing Dots */}
        {state === 'thinking' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-xs border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );
};
