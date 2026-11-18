import React from 'react';

export const AnimatedBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* 1. Main full-screen animated multi-stop gradient canvas */}
      <div className="absolute inset-0 bg-assan-animated opacity-95" />

      <div
        className="absolute -top-24 -left-24 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] rounded-full bg-gradient-to-br from-[#ffffff]/90 via-[#f3fbf6]/35 to-transparent blur-[120px]"
        style={{
          animation: 'floatOrb1 24s ease-in-out infinite',
        }}
      />

      <div
        className="absolute -bottom-20 -right-20 w-[300px] h-[300px] sm:w-[550px] sm:h-[550px] rounded-full bg-gradient-to-tl from-[#fdfbf7]/80 via-[#f9f5ed]/50 to-transparent blur-[130px]"
        style={{
          animation: 'floatOrb2 28s ease-in-out infinite',
        }}
      />

      <div
        className="hidden sm:block absolute top-1/3 right-1/4 w-[420px] h-[420px] rounded-full bg-gradient-to-tr from-[#ffffff]/70 via-[#f3fbf6]/25 to-transparent blur-[140px]"
        style={{
          animation: 'floatOrb3 22s ease-in-out infinite',
        }}
      />

      <div
        className="hidden sm:block absolute bottom-1/4 left-1/6 w-[450px] h-[450px] rounded-full bg-gradient-to-r from-[#faf8f5]/60 via-[#ffffff]/80 to-[#f3faf5]/25 blur-[110px]"
        style={{
          animation: 'floatOrb1 30s ease-in-out infinite reverse',
        }}
      />

      <div className="absolute inset-0 bg-white/40" />
    </div>
  );
};