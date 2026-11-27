"use client";

import { motion } from "framer-motion";
import RainbowPhotoGallery from "@/components/RainbowPhotoGallery";
import UpiPaymentCard from "@/components/UpiPaymentCard";
import ParticleQrCanvas from "@/components/ParticleQrCanvas";

interface ProfileCardMediaProps {
  cardMode: "id" | "upi";
  isTransforming: boolean;
  onAnimationComplete: () => void;
  onToggle: () => void;
  upiId?: string;
  upiUri?: string;
}

export default function ProfileCardMedia({
  cardMode,
  isTransforming,
  onAnimationComplete,
  onToggle,
  upiId = "guesswho@pingpay",
  upiUri = "upi://pay?pa=guesswho%40pingpay&pn=Nitin%20Shukla&cu=INR",
}: ProfileCardMediaProps) {
  const isUpiActive = cardMode === "upi";

  return (
    <div className="relative mt-2.5 sm:mt-3 aspect-[4/4.7] select-none">
      {/* Mode A: Clean Interactive Rainbow Photo Gallery (Personal Identity) */}
      <motion.div
        className="absolute inset-0 w-full h-full"
        initial={false}
        animate={{
          opacity: isUpiActive ? 0 : 1,
          scale: isUpiActive ? 0.92 : 1,
          filter: isTransforming && isUpiActive ? "blur(6px)" : "blur(0px)",
          pointerEvents: isUpiActive ? "none" : "auto",
        }}
        transition={{
          duration: 0.35,
          ease: "easeInOut",
        }}
      >
        <RainbowPhotoGallery />
      </motion.div>

      {/* Mode B: UPI Payment Identity Card */}
      <motion.div
        className="absolute inset-0 w-full h-full"
        initial={false}
        animate={{
          opacity: isUpiActive && !isTransforming ? 1 : 0,
          scale: isUpiActive && !isTransforming ? 1 : 0.94,
          pointerEvents: isUpiActive && !isTransforming ? "auto" : "none",
        }}
        transition={{
          duration: 0.35,
          ease: "easeOut",
        }}
      >
        <UpiPaymentCard upiId={upiId} upiUri={upiUri} />
      </motion.div>

      {/* Cinematic Particle Convergence & Dispersion Canvas Engine */}
      {isTransforming && (
        <ParticleQrCanvas
          cardMode={cardMode}
          isTransforming={isTransforming}
          onComplete={onAnimationComplete}
          upiUri={upiUri}
        />
      )}
    </div>
  );
}
