import React from 'react';

interface SparklineProps {
  variant: 'cyan' | 'orange' | 'red';
  className?: string;
}

export const SparklineSvg: React.FC<SparklineProps> = ({ variant, className = 'w-24 h-10' }) => {
  const strokeColor =
    variant === 'cyan' ? '#12D9E8' : variant === 'orange' ? '#FF792D' : '#FF5050';
  const gradId = `sparkGrad-${variant}`;

  return (
    <svg
      viewBox="0 0 110 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="55" y1="4" x2="55" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.38" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d="M 4 34 C 18 33, 24 22, 38 25 C 52 28, 60 14, 74 17 C 88 20, 95 7, 106 8 L 106 40 L 4 40 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M 4 34 C 18 33, 24 22, 38 25 C 52 28, 60 14, 74 17 C 88 20, 95 7, 106 8"
        stroke={strokeColor}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="106" cy="8" r="3" fill="#FFFFFF" stroke={strokeColor} strokeWidth="2" />
    </svg>
  );
};

