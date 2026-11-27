export interface Project {
  id: string;
  title: string;
  kicker: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  previewImage: string;
  previewAspect?: string;
  metrics: {
    label: string;
    value: string;
  }[];
  techStack: string[];
  githubUrl: string;
  liveDemoUrl: string;
  featured: boolean;
  highlights: string[];
}

export interface SkillCategory {
  id: string;
  number: string;
  name: string;
  description: string;
  skills: {
    name: string;
    level?: string;
    featured?: boolean;
    icon?: string;
  }[];
}

export interface ExperienceItem {
  id: string;
  role: string;
  organization: string;
  employmentType: string;
  period: string;
  location: string;
  description: string;
  achievements: string[];
  technologies: string[];
}

export interface EducationItem {
  degree: string;
  specialization: string;
  institution: string;
  location: string;
  period: string;
  grade: string;
  summary: string;
  coursework: string[];
}

export interface AchievementItem {
  id: string;
  title: string;
  issuer: string;
  date: string;
  category: "Hackathon" | "Certification" | "Open Source" | "Academic";
  description: string;
  credentialUrl?: string;
  badge?: string;
}

export interface IntroConfig {
  greeting: string;
  taglineLead: string;
  taglineAccent: string;
  descriptor: string;
  durationMs: number;
}

export interface ProfileImage {
  src: string;
  alt: string;
  title: string;
}

export interface SocialLinkItem {
  id: "github" | "linkedin" | "twitter" | "email";
  name: string;
  handle: string;
  url: string;
  isExternal: boolean;
}

export interface PhilosophyStage {
  word: string;
  subheading: string;
}

export const socialLinks = {
  github: "https://github.com/IamNitinShukla",
  linkedin: "https://www.linkedin.com/in/iamnitinshukla",
  twitter: "https://x.com/woonitin",
  email: "snitin.tech@gmail.com",
  emailUrl: "mailto:snitin.tech@gmail.com",
} as const;

export interface ParticlesConfig {
  desktopCount: number;
  tabletCount: number;
  mobileCount: number;
  minRadius: number;
  maxRadius: number;
  mouseRadius: number;
  maxSpeed: number;
}

