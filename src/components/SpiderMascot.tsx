"use client";

import { useState } from "react";

interface SpiderMascotProps {
  className?: string;
  size?: number;
}

export default function SpiderMascot({ className = "", size = 64 }: SpiderMascotProps) {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 800);
  };

  return (
    <div
      onClick={handleClick}
      title="Mechanical Autonomous Drone Mascot"
      className={`cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95 ${
        clicked ? "rotate-12 scale-125" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_4px_12px_var(--accent-glow)]"
      >
        {/* Web line attachment */}
        <line x1="50" y1="0" x2="50" y2="40" stroke="var(--secondary-text)" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 2" />

        {/* Spider Legs - Left Side */}
        <path d="M42 45 Q20 30 10 40" stroke="#888888" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M40 50 Q16 48 8 60" stroke="#999999" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M42 55 Q22 68 15 80" stroke="#888888" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M45 60 Q30 82 25 92" stroke="#666666" strokeWidth="2" strokeLinecap="round" />

        {/* Spider Legs - Right Side */}
        <path d="M58 45 Q80 30 90 40" stroke="#888888" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M60 50 Q84 48 92 60" stroke="#999999" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M58 55 Q78 68 85 80" stroke="#888888" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M55 60 Q70 82 75 92" stroke="#666666" strokeWidth="2" strokeLinecap="round" />

        {/* Mechanical Body & Core */}
        <ellipse cx="50" cy="54" rx="12" ry="15" fill="var(--surface-elevated)" stroke="var(--border-strong)" strokeWidth="2" />
        <circle cx="50" cy="42" r="7" fill="var(--surface-tertiary)" stroke="var(--border-strong)" strokeWidth="1.5" />

        {/* Glowing Reactor Core */}
        <circle cx="50" cy="54" r="5" fill="var(--accent)" className="animate-pulse" />
        <circle cx="50" cy="54" r="2" fill="#FFFFFF" />

        {/* Optics / Eyes */}
        <circle cx="47" cy="41" r="1.5" fill="var(--accent)" />
        <circle cx="53" cy="41" r="1.5" fill="var(--accent)" />

        {/* Joint Pins */}
        <circle cx="42" cy="45" r="1.5" fill="var(--accent)" />
        <circle cx="58" cy="45" r="1.5" fill="var(--accent)" />
        <circle cx="40" cy="50" r="1.5" fill="#FFFFFF" />
        <circle cx="60" cy="50" r="1.5" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
