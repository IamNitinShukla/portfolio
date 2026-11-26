# Premium Personal Developer Portfolio

A production-quality, dark, minimal, cinematic personal portfolio designed for a **Computer Science undergraduate specializing in Artificial Intelligence & Full-Stack Systems Engineering**. Inspired by the high-craft visual storytelling, interactive mechanics, and aesthetic of **Yogender.me** and **AryanTech.app**.

---

## ✦ Key Features

- **Design System**: Dark aesthetic (`#0A0A0A` background, `#141414` charcoal surfaces, `#F5F3EE` warm white editorial typography, subtle `#E8FF70` warm accent yellow, and subtle dark gray borders).
- **Hero & Digital Developer ID Badge**:
  - Live availability indicator (`AVAILABLE FOR 2025/2026 ROLES`).
  - Large editorial typography with warm yellow accent highlighting.
  - Interactive digital developer ID card with verified status badge, avatar visual, barcode graphic, and live real-time clock.
  - Dual CTAs (*Explore My Work* & *Let's Connect*).
- **Creative Visual Storytelling ("How I build.")**:
  - Stylized robotic/human synergy visual composition inspired by the reference recording.
  - 4 Core Architectural Directives: `Simple.`, `Fast.`, `Useful.`, `Crafted.` with interactive hover cards.
- **Infinite Technology Marquee**:
  - Hardware-accelerated infinite scrolling band of core production tools and frameworks.
- **About Me**:
  - Academic background, engineering philosophy, technical interest areas, and developer environment specs card.
- **Core Technical Expertise (7 Categorized Domains)**:
  1. Programming Languages
  2. AI & Machine Learning
  3. Generative AI & LLMs
  4. Backend Development
  5. Frontend Development
  6. Databases & Cloud
  7. Development Tools
  - Category filtering tabs and interactive badges.
- **Featured Builds & Case Studies**:
  - Interactive project carousel with thumbnail navigation, slide indicators, and auto-flow toggle.
  - Initial realistic placeholders for:
    1. **LexGenAI** (Generative AI legal intelligence & statutory RAG engine).
    2. **Krishi-Setu** (Multimodal agricultural vision diagnosis & dialect-normalized assistant).
    3. **AI Video Generator** (Autonomous multimodal video & typography synthesis pipeline).
    4. **RookDB** (High-throughput LSM-tree embedded key-value storage engine).
  - Working source code repository links, live demo buttons, and architecture deep dive modal.
- **Experience Timeline**:
  - Elegant vertical timeline with glowing connector line, role, organization, employment type, dates, responsibilities, and tech tags.
- **Education Section**:
  - B.Tech in Computer Science, Specialization: Artificial Intelligence.
  - Coursework pills, GPA badge, institute placeholder.
- **Achievements & Certifications**:
  - Competitive hackathons, professional credentials, and open-source contributions.
- **Contact & Collaboration**:
  - Working inquiry form with full client-side validation, loading state, and confetti celebration on submission.
  - Direct mailto client alternative.
  - 30-minute sync scheduler modal (Cal.com / Google Meet integration).
- **Interactive Command Palette / Quick Terminal (`⌘K` / `Ctrl+K`)**:
  - Terminal-style command runner (`help`, `projects`, `skills`, `work`, `neofetch`, `resume`, `email`, `clear`).
- **Smooth Lenis Scrolling**:
  - Inertia-free scrolling with strict compliance for `prefers-reduced-motion`.

---

## ✦ Centralized Content Configuration

**You do not need to hunt through components to customize your portfolio.**  
All personal details, project data, education, experience, skills, and links are centralized in:

📁 [`src/data/portfolioData.ts`](file:///c:/Users/WorkSpace/Desktop/WorkSpace/Portfolio/src/data/portfolioData.ts)

### Editable Sections in `portfolioData.ts`:
- `personal`: Name, role, headlines, bio, email, social links, location, dev ID code, and resume URL.
- `philosophy`: Core quote, pillars, and descriptions.
- `techMarquee`: Badges displayed in the infinite scroll band.
- `skillCategories`: All 7 technical skill categories and individual tools.
- `projects`: Title, category, metrics, description, GitHub URL, and live demo link.
- `experience`: Roles, companies, dates, achievements, and tech pills.
- `education`: Degree, specialization, institute name, GPA, coursework list.
- `achievements`: Hackathon prizes, certificates, and milestones.

---

## ✦ Getting Started

### Prerequisites
- Node.js LTS (v18+ or v20+)
- npm or pnpm

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build & Test
```bash
npm run build
npm run start
```

### 4. Code Quality & Linting
```bash
npm run lint
```

---

## ✦ Gemini-Powered AI Portfolio Assistant

The portfolio includes an intelligent conversational AI assistant representing Nitin Shukla, powered by Google's **Gemini Flash** models with live token streaming and strict factual grounding in `portfolioData.ts`.

### Setup & Environment Variables
Copy `.env.example` to `.env.local` and add your Gemini API key:

```bash
cp .env.example .env.local
```

Configure your environment in `.env.local`:
```bash
# Required: Free API Key from Google AI Studio (https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Model identifier (Default: gemini-3.8-flash, with automatic fallback)
GEMINI_MODEL=gemini-3.8-flash

# Optional: Server-side sliding-window rate limit per IP/minute (Default: 25)
GEMINI_RATE_LIMIT_RPM=25
```

### Architecture & Security
- **Server-Side API**: Communication runs securely through Next.js Route Handler `src/app/api/chat/route.ts`. The API key is never exposed to the client or browser bundles.
- **In-Context Grounding**: The assistant grounds every answer strictly in `portfolioData.ts` and politely acknowledges when information is unlisted rather than hallucinating.
- **Automatic Fallback**: If offline or if the upstream API is unavailable, the assistant seamlessly falls back to local grounded records.
- **Streaming & Cancellation**: Real-time token streaming with client abort control (`AbortController`).

---

## ✦ Connecting Live Backend Integrations

1. **Contact Form**:
   - The form in [`src/components/Contact.tsx`](file:///c:/Users/WorkSpace/Desktop/WorkSpace/Portfolio/src/components/Contact.tsx) performs client-side validation and dispatches with a loading spinner and celebratory confetti.
   - To connect to a live backend endpoint, replace the simulated delay in `handleSubmit` with your endpoint (e.g., [Formspree](https://formspree.io), [Resend](https://resend.com), [Web3Forms](https://web3forms.com), or a Next.js API route `/api/contact`).
2. **Meeting Booking (Cal.com / Calendly)**:
   - Update `calDotCom` in `portfolioData.ts` to your personal Cal.com link (e.g., `https://cal.com/your-username/30min`).
3. **Resume Download**:
   - Replace [`public/resume-placeholder.pdf`](file:///c:/Users/WorkSpace/Desktop/WorkSpace/Portfolio/public/resume-placeholder.pdf) with your actual PDF resume.

---

## ✦ Project Structure

```
Portfolio/
├── public/
│   ├── favicon.ico
│   ├── resume-placeholder.pdf
│   └── images/
│       ├── creative-hands.svg       # "How I build" visual composition
│       ├── profile-placeholder.svg  # ID badge profile portrait
│       └── projects/
│           ├── lexgenai.svg         # LexGenAI interface mockup
│           ├── krishisetu.svg       # Krishi-Setu interface mockup
│           ├── aivideo.svg          # AI Video Generator mockup
│           └── rookdb.svg           # RookDB LSM storage engine mockup
├── src/
│   ├── app/
│   │   ├── globals.css              # Dark theme, grids, selection, animations
│   │   ├── layout.tsx               # Root layout, metadata, font configuration
│   │   └── page.tsx                 # Main single-page scroll layout
│   ├── components/
│   │   ├── Navigation.tsx           # Floating pill nav + mobile drawer + ⌘K trigger
│   │   ├── Hero.tsx                 # Headline, CTAs, Digital ID Badge Card
│   │   ├── TechMarquee.tsx          # Infinite marquee technology band
│   │   ├── Storytelling.tsx         # "How I build." visual narrative & 4 pillars
│   │   ├── About.tsx                # Academic specialism, personal story & specs
│   │   ├── Skills.tsx               # 7 Categorized skill domains + filter tabs
│   │   ├── FeaturedProjects.tsx     # Project carousel, specs, deep dive modal
│   │   ├── ExperienceTimeline.tsx   # Vertical career track record timeline
│   │   ├── Education.tsx            # B.Tech AI degree, coursework, academic highlights
│   │   ├── Achievements.tsx         # Hackathons, certifications, open-source
│   │   ├── Contact.tsx              # Validated form, confetti, Cal.com scheduler
│   │   ├── Footer.tsx               # Dynamic copyright, quick links, back to top
│   │   ├── CommandPalette.tsx       # Quick terminal interactive environment (⌘K)
│   │   └── SmoothScroll.tsx         # Lenis smooth scroll engine
│   ├── data/
│   │   └── portfolioData.ts         # Centralized configuration for all content
│   └── lib/
│       └── utils.ts                 # Tailwind merge & clsx utilities
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── .eslintrc.json
└── package.json
```
