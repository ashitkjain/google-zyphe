import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ className = "", size = 48 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
      >
        <defs>
          <linearGradient id="houseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
          <linearGradient id="chipGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EEF2FF" />
            <stop offset="100%" stopColor="#C7D2FE" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* House Body */}
        <path
          d="M50 10L10 45V85C10 87.7614 12.2386 90 15 90H85C87.7614 90 90 87.7614 90 85V45L50 10Z"
          fill="url(#houseGradient)"
        />
        
        {/* Chimney */}
        <path
          d="M68 25V35L75 41V25H68Z"
          fill="#4338CA"
          opacity="0.8"
        />

        {/* AI Chip Background */}
        <rect
          x="32"
          y="48"
          width="36"
          height="36"
          rx="6"
          fill="url(#chipGradient)"
          filter="url(#glow)"
        />

        {/* Chip Pins - Top */}
        <rect x="38" y="44" width="2" height="4" rx="1" fill="#C7D2FE" />
        <rect x="44" y="44" width="2" height="4" rx="1" fill="#C7D2FE" />
        <rect x="50" y="44" width="2" height="4" rx="1" fill="#C7D2FE" />
        <rect x="56" y="44" width="2" height="4" rx="1" fill="#C7D2FE" />
        <rect x="62" y="44" width="2" height="4" rx="1" fill="#C7D2FE" />

        {/* Chip Pins - Bottom */}
        <rect x="38" y="84" width="2" height="4" rx="1" fill="#C7D2FE" />
        <rect x="44" y="84" width="2" height="4" rx="1" fill="#C7D2FE" />
        <rect x="50" y="84" width="2" height="4" rx="1" fill="#C7D2FE" />
        <rect x="56" y="84" width="2" height="4" rx="1" fill="#C7D2FE" />
        <rect x="62" y="84" width="2" height="4" rx="1" fill="#C7D2FE" />

        {/* Chip Pins - Left */}
        <rect x="28" y="54" width="4" height="2" rx="1" fill="#C7D2FE" />
        <rect x="28" y="60" width="4" height="2" rx="1" fill="#C7D2FE" />
        <rect x="28" y="66" width="4" height="2" rx="1" fill="#C7D2FE" />
        <rect x="28" y="72" width="4" height="2" rx="1" fill="#C7D2FE" />
        <rect x="28" y="78" width="4" height="2" rx="1" fill="#C7D2FE" />

        {/* Chip Pins - Right */}
        <rect x="68" y="54" width="4" height="2" rx="1" fill="#C7D2FE" />
        <rect x="68" y="60" width="4" height="2" rx="1" fill="#C7D2FE" />
        <rect x="68" y="66" width="4" height="2" rx="1" fill="#C7D2FE" />
        <rect x="68" y="72" width="4" height="2" rx="1" fill="#C7D2FE" />
        <rect x="68" y="78" width="4" height="2" rx="1" fill="#C7D2FE" />

        {/* AI Text */}
        <text
          x="50"
          y="71"
          textAnchor="middle"
          fill="#4F46E5"
          style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'Inter, sans-serif' }}
        >
          AI
        </text>
      </svg>
    </div>
  );
};

export default Logo;
