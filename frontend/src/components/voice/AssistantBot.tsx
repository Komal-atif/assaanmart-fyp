import React from 'react';
const HeldCard: React.FC<{ item?: HeldItem | null; cx: number; cy: number; cls: string; fly?: boolean }> = ({ item, cx, cy, cls, fly }) => {
  const w = 118;
  const h = 142;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return (
    <g className={`${fly ? 'fly' : `hold ${cls}${item ? ' on' : ''}`}`}>
      {item && (
        <>
          <rect x={x} y={y} width={w} height={h} rx="20" fill="#fff" stroke="#1DAA61" strokeWidth="4" />
          <rect x={x} y={y} width={w} height="26" rx="20" fill="#e0f4e7" />
          <rect x={x} y={y + 14} width={w} height="12" fill="#e0f4e7" />
          <text x={cx} y={y + 74} textAnchor="middle" fontSize="44">{item.emoji || '🛒'}</text>
          {item.image && <image href={item.image} x={x + 10} y={y + 8} width={w - 20} height={h - 52} preserveAspectRatio="xMidYMid meet" />}
          <text x={cx} y={y + h - 22} textAnchor="middle" fontSize="13" fontWeight="800" fill="#1f5233">
            {(item.label || '').length > 15 ? (item.label || '').slice(0, 14) + '…' : item.label}
          </text>
          {item.price && (
            <text x={cx} y={y + h - 6} textAnchor="middle" fontSize="13" fontWeight="800" fill="#1DAA61">{item.price}</text>
          )}
        </>
      )}
    </g>
  );
};

export interface HeldItem { image?: string | null; label?: string; price?: string; emoji?: string }

export type BotState = 'idle' | 'listening' | 'talking' | 'showing' | 'happy';

