import React from 'react';
import { Mic, Pause, SkipForward, RefreshCw } from 'lucide-react';
import { VoicePhase, VoiceAvatar } from './VoiceAvatar';

interface VoiceAgentPanelProps {
  phase: VoicePhase;
  started: boolean;
  reply: string;
  heard: string;
  lang: 'english' | 'urdu' | null;
  notice: string;
  levelRef: React.MutableRefObject<number>;
  onToggle: () => void;
  onStartOver: () => void;
  interrupt: boolean;
  onInterruptChange: (val: boolean) => void;
}

const STATUS_LABELS: Record<VoicePhase, { label: string; bg: string; text: string; dot: string }> = {
  off: {
    label: 'Tap mic once to start voice order',
    bg: 'bg-emerald-50/80 border-emerald-200/70',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
  },
  listening: {
    label: 'Listening… speak naturally in Urdu or English',
    bg: 'bg-emerald-100/90 border-emerald-300',
    text: 'text-emerald-950 font-bold',
    dot: 'bg-emerald-600 animate-ping',
  },
  thinking: {
    label: 'Thinking… matching products & brands',
    bg: 'bg-amber-50 border-amber-300',
    text: 'text-amber-950 font-bold',
    dot: 'bg-amber-500 animate-pulse',
  },
  speaking: {
    label: 'Speaking… speak anytime to interrupt',
    bg: 'bg-teal-50 border-teal-300',
    text: 'text-teal-950 font-bold',
    dot: 'bg-teal-600 animate-bounce',
  },
};

export const VoiceAgentPanel: React.FC<VoiceAgentPanelProps> = ({
  phase,
  started,
  reply,
  heard,
  lang,
  notice,
  levelRef,
  onToggle,
  onStartOver,
  interrupt,
  onInterruptChange,
}) => {
  const isUrdu = lang === 'urdu';
  const statusInfo = STATUS_LABELS[phase];

  const buttonIcon =
    phase === 'off' ? (
      <Mic className="w-8 h-8 text-white" />
    ) : phase === 'speaking' ? (
      <SkipForward className="w-7 h-7 text-white" />
    ) : (
      <Pause className="w-7 h-7 text-white" />
    );

  const buttonHint =
    phase === 'off' ? 'Tap to Speak' : phase === 'speaking' ? 'Tap to Skip' : 'Tap to Pause';

  return (
    <div className="flex flex-col items-center gap-4 bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-7 shadow-xl shadow-emerald-950/5 border border-emerald-100">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-xs shadow-emerald-500/50" />
          <span className="text-sm font-bold text-[#064e3b] tracking-tight">Assan Voice Engine</span>
        </div>

        {lang && (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#064e3b] border border-emerald-200">
            {isUrdu ? 'Urdu Voice Active' : 'English Voice Active'}
          </span>
        )}
      </div>

      {/* 3D Circular Mascot Stage */}
      <div className="py-2">
        <VoiceAvatar state={phase} levelRef={levelRef} />
      </div>

      {/* Status Pill */}
      <div
        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs border transition-all ${statusInfo.bg} ${statusInfo.text}`}
      >
        <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
        <span>{statusInfo.label}</span>
      </div>

      {/* Speech Caption Bubble */}
      <div className="w-full bg-[#f9faf7] rounded-2xl p-5 border border-emerald-100/80 shadow-2xs text-center min-h-[80px] flex flex-col justify-center items-center">
        {isUrdu ? (
          <p className="text-base sm:text-lg font-medium text-[#064e3b] leading-relaxed" dir="auto">
            {reply || 'اردو میں بات کریں، میں آواز کے ذریعے جواب دوں گی۔'}
          </p>
        ) : (
          <p className="text-sm sm:text-base font-medium text-slate-800 leading-relaxed">
            {reply ||
              "Tap the mic. I'll ask whether you'd like English or Urdu, then simply speak your grocery list!"}
          </p>
        )}

        {heard && !isUrdu && (
          <div className="mt-2.5 text-xs text-slate-500 border-t border-slate-200/60 pt-2 w-full">
            <span className="font-semibold text-emerald-800">You said:</span> "{heard}"
          </div>
        )}
      </div>

      {/* Notice Message if any */}
      {notice && (
        <div className="w-full bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3.5 py-2.5 rounded-xl text-center">
          {notice}
        </div>
      )}

      {/* Center Big Microphone Button */}
      <div className="flex flex-col items-center gap-2 my-2">
        <button
          type="button"
          onClick={onToggle}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-95 cursor-pointer ${
            phase === 'off'
              ? 'bg-gradient-to-tr from-[#064e3b] to-[#059669] shadow-emerald-900/30 hover:scale-105'
              : phase === 'listening'
              ? 'bg-gradient-to-tr from-[#059669] to-[#10b981] shadow-emerald-500/40 ring-4 ring-emerald-200/80 animate-pulse'
              : phase === 'thinking'
              ? 'bg-gradient-to-tr from-amber-500 to-amber-600 shadow-amber-500/40 ring-4 ring-amber-200'
              : 'bg-gradient-to-tr from-teal-600 to-emerald-600 shadow-teal-500/40 ring-4 ring-teal-200'
          }`}
          aria-label={buttonHint}
        >
          {buttonIcon}
        </button>
        <span className="text-xs font-semibold text-slate-600">{buttonHint}</span>
      </div>

      {/* Hands-Free Barge-In Checkbox */}
      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={interrupt}
          onChange={(e) => onInterruptChange(e.target.checked)}
          className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500 border-slate-300"
        />
        <span>Allow voice interruption while agent is speaking</span>
      </label>

      {/* Start Over Button */}
      {started && (
        <button
          type="button"
          onClick={onStartOver}
          className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline underline-offset-4 pt-1 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Start a new order</span>
        </button>
      )}
    </div>
  );
};