export const portfolioData = {
  particles: {
    desktopCount: 220,
    tabletCount: 150,
    mobileCount: 80,
    minRadius: 1.1,
    maxRadius: 3.2,
    mouseRadius: 140,
    maxSpeed: 0.35,
  },
  intro: {
    greeting: "HELLO, I'M NITIN.",
    taglineLead: "I BUILD ",
    taglineAccent: "INTELLIGENT DIGITAL EXPERIENCES.",
    descriptor: "AI ENGINEER • FULL-STACK DEVELOPER",
    durationMs: 2800,
  },
  personal: {
    name: "Nitin Shukla",
    role: "Full-Stack Developer · AI Systems Engineer",
    title: "AI Specialist & Full-Stack Engineer",
    statusText: "AVAILABLE FOR 2025/2026 ROLES",
    statusAvailable: true,
    location: "Himachal, IN / Remote",
    origin: "Himachal, IN",
    timezone: "IST (UTC+5:30)",
    devId: "DEV // 2026",
    code: "# AR-8842",
    verified: true,
    headlineLead: "I build intelligent",
    headlineAccent: "web applications and AI systems",
    headlineEnd: "that actually ship.",
    shortBio:
      "Computer Science undergraduate specializing in Artificial Intelligence. Passionate about LLMs, agentic workflows, scalable backend architectures, and crafting tactile, cinematic user interfaces.",
    aboutBio1:
      "I am an engineer working at the intersection of full-stack engineering and Applied Artificial Intelligence. I combine disciplined systems thinking with high visual craft to build production tools that solve real problems.",
    aboutBio2:
      "From fine-tuning specialized LLMs and architecting low-latency Retrieval-Augmented Generation (RAG) pipelines to building resilient distributed backends and tactile interfaces, I believe software should be fast, dependable, and intuitive.",
    email: socialLinks.email,
    github: socialLinks.github,
    linkedin: socialLinks.linkedin,
    twitter: socialLinks.twitter,
    upiId: "guesswho@pingpay",
    upiUri: "upi://pay?pa=guesswho%40pingpay&pn=Nitin%20Shukla&cu=INR",
    calDotCom: "https://cal.com/nitinshukla/30min",
    resumeUrl: "/resume-placeholder.pdf",
    avatar: "/images/profile/nitin-01.jpg",
    profileImages: [
      {
        src: "/images/profile/nitin-01.jpg",
        alt: "Nitin Shukla — Lead photograph, Full-Stack Developer and AI Systems Engineer",
        title: "Portrait 01",
      },
      {
        src: "/images/profile/nitin-02.jpg",
        alt: "Nitin Shukla — Software engineering, AI systems architecture and algorithms",
        title: "Portrait 02",
      },
      {
        src: "/images/profile/nitin-03.jpg",
        alt: "Nitin Shukla — Creative developer and systems builder",
        title: "Portrait 03",
      },
      {
        src: "/images/profile/nitin-04.jpg",
        alt: "Nitin Shukla — Personal developer portfolio showcase",
        title: "Portrait 04",
      },
    ],
  },

  philosophy: {
    eyebrow: "PHILOSOPHY",
    title: "How I build.",
    stages: [
      { word: "SIMPLE", subheading: "Clarity over complexity." },
      { word: "FAST", subheading: "Respect every millisecond." },
      { word: "USEFUL", subheading: "Solve what actually matters." },
      { word: "CRAFTED", subheading: "Details make the difference." },
    ],
  },

  techMarquee: [
    "AWS",
    "Python",
    "TypeScript",
    "Next.js",
    "PyTorch",
    "LangChain",
    "FastAPI",
    "PostgreSQL",
    "Docker",
    "Tailwind CSS",
    "Framer Motion",
    "RAG",
    "MongoDB",
    "AI Agents",
    "Redis",
    "Vector DBs",
    "Kubernetes",
  ],

  skillCategories: [
    {
      id: "programming-languages",
      number: "01",
      name: "Programming Languages",
      description: "Core languages used for systems programming, data structures, and production services.",
      skills: [
        { name: "Python", level: "Advanced", featured: true },
        { name: "TypeScript", level: "Advanced", featured: true },
        { name: "JavaScript (ESNext)", level: "Advanced", featured: false },
        { name: "Go", level: "Intermediate", featured: true },
        { name: "C / C++", level: "Proficient", featured: false },
        { name: "SQL", level: "Advanced", featured: true },
        { name: "HTML5 / Modern CSS", level: "Advanced", featured: false },
      ],
    },
    {
      id: "ai-machine-learning",
      number: "02",
      name: "AI & Machine Learning",
      description: "Foundational machine learning, neural architectures, and computer vision workflows.",
      skills: [
        { name: "PyTorch", level: "Advanced", featured: true },
        { name: "TensorFlow / Keras", level: "Intermediate", featured: false },
        { name: "Scikit-Learn", level: "Advanced", featured: true },
        { name: "Hugging Face Transformers", level: "Advanced", featured: true },
        { name: "OpenCV", level: "Intermediate", featured: false },
        { name: "NumPy & Pandas", level: "Advanced", featured: true },
        { name: "Model Quantization & LoRA", level: "Proficient", featured: true },
      ],
    },
    {
      id: "generative-ai-llms",
      number: "03",
      name: "Generative AI & LLMs",
      description: "Autonomous agents, vector search, retrieval augmentation, and frontier model orchestration.",
      skills: [
        { name: "RAG Architectures", level: "Advanced", featured: true },
        { name: "LangChain / LangGraph", level: "Advanced", featured: true },
        { name: "LlamaIndex", level: "Proficient", featured: false },
        { name: "ChromaDB & Pinecone", level: "Advanced", featured: true },
        { name: "OpenAI / Claude API Tool-Calling", level: "Advanced", featured: true },
        { name: "Local LLMs (Ollama / vLLM)", level: "Proficient", featured: true },
        { name: "Semantic Search & Re-ranking", level: "Advanced", featured: false },
      ],
    },
    {
      id: "backend-development",
      number: "04",
      name: "Backend Development",
      description: "Resilient API design, asynchronous message processing, and microservice infrastructure.",
      skills: [
        { name: "FastAPI", level: "Advanced", featured: true },
        { name: "Node.js & Express", level: "Advanced", featured: true },
        { name: "RESTful API Design", level: "Advanced", featured: false },
        { name: "WebSockets & SSE", level: "Proficient", featured: true },
        { name: "Celery & Asynchronous Queues", level: "Intermediate", featured: false },
        { name: "JWT & OAuth2 Authentication", level: "Advanced", featured: false },
        { name: "Microservices Architecture", level: "Intermediate", featured: false },
      ],
    },
    {
      id: "frontend-development",
      number: "05",
      name: "Frontend Development",
      description: "Modern, reactive web interfaces engineered for performance, accessibility, and delight.",
      skills: [
        { name: "Next.js App Router", level: "Advanced", featured: true },
        { name: "React 18 / 19", level: "Advanced", featured: true },
        { name: "Tailwind CSS", level: "Advanced", featured: true },
        { name: "Framer Motion", level: "Advanced", featured: true },
        { name: "GSAP / ScrollTrigger", level: "Proficient", featured: true },
        { name: "State Management (Zustand/Context)", level: "Advanced", featured: false },
        { name: "Responsive & Accessible UI", level: "Advanced", featured: false },
      ],
    },
    {
      id: "databases-cloud",
      number: "06",
      name: "Databases & Cloud",
      description: "Relational, document, caching, and modern containerized cloud deployments.",
      skills: [
        { name: "PostgreSQL & pgvector", level: "Advanced", featured: true },
        { name: "MongoDB", level: "Proficient", featured: false },
        { name: "Redis (Cache & PubSub)", level: "Proficient", featured: true },
        { name: "Docker & Containerization", level: "Proficient", featured: true },
        { name: "AWS (S3, EC2, Lambda)", level: "Intermediate", featured: false },
        { name: "Supabase & Firebase", level: "Advanced", featured: true },
        { name: "Vercel Edge & Cloudflare", level: "Advanced", featured: false },
      ],
    },
    {
      id: "development-tools",
      number: "07",
      name: "Development Tools",
      description: "Developer workflows, testing suites, version control, and observability tools.",
      skills: [
        { name: "Git & GitHub Workflows", level: "Advanced", featured: true },
        { name: "Linux / Bash Shell", level: "Proficient", featured: false },
        { name: "Postman & API Testing", level: "Advanced", featured: false },
        { name: "VS Code & Antigravity IDE", level: "Advanced", featured: false },
        { name: "GitHub Actions CI/CD", level: "Proficient", featured: true },
        { name: "PyTest & Vitest", level: "Intermediate", featured: false },
      ],
    },
  ],

  projects: [
    {
      id: "lexgenai",
      title: "LexGenAI",
      kicker: "Generative AI · Legal Intelligence & RAG",
      category: "AI & Legal Tech",
      shortDescription:
        "Enterprise-grade legal intelligence and automated document analysis system utilizing multi-stage RAG, statutory clause extraction, and verifiable legal citation referencing.",
      fullDescription:
        "LexGenAI addresses the high error rates in generative legal research through an audited multi-step retrieval pipeline. It combines hybrid dense-sparse vector search across statutory corpora with custom prompt chains for contract risk analysis, clause redlining, and compliance verification.",
      previewImage: "/images/projects/lexgenai.svg",
      previewAspect: "aspect-video",
      metrics: [
        { label: "CITATION ACCURACY", value: "98.4%" },
        { label: "QUERY LATENCY", value: "< 750ms" },
        { label: "INDEX CAPACITY", value: "50k+ Statutes" },
      ],
      techStack: ["Next.js", "FastAPI", "LangChain", "PostgreSQL (pgvector)", "OpenAI", "Tailwind CSS"],
      githubUrl: "https://github.com/IamNitinShukla/lexgenai",
      liveDemoUrl: "https://lexgenai-demo.placeholder.app",
      featured: true,
      highlights: [
        "Multi-stage retrieval pipeline with contextual compression and semantic re-ranking",
        "Deterministic statutory clause citation verification against supreme court precedent",
        "Interactive side-by-side contract diff viewer with risk category tagging",
      ],
    },
    {
      id: "krishi-setu",
      title: "Krishi-Setu",
      kicker: "AgriTech · Multimodal Vision & Voice AI",
      category: "Full Stack AI Platform",
      shortDescription:
        "AI-powered agricultural knowledge bridge connecting farmers with localized crop pathology diagnosis, multilingual voice assistance, and fair transparent mandi pricing.",
      fullDescription:
        "Krishi-Setu translates advanced vision models into high-impact rural utility. Farmers can capture leaf imagery directly through mobile browsers for instant disease classification, query localized agronomy guidelines through audio in regional dialects, and access fair market trends.",
      previewImage: "/images/projects/krishisetu.svg",
      previewAspect: "aspect-video",
      metrics: [
        { label: "MODEL F1 SCORE", value: "0.942" },
        { label: "DIALECTS SUPPORTED", value: "8 Regional" },
        { label: "OFFLINE CAPABILITY", value: "Edge PWA" },
      ],
      techStack: ["React Native / Next.js", "PyTorch", "FastAPI", "Hugging Face", "MongoDB", "Whisper AI"],
      githubUrl: "https://github.com/IamNitinShukla/krishi-setu",
      liveDemoUrl: "https://krishi-setu.placeholder.app",
      featured: true,
      highlights: [
        "Mobile-optimized convolutional neural network for real-time leaf disease segmentation",
        "Voice-first conversational assistant supporting dialect normalization via Whisper",
        "Aggregated localized crop yield analytics and transparent price discovery feeds",
      ],
    },
    {
      id: "ai-video-generator",
      title: "AI Video Generator",
      kicker: "Multimodal Synthesis · Autonomous Pipeline",
      category: "Generative Media & Systems",
      shortDescription:
        "Autonomous multimodal video synthesis pipeline that converts textual scripts into cohesive, animated multimedia video assets with automated voice synthesis and typography overlay.",
      fullDescription:
        "An end-to-end media automation engine. Users supply raw topics or outlines, and the pipeline orchestrates LLM script generation, scene storyboard planning, dynamic generative image asset production, speech synthesis synchronization, and programmatic video rendering via FFmpeg.",
      previewImage: "/images/projects/aivideo.svg",
      previewAspect: "aspect-video",
      metrics: [
        { label: "RENDER TIME", value: "1.8x Realtime" },
        { label: "EXPORT RESOLUTION", value: "1080p 60fps" },
        { label: "AUDIO SYNC DRIFT", value: "< 15ms" },
      ],
      techStack: ["Python", "FastAPI", "MoviePy / FFmpeg", "ElevenLabs API", "Stable Diffusion", "Next.js"],
      githubUrl: "https://github.com/IamNitinShukla/ai-video-generator",
      liveDemoUrl: "https://ai-video-gen.placeholder.app",
      featured: true,
      highlights: [
        "Programmatic timeline scheduling with automated kinetic typography overlay",
        "Dynamic audio alignment calculating syllable duration against word timestamps",
        "Worker pool queue architecture processing background render tasks asynchronously",
      ],
    },
    {
      id: "rookdb",
      title: "RookDB (Systems Project)",
      kicker: "Systems Architecture · Key-Value Engine",
      category: "Systems & Storage",
      shortDescription:
        "High-throughput embedded LSM-tree key-value storage engine engineered from scratch in Go, featuring write-ahead logging (WAL), SSTable compaction, and memory-mapped reads.",
      fullDescription:
        "An exploration into fundamental database internals. Designed with append-only write-ahead logging for durability, skip-list memtable in memory, bloom filters for negative read optimization, and background multi-level compaction.",
      previewImage: "/images/projects/rookdb.svg",
      previewAspect: "aspect-video",
      metrics: [
        { label: "WRITE THROUGHPUT", value: "85k ops/sec" },
        { label: "BLOOM FALSE-POS", value: "< 1.2%" },
        { label: "COMPACT OVERHEAD", value: "Minimal" },
      ],
      techStack: ["Go", "Concurrency", "LSM-Tree", "Memory Mapping", "Linux Benchmarking"],
      githubUrl: "https://github.com/IamNitinShukla/rookdb",
      liveDemoUrl: "https://github.com/IamNitinShukla/rookdb",
      featured: false,
      highlights: [
        "Lock-free memtable read path with atomic pointer transitions",
        "Custom binary encoding format minimizing disk footprint and serialization latency",
        "Benchmark suite comparing throughput characteristics against LevelDB under random write loads",
      ],
    },
  ],

  experience: [
    {
      id: "exp-1",
      role: "AI & Full-Stack Engineering Intern",
      organization: "Tech Innovators Lab (Placeholder)",
      employmentType: "Internship",
      period: "May 2025 – Aug 2025 (Placeholder)",
      location: "Bengaluru, IN (Hybrid)",
      description:
        "Engineered autonomous AI agents and developed high-performance full-stack web applications for enterprise analytics.",
      achievements: [
        "Designed and implemented a low-latency RAG pipeline that indexed 100k+ customer support interactions, reducing average resolution latency by 34%.",
        "Architected scalable REST and WebSocket endpoints in FastAPI and Node.js with automated test coverage.",
        "Refactored front-end client dashboards using Next.js App Router and Zustand, optimizing Core Web Vitals to 95+ score.",
      ],
      technologies: ["Next.js", "TypeScript", "FastAPI", "PyTorch", "PostgreSQL", "Docker", "Tailwind CSS"],
    },
    {
      id: "exp-2",
      role: "Undergraduate AI Research Assistant",
      organization: "Campus AI Research Laboratory (Placeholder)",
      employmentType: "Academic Research",
      period: "Jan 2025 – Present (Placeholder)",
      location: "On-Campus",
      description:
        "Investigated parameter-efficient fine-tuning (PEFT/LoRA) techniques on domain-specific transformer models.",
      achievements: [
        "Conducted empirical evaluations on quantized LLMs (4-bit/8-bit) for low-resource Indian languages.",
        "Published technical benchmarking reports and co-authored departmental whitepaper on small language model reasoning capabilities.",
        "Created an interactive live demo testbed using Streamlit and React for peer evaluation.",
      ],
      technologies: ["Python", "PyTorch", "Hugging Face", "LoRA/PEFT", "Transformers", "Linux"],
    },
    {
      id: "exp-3",
      role: "Open Source Contributor & Technical Lead",
      organization: "Developer Student Club / AI Collective (Placeholder)",
      employmentType: "Leadership / Volunteer",
      period: "Aug 2024 – Present (Placeholder)",
      location: "Campus & Remote",
      description:
        "Led a cohort of 60+ engineering students through hands-on full-stack development, modern Git workflows, and LLM engineering.",
      achievements: [
        "Conducted 10+ end-to-end technical workshops on building with Next.js, FastAPI, and vector databases.",
        "Organized 36-hour internal hackathon and mentored 12 student teams from ideation to production deployment.",
      ],
      technologies: ["Next.js", "Python", "Git", "Community Mentorship", "System Architecture"],
    },
  ],

  education: {
    degree: "B.Tech in Computer Science and Engineering",
    specialization: "Specialization: Artificial Intelligence",
    institution: "National Institute of Technology (Placeholder Institution)",
    location: "India",
    period: "2023 – 2027 (Expected)",
    grade: "CGPA: 8.9 / 10.0 (Placeholder)",
    summary:
      "Rigorous undergraduate curriculum with focused coursework in machine learning, algorithms, neural computing, and scalable software systems.",
    coursework: [
      "Deep Learning & Neural Networks",
      "Natural Language Processing",
      "Design & Analysis of Algorithms",
      "Data Structures & OOP in C++",
      "Operating Systems & Concurrency",
      "Database Management Systems",
      "Computer Networks & Protocols",
      "Probability & Linear Algebra for AI",
    ],
  },

  achievements: [
    {
      id: "ach-1",
      title: "1st Place Winner — National GenAI Hackathon 2025",
      issuer: "Apex Tech Forum (Placeholder)",
      date: "February 2025",
      category: "Hackathon",
      description:
        "Won 1st place among 150+ teams by engineering an autonomous multimodal clinical triage assistant with local offline vision inference.",
      badge: "Winner 🏆",
    },
    {
      id: "ach-2",
      title: "Deep Learning Specialization",
      issuer: "DeepLearning.AI (Coursera)",
      date: "December 2024",
      category: "Certification",
      description:
        "5-course series covering convolutional networks, sequence models, transformer architectures, hyperparameter tuning, and structuring ML projects.",
      badge: "Certified ✓",
    },
    {
      id: "ach-3",
      title: "Top 5 Finalist — Smart India Hackathon (SIH)",
      issuer: "Ministry of Education (Placeholder)",
      date: "November 2024",
      category: "Hackathon",
      description:
        "Developed Krishi-Setu prototype for agricultural supply chain visibility and multilingual farmer assistance under rural tech initiative.",
      badge: "Finalist 🏅",
    },
    {
      id: "ach-4",
      title: "Active Open-Source Contributor",
      issuer: "GitHub Community",
      date: "Ongoing",
      category: "Open Source",
      description:
        "Merged contributions to popular open-source AI tooling, prompt optimization libraries, and documentation repos with 500+ community stars.",
      badge: "500+ Stars ⭐",
    },
  ],

  socialLinks: [
    { id: "github", name: "GitHub", url: socialLinks.github, handle: "@IamNitinShukla", isExternal: true },
    { id: "linkedin", name: "LinkedIn", url: socialLinks.linkedin, handle: "in/iamnitinshukla", isExternal: true },
    { id: "twitter", name: "X (Twitter)", url: socialLinks.twitter, handle: "@woonitin", isExternal: true },
    { id: "email", name: "Email", url: socialLinks.emailUrl, handle: "snitin.tech@gmail.com", isExternal: false },
  ] as SocialLinkItem[],
};
