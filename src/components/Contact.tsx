"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Mail,
  Send,
  AlertCircle,
  CheckCircle2,
  X as CloseIcon,
  Github,
  Linkedin,
  Copy,
  Check,
  ArrowLeft,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import { portfolioData, socialLinks } from "@/data/portfolioData";

type ModalStep = "details" | "otp" | "success";

interface ContactProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function Contact({ isOpen, onOpenChange }: ContactProps = {}) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isModalOpen = isOpen !== undefined ? isOpen : internalModalOpen;

  const setIsModalOpen = useCallback((open: boolean) => {
    setInternalModalOpen(open);
    onOpenChange?.(open);
  }, [onOpenChange]);

  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<ModalStep>("details");
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form details
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
    hp_field: "", // Anti-spam honeypot
  });

  // OTP state
  const [otpToken, setOtpToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mountTime] = useState(() => Date.now());
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Prevent background scrolling and attach ESC listener when modal is open
  useEffect(() => {
    if (isModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsModalOpen(false);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isModalOpen, setIsModalOpen]);

  // Listen for global open-contact-modal events
  useEffect(() => {
    const handleOpen = () => {
      setIsModalOpen(true);
    };
    window.addEventListener("open-contact-modal", handleOpen);
    return () => window.removeEventListener("open-contact-modal", handleOpen);
  }, [setIsModalOpen]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [resendCountdown]);

  // Email copy handler with robust fallback and feedback
  const copyEmail = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const email = portfolioData.personal.email || socialLinks.email;
    let didCopy = false;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
        didCopy = true;
      }
    } catch {
      // Fallback
    }

    if (!didCopy && typeof document !== "undefined") {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = email;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        didCopy = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (err) {
        console.warn("Fallback copy failed:", err);
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const validateDetails = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = "Please enter your name (at least 2 characters)";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errs.email = "Please enter your email address";
    } else if (!emailRegex.test(formData.email.trim())) {
      errs.email = "Please enter a valid email address";
    }
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      errs.message = "Please write a message with at least 10 characters";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 1: Request OTP via Gmail SMTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateDetails()) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/contact/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
          hp_field: formData.hp_field,
          clientTime: mountTime,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send verification code. Please try again.");
      }

      setOtpToken(data.token);
      setResendCountdown(data.resendInSeconds || 60);
      setStep("otp");
      setOtpCode("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error. Please try again or email directly.";
      setSubmitError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isLoading) return;
    setSubmitError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/contact/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
          hp_field: formData.hp_field,
          clientTime: mountTime,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to resend code.");
      }

      setOtpToken(data.token);
      setResendCountdown(data.resendInSeconds || 60);
      setOtpCode("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend code.";
      setSubmitError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify OTP and submit inquiry
  const handleVerifyAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const cleanOtp = otpCode.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setSubmitError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: `Portfolio Inquiry — ${formData.name}`,
          message: formData.message,
          otp: cleanOtp,
          token: otpToken,
          hp_field: formData.hp_field,
          clientTime: mountTime,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data && data.newToken) {
        setOtpToken(data.newToken);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Verification failed. Please check the code and try again.");
      }

      setStep("success");

      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 75,
          spread: 65,
          origin: { y: 0.6 },
          colors: ["#FFFFFF", "#E8FF70", "#6657D9", "#38BDF8"],
        });
      } catch {}
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error. Please try again or email directly.";
      setSubmitError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const emailAddress = portfolioData.personal.email || socialLinks.email;

  const handleOpenModal = () => {
    setIsModalOpen(true);
    if (step === "success") {
      setStep("details");
      setFormData({ name: "", email: "", message: "", hp_field: "" });
      setOtpCode("");
      setOtpToken("");
      setErrors({});
      setSubmitError(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <section
        id="contact"
        className="relative pt-20 pb-20 sm:pt-28 sm:pb-28 md:pt-36 md:pb-32 bg-transparent transition-colors overflow-hidden"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center">
          
          {/* Eyebrow: Minimal, pure text, wide tracking (matching Yogender reference) */}
          <p className="font-sans text-[11px] sm:text-xs tracking-[0.28em] uppercase font-medium text-neutral-400 dark:text-[#888888] mb-6 sm:mb-8 select-none">
            GET IN TOUCH
          </p>

          {/* Large Editorial Headline (matching reference) */}
          <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-center leading-[1.04] text-primary dark:text-[#FFFFFF] max-w-4xl">
            Let&apos;s Build <br />
            Something Great.
          </h2>

          {/* Supporting Description (matching reference) */}
          <p className="mt-5 sm:mt-7 text-base sm:text-lg text-neutral-400 dark:text-[#8C8C8C] max-w-2xl text-center leading-relaxed font-normal">
            Have an ambitious project, an engineering role, or an AI concept <br className="hidden sm:inline" />
            you&apos;d like to bring to life? I&apos;d love to connect.
          </p>

          {/* Single Prominent Pill-Shaped CTA: SAY HELLO ↗ (Opens Centered Modal) */}
          <div className="mt-8 sm:mt-10 flex items-center justify-center">
            <button
              type="button"
              onClick={handleOpenModal}
              className="group inline-flex items-center gap-2.5 px-9 sm:px-10 py-4 sm:py-4.5 rounded-full bg-[#171923] dark:bg-[#F2F2EE] text-white dark:text-[#121212] font-sans text-xs sm:text-sm font-semibold tracking-wider uppercase shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 dark:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-haspopup="dialog"
              aria-expanded={isModalOpen}
            >
              <span>SAY HELLO</span>
              <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>

          {/* Thin Subtle Horizontal Divider (width matches visual column ~max-w-2xl) */}
          <div className="w-full max-w-2xl my-12 sm:my-16 h-px bg-border/40 dark:bg-white/[0.08]" />

          {/* Minimal Bottom Row: Email • GitHub • LinkedIn • X (Twitter) (Exact Reference Layout) */}
          <div className="w-full max-w-2xl flex flex-wrap items-center justify-center gap-y-3 gap-x-4 sm:gap-x-6 text-xs sm:text-[13px] font-sans text-neutral-400 dark:text-[#888888]">
            
            {/* Email Item */}
            <a
              href={`mailto:${emailAddress}`}
              onClick={() => {
                copyEmail();
              }}
              className="inline-flex items-center gap-2 hover:text-primary dark:hover:text-white transition-colors group cursor-pointer"
              title="Email Nitin (click to copy / email)"
            >
              <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-75 group-hover:opacity-100 transition-opacity" />
              <span>{copied ? "Copied to clipboard!" : emailAddress}</span>
            </a>

            {/* Separator Bullet (Desktop) */}
            <span className="hidden sm:inline text-primary-muted/40 dark:text-white/20 select-none">•</span>

            {/* GitHub Item */}
            <a
              href={socialLinks.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-primary dark:hover:text-white transition-colors group"
              aria-label="GitHub Profile"
            >
              <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-75 group-hover:opacity-100 transition-opacity" />
              <span>GitHub</span>
            </a>

            {/* Separator Bullet (Desktop) */}
            <span className="hidden sm:inline text-primary-muted/40 dark:text-white/20 select-none">•</span>

            {/* LinkedIn Item */}
            <a
              href={socialLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-primary dark:hover:text-white transition-colors group"
              aria-label="LinkedIn Profile"
            >
              <Linkedin className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-75 group-hover:opacity-100 transition-opacity" />
              <span>LinkedIn</span>
            </a>

            {/* Separator Bullet (Desktop) */}
            <span className="hidden sm:inline text-primary-muted/40 dark:text-white/20 select-none">•</span>

            {/* X (Twitter) Item */}
            <a
              href={socialLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-primary dark:hover:text-white transition-colors group"
              aria-label="X (formerly Twitter) Profile"
            >
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-75 group-hover:opacity-100 transition-opacity fill-current"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>X (Twitter)</span>
            </a>

          </div>

          {/* Subtle, quiet copyright attribution */}
          <p className="mt-12 text-[11px] font-mono text-primary-muted/30 dark:text-white/15 select-none tracking-wider">
            © {new Date().getFullYear()} {portfolioData.personal.name}. All rights reserved.
          </p>

        </div>
      </section>

      {/* Centered Say Hello Modal with OTP Verification (Never expands inline) */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            {/* Backdrop with dark overlay and smooth blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-md"
            />

            {/* Full-viewport click catcher behind card to ensure outside clicks close modal */}
            <div
              className="fixed inset-0"
              onClick={handleCloseModal}
              aria-hidden="true"
            />

            {/* Centered Modal Surface */}
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-lg rounded-3xl bg-surface/95 dark:bg-[#141514]/98 border border-border/80 dark:border-white/[0.08] shadow-2xl p-6 sm:p-8 text-left my-auto max-h-[92vh] overflow-y-auto"
            >
              {/* Top Row: Eyebrow + Close Icon */}
              <div className="flex items-center justify-between mb-1">
                <p className="font-sans text-[11px] sm:text-xs tracking-[0.28em] uppercase font-semibold text-primary-muted dark:text-[#888888] select-none">
                  {step === "otp" ? "EMAIL VERIFICATION" : "GET IN TOUCH"}
                </p>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1.5 -mr-1.5 rounded-full text-primary-muted hover:text-primary dark:text-[#888888] dark:hover:text-white hover:bg-surface-secondary dark:hover:bg-white/[0.06] transition-colors"
                  aria-label="Close modal"
                >
                  <CloseIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              </div>

              {/* Heading */}
              <h3
                id="contact-modal-title"
                className="text-2xl sm:text-3xl font-bold tracking-tight text-primary dark:text-white mb-6"
              >
                {step === "otp" ? "Verify your email" : "Say hello"}
              </h3>

              {/* STEP 3: SUCCESS STATE */}
              {step === "success" && (
                <div className="py-6 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500 mb-4">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold text-primary dark:text-white mb-2">
                    Message Sent!
                  </h4>
                  <p className="text-xs sm:text-sm text-primary-muted dark:text-[#A4A49C] max-w-md mb-6 leading-relaxed">
                    Your message has been sent successfully. I&apos;ll get back to you soon.
                  </p>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-8 py-3 rounded-full bg-[#171923] dark:bg-[#F2F2EE] text-white dark:text-[#121212] font-sans text-xs font-semibold tracking-wider uppercase hover:opacity-95 transition-opacity"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* STEP 1: DETAILS INPUT */}
              {step === "details" && (
                <form onSubmit={handleRequestOtp} noValidate className="space-y-4">
                  {/* Anti-spam honeypot */}
                  <div className="sr-only" aria-hidden="true">
                    <label htmlFor="modal-hp_field">Leave this empty</label>
                    <input
                      id="modal-hp_field"
                      type="text"
                      name="hp_field"
                      tabIndex={-1}
                      autoComplete="off"
                      value={formData.hp_field}
                      onChange={(e) => setFormData({ ...formData, hp_field: e.target.value })}
                    />
                  </div>

                  {/* ERROR BANNER */}
                  {submitError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-sans flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="flex-1 leading-relaxed">
                        <p>{submitError}</p>
                        <p className="mt-1 text-[11px] opacity-80">
                          You can also reach me directly at{" "}
                          <a href="mailto:snitin.tech@gmail.com" className="underline font-semibold">
                            snitin.tech@gmail.com
                          </a>.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 1. Your Name */}
                  <div>
                    <label
                      htmlFor="modal-name"
                      className="block font-sans text-xs text-primary-muted dark:text-[#A4A49C] font-medium mb-1.5"
                    >
                      Your name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="modal-name"
                      name="name"
                      type="text"
                      required
                      disabled={isLoading}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Sarah Connor"
                      aria-invalid={!!errors.name}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary/70 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] focus:border-accent dark:focus:border-white/40 focus:outline-none text-sm text-primary dark:text-white placeholder:text-primary-muted/40 transition-colors disabled:opacity-60"
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs text-red-500 dark:text-red-400 font-sans flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{errors.name}</span>
                      </p>
                    )}
                  </div>

                  {/* 2. Your Email */}
                  <div>
                    <label
                      htmlFor="modal-email"
                      className="block font-sans text-xs text-primary-muted dark:text-[#A4A49C] font-medium mb-1.5"
                    >
                      Your email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="modal-email"
                      name="email"
                      type="email"
                      required
                      disabled={isLoading}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="sarah@company.com"
                      aria-invalid={!!errors.email}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary/70 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] focus:border-accent dark:focus:border-white/40 focus:outline-none text-sm text-primary dark:text-white placeholder:text-primary-muted/40 transition-colors disabled:opacity-60"
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-500 dark:text-red-400 font-sans flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{errors.email}</span>
                      </p>
                    )}
                  </div>

                  {/* 3. What would you like to talk about? */}
                  <div>
                    <label
                      htmlFor="modal-message"
                      className="block font-sans text-xs text-primary-muted dark:text-[#A4A49C] font-medium mb-1.5"
                    >
                      What would you like to talk about? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="modal-message"
                      name="message"
                      rows={4}
                      required
                      disabled={isLoading}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell me about your project, team, or concept..."
                      aria-invalid={!!errors.message}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary/70 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] focus:border-accent dark:focus:border-white/40 focus:outline-none text-sm text-primary dark:text-white placeholder:text-primary-muted/40 transition-colors resize-none disabled:opacity-60"
                    />
                    {errors.message && (
                      <p className="mt-1 text-xs text-red-500 dark:text-red-400 font-sans flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{errors.message}</span>
                      </p>
                    )}
                  </div>

                  {/* Continue Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#171923] dark:bg-[#F2F2EE] text-white dark:text-[#121212] font-sans text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all hover:opacity-95 shadow-md disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          <span>Sending Verification Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Continue / Verify Email</span>
                          <ArrowUpRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: OTP VERIFICATION */}
              {step === "otp" && (
                <form onSubmit={handleVerifyAndSubmit} noValidate className="space-y-5">
                  <div className="p-3.5 rounded-2xl bg-surface-secondary/60 dark:bg-white/[0.03] border border-border/80 dark:border-white/[0.08] flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/15 dark:bg-[#E8FF70]/15 flex items-center justify-center text-accent dark:text-[#E8FF70] shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="text-xs leading-relaxed">
                      <p className="text-primary-muted dark:text-[#A4A49C]">
                        We sent a 6-digit verification code to:
                      </p>
                      <p className="font-semibold text-primary dark:text-white font-mono break-all mt-0.5">
                        {formData.email}
                      </p>
                    </div>
                  </div>

                  {/* ERROR BANNER */}
                  {submitError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-sans flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="flex-1 leading-relaxed">
                        <p>{submitError}</p>
                      </div>
                    </div>
                  )}

                  {/* 6-digit OTP Input */}
                  <div>
                    <label
                      htmlFor="modal-otp"
                      className="block font-sans text-xs text-primary-muted dark:text-[#A4A49C] font-medium mb-2 text-center"
                    >
                      Enter 6-digit code
                    </label>
                    <input
                      id="modal-otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      required
                      disabled={isLoading}
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setOtpCode(val);
                      }}
                      placeholder="••••••"
                      className="w-full text-center font-mono text-2xl tracking-[0.5em] sm:tracking-[0.6em] font-bold py-3.5 px-4 rounded-2xl bg-surface-secondary/70 dark:bg-white/[0.04] border border-border dark:border-white/[0.12] focus:border-accent dark:focus:border-white/50 focus:outline-none text-primary dark:text-white placeholder:text-primary-muted/20 transition-all disabled:opacity-60"
                    />
                    <p className="text-[11px] text-center text-primary-muted dark:text-[#888888] mt-2 font-mono">
                      Code expires in 5 minutes · Max 5 attempts
                    </p>
                  </div>

                  {/* Resend & Edit Details Row */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50 dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("details");
                        setSubmitError(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-primary-muted hover:text-primary dark:hover:text-white transition-colors py-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>

                    <button
                      type="button"
                      disabled={resendCountdown > 0 || isLoading}
                      onClick={handleResendOtp}
                      className="inline-flex items-center gap-1.5 text-accent dark:text-[#E8FF70] hover:underline transition-colors disabled:opacity-40 disabled:no-underline py-1 font-mono text-[11px]"
                    >
                      <RotateCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                      <span>
                        {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
                      </span>
                    </button>
                  </div>

                  {/* Final Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading || otpCode.trim().length !== 6}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#171923] dark:bg-[#F2F2EE] text-white dark:text-[#121212] font-sans text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all hover:opacity-95 shadow-md disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          <span>Verifying & Sending...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Inquiry</span>
                          <Send className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
