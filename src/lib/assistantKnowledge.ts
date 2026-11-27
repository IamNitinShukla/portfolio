import { portfolioData, socialLinks } from "@/data/portfolioData";
import type { WebSearchResult } from "@/lib/webSearch";

/**
 * Generates dynamic system instructions for Friday with live temporal context,
 * verified portfolio data, and optional real-time web search results.
 */
export function getSystemInstruction(options?: {
  currentDate?: Date;
  webSearchResults?: WebSearchResult[];
  isPortfolioQuery?: boolean;
}): string {
  const now = options?.currentDate || new Date();
  const dateFormatted = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeFormatted = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  let prompt = `You are Friday, a helpful, intelligent, general-purpose AI assistant created for Nitin Shukla (referred to respectfully as "Nitin Sir").
You are represented visually in this web interface by a sleek, custom red robot mascot.

=======================================================
IDENTITY & CORE INSTRUCTIONS
=======================================================
1. YOUR NAME & NATURE:
   - Your name is Friday.
   - You are a genuine general-purpose AI assistant capable of answering general knowledge questions, writing code, solving mathematical problems, explaining scientific/engineering concepts, and having natural conversations.
   - You are NOT a restricted portfolio-only bot. Answer general knowledge questions independently, thoroughly, and naturally.
   - Do NOT unnecessarily mention Nitin Sir, his portfolio, website, or resume when answering general knowledge, coding, or science questions (e.g., questions about machine learning, binary search, quantum computing, or photosynthesis have nothing to do with the portfolio).
   - When asked "Who are you?", "What is your name?", or to introduce yourself, state:
     "Hello! I'm Friday, Nitin Sir's personal AI assistant. I can help you explore his projects, technical skills, experience, and answer general questions."

2. HOW TO ADDRESS NITIN SHUKLA:
   - When conversationally speaking about or referring to your owner/creator, ALWAYS call him "Nitin Sir" (e.g., "Nitin Sir built LexGenAI", "Nitin Sir specializes in applied AI and Full-Stack Engineering", "Nitin Sir's full name is Nitin Shukla").
   - His legal and professional name is Nitin Shukla.

3. TEMPORAL & LIVE CONTEXT (ALWAYS CURRENT):
   - Current Date: ${dateFormatted}
   - Current Time: ${timeFormatted}
   - When asked what day or date it is (e.g. "What day is today?", "What is today's date?"), answer directly, immediately, and accurately using this temporal context.

4. BALANCED KNOWLEDGE BOUNDARIES:
   - GENERAL KNOWLEDGE: Answer fully using your comprehensive knowledge. Explain complex topics simply, write clean idiomatic code, and provide accurate answers without any portfolio disclaimers.
   - PORTFOLIO KNOWLEDGE: When asked about Nitin Sir (his background, skills, projects, contact info, experience), use the verified portfolio data below as the authoritative source of truth. Never invent Nitin Sir's qualifications, projects, or personal information.
   - MISSING PERSONAL INFO: If asked about Nitin Sir's private personal details that are not in the portfolio (e.g. private phone number, home address), state clearly that it is not publicly published and provide his contact email (${portfolioData.personal.email}) or LinkedIn.
   - DO NOT CONFUSE MISSING PORTFOLIO DATA WITH MISSING GENERAL KNOWLEDGE: If asked "What is quantum computing?" or "What is machine learning?", that is a general knowledge question. Answer it directly and accurately!

=======================================================
NITIN SHUKLA — AUTHORITATIVE PROFILE DATA
(Reference when questions specifically pertain to Nitin Sir)
=======================================================
Full Name: ${portfolioData.personal.name}
Role: ${portfolioData.personal.role}
Title: ${portfolioData.personal.title}
Location: ${portfolioData.personal.location}
Origin: ${portfolioData.personal.origin}
Timezone: ${portfolioData.personal.timezone}
Status: ${portfolioData.personal.statusText} (Actively available for 2025/2026 roles)
Bio: ${portfolioData.personal.shortBio}
Summary: ${portfolioData.personal.aboutBio1} ${portfolioData.personal.aboutBio2}

Contact & Profiles:
- Email: ${portfolioData.personal.email}
- GitHub: ${socialLinks.github} (@IamNitinShukla)
- LinkedIn: ${socialLinks.linkedin}
- Twitter/X: ${socialLinks.twitter} (@woonitin)
- Public UPI ID: ${portfolioData.personal.upiId} (URI: ${portfolioData.personal.upiUri})
- Resume: ${portfolioData.personal.resumeUrl}

Engineering Philosophy:
01 — SIMPLE.
02 — FAST.
03 — USEFUL.
04 — CRAFTED.

Core Skills & Technologies:
Tech Marquee: ${portfolioData.techMarquee.join(", ")}
${portfolioData.skillCategories
  .map(
    cat =>
      `• ${cat.name}: ` +
      cat.skills.map(s => `${s.name} [${s.level || "Proficient"}]`).join(", ")
  )
  .join("\n")}

Featured Projects & Systems:
${portfolioData.projects
  .map(
    p => `Project: ${p.title} (${p.category})
Kicker: ${p.kicker}
Short Description: ${p.shortDescription}
Architecture: ${p.fullDescription}
Tech Stack: ${p.techStack.join(", ")}
Metrics: ${p.metrics.map(m => `${m.label}: ${m.value}`).join(" | ")}
Highlights:
${p.highlights.map(h => `  - ${h}`).join("\n")}
Links: GitHub (${p.githubUrl}) | Demo (${p.liveDemoUrl})`
  )
  .join("\n\n")}

Experience:
${portfolioData.experience
  .map(
    exp => `Role: ${exp.role} at ${exp.organization} (${exp.period}, ${exp.location})
Description: ${exp.description}
Tech: ${exp.technologies.join(", ")}`
  )
  .join("\n\n")}

Education:
${portfolioData.education.degree} in ${portfolioData.education.specialization}
Institution: ${portfolioData.education.institution} (${portfolioData.education.period})
Grade: ${portfolioData.education.grade}
Coursework: ${portfolioData.education.coursework.join(", ")}

Achievements:
${portfolioData.achievements.map(ach => `• ${ach.title} (${ach.issuer}, ${ach.date}): ${ach.description}`).join("\n")}
`;

  if (options?.webSearchResults && options.webSearchResults.length > 0) {
    prompt += `\n=======================================================
REAL-TIME WEB SEARCH RESULTS (GROUNDING SOURCES)
=======================================================
The following live web search results were retrieved for this query. Synthesize your answer accurately using these facts. Include markdown source links [Source Title](URL) where relevant:
${options.webSearchResults
  .map(
    (s, i) =>
      `[Source ${i + 1}] Title: ${s.title}\nURL: ${s.url}\nSummary: ${s.snippet}`
  )
  .join("\n\n")}
`;
  }

  return prompt;
}

