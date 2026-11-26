"use client";

import { useState, useEffect, useRef } from "react";
import { portfolioData } from "@/data/portfolioData";
import { Terminal, X, CornerDownLeft, Sparkles, Copy, Check, FileText } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { theme, toggleTheme } = useTheme();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Array<{ cmd: string; output: React.ReactNode }>>([
    {
      cmd: "welcome",
      output: (
        <div className="text-primary-muted space-y-1">
          <p className="text-accent font-bold">
            {portfolioData.personal.name.toUpperCase()} {"//"} ENGINEERING ENVIRONMENT v2.4
          </p>
          <p>Type <span className="text-accent">help</span> to view available directives, or <span className="text-accent">neofetch</span> for system information.</p>
        </div>
      ),
    },
  ]);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCommand = (cmdStr: string) => {
    const clean = cmdStr.trim().toLowerCase();
    let res: React.ReactNode = null;

    switch (clean) {
      case "help":
        res = (
          <div className="space-y-1 text-xs text-primary-muted">
            <p className="text-accent font-semibold">AVAILABLE COMMANDS:</p>
            <p><span className="text-primary font-mono w-24 inline-block">projects</span> → Jump to featured projects</p>
            <p><span className="text-primary font-mono w-24 inline-block">skills</span> → Jump to technical expertise</p>
            <p><span className="text-primary font-mono w-24 inline-block">work</span> → Jump to experience timeline</p>
            <p><span className="text-primary font-mono w-24 inline-block">contact</span> → Jump to contact section</p>
            <p><span className="text-primary font-mono w-24 inline-block">github</span> → Open GitHub profile</p>
            <p><span className="text-primary font-mono w-24 inline-block">linkedin</span> → Open LinkedIn profile</p>
            <p><span className="text-primary font-mono w-24 inline-block">twitter</span> → Open X / Twitter profile</p>
            <p><span className="text-primary font-mono w-24 inline-block">email</span> → Copy developer email</p>
            <p><span className="text-primary font-mono w-24 inline-block">theme</span> → Toggle light / dark mode</p>
            <p><span className="text-primary font-mono w-24 inline-block">neofetch</span> → Display developer identity &amp; specs</p>
            <p><span className="text-primary font-mono w-24 inline-block">resume</span> → Download resume PDF</p>
            <p><span className="text-primary font-mono w-24 inline-block">clear</span> → Clear terminal logs</p>
          </div>
        );
        break;

      case "clear":
        setHistory([]);
        setInput("");
        return;

      case "theme":
      case "dark":
      case "light":
        toggleTheme();
        res = <p className="text-accent">Toggled active portfolio theme.</p>;
        break;

      case "neofetch":
        res = (
          <div className="font-mono text-xs space-y-1 text-primary-muted pt-1">
            <p className="text-accent">
              {portfolioData.personal.name.toLowerCase()}@portfolio-core [IST: 2026]
            </p>
            <p>-------------------------</p>
            <p><span className="text-primary">OS:</span> Next.js 14 / TypeScript / Tailwind</p>
            <p><span className="text-primary">HOST:</span> {portfolioData.personal.name} ({portfolioData.personal.devId})</p>
            <p><span className="text-primary">ROLE:</span> {portfolioData.personal.role}</p>
            <p><span className="text-primary">LOCATION:</span> {portfolioData.personal.location}</p>
            <p><span className="text-primary">ACADEMICS:</span> {portfolioData.education.degree}</p>
            <p><span className="text-primary">SPECIALISM:</span> {portfolioData.education.specialization}</p>
            <p><span className="text-primary">PRIMARY STACK:</span> PyTorch, FastAPI, Next.js, LangChain, PostgreSQL</p>
          </div>
        );
        break;

      case "projects":
        document.querySelector("#work")?.scrollIntoView({ behavior: "smooth" });
        res = <p className="text-accent">Navigating to #work...</p>;
        setTimeout(onClose, 400);
        break;

      case "skills":
        document.querySelector("#skills")?.scrollIntoView({ behavior: "smooth" });
        res = <p className="text-accent">Navigating to #skills...</p>;
        setTimeout(onClose, 400);
        break;

      case "work":
      case "experience":
        document.querySelector("#experience")?.scrollIntoView({ behavior: "smooth" });
        res = <p className="text-accent">Navigating to #experience...</p>;
        setTimeout(onClose, 400);
        break;

      case "contact":
        document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
        res = <p className="text-accent">Navigating to #contact...</p>;
        setTimeout(onClose, 400);
        break;

      case "resume":
        res = <p className="text-accent">Downloading resume...</p>;
        const link = document.createElement("a");
        link.href = portfolioData.personal.resumeUrl;
        link.download = "Resume-Placeholder.pdf";
        link.click();
        break;

      case "github":
        window.open(portfolioData.personal.github, "_blank", "noopener,noreferrer");
        res = <p className="text-accent">Opening GitHub profile ({portfolioData.personal.github})...</p>;
        break;

      case "linkedin":
        window.open(portfolioData.personal.linkedin, "_blank", "noopener,noreferrer");
        res = <p className="text-accent">Opening LinkedIn profile ({portfolioData.personal.linkedin})...</p>;
        break;

      case "twitter":
      case "x":
        window.open(portfolioData.personal.twitter, "_blank", "noopener,noreferrer");
        res = <p className="text-accent">Opening X profile ({portfolioData.personal.twitter})...</p>;
        break;

      case "email":
        navigator.clipboard.writeText(portfolioData.personal.email);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        res = <p className="text-accent">Copied {portfolioData.personal.email} to clipboard.</p>;
        break;

      default:
        res = (
          <p className="text-red-400">
            command not found: {cmdStr}. Type <span className="text-accent">help</span> for directives.
          </p>
        );
        break;
    }

    setHistory((prev) => [...prev, { cmd: cmdStr, output: res }]);
    setInput("");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleCommand(input);
  };

  if (!isOpen) return null;

  return (
    <div
      id="command-palette-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette Terminal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-secondary border-b border-border/80">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
            <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
            <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
            <span className="font-mono text-xs text-primary-muted ml-2">
              terminal // command-palette (ESC to close)
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-primary-muted hover:text-primary hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Terminal Scroll Content */}
        <div ref={scrollRef} className="p-4 sm:p-6 font-mono text-xs overflow-y-auto flex-1 space-y-4">
          {history.map((item, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-2 text-primary font-bold">
                <span className="text-accent">user@portfolio:~$</span>
                <span>{item.cmd}</span>
              </div>
              <div className="pl-4 border-l border-border/60">{item.output}</div>
            </div>
          ))}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-4 py-2 border-t border-border/60 bg-surface-secondary/70 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-primary-subtle uppercase">Quick:</span>
          {["help", "projects", "skills", "theme", "neofetch", "resume", "contact"].map((q) => (
            <button
              key={q}
              onClick={() => handleCommand(q)}
              className="px-2 py-0.5 rounded bg-surface border border-border/60 hover:border-accent text-[11px] font-mono text-primary-muted hover:text-accent transition-colors"
            >
              ${q}
            </button>
          ))}
        </div>

        {/* Terminal Input Prompt */}
        <form onSubmit={handleFormSubmit} className="p-3 bg-surface border-t border-border flex items-center gap-2">
          <span className="font-mono text-accent text-xs pl-2">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command (e.g. projects, neofetch, theme, help)..."
            className="flex-1 bg-transparent font-mono text-xs text-primary placeholder:text-primary-subtle focus:outline-none"
          />
          <button
            type="submit"
            className="p-1.5 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background text-primary-muted transition-colors"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
