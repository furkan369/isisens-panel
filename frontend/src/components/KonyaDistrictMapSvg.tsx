import React from 'react';

export const KonyaDistrictMapSvg: React.FC = () => {
  const nodes = [
    { x: 145, y: 128, r: 7, color: '#FF792D', pulse: true, label: 'Merkez' },
    { x: 126, y: 92, r: 5, color: '#FF792D', pulse: true, label: 'Selçuklu' },
    { x: 96, y: 108, r: 4.5, color: '#FF792D', pulse: false },
    { x: 175, y: 96, r: 4.5, color: '#FF792D', pulse: false },
    { x: 118, y: 148, r: 4, color: '#12D9E8', pulse: false },
    { x: 74, y: 142, r: 4.5, color: '#12D9E8', pulse: true },
    { x: 54, y: 122, r: 3.5, color: '#FF792D', pulse: false },
    { x: 158, y: 66, r: 4, color: '#12D9E8', pulse: false },
    { x: 108, y: 62, r: 3.5, color: '#12D9E8', pulse: false },
    { x: 204, y: 118, r: 4, color: '#12D9E8', pulse: true },
    { x: 186, y: 154, r: 4, color: '#FF792D', pulse: false },
    { x: 144, y: 172, r: 4, color: '#12D9E8', pulse: false },
    { x: 92, y: 172, r: 3.5, color: '#FF792D', pulse: false },
  ];

  const links = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 10], [0, 11],
    [1, 2], [1, 3], [1, 7], [1, 8],
    [2, 5], [2, 6], [4, 5], [4, 11], [5, 12],
    [3, 7], [3, 9], [9, 10], [10, 11],
  ];

  return (
    <div className="relative w-full h-56 flex items-center justify-center select-none">
      <svg viewBox="0 0 260 210" className="w-full h-full drop-shadow-[0_0_16px_rgba(18,217,232,0.28)]">
        <defs>
          <linearGradient id="konyaMapFill" x1="20" y1="15" x2="230" y2="195" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0E2749" stopOpacity="0.92" />
            <stop offset="55%" stopColor="#0A1B36" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#08152B" stopOpacity="0.92" />
          </linearGradient>
          <radialGradient id="konyaHotspot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF9E44" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#FF792D" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FF792D" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Stylized Konya Province Vector Boundary */}
        <path
          d="M 88 22 L 116 18 L 138 28 L 166 22 L 188 38 L 182 58 L 204 72 L 228 68 L 242 88 L 232 114 L 244 134 L 224 156 L 198 162 L 182 184 L 154 196 L 132 188 L 114 198 L 86 188 L 72 168 L 46 164 L 24 146 L 18 124 L 38 106 L 34 84 L 56 72 L 68 46 L 88 22 Z"
          fill="url(#konyaMapFill)"
          stroke="#12D9E8"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Subtle Internal District Borders */}
        <path
          d="M 68 46 L 118 88 L 166 22 M 38 106 L 118 88 L 145 128 L 232 114 M 72 168 L 145 128 L 154 196"
          stroke="#12D9E8"
          strokeOpacity="0.18"
          strokeWidth="1"
          strokeDasharray="3 3"
          fill="none"
        />

        {/* Constellation Network Lines */}
        {links.map(([a, b], idx) => (
          <line
            key={idx}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke={idx % 2 === 0 ? '#FF792D' : '#12D9E8'}
            strokeOpacity="0.38"
            strokeWidth="1.1"
          />
        ))}

        {/* Glowing Center Hotspot */}
        <circle cx="145" cy="128" r="28" fill="url(#konyaHotspot)" />
        <circle cx="126" cy="92" r="20" fill="url(#konyaHotspot)" />

        {/* Nodes */}
        {nodes.map((n, idx) => (
          <g key={idx}>
            <circle cx={n.x} cy={n.y} r={n.r * 2.2} fill={n.color} fillOpacity="0.22" />
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} />
            <circle cx={n.x} cy={n.y} r={n.r * 0.45} fill="#FFFFFF" />
          </g>
        ))}

        {/* Konya Center Label */}
        <text
          x="136"
          y="113"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="16"
          fontWeight="700"
          className="tracking-wide"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
        >
          Konya
        </text>
      </svg>
    </div>
  );
};

export const SuccessDonutChartSvg: React.FC<{ percentage: number }> = ({ percentage }) => {
  const safePct = Math.max(0, Math.min(100, percentage));
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const cyanDash = (safePct / 100) * circumference;
  const orangeDash = circumference - cyanDash;

  return (
    <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="donutCyanGrad" x1="0" y1="0" x2="150" y2="150" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#39F5FF" />
            <stop offset="100%" stopColor="#0BB8D4" />
          </linearGradient>
        </defs>
        {/* Background Track */}
        <circle
          cx="75"
          cy="75"
          r={radius}
          stroke="#132540"
          strokeWidth="16"
          fill="none"
        />
        {/* Failure / Missing Slice (Orange) */}
        <circle
          cx="75"
          cy="75"
          r={radius}
          stroke="#FF792D"
          strokeWidth="16"
          strokeDasharray={`${orangeDash} ${circumference}`}
          strokeDashoffset={-cyanDash}
          fill="none"
        />
        {/* Success Slice (Glowing Cyan) */}
        <circle
          cx="75"
          cy="75"
          r={radius}
          stroke="url(#donutCyanGrad)"
          strokeWidth="16"
          strokeDasharray={`${cyanDash} ${circumference}`}
          strokeLinecap="butt"
          fill="none"
          style={{ filter: 'drop-shadow(0 0 8px rgba(18, 217, 232, 0.55))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold text-white tracking-tight">
          %{safePct.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        </span>
        <span className="text-[11px] text-[#AEBCCB] font-medium mt-0.5">Başarılı Okuma</span>
      </div>
    </div>
  );
};

