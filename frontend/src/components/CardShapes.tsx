import React from 'react';

export const CardShapes: React.FC = () => {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="gCardShape" clipPathUnits="objectBoundingBox">
          <path d="M0,0.03 Q0,0 0.045,0 L0.955,0 Q1,0 1,0.03 L1,0.945 Q1,0.97 0.92,0.975 Q0.5,1.015 0.08,0.975 Q0,0.97 0,0.945 Z" />
        </clipPath>
        <clipPath id="gBarShape" clipPathUnits="objectBoundingBox">
          <path d="M0.012,0.05 Q0.5,0.26 0.988,0.05 Q1,0.05 1,0.1 L1,0.84 Q1,0.88 0.988,0.88 Q0.5,1.14 0.012,0.88 Q0,0.88 0,0.84 L0,0.1 Q0,0.05 0.012,0.05 Z" />
        </clipPath>
      </defs>
    </svg>
  );
};