interface AssistantBotProps {
  state?: BotState;
  className?: string;
  showArms?: boolean;
  showAntenna?: boolean;
  showShadow?: boolean;
  viewBox?: string;
  holdLeft?: HeldItem | null;
  holdRight?: HeldItem | null;
  adding?: HeldItem | null;
}
export const AssistantBot: React.FC<AssistantBotProps> = ({ state = 'idle', className = 'w-full h-full', showArms = true, showAntenna = false, showShadow = true, viewBox = '335 170 600 670', holdLeft = null, holdRight = null, adding = null }) => (
  <svg
    className={`am-bot ${className}`}
    data-state={state}
    viewBox={viewBox}
    data-hold={holdLeft || holdRight || adding ? 'true' : 'false'}
    role="img"
    aria-label="AssanMart assistant"
  >
    <style>{`
      .am-bot{display:block;overflow:visible}
      .am-bot *{transform-box:view-box}

      .am-bot .bot{animation:amB-float 3.2s ease-in-out infinite}
      .am-bot .shadow{transform-origin:633px 793px;animation:amB-shadow 3.2s ease-in-out infinite}
      @keyframes amB-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-24px)}}
      @keyframes amB-shadow{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.88);opacity:.75}}

      .am-bot .ball{transform-box:fill-box;transform-origin:center;animation:amB-pulse 2.4s ease-in-out infinite}
      @keyframes amB-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}

      .am-bot .eyes{transform-box:fill-box;transform-origin:center;animation:amB-blink 5s infinite}
      @keyframes amB-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}

      .am-bot .m-smile{opacity:1}
      .am-bot .m-talk,.am-bot .m-o,.am-bot .eyes-happy{opacity:0}
      .am-bot .m-talk{transform-box:fill-box;transform-origin:center}

      .am-bot .arm-l{transform-origin:520px 485px;animation:amB-wave 3.2s ease-in-out infinite}
      .am-bot .arm-r{transform-origin:520px 485px;transition:transform .45s cubic-bezier(.3,1.5,.5,1);animation:amB-wave 3.2s ease-in-out infinite}
      @keyframes amB-wave{0%,100%{transform:rotate(0)}50%{transform:rotate(6deg)}}

      .am-bot .ring{opacity:0;fill:none;stroke:#20e0b9;stroke-width:6;transform-box:fill-box;transform-origin:center}

      .am-bot[data-state=listening] .eyes{animation:none;transform:scale(1.2)}
      .am-bot[data-state=listening] .m-smile{opacity:0}
      .am-bot[data-state=listening] .m-o{opacity:1}
      .am-bot[data-state=listening] .ring{animation:amB-ring 1.4s ease-out infinite}
      .am-bot[data-state=listening] .ring.r2{animation-delay:.45s}
      .am-bot[data-state=listening] .head{animation:amB-tilt 1.6s ease-in-out infinite;transform-origin:617px 450px}
      @keyframes amB-ring{0%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:scale(1.4)}}
      @keyframes amB-tilt{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}

      .am-bot[data-state=talking] .m-smile{opacity:0}
      .am-bot[data-state=talking] .m-talk{opacity:1;animation:amB-talk .26s ease-in-out infinite alternate}
      .am-bot[data-state=talking] .head{animation:amB-nod .7s ease-in-out infinite;transform-origin:617px 450px}
      @keyframes amB-talk{0%{transform:scaleY(.25) scaleX(.8)}100%{transform:scaleY(1.25) scaleX(1.05)}}
      @keyframes amB-nod{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}

      .am-bot[data-state=showing] .head{transform-origin:617px 450px;transform:rotate(8deg) translateX(8px);transition:transform .4s cubic-bezier(.3,1.5,.5,1)}
      .am-bot[data-state=showing] .arm-r{animation:none;transform:rotate(30deg)}

      .am-bot[data-state=happy] .bot{animation:amB-hop .55s ease-out 2}
      .am-bot[data-state=happy] .eyes{opacity:0}
      .am-bot[data-state=happy] .eyes-happy{opacity:1}
      .am-bot[data-state=happy] .arm-l{animation:amB-cheerL .35s ease-in-out infinite alternate}
      .am-bot[data-state=happy] .arm-r{animation:amB-cheerL .35s ease-in-out infinite alternate}
      @keyframes amB-hop{0%,100%{transform:translateY(0)}45%{transform:translateY(-70px)}}
      @keyframes amB-cheerL{0%{transform:rotate(12deg)}100%{transform:rotate(34deg)}}

      .am-bot[data-hold=true] .arm-l,.am-bot[data-hold=true] .arm-r{animation:none;transform:rotate(36deg)}
      .am-bot .hold{opacity:0;transform-box:fill-box;transform-origin:center bottom;transform:translateY(34px) scale(.5);transition:opacity .35s,transform .5s cubic-bezier(.3,1.6,.5,1)}
      .am-bot .hold.on{opacity:1;transform:translateY(0) scale(1)}
      .am-bot .hold.on.l{animation:amB-holdL 2.4s ease-in-out infinite}
      .am-bot .hold.on.r{animation:amB-holdR 2.4s ease-in-out .3s infinite}
      @keyframes amB-holdL{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(2deg)}}
      @keyframes amB-holdR{0%,100%{transform:translateY(0) rotate(3deg)}50%{transform:translateY(-8px) rotate(-2deg)}}
      .am-bot .fly{transform-box:fill-box;transform-origin:center;animation:amB-fly 1.7s cubic-bezier(.5,0,.3,1) forwards}
      @keyframes amB-fly{0%{opacity:0;transform:translate(0,40px) scale(.4)}20%{opacity:1;transform:translate(0,-6px) scale(1.05)}55%{opacity:1;transform:translate(0,-6px) scale(1)}100%{opacity:0;transform:translate(330px,-30px) scale(.25)}}

      @media (prefers-reduced-motion:reduce){
        .am-bot *{animation:none!important}
        .am-bot .hold{transition:none}
      }
    `}</style>

    <defs>
      <linearGradient id="amBodyL" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#e8f5ff"/>
        <stop offset="1" stopColor="#c3e0fa"/>
      </linearGradient>
      <linearGradient id="amHeadL" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor="#eef7ff"/>
        <stop offset="1" stopColor="#d3e8fb"/>
      </linearGradient>
      <linearGradient id="amArmG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e2f1fe"/>
        <stop offset="1" stopColor="#b4d9f7"/>
      </linearGradient>
    </defs>

    {showShadow && <g className="shadow">
      <ellipse cx="633" cy="793" rx="250" ry="38" fill="#dcedfc"/>
      <ellipse cx="635" cy="792" rx="92" ry="15" fill="#1583c6"/>
    </g>}

    <g className="bot">
      <path d="M545 458 L735 458 C765 490 780 540 772 600 C760 655 725 690 665 698 C625 700 580 695 545 675 C495 645 466 600 468 548 C470 505 505 470 545 458 Z" fill="#90c9f3"/>
      <path d="M541 462 L735 462 L758 505 C772 540 775 575 765 615 C752 650 730 672 698 686 C670 696 640 696 612 694 C585 690 565 678 552 662 C525 630 512 590 510 545 C510 510 520 482 541 462 Z" fill="url(#amBodyL)"/>
      <path d="M548 472 Q568 468 568 487 Q566 508 552 528 Q534 530 530 515 Q532 488 548 472 Z" fill="#fff" opacity=".92"/>
      <path d="M533 552 Q548 546 552 568 Q554 598 562 622 Q545 626 536 600 Q526 570 533 552 Z" fill="#fff" opacity=".5"/>
      <path d="M512 453 L735 453" stroke="#a2d0f4" strokeWidth="5" strokeLinecap="round"/>

      {showArms && (
        <>
          <g className="arm-l"><path d="M404 433 C440 436 495 448 528 462 L525 478 L492 525 C455 512 410 485 390 452 C386 440 394 432 404 433 Z" fill="#8ec8f2"/>
        <path d="M404 436 C440 440 490 450 524 464 C512 490 498 505 488 506 C455 495 418 475 398 450 C396 442 398 437 404 436 Z" fill="url(#amArmG)"/>
        <ellipse cx="437" cy="453" rx="15" ry="8" transform="rotate(20 437 453)" fill="#fff" opacity=".92"/></g>
      <g transform="translate(1254 0) scale(-1 1)"><g className="arm-r"><path d="M404 433 C440 436 495 448 528 462 L525 478 L492 525 C455 512 410 485 390 452 C386 440 394 432 404 433 Z" fill="#8ec8f2"/>
        <path d="M404 436 C440 440 490 450 524 464 C512 490 498 505 488 506 C455 495 418 475 398 450 C396 442 398 437 404 436 Z" fill="url(#amArmG)"/>
        <ellipse cx="437" cy="453" rx="15" ry="8" transform="rotate(20 437 453)" fill="#fff" opacity=".92"/></g></g>
        </>
      )}

      <HeldCard item={holdLeft} cx={398} cy={392} cls="l" />
      <HeldCard item={holdRight} cx={856} cy={392} cls="r" />
      {adding && <HeldCard item={adding} cx={856} cy={392} cls="fly-wrap" fly />}

      <g className="head">
        <ellipse className="ring r1" cx="617" cy="355" rx="165" ry="120"/>
        <ellipse className="ring r2" cx="617" cy="355" rx="165" ry="120"/>
        {showAntenna && (<g><rect x="588" y="246" width="62" height="12" rx="3" fill="#a9d3f4"/>
        <rect x="604" y="239" width="34" height="9" rx="3" fill="#b9dcf9"/>
        <path d="M606 246 L622 205 L636 207 L628 246 Z" fill="#b0d7f5"/>
        <circle className="ball" cx="638" cy="190" r="13" fill="#cfe9ff" stroke="#9fd0f5" strokeWidth="2"/>
        <circle cx="633" cy="185" r="4" fill="#fff"/></g>)}
        <path d="M466 410 C464 350 485 295 535 272 C560 262 590 258 620 258 C660 258 715 268 745 300 C762 325 768 360 766 400 L735 448 L498 448 Z" fill="#94cbf3"/>
        <path d="M503 402 C500 345 515 295 546 268 C570 260 595 258 620 258 C660 258 715 268 745 300 C762 325 768 360 766 400 L735 448 L530 448 L503 402 Z" fill="url(#amHeadL)"/>
        <path d="M504 421 L766 421 L735 448 L498 448 Z" fill="#b9dcf9"/>
        <path d="M550 402 C550 360 560 325 590 310 C610 300 640 297 665 297 C710 297 740 308 750 325 C762 345 766 375 766 402 Z" fill="#052a47"/>
        <path d="M585 314 C610 300 650 296 690 298 C725 300 745 312 752 330" stroke="#021a2e" strokeWidth="5" strokeLinecap="round" fill="none"/>
        <g className="eyes">
          <circle cx="622" cy="337" r="10" fill="#20e0b9"/>
          <circle cx="706" cy="334" r="10" fill="#20e0b9"/>
        </g>
        <g className="eyes-happy" fill="none" stroke="#20e0b9" strokeWidth="6" strokeLinecap="round">
          <path d="M606 343 Q622 322 638 343"/>
          <path d="M690 340 Q706 319 722 340"/>
        </g>
        <path className="m-smile" d="M640 360 Q642 380 666 380 Q690 380 692 360" stroke="#20e0b9" strokeWidth="3.2" strokeLinecap="round" fill="none"/>
        <ellipse className="m-talk" cx="666" cy="372" rx="20" ry="13" fill="#20e0b9"/>
        <circle className="m-o" cx="666" cy="372" r="9" fill="none" stroke="#20e0b9" strokeWidth="5"/>
      </g>
    </g>
  </svg>
);