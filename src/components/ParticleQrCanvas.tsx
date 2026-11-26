"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useReducedMotion } from "framer-motion";

interface ParticleQrCanvasProps {
  cardMode: "id" | "upi";
  isTransforming: boolean;
  onComplete: () => void;
  upiUri?: string;
}

interface Particle {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  color: string;
  size: number;
  swirl: number;
}

const RGB_PALETTE = [
  "#38bdf8", // Sky blue
  "#a855f7", // Violet
  "#f43f5e", // Rose
  "#22c55e", // Emerald
  "#e8ff70", // Titanium Lime
];

export default function ParticleQrCanvas({
  cardMode,
  isTransforming,
  onComplete,
  upiUri = "upi://pay?pa=guesswho%40pingpay&pn=Nitin%20Shukla&cu=INR",
}: ParticleQrCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (!isTransforming) return;

    if (prefersReduced) {
      onComplete();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context = ctx;

    // Get exact CSS dimensions
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 340;
    const height = rect.height || 400;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Generate 33x33 QR code modules
    const qr = QRCode.create(upiUri, { errorCorrectionLevel: "M" });
    const matrixSize = qr.modules.size;
    const darkModules: { r: number; c: number }[] = [];

    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (qr.modules.get(r, c)) {
          darkModules.push({ r, c });
        }
      }
    }

    // Target QR dimensions on canvas (centered, aligned with enlarged QR code)
    const qrSize = Math.min(width - 32, 235);
    const qrLeft = (width - qrSize) / 2;
    const qrTop = (height - qrSize) / 2 - 8;
    const moduleSize = qrSize / matrixSize;

    // Select ~130 modules to assemble, prioritizing the 3 corner finder patterns
    const sampleSize = Math.min(130, darkModules.length);
    const step = Math.max(1, Math.floor(darkModules.length / sampleSize));
    const sampledModules: { r: number; c: number }[] = [];

    // Ensure corner finder patterns are included
    for (let r = 0; r <= 6; r++) {
      for (let c = 0; c <= 6; c++) {
        if (qr.modules.get(r, c)) sampledModules.push({ r, c });
      }
      for (let c = matrixSize - 7; c < matrixSize; c++) {
        if (qr.modules.get(r, c)) sampledModules.push({ r, c });
      }
    }
    for (let r = matrixSize - 7; r < matrixSize; r++) {
      for (let c = 0; c <= 6; c++) {
        if (qr.modules.get(r, c)) sampledModules.push({ r, c });
      }
    }

    // Fill remaining with evenly sampled data modules
    for (let i = 0; i < darkModules.length && sampledModules.length < sampleSize; i += step) {
      sampledModules.push(darkModules[i]);
    }

    // Create particles
    const particles: Particle[] = sampledModules.map((mod, idx) => {
      const targetX = qrLeft + mod.c * moduleSize + moduleSize / 2;
      const targetY = qrTop + mod.r * moduleSize + moduleSize / 2;

      // Start position: distributed along perimeter (matching RGB surface dots)
      let startX = 0;
      let startY = 0;
      const side = idx % 4;
      if (side === 0) {
        // Top perimeter
        startX = Math.random() * width;
        startY = Math.random() * 20 - 10;
      } else if (side === 1) {
        // Bottom perimeter
        startX = Math.random() * width;
        startY = height - Math.random() * 20 + 10;
      } else if (side === 2) {
        // Left perimeter
        startX = Math.random() * 20 - 10;
        startY = Math.random() * height;
      } else {
        // Right perimeter
        startX = width - Math.random() * 20 + 10;
        startY = Math.random() * height;
      }

      return {
        startX,
        startY,
        targetX,
        targetY,
        color: RGB_PALETTE[idx % RGB_PALETTE.length],
        size: Math.random() * 1.5 + 2,
        swirl: (Math.random() - 0.5) * 50,
      };
    });

    const isConverging = cardMode === "upi"; // ID -> UPI
    const duration = isConverging ? 850 : 650;
    const startTime = performance.now();

    function ease(t: number): number {
      // Smooth cubic bezier ease
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function render(currentTime: number) {
      if (!context) return;
      const elapsed = currentTime - startTime;
      const rawProgress = Math.min(1, elapsed / duration);
      const p = ease(rawProgress);

      context.clearRect(0, 0, width, height);

      particles.forEach((pt) => {
        let currX: number;
        let currY: number;

        if (isConverging) {
          // Converge from perimeter into QR matrix
          const swirlFactor = Math.sin(p * Math.PI) * pt.swirl * (1 - p);
          currX = pt.startX + (pt.targetX - pt.startX) * p + swirlFactor;
          currY = pt.startY + (pt.targetY - pt.startY) * p + swirlFactor * 0.5;
        } else {
          // Dissolve from QR matrix back out to perimeter
          const swirlFactor = Math.sin(p * Math.PI) * pt.swirl * (1 - p);
          currX = pt.targetX + (pt.startX - pt.targetX) * p + swirlFactor;
          currY = pt.targetY + (pt.startY - pt.targetY) * p + swirlFactor * 0.5;
        }

        // Particle shape and glow
        context.save();
        context.shadowBlur = (1 - rawProgress * 0.4) * 8;
        context.shadowColor = pt.color;
        context.fillStyle = pt.color;

        // Towards completion, square modules snap into position
        if (isConverging && rawProgress > 0.65) {
          const snapProgress = (rawProgress - 0.65) / 0.35;
          const sz = pt.size + (moduleSize * 0.9 - pt.size) * snapProgress;
          context.fillRect(currX - sz / 2, currY - sz / 2, sz, sz);
        } else {
          context.beginPath();
          context.arc(currX, currY, pt.size / 2, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      });

      if (rawProgress < 1) {
        animFrameRef.current = requestAnimationFrame(render);
      } else {
        context.clearRect(0, 0, width, height);
        onComplete();
      }
    }

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cardMode, isTransforming, onComplete, upiUri, prefersReduced]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full z-30"
      aria-hidden="true"
    />
  );
}
