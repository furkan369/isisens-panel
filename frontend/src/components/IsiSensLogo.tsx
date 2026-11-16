import React from 'react';

export const IsiSensLogo: React.FC = () => {
  return (
    <div className="flex items-center gap-3 select-none">
      {/* Circular Glowing Emblem: Left Orange Heat Waves + Right Cyan RF Signal Waves */}
      <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#FF792D]/35 via-transparent to-[#12D9E8]/35 blur-md" />
        <svg
          viewBox="0 0 64 64"
          className="w-12 h-12 relative z-10 drop-shadow-[0_0_10px_rgba(255,121,45,0.45)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="isisensRingLeft" x1="0" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFB03A" />
              <stop offset="50%" stopColor="#FF792D" />
              <stop offset="100%" stopColor="#E04819" />
            </linearGradient>
            <linearGradient id="isisensRingRight" x1="32" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38F3FF" />
              <stop offset="50%" stopColor="#12D9E8" />
              <stop offset="100%" stopColor="#0884B8" />
            </linearGradient>
            <linearGradient id="isisensSCurve" x1="20" y1="8" x2="44" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFB347" />
              <stop offset="48%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#12D9E8" />
            </linearGradient>
          </defs>

          {/* Dark Core Circle */}
          <circle cx="32" cy="32" r="28" fill="#061022" />

          {/* Left Orange Arc */}
          <path
            d="M 30 5 A 27 27 0 0 0 30 59"
            stroke="url(#isisensRingLeft)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Right Cyan Arc */}
          <path
            d="M 34 5 A 27 27 0 0 1 34 59"
            stroke="url(#isisensRingRight)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Left Inner Heat Flame Waves */}
          <path
            d="M 18 41 C 14 34, 21 28, 17 21 C 23 24, 24 31, 21 37 C 24 34, 26 28, 24 23 C 29 28, 28 38, 22 44 Z"
            fill="url(#isisensRingLeft)"
          />

          {/* Center Dynamic S-Wave */}
          <path
            d="M 35 10 C 22 18, 24 31, 32 33 C 40 35, 41 47, 28 54"
            stroke="url(#isisensSCurve)"
            strokeWidth="4.2"
            strokeLinecap="round"
          />

          {/* Right Inner Wireless M-Bus RF Signal Waves */}
          <path
            d="M 38 25 A 9 9 0 0 1 38 39"
            stroke="#12D9E8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 42.5 21 A 14 14 0 0 1 42.5 43"
            stroke="#12D9E8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 47 17 A 19 19 0 0 1 47 47"
            stroke="#38F3FF"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Brand Text & Subtitle */}
      <div className="flex flex-col leading-tight">
        <div className="text-[26px] font-extrabold tracking-tight flex items-center">
          <span className="text-[#FF792D] drop-shadow-[0_0_10px_rgba(255,121,45,0.4)]">Isı</span>
          <span className="text-[#12D9E8] drop-shadow-[0_0_10px_rgba(18,217,232,0.4)]">Sens</span>
        </div>
        <span className="text-[10.5px] text-[#AEBCCB] font-medium tracking-wide mt-0.5">
          IoT & Yapay Zeka Destekli
        </span>
        <span className="text-[10.5px] text-[#AEBCCB]/90 font-medium tracking-wide">
          Isı Paylaşım Platformu
        </span>
      </div>
    </div>
  );
};

export const SidebarNeonWaveSvg: React.FC = () => {
  return (
    <div className="pointer-events-none relative w-full h-24 overflow-hidden select-none">
      <svg
        viewBox="0 0 260 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="neonOrangeWave" x1="0" y1="95" x2="220" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF792D" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#FF9E44" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#FF792D" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="neonCyanWave" x1="15" y1="105" x2="255" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#12D9E8" stopOpacity="0.15" />
            <stop offset="45%" stopColor="#12D9E8" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#38F3FF" stopOpacity="0.2" />
          </linearGradient>
          <filter id="neonGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Ambient Glow Backfill */}
        <path
          d="M-10 105 Q 90 35 235 12"
          stroke="url(#neonOrangeWave)"
          strokeWidth="10"
          strokeOpacity="0.25"
          filter="url(#neonGlowFilter)"
        />
        <path
          d="M10 112 Q 130 58 265 48"
          stroke="url(#neonCyanWave)"
          strokeWidth="10"
          strokeOpacity="0.25"
          filter="url(#neonGlowFilter)"
        />
        {/* Crisp Neon Core Lines */}
        <path
          d="M-10 102 Q 90 35 230 14"
          stroke="url(#neonOrangeWave)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M15 110 Q 135 58 265 50"
          stroke="url(#neonCyanWave)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

