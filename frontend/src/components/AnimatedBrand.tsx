import React from 'react';
import { AnimatedLogo } from './AnimatedLogo';

interface AnimatedBrandProps {
  playKey?: number | string;
}

export const AnimatedBrand: React.FC<AnimatedBrandProps> = ({ playKey = 0 }) => (
  <span key={playKey} className="amb relative flex items-center gap-2">
    <style>{`
      .amb .mark{animation:amb-mark 3.6s ease-out 1 both;transform-origin:50% 50%}
      .amb .word{animation:amb-word 3.6s linear 1 both}
      .amb .ring{animation:amb-ring 3.6s ease-out 1 both;opacity:0}
      .amb .orbit{animation:amb-orbit 3.6s cubic-bezier(.5,0,.3,1) 1 both;opacity:0}
      .amb .dot{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:9999px;animation:amb-dot 3.6s cubic-bezier(.5,0,.3,1) 1 both}
      .amb .d1{--a:0deg;background:#1daa61}
      .amb .d2{--a:120deg;background:#7fcf9a}
      .amb .d3{--a:240deg;background:#f59e0b}
      @keyframes amb-orbit{
        0%{opacity:0;transform:rotate(0)}
        8%{opacity:1}
        46%{opacity:1;transform:rotate(300deg)}
        48%,100%{opacity:0;transform:rotate(300deg)}
      }
      @keyframes amb-dot{
        0%{transform:rotate(var(--a)) translateX(26px) scale(.2)}
        12%{transform:rotate(var(--a)) translateX(26px) scale(1)}
        46%,100%{transform:rotate(var(--a)) translateX(0) scale(.6)}
      }
      @keyframes amb-ring{
        0%,46%{opacity:0;transform:scale(.7)}
        49%{opacity:1;transform:scale(1.15)}
        73%,100%{opacity:0;transform:scale(2)}
      }
      @keyframes amb-mark{
        0%,46%{opacity:0;transform:scale(.2)}
        60%{opacity:1;transform:scale(1.14)}
        70%{transform:scale(.97)}
        80%,100%{opacity:1;transform:scale(1)}
      }
      @keyframes amb-word{
        0%,63%{clip-path:inset(0 100% 0 0)}
        64%{clip-path:inset(0 100% 0 0);animation-timing-function:steps(9,end)}
        100%{clip-path:inset(0 0 0 0)}
      }
      @media (prefers-reduced-motion:reduce){
        .amb .mark,.amb .word{animation:none!important;opacity:1;clip-path:none}
        .amb .ring,.amb .orbit{display:none}
      }
    `}</style>

    {/* logo circle */}
    <span className="relative w-10 h-10 shrink-0">
      <span className="mark w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden">
        <AnimatedLogo className="w-[74%] h-[74%]" />
      </span>
      {/* pulse ring */}
      <span className="ring pointer-events-none absolute inset-0 rounded-full border-2 border-[#7fcf9a]" />
      {/* three dots spiralling into the logo */}
      <span className="orbit pointer-events-none absolute left-1/2 top-1/2 w-0 h-0">
        <span className="dot d1" /><span className="dot d2" /><span className="dot d3" />
      </span>
    </span>

    {/* wordmark types out */}
    <span className="word text-lg font-black tracking-tight text-[#2a6b43] whitespace-nowrap">
      Assan<span className="text-[#1DAA61]">Mart</span>
    </span>
  </span>
);