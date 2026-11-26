"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { portfolioData } from "@/data/portfolioData";

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  color: string;
  phaseX: number;
  phaseY: number;
  phaseSpeedX: number;
  phaseSpeedY: number;
  pulsePhase: number;
  pulseSpeed: number;
}

// Sophisticated RGB color palettes: blue, violet, purple, pink, orange + subtle theme accent
const RGB_COLORS_LIGHT = [
  "rgba(79, 128, 245, ",  // Soft Cloud Blue
  "rgba(102, 87, 217, ",  // Digital Violet (Primary Theme Accent #6657D9)
  "rgba(139, 92, 246, ",  // Muted Violet
  "rgba(236, 72, 153, ",  // Soft Rose Pink
  "rgba(249, 115, 22, ",  // Subtle Orange
  "rgba(185, 174, 255, ", // Subtle Glow Violet (#B9AEFF)
];

const RGB_COLORS_DARK = [
  "rgba(96, 165, 250, ",  // Soft Luminous Blue
  "rgba(167, 139, 250, ", // Soft Luminous Violet
  "rgba(192, 132, 252, ", // Soft Luminous Purple
  "rgba(244, 114, 182, ", // Soft Luminous Pink
  "rgba(251, 146, 60, ",  // Soft Luminous Orange
  "rgba(232, 255, 112, ", // Dark Theme Accent (Luminous Yellow-Lime)
];

interface ParticleBackgroundProps {
  className?: string;
  forceDark?: boolean;
}

export default function ParticleBackground({ className = "", forceDark = false }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();
  const effectiveTheme = forceDark ? "dark" : theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // High DPI capping to max 2x to avoid GPU strain while maintaining crisp retina rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();

    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Responsive particle count from centralized portfolioData configuration
    const getTargetCount = (w: number) => {
      if (w < 640) return portfolioData.particles.mobileCount; // 80 particles
      if (w < 1024) return portfolioData.particles.tabletCount; // 150 particles
      return portfolioData.particles.desktopCount; // 220 particles
    };

    const isMobile = width < 768;
    const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    const particleCount = getTargetCount(width);
    const colors = effectiveTheme === "dark" ? RGB_COLORS_DARK : RGB_COLORS_LIGHT;

    // Uniform spatial distribution using Jittered Grid (eliminates empty voids and hyper-dense clumps)
    const aspect = width / Math.max(height, 1);
    const cols = Math.max(1, Math.round(Math.sqrt(particleCount * aspect)));
    const rows = Math.max(1, Math.ceil(particleCount / cols));
    const cellW = width / cols;
    const cellH = height / rows;

    const particles: Particle[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (particles.length >= particleCount) break;

        // Position jittered within each grid cell with a 10% safety margin
        const x = (c + 0.1 + Math.random() * 0.8) * cellW;
        const y = (r + 0.1 + Math.random() * 0.8) * cellH;

        // Multi-tier particle sizing for realistic depth variation
        const sizeRand = Math.random();
        let size: number;
        if (effectiveTheme === "dark") {
          if (sizeRand < 0.55) {
            size = 1.1 + Math.random() * 0.7; // Subtle small depth layer (1.1 - 1.8px)
          } else if (sizeRand < 0.85) {
            size = 1.8 + Math.random() * 0.7; // Medium focal layer (1.8 - 2.5px)
          } else {
            size = 2.5 + Math.random() * 0.7; // Larger accent foreground layer (2.5 - 3.2px)
          }
        } else {
          // Cloud + Digital Violet: small, delicate, elegant particles
          if (sizeRand < 0.60) {
            size = 0.9 + Math.random() * 0.5; // Fine atmospheric dust (0.9 - 1.4px)
          } else if (sizeRand < 0.88) {
            size = 1.4 + Math.random() * 0.5; // Mid layer (1.4 - 1.9px)
          } else {
            size = 1.9 + Math.random() * 0.5; // Accent violet dots (1.9 - 2.4px)
          }
        }

        // Base opacity calibrated for optimal readability in both themes:
        // Light mode: 0.22 - 0.38 (ethereal cloud violet/blue, never competing with text)
        // Dark mode: 0.35 - 0.70 (luminous on dark canvas without harsh glare)
        const baseAlpha = effectiveTheme === "dark"
          ? Math.random() * 0.35 + 0.35
          : Math.random() * 0.16 + 0.22;

        const speedScale = prefersReducedMotion ? 0.05 : 1;
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.08 + Math.random() * 0.18) * speedScale;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const color = colors[Math.floor(Math.random() * colors.length)];

        particles.push({
          x,
          y,
          originX: x,
          originY: y,
          vx,
          vy,
          size,
          baseAlpha,
          color,
          phaseX: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          phaseSpeedX: 0.008 + Math.random() * 0.012,
          phaseSpeedY: 0.008 + Math.random() * 0.012,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.015 + Math.random() * 0.02,
        });
      }
    }

    // Mouse coordinates & interaction radius
    const mouse = {
      x: -9999,
      y: -9999,
      targetX: -9999,
      targetY: -9999,
      active: false,
      radius: isMobile ? 90 : portfolioData.particles.mouseRadius,
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Disable cursor repulsion on touch devices so native touch scrolling is 100% smooth
      if (isTouch && isMobile) return;
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.targetX = -9999;
      mouse.targetY = -9999;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", resizeCanvas, { passive: true });

    // Tab visibility handling to pause rendering when tab is hidden
    let isTabVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let lastTime = performance.now();

    const render = (time: number) => {
      if (!isTabVisible) return;

      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // Smooth mouse coordinate interpolation (damping jitter)
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.12;
        mouse.y += (mouse.targetY - mouse.y) * 0.12;
      } else {
        mouse.x = -9999;
        mouse.y = -9999;
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Organic sinusoidal floating & drift
        p.phaseX += p.phaseSpeedX;
        p.phaseY += p.phaseSpeedY;
        const driftX = Math.sin(p.phaseX) * 0.24;
        const driftY = Math.cos(p.phaseY) * 0.24;

        p.x += p.vx + driftX;
        p.y += p.vy + driftY;

        // Toroidal boundary wrapping with generous margin for seamless transitions
        const margin = 20;
        if (p.x < -margin) p.x = width + margin;
        if (p.x > width + margin) p.x = -margin;
        if (p.y < -margin) p.y = height + margin;
        if (p.y > height + margin) p.y = -margin;

        // Natural cursor interaction: soft distance falloff and fluid repulsion
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);

          if (dist < mouse.radius && dist > 1) {
            // Power curve falloff for smooth, non-snapping fluid deflection
            const proximity = 1 - dist / mouse.radius;
            const force = Math.pow(proximity, 1.35) * 2.4;
            const angle = Math.atan2(dy, dx);
            p.x += Math.cos(angle) * force;
            p.y += Math.sin(angle) * force;
          }
        }

        // Gentle breathing opacity pulse
        p.pulsePhase += p.pulseSpeed;
        const alphaPulse = Math.sin(p.pulsePhase) * 0.10;
        const currentAlpha = Math.max(0.18, Math.min(0.88, p.baseAlpha + alphaPulse));

        ctx.fillStyle = `${p.color}${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", resizeCanvas);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [effectiveTheme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-700 ${className}`}
    />
  );
}