/** Default static system instruction export */
export const PORTFOLIO_SYSTEM_INSTRUCTION = getSystemInstruction();

/**
 * Safe local fallback response generator for offline mode or API unavailability.
 * Handles portfolio, date/time, CS concepts, and general offline queries gracefully.
 */
export function generateLocalFallback(query: string): string {
  const q = query.toLowerCase().trim();

  // Date and Time queries
  if (
    /\b(what day|what is today'?s? date|what is the date|what time|current time|today'?s? date|what day is it)\b/i.test(
      q
    )
  ) {
    const now = new Date();
    return `Today is **${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}**. (Server Time: ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })})`;
  }

  // Assistant introduction / identity
  if (
    /\b(who are you|your name|what is your name|who made you|who are u|introduce yourself)\b/i.test(
      q
    )
  ) {
    return `Hello! I'm Friday, Nitin Sir's personal AI assistant. I can help you explore his projects, technical skills, experience, and answer general questions.`;
  }

  // Full name
  if (/\b(full name|real name|his name)\b/i.test(q) && !q.includes("project")) {
    return `Nitin Sir's full name is **${portfolioData.personal.name}**.`;
  }

  // Technical specialization / focus
  if (/\b(specializ\w*|domain|focus|what does he do)\b/i.test(q)) {
    return (
      `Nitin Sir specializes as a **${portfolioData.personal.role}** with an undergraduate specialization in ` +
      `**${portfolioData.education.specialization}**. His engineering focus centers on applied AI systems, ` +
      `low-latency microservices, RAG architectures, and responsive full-stack applications in Next.js and FastAPI.`
    );
  }

  // Specific project: LexGenAI
  if (/\b(lexgenai|legal tech|legal intelligence)\b/i.test(q)) {
    const p = portfolioData.projects.find(x => x.id === "lexgenai");
    if (p) {
      return (
        `**${p.title}** (${p.category}): ${p.fullDescription}\n\n` +
        `• **Tech Stack:** ${p.techStack.join(", ")}\n` +
        `• **Key Metrics:** ${p.metrics.map(m => `${m.label}: ${m.value}`).join(" | ")}`
      );
    }
  }

  // Specific project: Krishi-Setu
  if (/\b(krishi|agri|crop disease|farmer)\b/i.test(q)) {
    const p = portfolioData.projects.find(x => x.id === "krishi-setu");
    if (p) {
      return (
        `**${p.title}** (${p.category}): ${p.fullDescription}\n\n` +
        `• **Tech Stack:** ${p.techStack.join(", ")}\n` +
        `• **Key Metrics:** ${p.metrics.map(m => `${m.label}: ${m.value}`).join(" | ")}`
      );
    }
  }

  // Specific project: RookDB
  if (/\b(rookdb|storage engine|lsm|key-value)\b/i.test(q)) {
    const p = portfolioData.projects.find(x => x.id === "rookdb");
    if (p) {
      return (
        `**${p.title}** (${p.category}): ${p.fullDescription}\n\n` +
        `• **Tech Stack:** ${p.techStack.join(", ")}\n` +
        `• **Key Metrics:** ${p.metrics.map(m => `${m.label}: ${m.value}`).join(" | ")}`
      );
    }
  }

  // Specific project: AI Video Generator
  if (/\b(video generator|ai video|multimodal synthesis)\b/i.test(q)) {
    const p = portfolioData.projects.find(x => x.id === "ai-video-generator");
    if (p) {
      return (
        `**${p.title}** (${p.category}): ${p.fullDescription}\n\n` +
        `• **Tech Stack:** ${p.techStack.join(", ")}\n` +
        `• **Key Metrics:** ${p.metrics.map(m => `${m.label}: ${m.value}`).join(" | ")}`
      );
    }
  }

  // General projects inquiry
  if (/\b(projects?|what has he built|case studies)\b/i.test(q) && (q.includes("nitin") || q.includes("he "))) {
    const list = portfolioData.projects
      .map(p => `• **${p.title}** (${p.category}): ${p.shortDescription}`)
      .join("\n");
    return `Here are Nitin Sir's featured engineering projects:\n\n${list}\n\nYou can explore deep-dive case studies for each in the Projects section.`;
  }

  // Tech stack / languages
  if (
    /\b(tech\w*|stack|skills?)\b/i.test(q) &&
    (q.includes("nitin") || q.includes("he ") || q.includes("his"))
  ) {
    return (
      `Nitin Sir's core stack includes ` +
      `${portfolioData.techMarquee.slice(0, 10).join(", ")}. ` +
      `He has advanced proficiency in Python, TypeScript, PyTorch, LangChain, FastAPI, Next.js, and PostgreSQL.`
    );
  }

  // UPI ID / Payment
  if (/\b(upi|payment|pay|qr|donate|upi id)\b/i.test(q)) {
    return (
      `Nitin Sir's public UPI ID is **${portfolioData.personal.upiId}** (${portfolioData.personal.upiUri}), ` +
      `as featured on his profile card QR code.`
    );
  }

  // Phone number / private contact
  if (/\b(phone|mobile|call|whatsapp|telephone|contact number|cell)\b/i.test(q)) {
    return (
      `Nitin Sir has not published a public phone number in his portfolio. ` +
      `You can reach him directly via email at **${portfolioData.personal.email}** or connect on LinkedIn at ${socialLinks.linkedin}.`
    );
  }

  // Common General Knowledge Fallbacks (when Gemini API is offline)
  if (/\b(machine learning|what is ml)\b/i.test(q)) {
    return `**Machine Learning (ML)** is a branch of artificial intelligence focused on building algorithms that learn patterns from data and make predictions or decisions without being explicitly hardcoded for every scenario. Core paradigms include supervised learning, unsupervised learning, and reinforcement learning.`;
  }

  if (/\b(quantum computing)\b/i.test(q)) {
    return `**Quantum Computing** is a computational paradigm that leverages quantum mechanical phenomena—such as superposition and entanglement—to perform complex operations exponentially faster than classical computers for specific problem classes like cryptography, quantum simulation, and optimization.`;
  }

  if (/\b(reverse a string|reverse string)\b/i.test(q) && /python/i.test(q)) {
    return `Here is a Python function to reverse a string using slicing:\n\n\`\`\`python\ndef reverse_string(text: str) -> str:\n    return text[::-1]\n\n# Example\nprint(reverse_string("hello"))  # "olleh"\n\`\`\``;
  }

  // General offline notice (NEVER says "not mentioned in portfolio" for general topics)
  return `I am currently in offline mode and could not connect to the live AI service for that response. When connected online, I can answer general knowledge questions, write code, explore AI concepts, or discuss Nitin Sir's projects.`;
}
